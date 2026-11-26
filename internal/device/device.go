package device

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/protocol"
)

// TrustedDevice represents a paired and trusted remote peer stored securely
type TrustedDevice struct {
	DeviceID          string    `json:"device_id"`
	DeviceName        string    `json:"device_name"`
	CustomAlias       string    `json:"custom_alias,omitempty"`
	DeviceType        string    `json:"device_type"`
	Platform          string    `json:"platform"`
	TLSFingerprint    string    `json:"tls_fingerprint"`
	LastIP            string    `json:"last_ip"`
	LastPort          int       `json:"last_port"`
	SupportedFeatures []string  `json:"supported_features"`
	AutoAccept        bool      `json:"auto_accept"`
	PairedAt          time.Time `json:"paired_at"`
	LastConnectedAt   time.Time `json:"last_connected_at"`
}

// DisplayName returns the custom alias if set, otherwise the device's advertised name
func (td TrustedDevice) DisplayName() string {
	if strings.TrimSpace(td.CustomAlias) != "" {
		return td.CustomAlias
	}
	return td.DeviceName
}

// Manager manages the local device identity and trusted peer store
type Manager struct {
	mu           sync.RWMutex
	self         protocol.DeviceInfo
	trusted      map[string]TrustedDevice
	storePath    string
	autoAcceptAllTrusted bool
}

// NewManager initializes the Device and Trust Manager with local persistence
func NewManager(storageDir, deviceID, deviceName string, port int, tlsFingerprint string) (*Manager, error) {
	if err := os.MkdirAll(storageDir, 0700); err != nil {
		return nil, err
	}
	devType := detectDeviceType()
	self := protocol.DeviceInfo{
		DeviceID:        deviceID,
		DeviceName:      deviceName,
		DeviceType:      devType,
		Platform:        runtime.GOOS,
		Port:            port,
		Capabilities:    []string{"tls1.3", "chunk-resume", "multi-file", "qr-pair", "sha256-verify"},
		ProtocolVersion: protocol.ProtocolVersion,
		TLSFingerprint:  tlsFingerprint,
		Online:          true,
		LastSeen:        time.Now(),
		ConnectionState: protocol.ConnStateConnected,
	}

	m := &Manager{
		self:                 self,
		trusted:              make(map[string]TrustedDevice),
		storePath:            filepath.Join(storageDir, "trusted_devices.json"),
		autoAcceptAllTrusted: false,
	}
	_ = m.load()
	return m, nil
}

func detectDeviceType() string {
	switch runtime.GOOS {
	case "darwin":
		return "mac"
	case "windows":
		return "windows"
	case "android":
		return "android"
	case "ios":
		return "ios"
	default:
		return "mac"
	}
}

// Self returns a copy of the local device info
func (m *Manager) Self() protocol.DeviceInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	cp := m.self
	cp.LastSeen = time.Now()
	return cp
}

// UpdateSelfName updates the broadcast label of this device
func (m *Manager) UpdateSelfName(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if strings.TrimSpace(name) != "" {
		m.self.DeviceName = strings.TrimSpace(name)
	}
}

// UpdateSelfIP updates the primary local IP address
func (m *Manager) UpdateSelfIP(ip string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.self.IPAddress = ip
}

// SetAutoAcceptTrusted configures whether verified trusted devices auto-accept incoming transfers
func (m *Manager) SetAutoAcceptTrusted(enabled bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.autoAcceptAllTrusted = enabled
}

// AutoAcceptTrusted returns the global trusted auto-accept preference
func (m *Manager) AutoAcceptTrusted() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.autoAcceptAllTrusted
}

// RegisterTrusted registers or updates a paired trusted device
func (m *Manager) RegisterTrusted(info protocol.DeviceInfo, autoAccept bool) (TrustedDevice, error) {
	if strings.TrimSpace(info.DeviceID) == "" {
		return TrustedDevice{}, errors.New("device_id is required")
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	existing, exists := m.trusted[info.DeviceID]
	pairedAt := now
	alias := ""
	if exists {
		pairedAt = existing.PairedAt
		alias = existing.CustomAlias
	}

	td := TrustedDevice{
		DeviceID:          info.DeviceID,
		DeviceName:        info.DeviceName,
		CustomAlias:       alias,
		DeviceType:        info.DeviceType,
		Platform:          info.Platform,
		TLSFingerprint:    info.TLSFingerprint,
		LastIP:            info.IPAddress,
		LastPort:          info.Port,
		SupportedFeatures: info.Capabilities,
		AutoAccept:        autoAccept,
		PairedAt:          pairedAt,
		LastConnectedAt:   now,
	}
	m.trusted[info.DeviceID] = td
	err := m.saveLocked()
	return td, err
}

// IsTrusted checks if a device ID is in the trusted registry and optionally verifies TLS fingerprint
func (m *Manager) IsTrusted(deviceID, tlsFingerprint string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	td, ok := m.trusted[deviceID]
	if !ok {
		return false
	}
	if tlsFingerprint != "" && td.TLSFingerprint != "" && td.TLSFingerprint != tlsFingerprint {
		return false
	}
	return true
}

// ShouldAutoAccept determines if an incoming transfer from a verified peer can auto-start
// Note: Even trusted devices must pass pairing/session validation first.
func (m *Manager) ShouldAutoAccept(deviceID, tlsFingerprint string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	td, ok := m.trusted[deviceID]
	if !ok {
		return false
	}
	if tlsFingerprint != "" && td.TLSFingerprint != "" && td.TLSFingerprint != tlsFingerprint {
		return false
	}
	return m.autoAcceptAllTrusted || td.AutoAccept
}

// RenameTrusted updates a trusted device's friendly alias
func (m *Manager) RenameTrusted(deviceID, newName string) (TrustedDevice, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	td, ok := m.trusted[deviceID]
	if !ok {
		return TrustedDevice{}, protocol.ErrNotFound
	}
	td.CustomAlias = strings.TrimSpace(newName)
	if td.CustomAlias != "" {
		td.DeviceName = td.CustomAlias
	}
	m.trusted[deviceID] = td
	err := m.saveLocked()
	return td, err
}

// RevokeTrust removes a device from the trusted list immediately
func (m *Manager) RevokeTrust(deviceID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.trusted[deviceID]; !ok {
		return protocol.ErrNotFound
	}
	delete(m.trusted, deviceID)
	return m.saveLocked()
}

// TouchConnected updates the last connected timestamp for a trusted device
func (m *Manager) TouchConnected(deviceID, ip string, port int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if td, ok := m.trusted[deviceID]; ok {
		td.LastConnectedAt = time.Now()
		if ip != "" {
			td.LastIP = ip
		}
		if port > 0 {
			td.LastPort = port
		}
		m.trusted[deviceID] = td
		_ = m.saveLocked()
	}
}

// ListTrusted returns all registered trusted devices
func (m *Manager) ListTrusted() []TrustedDevice {
	m.mu.RLock()
	defer m.mu.RUnlock()
	list := make([]TrustedDevice, 0, len(m.trusted))
	for _, td := range m.trusted {
		list = append(list, td)
	}
	return list
}

func (m *Manager) load() error {
	data, err := os.ReadFile(m.storePath)
	if err != nil {
		return err
	}
	var list []TrustedDevice
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}
	for _, td := range list {
		m.trusted[td.DeviceID] = td
	}
	return nil
}

func (m *Manager) saveLocked() error {
	list := make([]TrustedDevice, 0, len(m.trusted))
	for _, td := range m.trusted {
		list = append(list, td)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	tmpPath := m.storePath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0600); err != nil {
		return err
	}
	return os.Rename(tmpPath, m.storePath)
}
