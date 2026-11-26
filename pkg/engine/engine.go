package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/connection"
	"github.com/FahadKhan356/Droply/internal/device"
	"github.com/FahadKhan356/Droply/internal/discovery"
	"github.com/FahadKhan356/Droply/internal/history"
	"github.com/FahadKhan356/Droply/internal/pairing"
	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/internal/queue"
	"github.com/FahadKhan356/Droply/internal/security"
	"github.com/FahadKhan356/Droply/internal/storage"
	"github.com/FahadKhan356/Droply/internal/transfer"
)

// RuntimeSettings holds live user-configurable engine settings
type RuntimeSettings struct {
	DeviceName       string  `json:"device_name"`
	Preset           string  `json:"preset"` // "turbo", "balanced", "custom"
	UploadRateMBps   float64 `json:"upload_rate_mbps"`
	DownloadRateMBps float64 `json:"download_rate_mbps"`
	ParallelStreams  int     `json:"parallel_streams"`
	ListenPort       int     `json:"listen_port"`
	Visibility       string  `json:"visibility"` // "everyone", "contacts", "hidden"
	AutoAcceptPaired bool    `json:"auto_accept_paired"`
	DownloadDir      string  `json:"download_dir"`
}

// Event represents a live notification pushed to React Native and Next.js clients
type Event struct {
	Type      string      `json:"type"` // "transfer_update", "peer_discovered", "incoming_request", "pairing_update"
	Timestamp int64       `json:"timestamp"`
	Payload   interface{} `json:"payload"`
}

// DroplyNode is the complete unified Go Engine instance
type DroplyNode struct {
	mu           sync.RWMutex
	TLSIdentity  *security.TLSIdentity
	DeviceMgr    *device.Manager
	PairingSvc   *pairing.Service
	DiscoverySvc *discovery.Service
	ConnMgr      *connection.Manager
	StorageMgr   *storage.Manager
	TransferEng  *transfer.Engine
	QueueMgr     *queue.Manager
	HistoryMgr   *history.Manager
	Settings     RuntimeSettings
	subscribers  map[chan Event]struct{}
	controlSrv   *http.Server
}

// Options configures a new DroplyNode
type Options struct {
	StorageDir   string
	DownloadDir  string
	DeviceID     string
	DeviceName   string
	TransferPort int
	UDPPort      int
	ChunkSize    int
}

// NewNode initializes all 11 modular services of the DROPly Go networking engine
func NewNode(opts Options) (*DroplyNode, error) {
	if opts.StorageDir == "" {
		home, _ := os.UserHomeDir()
		opts.StorageDir = filepath.Join(home, ".droply")
	}
	if opts.DownloadDir == "" {
		home, _ := os.UserHomeDir()
		opts.DownloadDir = filepath.Join(home, "Downloads", "DROPly")
	}
	if opts.DeviceID == "" {
		tok, _ := security.GenerateRandomToken(6)
		opts.DeviceID = "dev_" + tok
	}
	if opts.DeviceName == "" {
		host, err := os.Hostname()
		if err != nil || host == "" {
			host = "DROPly Node"
		}
		opts.DeviceName = host
	}
	if opts.TransferPort <= 0 {
		opts.TransferPort = protocol.DefaultTransferPort
	}

	tlsID, err := security.LoadOrGenerateTLS(opts.StorageDir, opts.DeviceID)
	if err != nil {
		return nil, err
	}

	devMgr, err := device.NewManager(opts.StorageDir, opts.DeviceID, opts.DeviceName, opts.TransferPort, tlsID.Fingerprint)
	if err != nil {
		return nil, err
	}
	devMgr.UpdateSelfIP(discovery.DetectLocalIPv4())

	pairSvc := pairing.NewService(5 * time.Minute)
	connMgr := connection.NewManager(devMgr.Self, tlsID, 10*time.Second)
	storeMgr, err := storage.NewManager(opts.DownloadDir, protocol.MaxDefaultFileSize)
	if err != nil {
		return nil, err
	}
	histMgr, err := history.NewManager(opts.StorageDir)
	if err != nil {
		return nil, err
	}

	node := &DroplyNode{
		TLSIdentity: tlsID,
		DeviceMgr:   devMgr,
		PairingSvc:  pairSvc,
		ConnMgr:     connMgr,
		StorageMgr:  storeMgr,
		HistoryMgr:  histMgr,
		subscribers: make(map[chan Event]struct{}),
		Settings: RuntimeSettings{
			DeviceName:       opts.DeviceName,
			Preset:           "turbo",
			UploadRateMBps:   150,
			DownloadRateMBps: 200,
			ParallelStreams:  4,
			ListenPort:       opts.TransferPort,
			Visibility:       "everyone",
			AutoAcceptPaired: false,
			DownloadDir:      opts.DownloadDir,
		},
	}

	txEng := transfer.NewEngine(transfer.Config{
		DeviceMgr:   devMgr,
		PairingSvc:  pairSvc,
		ConnMgr:     connMgr,
		StorageMgr:  storeMgr,
		TLSIdentity: tlsID,
		ChunkSize:   opts.ChunkSize,
		OnStateChange: func(rec transfer.Record) {
			if rec.Status == protocol.StatusCompleted || rec.Status == protocol.StatusFailed || rec.Status == protocol.StatusCancelled || rec.Status == protocol.StatusRejected {
				_, _ = histMgr.RecordFromTransfer(rec)
			}
			evtType := "transfer_update"
			if rec.Status == protocol.StatusWaitingForApproval && rec.Direction == "receive" {
				evtType = "incoming_request"
			}
			node.broadcastEvent(Event{
				Type:      evtType,
				Timestamp: time.Now().Unix(),
				Payload:   rec,
			})
		},
	})
	node.TransferEng = txEng
	node.QueueMgr = queue.NewManager(txEng, 4)

	discSvc := discovery.NewService(discovery.Config{
		UDPPort:      opts.UDPPort,
		SelfProvider: devMgr.Self,
		IsTrustedFn: func(deviceID string) bool {
			return devMgr.IsTrusted(deviceID, "")
		},
		OnPeerUpdated: func(peer protocol.DeviceInfo) {
			node.broadcastEvent(Event{
				Type:      "peer_discovered",
				Timestamp: time.Now().Unix(),
				Payload:   peer,
			})
		},
	})
	node.DiscoverySvc = discSvc

	// Generate initial pairing QR & PIN session so node is immediately ready for pairing
	_, _, _ = pairSvc.GenerateSession(devMgr.Self(), 5*time.Minute)

	return node, nil
}

// Start launches the TLS 1.3 P2P server, LAN discovery service, and optional localhost Control API server
func (n *DroplyNode) Start(ctx context.Context, transferBindAddr, controlBindAddr string) (int, error) {
	if transferBindAddr == "" {
		transferBindAddr = fmt.Sprintf("0.0.0.0:%d", n.Settings.ListenPort)
	}
	actualPort, err := n.TransferEng.StartServer(transferBindAddr)
	if err != nil {
		// Fallback to ephemeral port if default port is already bound
		actualPort, err = n.TransferEng.StartServer("0.0.0.0:0")
		if err != nil {
			return 0, err
		}
	}
	n.mu.Lock()
	n.Settings.ListenPort = actualPort
	n.mu.Unlock()

	_ = n.DiscoverySvc.Start(ctx)

	if controlBindAddr != "" {
		if err := n.startControlServer(controlBindAddr); err != nil {
			return actualPort, err
		}
	}
	return actualPort, nil
}

// Stop cleanly shuts down all networking listeners and workers
func (n *DroplyNode) Stop() {
	n.DiscoverySvc.Stop()
	n.TransferEng.StopServer()
	n.QueueMgr.Close()
	n.mu.Lock()
	srv := n.controlSrv
	n.mu.Unlock()
	if srv != nil {
		_ = srv.Close()
	}
}

func (n *DroplyNode) broadcastEvent(evt Event) {
	n.mu.RLock()
	defer n.mu.RUnlock()
	for ch := range n.subscribers {
		select {
		case ch <- evt:
		default:
		}
	}
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func (n *DroplyNode) startControlServer(bindAddr string) error {
	mux := http.NewServeMux()

	// 1. Node Status & Telemetry
	mux.HandleFunc("/api/v1/status", withCORS(func(w http.ResponseWriter, r *http.Request) {
		freeBytes, _ := n.StorageMgr.AvailableDiskSpace()
		sess := n.PairingSvc.ActiveSession()
		if sess == nil {
			sess, _, _ = n.PairingSvc.GenerateSession(n.DeviceMgr.Self(), 5*time.Minute)
		}
		var qrPayload protocol.QRPairingPayload
		var qrString string
		if sess != nil {
			qrPayload = protocol.QRPairingPayload{
				ProtocolVersion: protocol.ProtocolVersion,
				SessionID:       sess.SessionID,
				DeviceID:        n.DeviceMgr.Self().DeviceID,
				DeviceName:      n.DeviceMgr.Self().DeviceName,
				DeviceType:      n.DeviceMgr.Self().DeviceType,
				IPAddress:       n.DeviceMgr.Self().IPAddress,
				Port:            n.Settings.ListenPort,
				Token:           sess.Token,
				PIN:             sess.PIN,
				TLSFingerprint:  n.TLSIdentity.Fingerprint,
				ExpiresAt:       sess.ExpiresAt.Unix(),
			}
			qrString, _ = pairing.EncodeQRPayload(qrPayload)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"self":           n.DeviceMgr.Self(),
			"settings":       n.Settings,
			"free_bytes":     freeBytes,
			"free_gb":        float64(freeBytes) / (1024 * 1024 * 1024),
			"active_pairing": qrPayload,
			"qr_payload_str": qrString,
		})
	}))

	// 2. Discovered LAN Peers
	mux.HandleFunc("/api/v1/peers", withCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"peers": n.DiscoverySvc.ListPeers(),
		})
	}))

	mux.HandleFunc("/api/v1/peers/rescan", withCORS(func(w http.ResponseWriter, r *http.Request) {
		_ = n.DiscoverySvc.BroadcastNow()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "scanning",
			"peers":  n.DiscoverySvc.ListPeers(),
		})
	}))

	mux.HandleFunc("/api/v1/peers/manual", withCORS(func(w http.ResponseWriter, r *http.Request) {
		var req protocol.DeviceInfo
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		peer, err := n.DiscoverySvc.RegisterManualPeer(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		// Attempt live handshake verification if reachable
		if verified, hErr := n.ConnMgr.ConnectAndHandshake(r.Context(), peer); hErr == nil {
			peer, _ = n.DiscoverySvc.RegisterManualPeer(verified)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(peer)
	}))

	// 3. QR & PIN Pairing
	mux.HandleFunc("/api/v1/pairing/generate", withCORS(func(w http.ResponseWriter, r *http.Request) {
		self := n.DeviceMgr.Self()
		self.Port = n.Settings.ListenPort
		_, payload, err := n.PairingSvc.GenerateSession(self, 5*time.Minute)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		qrStr, _ := pairing.EncodeQRPayload(payload)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"payload":        payload,
			"qr_payload_str": qrStr,
		})
	}))

	mux.HandleFunc("/api/v1/pairing/connect", withCORS(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			QRString string `json:"qr_string,omitempty"`
			IP       string `json:"ip,omitempty"`
			Port     int    `json:"port,omitempty"`
			PIN      string `json:"pin,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		var targetIP, expectedFP, sessionID, token, pin string
		var targetPort int

		if req.QRString != "" {
			parsed, err := pairing.DecodeQRPayload(req.QRString)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}
			targetIP = parsed.IPAddress
			targetPort = parsed.Port
			expectedFP = parsed.TLSFingerprint
			sessionID = parsed.SessionID
			token = parsed.Token
			pin = parsed.PIN
		} else {
			targetIP = req.IP
			targetPort = req.Port
			pin = req.PIN
		}

		resp, err := n.ConnMgr.PairWithPeer(r.Context(), targetIP, targetPort, expectedFP, sessionID, token, pin)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(resp)
			return
		}
		_, _ = n.DiscoverySvc.RegisterManualPeer(resp.HostDevice)
		_, _ = n.DeviceMgr.RegisterTrusted(resp.HostDevice, true)
		_ = json.NewEncoder(w).Encode(resp)
	}))

	// 4. Transfers Lifecycle & Queue
	mux.HandleFunc("/api/v1/transfers", withCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"transfers": n.TransferEng.ListTransfers(),
			"queue":     n.QueueMgr.ListJobs(),
		})
	}))

	mux.HandleFunc("/api/v1/transfers/send", withCORS(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PeerID        string   `json:"peer_id"`
			PeerIP        string   `json:"peer_ip,omitempty"`
			PeerPort      int      `json:"peer_port,omitempty"`
			PeerName      string   `json:"peer_name,omitempty"`
			SessionID     string   `json:"session_id,omitempty"`
			FilePaths     []string `json:"file_paths"`
			SyntheticFile *struct {
				FileName  string `json:"file_name"`
				SizeBytes int64  `json:"size_bytes"`
			} `json:"synthetic_file,omitempty"`
			Priority int `json:"priority,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// If mobile/web selected virtual sample items without local absolute paths, materialize real staging files on disk
		filePaths := req.FilePaths
		if len(filePaths) == 0 && req.SyntheticFile != nil {
			tmpDir := filepath.Join(os.TempDir(), "droply_outbound")
			_ = os.MkdirAll(tmpDir, 0755)
			safeName, err := security.SanitizeFilename(req.SyntheticFile.FileName)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			fullPath := filepath.Join(tmpDir, safeName)
			size := req.SyntheticFile.SizeBytes
			if size <= 0 || size > 10*1024*1024 {
				size = 2 * 1024 * 1024 // 2 MB fast real payload
			}
			if _, err := os.Stat(fullPath); os.IsNotExist(err) {
				data := make([]byte, size)
				for i := range data {
					data[i] = byte(i % 251)
				}
				_ = os.WriteFile(fullPath, data, 0644)
			}
			filePaths = []string{fullPath}
		}

		peer, ok := n.DiscoverySvc.GetPeer(req.PeerID)
		if !ok {
			ip := req.PeerIP
			port := req.PeerPort
			if ip == "" {
				ip = "127.0.0.1"
			}
			if port <= 0 {
				port = n.Settings.ListenPort
			}
			peer = protocol.DeviceInfo{
				DeviceID:        req.PeerID,
				DeviceName:      req.PeerName,
				IPAddress:       ip,
				Port:            port,
				ProtocolVersion: protocol.ProtocolVersion,
			}
		}

		// Ensure loopback self-transfers are authorized automatically for local verification
		sessionID := req.SessionID
		if sessionID == "" {
			if sess := n.PairingSvc.ActiveSession(); sess != nil {
				sessionID = sess.SessionID
			} else {
				sessionID = "local_verified_session"
			}
		}
		n.PairingSvc.AuthorizeTrustedSession(sessionID, n.DeviceMgr.Self().DeviceID)

		job := n.QueueMgr.Enqueue(sessionID, peer, filePaths, req.Priority)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(job)
	}))

	mux.HandleFunc("/api/v1/transfers/approve", withCORS(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TransferID string `json:"transfer_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if err := n.TransferEng.ApproveIncoming(req.TransferID); err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "approved"})
	}))

	mux.HandleFunc("/api/v1/transfers/reject", withCORS(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TransferID string `json:"transfer_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if err := n.TransferEng.RejectIncoming(req.TransferID); err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "rejected"})
	}))

	mux.HandleFunc("/api/v1/transfers/pause", withCORS(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TransferID string `json:"transfer_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		_ = n.TransferEng.PauseTransfer(req.TransferID)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "paused"})
	}))

	mux.HandleFunc("/api/v1/transfers/resume", withCORS(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TransferID string `json:"transfer_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		go func() {
			_, _ = n.TransferEng.ResumeTransfer(context.Background(), req.TransferID)
		}()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "resuming"})
	}))

	mux.HandleFunc("/api/v1/transfers/cancel", withCORS(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			TransferID string `json:"transfer_id"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		_ = n.QueueMgr.CancelJob(req.TransferID)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "cancelled"})
	}))

	// 5. Persistent Offline Transfer History
	mux.HandleFunc("/api/v1/history", withCORS(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"history": n.HistoryMgr.List(),
			})
		case http.MethodDelete:
			txID := r.URL.Query().Get("transfer_id")
			if txID != "" {
				_ = n.HistoryMgr.Remove(txID)
			} else {
				_ = n.HistoryMgr.Clear()
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		}
	}))

	// 6. Trusted Devices Management
	mux.HandleFunc("/api/v1/trusted", withCORS(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"trusted_devices": n.DeviceMgr.ListTrusted(),
			})
		case http.MethodPut:
			var req struct {
				DeviceID string `json:"device_id"`
				NewName  string `json:"new_name"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			td, err := n.DeviceMgr.RenameTrusted(req.DeviceID, req.NewName)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(td)
		case http.MethodDelete:
			id := r.URL.Query().Get("device_id")
			if err := n.DeviceMgr.RevokeTrust(id); err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "revoked"})
		}
	}))

	// 7. QoS Bandwidth & Engine Settings
	mux.HandleFunc("/api/v1/settings", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(n.Settings)
			return
		}
		var updated RuntimeSettings
		if err := json.NewDecoder(r.Body).Decode(&updated); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		n.mu.Lock()
		if updated.DeviceName != "" {
			n.Settings.DeviceName = updated.DeviceName
			n.DeviceMgr.UpdateSelfName(updated.DeviceName)
		}
		if updated.Preset != "" {
			n.Settings.Preset = updated.Preset
		}
		if updated.UploadRateMBps > 0 {
			n.Settings.UploadRateMBps = updated.UploadRateMBps
		}
		if updated.DownloadRateMBps > 0 {
			n.Settings.DownloadRateMBps = updated.DownloadRateMBps
		}
		if updated.ParallelStreams > 0 {
			n.Settings.ParallelStreams = updated.ParallelStreams
			n.QueueMgr.SetMaxConcurrent(updated.ParallelStreams)
		}
		if updated.Visibility != "" {
			n.Settings.Visibility = updated.Visibility
			n.DiscoverySvc.SetVisibility(updated.Visibility)
		}
		n.Settings.AutoAcceptPaired = updated.AutoAcceptPaired
		n.DeviceMgr.SetAutoAcceptTrusted(updated.AutoAcceptPaired)

		if n.Settings.Preset == "turbo" {
			n.TransferEng.SetBandwidthLimits(0, 0)
		} else {
			n.TransferEng.SetBandwidthLimits(n.Settings.UploadRateMBps, n.Settings.DownloadRateMBps)
		}
		cur := n.Settings
		n.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(cur)
	}))

	// 8. Real-Time Server-Sent Events Stream for React Native & Next.js live telemetry
	mux.HandleFunc("/api/v1/events", withCORS(func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		ch := make(chan Event, 32)
		n.mu.Lock()
		n.subscribers[ch] = struct{}{}
		n.mu.Unlock()
		defer func() {
			n.mu.Lock()
			delete(n.subscribers, ch)
			n.mu.Unlock()
		}()

		for {
			select {
			case <-r.Context().Done():
				return
			case evt := <-ch:
				data, _ := json.Marshal(evt)
				_, _ = fmt.Fprintf(w, "data: %s\n\n", string(data))
				flusher.Flush()
			}
		}
	}))

	ln, err := net.Listen("tcp", bindAddr)
	if err != nil {
		return err
	}
	srv := &http.Server{Handler: mux}
	n.mu.Lock()
	n.controlSrv = srv
	n.mu.Unlock()

	go func() {
		_ = srv.Serve(ln)
	}()
	return nil
}
