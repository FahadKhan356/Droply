package protocol

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"
)

const (
	ProtocolVersion     = "1.0"
	BeaconMagic         = "DROPLY_BEACON"
	DefaultTransferPort = 53317
	DefaultControlPort  = 53318
	DefaultDiscoveryUDP = 53319
	MulticastGroupIPv4  = "224.0.0.251:53319"
	DefaultChunkSize    = 512 * 1024 // 512 KB bounded streaming chunk
	MaxDefaultFileSize  = 100 * 1024 * 1024 * 1024 // 100 GB default configurable limit
)

// Standard Error Codes
const (
	ErrCodeProtocolMismatch   = "ERR_PROTOCOL_MISMATCH"
	ErrCodePairingExpired     = "ERR_PAIRING_EXPIRED"
	ErrCodePairingInvalid     = "ERR_PAIRING_INVALID"
	ErrCodePairingReplay      = "ERR_PAIRING_TOKEN_REPLAY"
	ErrCodePairingRejected    = "ERR_PAIRING_REJECTED"
	ErrCodeUnauthorizedDevice = "ERR_UNAUTHORIZED_DEVICE"
	ErrCodeInvalidMetadata    = "ERR_INVALID_METADATA"
	ErrCodeFileSizeExceeded   = "ERR_FILE_SIZE_EXCEEDED"
	ErrCodePathTraversal      = "ERR_PATH_TRAVERSAL"
	ErrCodeInsufficientDisk   = "ERR_INSUFFICIENT_STORAGE"
	ErrCodeTransferRejected   = "ERR_TRANSFER_REJECTED"
	ErrCodeChecksumMismatch   = "ERR_CHECKSUM_MISMATCH"
	ErrCodeTransferPaused     = "ERR_TRANSFER_PAUSED"
	ErrCodeTransferCancelled  = "ERR_TRANSFER_CANCELLED"
	ErrCodeRateLimited        = "ERR_RATE_LIMITED"
	ErrCodeResumeUnsupported  = "ERR_RESUME_UNSUPPORTED"
)

// ProtocolError provides structured error code + human message
type ProtocolError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *ProtocolError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func NewError(code, msg string) *ProtocolError {
	return &ProtocolError{Code: code, Message: msg}
}

// ConnectionState represents the 8 required connection states
type ConnectionState string

const (
	ConnStateDisconnected ConnectionState = "Disconnected"
	ConnStateDiscovering  ConnectionState = "Discovering"
	ConnStateConnecting   ConnectionState = "Connecting"
	ConnStatePairing      ConnectionState = "Pairing"
	ConnStateConnected    ConnectionState = "Connected"
	ConnStateTransferring ConnectionState = "Transferring"
	ConnStateInterrupted  ConnectionState = "Interrupted"
	ConnStateFailed       ConnectionState = "Failed"
)

// TransferStatus represents the 12 required transfer lifecycle statuses
type TransferStatus string

const (
	StatusQueued             TransferStatus = "Queued"
	StatusConnecting         TransferStatus = "Connecting"
	StatusWaitingForApproval TransferStatus = "Waiting for Approval"
	StatusPreparing          TransferStatus = "Preparing"
	StatusTransferring       TransferStatus = "Transferring"
	StatusPaused             TransferStatus = "Paused"
	StatusInterrupted        TransferStatus = "Interrupted"
	StatusVerifying          TransferStatus = "Verifying"
	StatusCompleted          TransferStatus = "Completed"
	StatusFailed             TransferStatus = "Failed"
	StatusCancelled          TransferStatus = "Cancelled"
	StatusRejected           TransferStatus = "Rejected"
)

// DeviceInfo represents discovered or connected peer information
type DeviceInfo struct {
	DeviceID        string          `json:"device_id"`
	DeviceName      string          `json:"device_name"`
	DeviceType      string          `json:"device_type"` // android, ios, mac, windows, tablet
	Platform        string          `json:"platform"`    // android, ios, darwin, windows, linux
	IPAddress       string          `json:"ip_address"`
	Port            int             `json:"port"`
	Capabilities    []string        `json:"capabilities"`
	ProtocolVersion string          `json:"protocol_version"`
	TLSFingerprint  string          `json:"tls_fingerprint,omitempty"`
	Online          bool            `json:"online"`
	LastSeen        time.Time       `json:"last_seen"`
	ConnectionState ConnectionState `json:"connection_state"`
	Trusted         bool            `json:"trusted"`
	DistanceHint    string          `json:"distance_hint,omitempty"`
	ProtocolBadge   string          `json:"protocol_badge,omitempty"`
}

// DiscoveryBeacon is broadcasted over UDP LAN
type DiscoveryBeacon struct {
	Magic           string   `json:"magic"`
	ProtocolVersion string   `json:"protocol_version"`
	DeviceID        string   `json:"device_id"`
	DeviceName      string   `json:"device_name"`
	DeviceType      string   `json:"device_type"`
	Platform        string   `json:"platform"`
	IPAddress       string   `json:"ip_address"`
	Port            int      `json:"port"`
	TLSFingerprint  string   `json:"tls_fingerprint"`
	Capabilities    []string `json:"capabilities"`
	Timestamp       int64    `json:"timestamp"`
}

// QRPairingPayload is encoded into the QR code for pairing
type QRPairingPayload struct {
	ProtocolVersion string `json:"v"`
	SessionID       string `json:"sid"`
	DeviceID        string `json:"id"`
	DeviceName      string `json:"name"`
	DeviceType      string `json:"type"`
	IPAddress       string `json:"ip"`
	Port            int    `json:"port"`
	Token           string `json:"token"`
	PIN             string `json:"pin"`
	TLSFingerprint  string `json:"fp"`
	ExpiresAt       int64  `json:"exp"`
}

// PairingRequest is sent by receiver/initiator to authorize pairing
type PairingRequest struct {
	ProtocolVersion string     `json:"protocol_version"`
	SessionID       string     `json:"session_id"`
	Token           string     `json:"token"`
	PIN             string     `json:"pin,omitempty"`
	PeerDevice      DeviceInfo `json:"peer_device"`
	Timestamp       int64      `json:"timestamp"`
}

// PairingResponse confirms or rejects a pairing attempt
type PairingResponse struct {
	Authorized      bool       `json:"authorized"`
	SessionID       string     `json:"session_id"`
	AuthSessionKey  string     `json:"auth_session_key,omitempty"`
	HostDevice      DeviceInfo `json:"host_device"`
	ErrorCode       string     `json:"error_code,omitempty"`
	ErrorMessage    string     `json:"error_message,omitempty"`
}

// FileMetadata contains validated metadata for a single file in a transfer
type FileMetadata struct {
	FileID       string `json:"file_id"`
	FileName     string `json:"file_name"`
	RelativePath string `json:"relative_path,omitempty"`
	FileSize     int64  `json:"file_size"`
	MimeType     string `json:"mime_type"`
	Extension    string `json:"extension"`
	SHA256       string `json:"sha256"`
	ChunkSize    int    `json:"chunk_size"`
	TotalChunks  int    `json:"total_chunks"`
	ThumbnailB64 string `json:"thumbnail_b64,omitempty"`
	SourcePath   string `json:"source_path,omitempty"`
}

// TransferOffer is sent by sender to request receiver approval
type TransferOffer struct {
	ProtocolVersion string         `json:"protocol_version"`
	SessionID       string         `json:"session_id"`
	TransferID      string         `json:"transfer_id"`
	Sender          DeviceInfo     `json:"sender"`
	Files           []FileMetadata `json:"files"`
	TotalSize       int64          `json:"total_size"`
	Timestamp       int64          `json:"timestamp"`
}

// TransferOfferResponse indicates whether receiver accepted or queued for approval
type TransferOfferResponse struct {
	TransferID   string         `json:"transfer_id"`
	Status       TransferStatus `json:"status"`
	Approved     bool           `json:"approved"`
	ChunkSize    int            `json:"chunk_size"`
	ErrorCode    string         `json:"error_code,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
}

// ChunkCheckpointResponse reports already verified chunks for resuming
type ChunkCheckpointResponse struct {
	TransferID          string `json:"transfer_id"`
	FileID              string `json:"file_id"`
	ReceivedChunks      []int  `json:"received_chunks"`
	NextContiguousChunk int    `json:"next_contiguous_chunk"`
	BytesReceived       int64  `json:"bytes_received"`
	CanResume           bool   `json:"can_resume"`
}

// ValidateProtocolVersion checks compatibility
func ValidateProtocolVersion(v string) error {
	if strings.TrimSpace(v) != ProtocolVersion {
		return NewError(ErrCodeProtocolMismatch, fmt.Sprintf("unsupported protocol version %q (expected %q)", v, ProtocolVersion))
	}
	return nil
}

// ValidateFileMetadata enforces non-empty safe filename, bounds, and chunk math
func ValidateFileMetadata(meta FileMetadata, maxFileSize int64) error {
	if strings.TrimSpace(meta.FileID) == "" {
		return NewError(ErrCodeInvalidMetadata, "file_id cannot be empty")
	}
	if strings.TrimSpace(meta.FileName) == "" {
		return NewError(ErrCodeInvalidMetadata, "file_name cannot be empty")
	}
	if meta.FileSize < 0 {
		return NewError(ErrCodeInvalidMetadata, "file_size cannot be negative")
	}
	if maxFileSize > 0 && meta.FileSize > maxFileSize {
		return NewError(ErrCodeFileSizeExceeded, fmt.Sprintf("file %q size %d exceeds maximum limit %d", meta.FileName, meta.FileSize, maxFileSize))
	}
	// Check for path traversal sequences in FileName or RelativePath
	if ContainsPathTraversal(meta.FileName) || ContainsPathTraversal(meta.RelativePath) {
		return NewError(ErrCodePathTraversal, fmt.Sprintf("unsafe path detected in %q", meta.FileName))
	}
	if len(meta.SHA256) != 64 {
		return NewError(ErrCodeInvalidMetadata, "file sha256 must be a 64-character hex digest")
	}
	return nil
}

// ContainsPathTraversal detects directory traversal attempts across Unix and Windows paths
func ContainsPathTraversal(p string) bool {
	if p == "" {
		return false
	}
	if strings.Contains(p, "\x00") {
		return true
	}
	normalized := strings.ReplaceAll(p, "\\", "/")
	if strings.HasPrefix(normalized, "/") || strings.Contains(normalized, ":") {
		return true
	}
	parts := strings.Split(normalized, "/")
	for _, part := range parts {
		if part == ".." {
			return true
		}
	}
	cleaned := filepath.Clean(normalized)
	return strings.HasPrefix(cleaned, "..") || strings.HasPrefix(cleaned, "/")
}

var ErrNotFound = errors.New("not found")
