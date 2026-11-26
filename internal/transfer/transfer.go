package transfer

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/connection"
	"github.com/FahadKhan356/Droply/internal/device"
	"github.com/FahadKhan356/Droply/internal/pairing"
	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/internal/security"
	"github.com/FahadKhan356/Droply/internal/storage"
)

// Record tracks the full real-time state of an active, queued, or completed transfer
type Record struct {
	TransferID       string                  `json:"transfer_id"`
	SessionID        string                  `json:"session_id"`
	Direction        string                  `json:"direction"` // "send" or "receive"
	Sender           protocol.DeviceInfo     `json:"sender"`
	Receiver         protocol.DeviceInfo     `json:"receiver"`
	Files            []protocol.FileMetadata `json:"files"`
	TotalSize        int64                   `json:"total_size"`
	TransferredBytes int64                   `json:"transferred_bytes"`
	CurrentSpeedMBps float64                 `json:"current_speed_mbps"`
	PeakSpeedMBps    float64                 `json:"peak_speed_mbps"`
	ProgressPercent  float64                 `json:"progress_percent"`
	Status           protocol.TransferStatus `json:"status"`
	StartTime        time.Time               `json:"start_time"`
	CompletionTime   *time.Time              `json:"completion_time,omitempty"`
	SavedPaths       []string                `json:"saved_paths,omitempty"`
	ErrorCode        string                  `json:"error_code,omitempty"`
	ErrorMessage     string                  `json:"error_message,omitempty"`
}

// Engine executes real TLS 1.3 chunked file transfers, incoming approval gates, and resume checkpoints
type Engine struct {
	mu               sync.RWMutex
	deviceMgr        *device.Manager
	pairingSvc       *pairing.Service
	connMgr          *connection.Manager
	storageMgr       *storage.Manager
	tlsIdentity      *security.TLSIdentity
	rateLimiter      *security.RateLimiter
	transfers        map[string]*Record
	approvalChans    map[string]chan bool
	pauseMu          sync.Mutex
	pausedTransfers  map[string]bool
	cancelFuncs      map[string]context.CancelFunc
	chunkSize        int
	uploadLimitBps   int64 // 0 = unlimited (Turbo)
	downloadLimitBps int64 // 0 = unlimited (Turbo)
	listener         net.Listener
	server           *http.Server
	onStateChange    func(rec Record)
}

// Config configures the Transfer Engine
type Config struct {
	DeviceMgr     *device.Manager
	PairingSvc    *pairing.Service
	ConnMgr       *connection.Manager
	StorageMgr    *storage.Manager
	TLSIdentity   *security.TLSIdentity
	ChunkSize     int
	OnStateChange func(rec Record)
}

// NewEngine initializes the File Transfer Engine
func NewEngine(cfg Config) *Engine {
	if cfg.ChunkSize <= 0 {
		cfg.ChunkSize = protocol.DefaultChunkSize
	}
	return &Engine{
		deviceMgr:       cfg.DeviceMgr,
		pairingSvc:      cfg.PairingSvc,
		connMgr:         cfg.ConnMgr,
		storageMgr:      cfg.StorageMgr,
		tlsIdentity:     cfg.TLSIdentity,
		rateLimiter:     security.NewRateLimiter(120, time.Minute),
		transfers:       make(map[string]*Record),
		approvalChans:   make(map[string]chan bool),
		pausedTransfers: make(map[string]bool),
		cancelFuncs:     make(map[string]context.CancelFunc),
		chunkSize:       cfg.ChunkSize,
		onStateChange:   cfg.OnStateChange,
	}
}

// SetBandwidthLimits configures upload and download rate caps in MB/s (0 = uncapped turbo)
func (e *Engine) SetBandwidthLimits(uploadMBps, downloadMBps float64) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if uploadMBps <= 0 {
		e.uploadLimitBps = 0
	} else {
		e.uploadLimitBps = int64(uploadMBps * 1024 * 1024)
	}
	if downloadMBps <= 0 {
		e.downloadLimitBps = 0
	} else {
		e.downloadLimitBps = int64(downloadMBps * 1024 * 1024)
	}
}

// StartServer starts the TLS 1.3 P2P transfer listener on addr (e.g., "0.0.0.0:53317" or "127.0.0.1:0")
func (e *Engine) StartServer(addr string) (int, error) {
	mux := http.NewServeMux()
	mux.HandleFunc("/p2p/v1/handshake", e.handleHandshake)
	mux.HandleFunc("/p2p/v1/pair", e.handlePair)
	mux.HandleFunc("/p2p/v1/transfer/request", e.handleTransferRequest)
	mux.HandleFunc("/p2p/v1/transfer/checkpoint", e.handleCheckpoint)
	mux.HandleFunc("/p2p/v1/transfer/chunk", e.handleChunkUpload)
	mux.HandleFunc("/p2p/v1/transfer/finalize", e.handleFinalize)

	rawLn, err := net.Listen("tcp", addr)
	if err != nil {
		return 0, err
	}
	tlsLn := tls.NewListener(rawLn, e.tlsIdentity.ServerTLSConfig())

	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	e.mu.Lock()
	e.listener = tlsLn
	e.server = srv
	e.mu.Unlock()

	port := rawLn.Addr().(*net.TCPAddr).Port
	go func() {
		_ = srv.Serve(tlsLn)
	}()
	return port, nil
}

// StopServer shuts down the P2P transfer server
func (e *Engine) StopServer() {
	e.mu.Lock()
	srv := e.server
	ln := e.listener
	e.mu.Unlock()
	if srv != nil {
		_ = srv.Close()
	}
	if ln != nil {
		_ = ln.Close()
	}
}

func (e *Engine) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (e *Engine) handleHandshake(w http.ResponseWriter, r *http.Request) {
	ip := e.clientIP(r)
	if !e.rateLimiter.Allow(ip) {
		http.Error(w, protocol.ErrCodeRateLimited, http.StatusTooManyRequests)
		return
	}
	var req connection.HandshakePayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid handshake payload", http.StatusBadRequest)
		return
	}
	if err := protocol.ValidateProtocolVersion(req.ProtocolVersion); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	resp := connection.HandshakePayload{
		ProtocolVersion: protocol.ProtocolVersion,
		Device:          e.deviceMgr.Self(),
		Timestamp:       time.Now().Unix(),
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (e *Engine) handlePair(w http.ResponseWriter, r *http.Request) {
	ip := e.clientIP(r)
	if !e.rateLimiter.Allow(ip) {
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(protocol.PairingResponse{
			Authorized:   false,
			ErrorCode:    protocol.ErrCodeRateLimited,
			ErrorMessage: "too many connection attempts",
		})
		return
	}

	var req protocol.PairingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(protocol.PairingResponse{
			Authorized:   false,
			ErrorCode:    protocol.ErrCodePairingInvalid,
			ErrorMessage: "malformed pairing request",
		})
		return
	}

	resp, err := e.pairingSvc.ValidateAndAuthorize(req)
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(resp)
		return
	}

	// Register peer as trusted once pairing succeeds
	_, _ = e.deviceMgr.RegisterTrusted(req.PeerDevice, false)
	_ = json.NewEncoder(w).Encode(resp)
}

func (e *Engine) handleTransferRequest(w http.ResponseWriter, r *http.Request) {
	var offer protocol.TransferOffer
	if err := json.NewDecoder(r.Body).Decode(&offer); err != nil {
		e.writeOfferError(w, "", http.StatusBadRequest, protocol.ErrCodeInvalidMetadata, "malformed transfer offer")
		return
	}
	if err := protocol.ValidateProtocolVersion(offer.ProtocolVersion); err != nil {
		e.writeOfferError(w, offer.TransferID, http.StatusBadRequest, protocol.ErrCodeProtocolMismatch, err.Error())
		return
	}
	if strings.TrimSpace(offer.TransferID) == "" || len(offer.Files) == 0 {
		e.writeOfferError(w, offer.TransferID, http.StatusBadRequest, protocol.ErrCodeInvalidMetadata, "transfer_id and at least one file required")
		return
	}

	// Security Check 1: Validate that sender is either paired in an active session OR is a verified trusted device
	isAuthorizedSession := e.pairingSvc.IsSessionAuthorized(offer.SessionID, offer.Sender.DeviceID)
	isTrustedPeer := e.deviceMgr.IsTrusted(offer.Sender.DeviceID, offer.Sender.TLSFingerprint)
	if !isAuthorizedSession && !isTrustedPeer {
		e.writeOfferError(w, offer.TransferID, http.StatusUnauthorized, protocol.ErrCodeUnauthorizedDevice, "sender device is not paired or authorized")
		return
	}

	// Security Check 2: Validate every file's metadata and path-traversal rules
	var computedTotal int64
	for _, fm := range offer.Files {
		if err := protocol.ValidateFileMetadata(fm, protocol.MaxDefaultFileSize); err != nil {
			code := protocol.ErrCodeInvalidMetadata
			if pe, ok := err.(*protocol.ProtocolError); ok {
				code = pe.Code
			}
			e.writeOfferError(w, offer.TransferID, http.StatusBadRequest, code, err.Error())
			return
		}
		computedTotal += fm.FileSize
	}

	// Security Check 3: Check disk space before accepting
	if err := e.storageMgr.CheckStorageCapacity(computedTotal); err != nil {
		code := protocol.ErrCodeInsufficientDisk
		if pe, ok := err.(*protocol.ProtocolError); ok {
			code = pe.Code
		}
		e.writeOfferError(w, offer.TransferID, http.StatusInsufficientStorage, code, err.Error())
		return
	}

	// Check if existing transfer record exists (e.g., resuming an already approved transfer)
	e.mu.Lock()
	existingRec, alreadyApproved := e.transfers[offer.TransferID]
	if alreadyApproved && (existingRec.Status == protocol.StatusTransferring || existingRec.Status == protocol.StatusInterrupted || existingRec.Status == protocol.StatusPaused) {
		existingRec.Status = protocol.StatusTransferring
		e.mu.Unlock()
		e.emitState(*existingRec)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(protocol.TransferOfferResponse{
			TransferID: offer.TransferID,
			Status:     protocol.StatusTransferring,
			Approved:   true,
			ChunkSize:  e.chunkSize,
		})
		return
	}

	rec := &Record{
		TransferID: offer.TransferID,
		SessionID:  offer.SessionID,
		Direction:  "receive",
		Sender:     offer.Sender,
		Receiver:   e.deviceMgr.Self(),
		Files:      offer.Files,
		TotalSize:  computedTotal,
		Status:     protocol.StatusWaitingForApproval,
		StartTime:  time.Now(),
	}
	e.transfers[offer.TransferID] = rec

	// Determine if receiver requires manual user approval
	autoAccept := e.deviceMgr.ShouldAutoAccept(offer.Sender.DeviceID, offer.Sender.TLSFingerprint)
	var approvalCh chan bool
	if !autoAccept {
		approvalCh = make(chan bool, 1)
		e.approvalChans[offer.TransferID] = approvalCh
	}
	e.mu.Unlock()
	e.emitState(*rec)

	if !autoAccept {
		select {
		case approved := <-approvalCh:
			if !approved {
				e.updateStatus(offer.TransferID, protocol.StatusRejected, protocol.ErrCodeTransferRejected, "transfer rejected by receiver")
				e.writeOfferError(w, offer.TransferID, http.StatusForbidden, protocol.ErrCodeTransferRejected, "receiver rejected incoming transfer")
				return
			}
		case <-r.Context().Done():
			e.updateStatus(offer.TransferID, protocol.StatusCancelled, protocol.ErrCodeTransferCancelled, "sender disconnected while waiting for approval")
			return
		case <-time.After(2 * time.Minute):
			e.updateStatus(offer.TransferID, protocol.StatusFailed, protocol.ErrCodeTransferRejected, "approval request timed out")
			e.writeOfferError(w, offer.TransferID, http.StatusRequestTimeout, protocol.ErrCodeTransferRejected, "approval timed out")
			return
		}
	}

	// Initialize temporary storage checkpoints for all files in the offer
	e.updateStatus(offer.TransferID, protocol.StatusPreparing, "", "")
	for _, fm := range offer.Files {
		if _, err := e.storageMgr.InitOrLoadReceiveFile(offer.TransferID, fm); err != nil {
			code := protocol.ErrCodeInsufficientDisk
			if pe, ok := err.(*protocol.ProtocolError); ok {
				code = pe.Code
			}
			e.updateStatus(offer.TransferID, protocol.StatusFailed, code, err.Error())
			e.writeOfferError(w, offer.TransferID, http.StatusInternalServerError, code, err.Error())
			return
		}
	}

	e.updateStatus(offer.TransferID, protocol.StatusTransferring, "", "")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(protocol.TransferOfferResponse{
		TransferID: offer.TransferID,
		Status:     protocol.StatusTransferring,
		Approved:   true,
		ChunkSize:  e.chunkSize,
	})
}

// ApproveIncoming approves a pending incoming transfer request waiting for receiver confirmation
func (e *Engine) ApproveIncoming(transferID string) error {
	e.mu.Lock()
	ch, ok := e.approvalChans[transferID]
	if ok {
		delete(e.approvalChans, transferID)
	}
	e.mu.Unlock()
	if !ok {
		return protocol.ErrNotFound
	}
	ch <- true
	return nil
}

// RejectIncoming rejects a pending incoming transfer request
func (e *Engine) RejectIncoming(transferID string) error {
	e.mu.Lock()
	ch, ok := e.approvalChans[transferID]
	if ok {
		delete(e.approvalChans, transferID)
	}
	e.mu.Unlock()
	if !ok {
		return protocol.ErrNotFound
	}
	ch <- false
	return nil
}

func (e *Engine) handleCheckpoint(w http.ResponseWriter, r *http.Request) {
	transferID := r.URL.Query().Get("transfer_id")
	fileID := r.URL.Query().Get("file_id")
	cp, ok := e.storageMgr.GetCheckpointStatus(transferID, fileID)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(protocol.ChunkCheckpointResponse{
			TransferID: transferID,
			FileID:     fileID,
			CanResume:  false,
		})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(cp)
}

func (e *Engine) handleChunkUpload(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	transferID := r.Header.Get("X-Droply-Transfer-ID")
	fileID := r.Header.Get("X-Droply-File-ID")
	chunkIdx, _ := strconv.Atoi(r.Header.Get("X-Droply-Chunk-Index"))
	offset, _ := strconv.ParseInt(r.Header.Get("X-Droply-Chunk-Offset"), 10, 64)
	chunkSHA := r.Header.Get("X-Droply-Chunk-SHA256")

	e.mu.RLock()
	rec, exists := e.transfers[transferID]
	dlLimit := e.downloadLimitBps
	e.mu.RUnlock()

	if !exists || (rec.Status != protocol.StatusTransferring && rec.Status != protocol.StatusPreparing) {
		http.Error(w, "transfer not active or approved", http.StatusForbidden)
		return
	}

	start := time.Now()
	written, err := e.storageMgr.WriteChunk(transferID, fileID, chunkIdx, offset, chunkSHA, r.Body)
	if err != nil {
		code := protocol.ErrCodeChecksumMismatch
		if pe, ok := err.(*protocol.ProtocolError); ok {
			code = pe.Code
		}
		e.updateStatus(transferID, protocol.StatusFailed, code, err.Error())
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if dlLimit > 0 && written > 0 {
		expectedDur := time.Duration(float64(written) / float64(dlLimit) * float64(time.Second))
		elapsed := time.Since(start)
		if expectedDur > elapsed {
			time.Sleep(expectedDur - elapsed)
		}
	}

	e.mu.Lock()
	var totalReceived int64
	for _, fm := range rec.Files {
		if cp, ok := e.storageMgr.GetCheckpointStatus(transferID, fm.FileID); ok {
			totalReceived += cp.BytesReceived
		}
	}
	rec.TransferredBytes = totalReceived
	if rec.TotalSize > 0 {
		rec.ProgressPercent = (float64(rec.TransferredBytes) / float64(rec.TotalSize)) * 100
	}
	elapsedTotal := time.Since(rec.StartTime).Seconds()
	if elapsedTotal > 0 {
		rec.CurrentSpeedMBps = (float64(rec.TransferredBytes) / (1024 * 1024)) / elapsedTotal
		if rec.CurrentSpeedMBps > rec.PeakSpeedMBps {
			rec.PeakSpeedMBps = rec.CurrentSpeedMBps
		}
	}
	recCopy := *rec
	e.mu.Unlock()
	e.emitState(recCopy)

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

func (e *Engine) handleFinalize(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransferID string `json:"transfer_id"`
		FileID     string `json:"file_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	e.updateStatus(req.TransferID, protocol.StatusVerifying, "", "")
	finalPath, err := e.storageMgr.VerifyAndFinalize(req.TransferID, req.FileID)
	if err != nil {
		code := protocol.ErrCodeChecksumMismatch
		if pe, ok := err.(*protocol.ProtocolError); ok {
			code = pe.Code
		}
		e.updateStatus(req.TransferID, protocol.StatusFailed, code, err.Error())
		w.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error_code":    code,
			"error_message": err.Error(),
		})
		return
	}

	e.mu.Lock()
	rec, ok := e.transfers[req.TransferID]
	if ok {
		rec.SavedPaths = append(rec.SavedPaths, finalPath)
		if len(rec.SavedPaths) >= len(rec.Files) {
			now := time.Now()
			rec.Status = protocol.StatusCompleted
			rec.TransferredBytes = rec.TotalSize
			rec.ProgressPercent = 100
			rec.CompletionTime = &now
		} else {
			rec.Status = protocol.StatusTransferring
		}
		e.emitState(*rec)
	}
	e.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":     string(protocol.StatusCompleted),
		"saved_path": finalPath,
	})
}

// SendFiles executes a complete single or multi-file streaming transfer (or resumes an interrupted transfer) to peer
func (e *Engine) SendFiles(ctx context.Context, transferID, sessionID string, peer protocol.DeviceInfo, filePaths []string) (*Record, error) {
	if strings.TrimSpace(transferID) == "" {
		rnd, _ := security.GenerateRandomToken(8)
		transferID = "tx_" + rnd
	}

	e.mu.Lock()
	rec, exists := e.transfers[transferID]
	var filesMeta []protocol.FileMetadata
	var totalBytes int64
	if exists && len(rec.Files) > 0 {
		filesMeta = rec.Files
		totalBytes = rec.TotalSize
	} else {
		for _, fp := range filePaths {
			meta, err := storage.InspectLocalFile(fp, e.chunkSize)
			if err != nil {
				e.mu.Unlock()
				return nil, err
			}
			filesMeta = append(filesMeta, meta)
			totalBytes += meta.FileSize
		}
		rec = &Record{
			TransferID: transferID,
			SessionID:  sessionID,
			Direction:  "send",
			Sender:     e.deviceMgr.Self(),
			Receiver:   peer,
			Files:      filesMeta,
			TotalSize:  totalBytes,
			Status:     protocol.StatusConnecting,
			StartTime:  time.Now(),
		}
		e.transfers[transferID] = rec
	}

	transferCtx, cancel := context.WithCancel(ctx)
	e.cancelFuncs[transferID] = cancel
	e.mu.Unlock()
	e.emitState(*rec)

	client := e.connMgr.HTTPClientForPeer(peer.TLSFingerprint)
	client.Timeout = 60 * time.Second

	// Step 1: Submit TransferOffer and wait for Receiver Approval
	e.updateStatus(transferID, protocol.StatusWaitingForApproval, "", "")
	offer := protocol.TransferOffer{
		ProtocolVersion: protocol.ProtocolVersion,
		SessionID:       sessionID,
		TransferID:      transferID,
		Sender:          e.deviceMgr.Self(),
		Files:           filesMeta,
		TotalSize:       totalBytes,
		Timestamp:       time.Now().Unix(),
	}
	offerBytes, _ := json.Marshal(offer)
	reqURL := fmt.Sprintf("https://%s:%d/p2p/v1/transfer/request", peer.IPAddress, peer.Port)
	httpReq, err := http.NewRequestWithContext(transferCtx, http.MethodPost, reqURL, bytes.NewReader(offerBytes))
	if err != nil {
		e.updateStatus(transferID, protocol.StatusFailed, "ERR_NETWORK", err.Error())
		return e.GetTransfer(transferID), err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(httpReq)
	if err != nil {
		e.updateStatus(transferID, protocol.StatusInterrupted, "ERR_CONNECTION_INTERRUPTED", err.Error())
		return e.GetTransfer(transferID), err
	}
	var offerResp protocol.TransferOfferResponse
	_ = json.NewDecoder(resp.Body).Decode(&offerResp)
	_ = resp.Body.Close()

	if !offerResp.Approved {
		status := protocol.StatusFailed
		if offerResp.ErrorCode == protocol.ErrCodeTransferRejected {
			status = protocol.StatusRejected
		}
		e.updateStatus(transferID, status, offerResp.ErrorCode, offerResp.ErrorMessage)
		return e.GetTransfer(transferID), protocol.NewError(offerResp.ErrorCode, offerResp.ErrorMessage)
	}

	e.updateStatus(transferID, protocol.StatusTransferring, "", "")
	e.connMgr.SetState(peer.DeviceID, protocol.ConnStateTransferring, "")

	// Step 2: Stream each file in bounded chunks, querying receiver's checkpoint first for seamless resume
	var cumulativeSent int64
	for _, fm := range filesMeta {
		cpURL := fmt.Sprintf("https://%s:%d/p2p/v1/transfer/checkpoint?transfer_id=%s&file_id=%s", peer.IPAddress, peer.Port, transferID, fm.FileID)
		cpReq, _ := http.NewRequestWithContext(transferCtx, http.MethodGet, cpURL, nil)
		startChunk := 0
		if cpResp, cpErr := client.Do(cpReq); cpErr == nil {
			var cpData protocol.ChunkCheckpointResponse
			if json.NewDecoder(cpResp.Body).Decode(&cpData) == nil && cpData.CanResume {
				startChunk = cpData.NextContiguousChunk
				cumulativeSent += int64(startChunk) * int64(fm.ChunkSize)
			}
			_ = cpResp.Body.Close()
		}

		f, err := os.Open(fm.SourcePath)
		if err != nil {
			e.updateStatus(transferID, protocol.StatusFailed, "ERR_FILE_IO", err.Error())
			return e.GetTransfer(transferID), err
		}

		buf := make([]byte, fm.ChunkSize)
		for chunkIdx := startChunk; chunkIdx < fm.TotalChunks; chunkIdx++ {
			// Check for cancellation or pause before each chunk
			if err := e.waitIfPausedOrCancelled(transferCtx, transferID); err != nil {
				_ = f.Close()
				return e.GetTransfer(transferID), err
			}

			offset := int64(chunkIdx) * int64(fm.ChunkSize)
			if _, err := f.Seek(offset, io.SeekStart); err != nil {
				_ = f.Close()
				e.updateStatus(transferID, protocol.StatusFailed, "ERR_FILE_SEEK", err.Error())
				return e.GetTransfer(transferID), err
			}

			n, readErr := io.ReadFull(f, buf)
			if readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF {
				_ = f.Close()
				e.updateStatus(transferID, protocol.StatusFailed, "ERR_FILE_READ", readErr.Error())
				return e.GetTransfer(transferID), readErr
			}

			chunkData := buf[:n]
			chunkSum := sha256.Sum256(chunkData)
			chunkHashHex := hex.EncodeToString(chunkSum[:])

			chunkStart := time.Now()
			chunkURL := fmt.Sprintf("https://%s:%d/p2p/v1/transfer/chunk", peer.IPAddress, peer.Port)
			cReq, _ := http.NewRequestWithContext(transferCtx, http.MethodPut, chunkURL, bytes.NewReader(chunkData))
			cReq.Header.Set("X-Droply-Protocol", protocol.ProtocolVersion)
			cReq.Header.Set("X-Droply-Session-ID", sessionID)
			cReq.Header.Set("X-Droply-Transfer-ID", transferID)
			cReq.Header.Set("X-Droply-File-ID", fm.FileID)
			cReq.Header.Set("X-Droply-Chunk-Index", strconv.Itoa(chunkIdx))
			cReq.Header.Set("X-Droply-Chunk-Offset", strconv.FormatInt(offset, 10))
			cReq.Header.Set("X-Droply-Chunk-Size", strconv.Itoa(n))
			cReq.Header.Set("X-Droply-Chunk-SHA256", chunkHashHex)
			cReq.Header.Set("X-Droply-Total-Size", strconv.FormatInt(fm.FileSize, 10))

			cResp, cErr := client.Do(cReq)
			if cErr != nil {
				_ = f.Close()
				if transferCtx.Err() != nil {
					e.updateStatus(transferID, protocol.StatusCancelled, protocol.ErrCodeTransferCancelled, "transfer cancelled")
					return e.GetTransfer(transferID), transferCtx.Err()
				}
				e.updateStatus(transferID, protocol.StatusInterrupted, "ERR_WIFI_INTERRUPTED", cErr.Error())
				e.connMgr.SetState(peer.DeviceID, protocol.ConnStateInterrupted, cErr.Error())
				return e.GetTransfer(transferID), cErr
			}
			_ = cResp.Body.Close()
			if cResp.StatusCode != http.StatusOK {
				_ = f.Close()
				e.updateStatus(transferID, protocol.StatusFailed, protocol.ErrCodeChecksumMismatch, "chunk rejected by receiver")
				return e.GetTransfer(transferID), fmt.Errorf("chunk %d failed with status %d", chunkIdx, cResp.StatusCode)
			}

			// Enforce upload bandwidth limit if configured
			e.mu.RLock()
			upLimit := e.uploadLimitBps
			e.mu.RUnlock()
			if upLimit > 0 && n > 0 {
				expectedDur := time.Duration(float64(n) / float64(upLimit) * float64(time.Second))
				elapsed := time.Since(chunkStart)
				if expectedDur > elapsed {
					time.Sleep(expectedDur - elapsed)
				}
			}

			cumulativeSent += int64(n)
			e.mu.Lock()
			rec.TransferredBytes = cumulativeSent
			if rec.TotalSize > 0 {
				rec.ProgressPercent = (float64(cumulativeSent) / float64(rec.TotalSize)) * 100
			}
			elapsedTotal := time.Since(rec.StartTime).Seconds()
			if elapsedTotal > 0 {
				rec.CurrentSpeedMBps = (float64(cumulativeSent) / (1024 * 1024)) / elapsedTotal
				if rec.CurrentSpeedMBps > rec.PeakSpeedMBps {
					rec.PeakSpeedMBps = rec.CurrentSpeedMBps
				}
			}
			recCopy := *rec
			e.mu.Unlock()
			e.emitState(recCopy)
		}
		_ = f.Close()

		// Step 3: Finalize file and verify full-file SHA-256 on receiver
		e.updateStatus(transferID, protocol.StatusVerifying, "", "")
		finBody, _ := json.Marshal(map[string]string{
			"transfer_id": transferID,
			"file_id":     fm.FileID,
		})
		finURL := fmt.Sprintf("https://%s:%d/p2p/v1/transfer/finalize", peer.IPAddress, peer.Port)
		finReq, _ := http.NewRequestWithContext(transferCtx, http.MethodPost, finURL, bytes.NewReader(finBody))
		finReq.Header.Set("Content-Type", "application/json")
		finResp, finErr := client.Do(finReq)
		if finErr != nil {
			e.updateStatus(transferID, protocol.StatusInterrupted, "ERR_FINALIZE_INTERRUPTED", finErr.Error())
			return e.GetTransfer(transferID), finErr
		}
		if finResp.StatusCode != http.StatusOK {
			var errPayload map[string]string
			_ = json.NewDecoder(finResp.Body).Decode(&errPayload)
			_ = finResp.Body.Close()
			code := errPayload["error_code"]
			if code == "" {
				code = protocol.ErrCodeChecksumMismatch
			}
			msg := errPayload["error_message"]
			e.updateStatus(transferID, protocol.StatusFailed, code, msg)
			return e.GetTransfer(transferID), protocol.NewError(code, msg)
		}
		_ = finResp.Body.Close()
	}

	now := time.Now()
	e.mu.Lock()
	rec.Status = protocol.StatusCompleted
	rec.TransferredBytes = rec.TotalSize
	rec.ProgressPercent = 100
	rec.CompletionTime = &now
	recCopy := *rec
	e.mu.Unlock()
	e.connMgr.SetState(peer.DeviceID, protocol.ConnStateConnected, "")
	e.emitState(recCopy)

	return &recCopy, nil
}

func (e *Engine) waitIfPausedOrCancelled(ctx context.Context, transferID string) error {
	for {
		select {
		case <-ctx.Done():
			e.updateStatus(transferID, protocol.StatusCancelled, protocol.ErrCodeTransferCancelled, "transfer cancelled")
			return protocol.NewError(protocol.ErrCodeTransferCancelled, "transfer cancelled")
		default:
		}
		e.pauseMu.Lock()
		paused := e.pausedTransfers[transferID]
		e.pauseMu.Unlock()
		if !paused {
			return nil
		}
		time.Sleep(50 * time.Millisecond)
	}
}

// PauseTransfer pauses an in-progress transfer
func (e *Engine) PauseTransfer(transferID string) error {
	e.pauseMu.Lock()
	e.pausedTransfers[transferID] = true
	e.pauseMu.Unlock()
	e.updateStatus(transferID, protocol.StatusPaused, "", "")
	return nil
}

// ResumeTransfer unpauses a paused transfer or restarts an interrupted transfer from its last verified chunk checkpoint
func (e *Engine) ResumeTransfer(ctx context.Context, transferID string) (*Record, error) {
	e.pauseMu.Lock()
	wasPaused := e.pausedTransfers[transferID]
	delete(e.pausedTransfers, transferID)
	e.pauseMu.Unlock()

	rec := e.GetTransfer(transferID)
	if rec == nil {
		return nil, protocol.ErrNotFound
	}
	if wasPaused && rec.Status == protocol.StatusPaused {
		e.updateStatus(transferID, protocol.StatusTransferring, "", "")
		return e.GetTransfer(transferID), nil
	}

	if rec.Direction == "send" && (rec.Status == protocol.StatusInterrupted || rec.Status == protocol.StatusFailed || rec.Status == protocol.StatusPaused) {
		paths := make([]string, 0, len(rec.Files))
		for _, fm := range rec.Files {
			paths = append(paths, fm.SourcePath)
		}
		return e.SendFiles(ctx, rec.TransferID, rec.SessionID, rec.Receiver, paths)
	}
	return rec, nil
}

// CancelTransfer cancels an active or queued transfer and cleans up partial data
func (e *Engine) CancelTransfer(transferID string) error {
	e.pauseMu.Lock()
	delete(e.pausedTransfers, transferID)
	e.pauseMu.Unlock()

	e.mu.Lock()
	cancel, ok := e.cancelFuncs[transferID]
	rec, exists := e.transfers[transferID]
	e.mu.Unlock()

	if ok && cancel != nil {
		cancel()
	}
	if exists {
		for _, fm := range rec.Files {
			_ = e.storageMgr.CleanupTemp(transferID, fm.FileID)
		}
		e.updateStatus(transferID, protocol.StatusCancelled, protocol.ErrCodeTransferCancelled, "cancelled by user")
		return nil
	}
	return protocol.ErrNotFound
}

// GetTransfer returns a snapshot of a transfer record by ID
func (e *Engine) GetTransfer(transferID string) *Record {
	e.mu.RLock()
	defer e.mu.RUnlock()
	rec, ok := e.transfers[transferID]
	if !ok {
		return nil
	}
	cp := *rec
	return &cp
}

// ListTransfers returns all active and recent transfer records
func (e *Engine) ListTransfers() []Record {
	e.mu.RLock()
	defer e.mu.RUnlock()
	out := make([]Record, 0, len(e.transfers))
	for _, r := range e.transfers {
		out = append(out, *r)
	}
	return out
}

func (e *Engine) updateStatus(transferID string, status protocol.TransferStatus, errCode, errMsg string) {
	e.mu.Lock()
	rec, ok := e.transfers[transferID]
	if !ok {
		e.mu.Unlock()
		return
	}
	rec.Status = status
	if errCode != "" {
		rec.ErrorCode = errCode
	}
	if errMsg != "" {
		rec.ErrorMessage = errMsg
	}
	cp := *rec
	e.mu.Unlock()
	e.emitState(cp)
}

func (e *Engine) emitState(rec Record) {
	if e.onStateChange != nil {
		e.onStateChange(rec)
	}
}

func (e *Engine) writeOfferError(w http.ResponseWriter, txID string, httpCode int, errCode, errMsg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpCode)
	_ = json.NewEncoder(w).Encode(protocol.TransferOfferResponse{
		TransferID:   txID,
		Status:       protocol.StatusFailed,
		Approved:     false,
		ErrorCode:    errCode,
		ErrorMessage: errMsg,
	})
}
