package connection

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/internal/security"
)

// PeerSession tracks the connection state, heartbeat, and session credentials for a remote peer
type PeerSession struct {
	Peer            protocol.DeviceInfo      `json:"peer"`
	State           protocol.ConnectionState `json:"state"`
	SessionID       string                   `json:"session_id,omitempty"`
	AuthSessionKey  string                   `json:"auth_session_key,omitempty"`
	LastHeartbeat   time.Time                `json:"last_heartbeat"`
	FailedAttempts  int                      `json:"failed_attempts"`
	LastError       string                   `json:"last_error,omitempty"`
}

// HandshakePayload is exchanged during connection initialization and heartbeat checks
type HandshakePayload struct {
	ProtocolVersion string              `json:"protocol_version"`
	Device          protocol.DeviceInfo `json:"device"`
	Timestamp       int64               `json:"timestamp"`
}

// Manager manages active peer connections, state transitions, TLS handshakes, and heartbeats
type Manager struct {
	mu          sync.RWMutex
	selfFn      func() protocol.DeviceInfo
	tlsIdentity *security.TLSIdentity
	sessions    map[string]*PeerSession // deviceID -> PeerSession
	timeout     time.Duration
}

// NewManager creates a new Connection Manager
func NewManager(selfFn func() protocol.DeviceInfo, tlsID *security.TLSIdentity, timeout time.Duration) *Manager {
	if timeout <= 0 {
		timeout = 8 * time.Second
	}
	return &Manager{
		selfFn:      selfFn,
		tlsIdentity: tlsID,
		sessions:    make(map[string]*PeerSession),
		timeout:     timeout,
	}
}

// SetState updates the connection state for a given deviceID
func (m *Manager) SetState(deviceID string, state protocol.ConnectionState, errMsg string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	sess, ok := m.sessions[deviceID]
	if !ok {
		sess = &PeerSession{
			Peer: protocol.DeviceInfo{DeviceID: deviceID},
		}
		m.sessions[deviceID] = sess
	}
	sess.State = state
	sess.LastError = errMsg
	if state == protocol.ConnStateConnected || state == protocol.ConnStateTransferring {
		sess.LastHeartbeat = time.Now()
		sess.FailedAttempts = 0
	}
}

// GetState returns the current ConnectionState for a device
func (m *Manager) GetState(deviceID string) protocol.ConnectionState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	sess, ok := m.sessions[deviceID]
	if !ok {
		return protocol.ConnStateDisconnected
	}
	return sess.State
}

// GetSession retrieves a copy of the PeerSession
func (m *Manager) GetSession(deviceID string) (PeerSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	sess, ok := m.sessions[deviceID]
	if !ok {
		return PeerSession{}, false
	}
	return *sess, true
}

// HTTPClientForPeer creates an HTTPS client configured with TLS 1.3 and certificate fingerprint pinning
func (m *Manager) HTTPClientForPeer(expectedFingerprint string) *http.Client {
	return &http.Client{
		Timeout: m.timeout,
		Transport: &http.Transport{
			TLSClientConfig:     m.tlsIdentity.ClientTLSConfig(expectedFingerprint),
			IdleConnTimeout:     30 * time.Second,
			TLSHandshakeTimeout: 5 * time.Second,
		},
	}
}

// ConnectAndHandshake performs a TLS 1.3 handshake and protocol version validation against a remote peer
func (m *Manager) ConnectAndHandshake(ctx context.Context, peer protocol.DeviceInfo) (protocol.DeviceInfo, error) {
	m.SetState(peer.DeviceID, protocol.ConnStateConnecting, "")

	client := m.HTTPClientForPeer(peer.TLSFingerprint)
	reqBody := HandshakePayload{
		ProtocolVersion: protocol.ProtocolVersion,
		Device:          m.selfFn(),
		Timestamp:       time.Now().Unix(),
	}
	data, err := json.Marshal(reqBody)
	if err != nil {
		m.SetState(peer.DeviceID, protocol.ConnStateFailed, err.Error())
		return protocol.DeviceInfo{}, err
	}

	url := fmt.Sprintf("https://%s:%d/p2p/v1/handshake", peer.IPAddress, peer.Port)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		m.SetState(peer.DeviceID, protocol.ConnStateFailed, err.Error())
		return protocol.DeviceInfo{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		m.SetState(peer.DeviceID, protocol.ConnStateFailed, err.Error())
		return protocol.DeviceInfo{}, err
	}
	defer resp.Body.Close()

	var remoteHandshake HandshakePayload
	if err := json.NewDecoder(resp.Body).Decode(&remoteHandshake); err != nil {
		m.SetState(peer.DeviceID, protocol.ConnStateFailed, err.Error())
		return protocol.DeviceInfo{}, err
	}

	if err := protocol.ValidateProtocolVersion(remoteHandshake.ProtocolVersion); err != nil {
		m.SetState(peer.DeviceID, protocol.ConnStateFailed, err.Error())
		return protocol.DeviceInfo{}, err
	}

	remotePeer := remoteHandshake.Device
	if remotePeer.IPAddress == "" {
		remotePeer.IPAddress = peer.IPAddress
	}
	if remotePeer.Port == 0 {
		remotePeer.Port = peer.Port
	}
	remotePeer.Online = true
	remotePeer.LastSeen = time.Now()
	remotePeer.ConnectionState = protocol.ConnStateConnected

	m.mu.Lock()
	sess, ok := m.sessions[remotePeer.DeviceID]
	if !ok {
		sess = &PeerSession{}
		m.sessions[remotePeer.DeviceID] = sess
	}
	sess.Peer = remotePeer
	sess.State = protocol.ConnStateConnected
	sess.LastHeartbeat = time.Now()
	sess.FailedAttempts = 0
	sess.LastError = ""
	m.mu.Unlock()

	return remotePeer, nil
}

// PairWithPeer initiates QR or PIN pairing over TLS 1.3 with a remote host
func (m *Manager) PairWithPeer(ctx context.Context, targetIP string, targetPort int, expectedFP, sessionID, token, pin string) (protocol.PairingResponse, error) {
	tempID := fmt.Sprintf("%s:%d", targetIP, targetPort)
	m.SetState(tempID, protocol.ConnStatePairing, "")

	client := m.HTTPClientForPeer(expectedFP)
	pairReq := protocol.PairingRequest{
		ProtocolVersion: protocol.ProtocolVersion,
		SessionID:       sessionID,
		Token:           token,
		PIN:             pin,
		PeerDevice:      m.selfFn(),
		Timestamp:       time.Now().Unix(),
	}
	body, err := json.Marshal(pairReq)
	if err != nil {
		return protocol.PairingResponse{}, err
	}

	url := fmt.Sprintf("https://%s:%d/p2p/v1/pair", targetIP, targetPort)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return protocol.PairingResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		m.SetState(tempID, protocol.ConnStateFailed, err.Error())
		return protocol.PairingResponse{}, err
	}
	defer resp.Body.Close()

	var pairResp protocol.PairingResponse
	if err := json.NewDecoder(resp.Body).Decode(&pairResp); err != nil {
		m.SetState(tempID, protocol.ConnStateFailed, err.Error())
		return protocol.PairingResponse{}, err
	}

	if !pairResp.Authorized {
		m.SetState(tempID, protocol.ConnStateFailed, pairResp.ErrorMessage)
		return pairResp, protocol.NewError(pairResp.ErrorCode, pairResp.ErrorMessage)
	}

	hostDev := pairResp.HostDevice
	if hostDev.IPAddress == "" {
		hostDev.IPAddress = targetIP
	}
	if hostDev.Port == 0 {
		hostDev.Port = targetPort
	}
	hostDev.ConnectionState = protocol.ConnStateConnected
	hostDev.Online = true

	m.mu.Lock()
	m.sessions[hostDev.DeviceID] = &PeerSession{
		Peer:           hostDev,
		State:          protocol.ConnStateConnected,
		SessionID:      pairResp.SessionID,
		AuthSessionKey: pairResp.AuthSessionKey,
		LastHeartbeat:  time.Now(),
	}
	m.mu.Unlock()

	return pairResp, nil
}

// Disconnect cleanly disconnects a peer session
func (m *Manager) Disconnect(deviceID string) {
	m.SetState(deviceID, protocol.ConnStateDisconnected, "")
}
