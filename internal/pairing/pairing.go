package pairing

import (
	"crypto/subtle"
	"encoding/json"
	"strings"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/internal/security"
)

// Session represents an ephemeral QR or PIN pairing session
type Session struct {
	SessionID      string              `json:"session_id"`
	Token          string              `json:"token"`
	PIN            string              `json:"pin"`
	HostDevice     protocol.DeviceInfo `json:"host_device"`
	PeerDevice     *protocol.DeviceInfo `json:"peer_device,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
	ExpiresAt      time.Time           `json:"expires_at"`
	Consumed       bool                `json:"consumed"`
	Authorized     bool                `json:"authorized"`
	Rejected       bool                `json:"rejected"`
	AuthSessionKey string              `json:"auth_session_key,omitempty"`
}

// Service manages QR pairing generation, token validation, replay protection, and authorized sessions
type Service struct {
	mu               sync.RWMutex
	sessions         map[string]*Session
	usedTokens       map[string]time.Time
	authorizedPeers  map[string]string // sessionID -> peerDeviceID
	activePIN        string
	activePINSession string
	defaultTTL       time.Duration
}

// NewService creates a new Pairing Service with configurable short expiry TTL
func NewService(ttl time.Duration) *Service {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &Service{
		sessions:        make(map[string]*Session),
		usedTokens:      make(map[string]time.Time),
		authorizedPeers: make(map[string]string),
		defaultTTL:      ttl,
	}
}

// GenerateSession creates a short-lived, one-time QR & PIN pairing session
func (s *Service) GenerateSession(host protocol.DeviceInfo, customTTL time.Duration) (*Session, protocol.QRPairingPayload, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ttl := s.defaultTTL
	if customTTL != 0 {
		ttl = customTTL
	}

	sidRand, err := security.GenerateRandomToken(8)
	if err != nil {
		return nil, protocol.QRPairingPayload{}, err
	}
	token, err := security.GenerateRandomToken(16)
	if err != nil {
		return nil, protocol.QRPairingPayload{}, err
	}
	pin, err := security.GenerateNumericPIN()
	if err != nil {
		return nil, protocol.QRPairingPayload{}, err
	}

	now := time.Now()
	sess := &Session{
		SessionID:  "pair_" + sidRand,
		Token:      token,
		PIN:        pin,
		HostDevice: host,
		CreatedAt:  now,
		ExpiresAt:  now.Add(ttl),
		Consumed:   false,
		Authorized: false,
	}

	s.sessions[sess.SessionID] = sess
	s.activePIN = pin
	s.activePINSession = sess.SessionID

	payload := protocol.QRPairingPayload{
		ProtocolVersion: protocol.ProtocolVersion,
		SessionID:       sess.SessionID,
		DeviceID:        host.DeviceID,
		DeviceName:      host.DeviceName,
		DeviceType:      host.DeviceType,
		IPAddress:       host.IPAddress,
		Port:            host.Port,
		Token:           sess.Token,
		PIN:             sess.PIN,
		TLSFingerprint:  host.TLSFingerprint,
		ExpiresAt:       sess.ExpiresAt.Unix(),
	}
	return sess, payload, nil
}

// EncodeQRPayload serializes a QRPairingPayload into a compact JSON string for QR encoding
func EncodeQRPayload(p protocol.QRPairingPayload) (string, error) {
	b, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// DecodeQRPayload parses and validates a scanned QR payload JSON string
func DecodeQRPayload(raw string) (protocol.QRPairingPayload, error) {
	var p protocol.QRPairingPayload
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return p, protocol.NewError(protocol.ErrCodePairingInvalid, "malformed QR pairing payload")
	}
	if err := protocol.ValidateProtocolVersion(p.ProtocolVersion); err != nil {
		return p, err
	}
	if strings.TrimSpace(p.SessionID) == "" || strings.TrimSpace(p.Token) == "" {
		return p, protocol.NewError(protocol.ErrCodePairingInvalid, "QR payload missing session_id or token")
	}
	if time.Now().Unix() > p.ExpiresAt {
		return p, protocol.NewError(protocol.ErrCodePairingExpired, "QR pairing session has expired")
	}
	return p, nil
}

// RejectSession explicitly rejects an active pairing session
func (s *Service) RejectSession(sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[sessionID]
	if !ok {
		return protocol.NewError(protocol.ErrCodePairingInvalid, "unknown pairing session")
	}
	sess.Rejected = true
	sess.Consumed = true
	return nil
}

// ValidateAndAuthorize validates an incoming PairingRequest (via QR token or PIN), enforces one-time use and expiry
func (s *Service) ValidateAndAuthorize(req protocol.PairingRequest) (protocol.PairingResponse, error) {
	if err := protocol.ValidateProtocolVersion(req.ProtocolVersion); err != nil {
		return protocol.PairingResponse{
			Authorized:   false,
			ErrorCode:    protocol.ErrCodeProtocolMismatch,
			ErrorMessage: err.Error(),
		}, err
	}
	if strings.TrimSpace(req.PeerDevice.DeviceID) == "" {
		err := protocol.NewError(protocol.ErrCodePairingInvalid, "peer device identity missing")
		return protocol.PairingResponse{
			Authorized:   false,
			ErrorCode:    err.Code,
			ErrorMessage: err.Message,
		}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Replay check on token if provided
	if req.Token != "" {
		if _, used := s.usedTokens[req.Token]; used {
			err := protocol.NewError(protocol.ErrCodePairingReplay, "pairing token has already been used (replay blocked)")
			return protocol.PairingResponse{
				Authorized:   false,
				SessionID:    req.SessionID,
				ErrorCode:    err.Code,
				ErrorMessage: err.Message,
			}, err
		}
	}

	sessionID := req.SessionID
	if sessionID == "" && req.PIN != "" {
		sessionID = s.activePINSession
	}

	sess, exists := s.sessions[sessionID]
	if !exists {
		err := protocol.NewError(protocol.ErrCodePairingInvalid, "pairing session not found")
		return protocol.PairingResponse{
			Authorized:   false,
			SessionID:    req.SessionID,
			ErrorCode:    err.Code,
			ErrorMessage: err.Message,
		}, err
	}

	if sess.Rejected {
		err := protocol.NewError(protocol.ErrCodePairingRejected, "pairing session was rejected by host")
		return protocol.PairingResponse{
			Authorized:   false,
			SessionID:    sess.SessionID,
			ErrorCode:    err.Code,
			ErrorMessage: err.Message,
		}, err
	}

	if sess.Consumed {
		err := protocol.NewError(protocol.ErrCodePairingReplay, "pairing session already consumed")
		return protocol.PairingResponse{
			Authorized:   false,
			SessionID:    sess.SessionID,
			ErrorCode:    err.Code,
			ErrorMessage: err.Message,
		}, err
	}

	if time.Now().After(sess.ExpiresAt) {
		sess.Consumed = true
		err := protocol.NewError(protocol.ErrCodePairingExpired, "pairing session expired")
		return protocol.PairingResponse{
			Authorized:   false,
			SessionID:    sess.SessionID,
			ErrorCode:    err.Code,
			ErrorMessage: err.Message,
		}, err
	}

	// Constant-time credential verification (either QR Token or 4-digit PIN)
	tokenMatch := req.Token != "" && subtle.ConstantTimeCompare([]byte(req.Token), []byte(sess.Token)) == 1
	cleanPIN := strings.TrimSpace(strings.TrimPrefix(req.PIN, "DROP ·"))
	cleanPIN = strings.ReplaceAll(cleanPIN, " ", "")
	pinMatch := cleanPIN != "" && subtle.ConstantTimeCompare([]byte(cleanPIN), []byte(sess.PIN)) == 1

	if !tokenMatch && !pinMatch {
		err := protocol.NewError(protocol.ErrCodePairingInvalid, "invalid pairing token or PIN credential")
		return protocol.PairingResponse{
			Authorized:   false,
			SessionID:    sess.SessionID,
			ErrorCode:    err.Code,
			ErrorMessage: err.Message,
		}, err
	}

	// Mark token and session consumed (one-time usage)
	sess.Consumed = true
	sess.Authorized = true
	peerCopy := req.PeerDevice
	sess.PeerDevice = &peerCopy
	if sess.Token != "" {
		s.usedTokens[sess.Token] = time.Now()
	}

	authKey, err := security.GenerateRandomToken(24)
	if err != nil {
		return protocol.PairingResponse{}, err
	}
	sess.AuthSessionKey = authKey
	s.authorizedPeers[authKey] = req.PeerDevice.DeviceID
	s.authorizedPeers[sess.SessionID] = req.PeerDevice.DeviceID

	return protocol.PairingResponse{
		Authorized:     true,
		SessionID:      sess.SessionID,
		AuthSessionKey: authKey,
		HostDevice:     sess.HostDevice,
	}, nil
}

// IsSessionAuthorized checks if a session ID or auth key is authorized for the given peerDeviceID
func (s *Service) IsSessionAuthorized(sessionOrKey, peerDeviceID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	authorizedPeer, ok := s.authorizedPeers[sessionOrKey]
	if !ok {
		return false
	}
	return authorizedPeer == peerDeviceID
}

// AuthorizeTrustedSession registers an authorized session directly for an already-trusted peer
func (s *Service) AuthorizeTrustedSession(sessionID, peerDeviceID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.authorizedPeers[sessionID] = peerDeviceID
}

// ActiveSession returns the current active QR/PIN session if still valid
func (s *Service) ActiveSession() *Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.activePINSession == "" {
		return nil
	}
	sess, ok := s.sessions[s.activePINSession]
	if !ok || sess.Consumed || time.Now().After(sess.ExpiresAt) {
		return nil
	}
	cp := *sess
	return &cp
}
