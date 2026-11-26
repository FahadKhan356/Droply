package history

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/internal/transfer"
)

// Entry represents a persistent offline transfer history record
type Entry struct {
	TransferID       string                  `json:"transfer_id"`
	Direction        string                  `json:"direction"` // "send" or "receive"
	PeerDeviceID     string                  `json:"peer_device_id"`
	PeerDeviceName   string                  `json:"peer_device_name"`
	PeerIP           string                  `json:"peer_ip"`
	PeerPort         int                     `json:"peer_port"`
	FileNames        []string                `json:"file_names"`
	SourcePaths      []string                `json:"source_paths,omitempty"`
	SavedLocations   []string                `json:"saved_locations,omitempty"`
	TotalSizeBytes   int64                   `json:"total_size_bytes"`
	DurationSeconds  float64                 `json:"duration_seconds"`
	AverageSpeedMBps float64                 `json:"average_speed_mbps"`
	Status           protocol.TransferStatus `json:"status"`
	ErrorMessage     string                  `json:"error_message,omitempty"`
	Timestamp        time.Time               `json:"timestamp"`
}

// Manager manages offline local persistence of transfer history
type Manager struct {
	mu      sync.RWMutex
	dbPath  string
	records map[string]Entry
}

// NewManager initializes the offline local history database
func NewManager(storageDir string) (*Manager, error) {
	if err := os.MkdirAll(storageDir, 0700); err != nil {
		return nil, err
	}
	m := &Manager{
		dbPath:  filepath.Join(storageDir, "transfer_history.db.json"),
		records: make(map[string]Entry),
	}
	_ = m.load()
	return m, nil
}

// RecordFromTransfer converts a live transfer.Record into a persistent history Entry
func (m *Manager) RecordFromTransfer(rec transfer.Record) (Entry, error) {
	peer := rec.Receiver
	if rec.Direction == "receive" {
		peer = rec.Sender
	}

	names := make([]string, 0, len(rec.Files))
	sources := make([]string, 0, len(rec.Files))
	for _, f := range rec.Files {
		names = append(names, f.FileName)
		if f.SourcePath != "" {
			sources = append(sources, f.SourcePath)
		}
	}

	endTime := time.Now()
	if rec.CompletionTime != nil {
		endTime = *rec.CompletionTime
	}
	dur := endTime.Sub(rec.StartTime).Seconds()
	if dur < 0.001 {
		dur = 0.001
	}

	entry := Entry{
		TransferID:       rec.TransferID,
		Direction:        rec.Direction,
		PeerDeviceID:     peer.DeviceID,
		PeerDeviceName:   peer.DeviceName,
		PeerIP:           peer.IPAddress,
		PeerPort:         peer.Port,
		FileNames:        names,
		SourcePaths:      sources,
		SavedLocations:   rec.SavedPaths,
		TotalSizeBytes:   rec.TotalSize,
		DurationSeconds:  dur,
		AverageSpeedMBps: rec.CurrentSpeedMBps,
		Status:           rec.Status,
		ErrorMessage:     rec.ErrorMessage,
		Timestamp:        rec.StartTime,
	}

	m.mu.Lock()
	m.records[entry.TransferID] = entry
	err := m.saveLocked()
	m.mu.Unlock()
	return entry, err
}

// Get retrieves a single transfer history entry by ID
func (m *Manager) Get(transferID string) (Entry, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	e, ok := m.records[transferID]
	return e, ok
}

// List returns all history records ordered newest first
func (m *Manager) List() []Entry {
	m.mu.RLock()
	defer m.mu.RUnlock()
	list := make([]Entry, 0, len(m.records))
	for _, e := range m.records {
		list = append(list, e)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].Timestamp.After(list[j].Timestamp)
	})
	return list
}

// Remove deletes an individual transfer record from history
func (m *Manager) Remove(transferID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.records[transferID]; !ok {
		return protocol.ErrNotFound
	}
	delete(m.records, transferID)
	return m.saveLocked()
}

// Clear removes all records from transfer history
func (m *Manager) Clear() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.records = make(map[string]Entry)
	return m.saveLocked()
}

func (m *Manager) load() error {
	data, err := os.ReadFile(m.dbPath)
	if err != nil {
		return err
	}
	var list []Entry
	if err := json.Unmarshal(data, &list); err != nil {
		return err
	}
	for _, e := range list {
		m.records[e.TransferID] = e
	}
	return nil
}

func (m *Manager) saveLocked() error {
	list := make([]Entry, 0, len(m.records))
	for _, e := range m.records {
		list = append(list, e)
	}
	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	tmp := m.dbPath + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, m.dbPath)
}
