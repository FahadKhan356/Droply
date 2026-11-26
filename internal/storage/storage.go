package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"

	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/internal/security"
)

// FileCheckpoint tracks incremental chunk receipt on disk so interrupted transfers resume cleanly across restarts
type FileCheckpoint struct {
	TransferID     string         `json:"transfer_id"`
	FileID         string         `json:"file_id"`
	FileName       string         `json:"file_name"`
	TempFilePath   string         `json:"temp_file_path"`
	ExpectedSize   int64          `json:"expected_size"`
	ExpectedSHA256 string         `json:"expected_sha256"`
	ChunkSize      int            `json:"chunk_size"`
	TotalChunks    int            `json:"total_chunks"`
	VerifiedChunks map[int]bool   `json:"verified_chunks"`
	BytesReceived  int64          `json:"bytes_received"`
}

// Manager handles safe disk storage, temporary part files, checkpoints, and atomic finalization
type Manager struct {
	mu                sync.Mutex
	downloadDir       string
	stagingDir        string
	maxFileSizeLimit  int64
	overrideFreeBytes int64 // > 0 in tests to simulate exact free disk capacity
	checkpoints       map[string]*FileCheckpoint
}

// NewManager creates a Storage Manager for downloadDir
func NewManager(downloadDir string, maxFileSize int64) (*Manager, error) {
	if err := os.MkdirAll(downloadDir, 0755); err != nil {
		return nil, err
	}
	stagingDir := filepath.Join(downloadDir, ".droply_staging")
	if err := os.MkdirAll(stagingDir, 0700); err != nil {
		return nil, err
	}
	if maxFileSize <= 0 {
		maxFileSize = protocol.MaxDefaultFileSize
	}
	m := &Manager{
		downloadDir:      downloadDir,
		stagingDir:       stagingDir,
		maxFileSizeLimit: maxFileSize,
		checkpoints:      make(map[string]*FileCheckpoint),
	}
	_ = m.loadExistingCheckpoints()
	return m, nil
}

// DownloadDir returns the configured download folder path
func (m *Manager) DownloadDir() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.downloadDir
}

// SetDownloadDir updates the destination download directory
func (m *Manager) SetDownloadDir(dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	staging := filepath.Join(dir, ".droply_staging")
	if err := os.MkdirAll(staging, 0700); err != nil {
		return err
	}
	m.mu.Lock()
	m.downloadDir = dir
	m.stagingDir = staging
	m.mu.Unlock()
	return nil
}

// SetOverrideFreeSpace sets a simulated disk free space limit (for testing insufficient storage)
func (m *Manager) SetOverrideFreeSpace(bytes int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.overrideFreeBytes = bytes
}

// AvailableDiskSpace returns available bytes in the download directory
func (m *Manager) AvailableDiskSpace() (int64, error) {
	m.mu.Lock()
	override := m.overrideFreeBytes
	dir := m.downloadDir
	m.mu.Unlock()

	if override > 0 {
		return override, nil
	}
	if override < 0 {
		return 0, nil
	}

	var stat syscall.Statfs_t
	if err := syscall.Statfs(dir, &stat); err != nil {
		return 100 * 1024 * 1024 * 1024, nil
	}
	return int64(stat.Bavail) * int64(stat.Bsize), nil
}

// CheckStorageCapacity verifies that totalBytes fits within available disk space and file size limits
func (m *Manager) CheckStorageCapacity(totalBytes int64) error {
	if totalBytes > m.maxFileSizeLimit {
		return protocol.NewError(protocol.ErrCodeFileSizeExceeded, fmt.Sprintf("transfer size %d exceeds max limit %d", totalBytes, m.maxFileSizeLimit))
	}
	avail, err := m.AvailableDiskSpace()
	if err == nil && totalBytes > avail {
		return protocol.NewError(protocol.ErrCodeInsufficientDisk, fmt.Sprintf("insufficient storage: need %d bytes, only %d bytes available", totalBytes, avail))
	}
	return nil
}

func checkpointKey(transferID, fileID string) string {
	return transferID + "__" + fileID
}

func (m *Manager) checkpointMetaPath(transferID, fileID string) string {
	safeKey := strings.ReplaceAll(checkpointKey(transferID, fileID), "/", "_")
	return filepath.Join(m.stagingDir, safeKey+".checkpoint.json")
}

// InitOrLoadReceiveFile initializes or resumes a temporary part file and its chunk checkpoint
func (m *Manager) InitOrLoadReceiveFile(transferID string, meta protocol.FileMetadata) (*FileCheckpoint, error) {
	if err := protocol.ValidateFileMetadata(meta, m.maxFileSizeLimit); err != nil {
		return nil, err
	}
	if err := m.CheckStorageCapacity(meta.FileSize); err != nil {
		return nil, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	key := checkpointKey(transferID, meta.FileID)
	if cp, exists := m.checkpoints[key]; exists {
		if _, err := os.Stat(cp.TempFilePath); err == nil {
			return cp, nil
		}
	}

	randSuffix, err := security.GenerateRandomToken(6)
	if err != nil {
		return nil, err
	}
	tempFileName := fmt.Sprintf(".droply.part.%s_%s_%s", transferID, meta.FileID, randSuffix)
	tempFilePath := filepath.Join(m.stagingDir, tempFileName)

	f, err := os.OpenFile(tempFilePath, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	if meta.FileSize > 0 {
		_ = f.Truncate(meta.FileSize)
	}
	_ = f.Close()

	chunkSize := meta.ChunkSize
	if chunkSize <= 0 {
		chunkSize = protocol.DefaultChunkSize
	}
	totalChunks := meta.TotalChunks
	if totalChunks <= 0 && meta.FileSize > 0 {
		totalChunks = int((meta.FileSize + int64(chunkSize) - 1) / int64(chunkSize))
	}

	cp := &FileCheckpoint{
		TransferID:     transferID,
		FileID:         meta.FileID,
		FileName:       meta.FileName,
		TempFilePath:   tempFilePath,
		ExpectedSize:   meta.FileSize,
		ExpectedSHA256: meta.SHA256,
		ChunkSize:      chunkSize,
		TotalChunks:    totalChunks,
		VerifiedChunks: make(map[int]bool),
		BytesReceived:  0,
	}
	m.checkpoints[key] = cp
	_ = m.saveCheckpointLocked(cp)
	return cp, nil
}

// WriteChunk streams a single chunk into the random temporary file at offset, verifying chunk SHA-256
func (m *Manager) WriteChunk(transferID, fileID string, chunkIndex int, offset int64, expectedChunkSHA256 string, r io.Reader) (int, error) {
	m.mu.Lock()
	key := checkpointKey(transferID, fileID)
	cp, exists := m.checkpoints[key]
	m.mu.Unlock()

	if !exists {
		return 0, protocol.NewError(protocol.ErrCodeInvalidMetadata, "transfer checkpoint not initialized")
	}

	f, err := os.OpenFile(cp.TempFilePath, os.O_WRONLY, 0600)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		return 0, err
	}

	hasher := sha256.New()
	buf := make([]byte, 64*1024) // 64 KB bounded streaming buffer
	written := 0

	for {
		n, readErr := r.Read(buf)
		if n > 0 {
			if offset+int64(written+n) > cp.ExpectedSize {
				return written, protocol.NewError(protocol.ErrCodeFileSizeExceeded, "chunk write exceeds declared file size")
			}
			if _, wErr := f.Write(buf[:n]); wErr != nil {
				return written, wErr
			}
			_, _ = hasher.Write(buf[:n])
			written += n
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return written, readErr
		}
	}

	if expectedChunkSHA256 != "" {
		actualHash := hex.EncodeToString(hasher.Sum(nil))
		if !strings.EqualFold(actualHash, expectedChunkSHA256) {
			return written, protocol.NewError(protocol.ErrCodeChecksumMismatch, fmt.Sprintf("chunk %d SHA-256 mismatch: got %s, expected %s", chunkIndex, actualHash, expectedChunkSHA256))
		}
	}

	m.mu.Lock()
	if !cp.VerifiedChunks[chunkIndex] {
		cp.VerifiedChunks[chunkIndex] = true
		cp.BytesReceived += int64(written)
		if cp.BytesReceived > cp.ExpectedSize {
			cp.BytesReceived = cp.ExpectedSize
		}
	}
	_ = m.saveCheckpointLocked(cp)
	m.mu.Unlock()

	return written, nil
}

// GetCheckpointStatus returns the current received chunk list and next contiguous chunk index for resuming
func (m *Manager) GetCheckpointStatus(transferID, fileID string) (protocol.ChunkCheckpointResponse, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := checkpointKey(transferID, fileID)
	cp, exists := m.checkpoints[key]
	if !exists {
		return protocol.ChunkCheckpointResponse{CanResume: false}, false
	}
	if _, err := os.Stat(cp.TempFilePath); err != nil {
		return protocol.ChunkCheckpointResponse{CanResume: false}, false
	}

	chunks := make([]int, 0, len(cp.VerifiedChunks))
	for idx := range cp.VerifiedChunks {
		chunks = append(chunks, idx)
	}
	sort.Ints(chunks)

	nextContiguous := 0
	for cp.VerifiedChunks[nextContiguous] {
		nextContiguous++
	}

	return protocol.ChunkCheckpointResponse{
		TransferID:          transferID,
		FileID:              fileID,
		ReceivedChunks:      chunks,
		NextContiguousChunk: nextContiguous,
		BytesReceived:       cp.BytesReceived,
		CanResume:           true,
	}, true
}

// VerifyAndFinalize performs full-file streaming SHA-256 integrity verification and atomically moves the file
func (m *Manager) VerifyAndFinalize(transferID, fileID string) (string, error) {
	m.mu.Lock()
	key := checkpointKey(transferID, fileID)
	cp, exists := m.checkpoints[key]
	destDir := m.downloadDir
	m.mu.Unlock()

	if !exists {
		return "", protocol.NewError(protocol.ErrCodeInvalidMetadata, "checkpoint not found for finalization")
	}

	actualSHA256, actualSize, err := security.ComputeFileSHA256(cp.TempFilePath)
	if err != nil {
		return "", err
	}

	if actualSize != cp.ExpectedSize {
		_ = m.CleanupTemp(transferID, fileID)
		return "", protocol.NewError(protocol.ErrCodeChecksumMismatch, fmt.Sprintf("incomplete file size: got %d, expected %d", actualSize, cp.ExpectedSize))
	}

	if !strings.EqualFold(actualSHA256, cp.ExpectedSHA256) {
		_ = m.CleanupTemp(transferID, fileID)
		return "", protocol.NewError(protocol.ErrCodeChecksumMismatch, fmt.Sprintf("corrupted file detected (SHA-256 mismatch): got %s, expected %s", actualSHA256, cp.ExpectedSHA256))
	}

	finalPath, err := security.SafeDestinationPath(destDir, cp.FileName)
	if err != nil {
		return "", err
	}

	if err := os.Rename(cp.TempFilePath, finalPath); err != nil {
		return "", err
	}

	// Ensure transferred file is never marked executable
	_ = os.Chmod(finalPath, 0644)

	m.mu.Lock()
	_ = os.Remove(m.checkpointMetaPath(transferID, fileID))
	delete(m.checkpoints, key)
	m.mu.Unlock()

	return finalPath, nil
}

// CleanupTemp removes temporary part file and checkpoint metadata
func (m *Manager) CleanupTemp(transferID, fileID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := checkpointKey(transferID, fileID)
	if cp, ok := m.checkpoints[key]; ok {
		_ = os.Remove(cp.TempFilePath)
		delete(m.checkpoints, key)
	}
	_ = os.Remove(m.checkpointMetaPath(transferID, fileID))
	return nil
}

func (m *Manager) saveCheckpointLocked(cp *FileCheckpoint) error {
	data, err := json.MarshalIndent(cp, "", "  ")
	if err != nil {
		return err
	}
	metaPath := m.checkpointMetaPath(cp.TransferID, cp.FileID)
	tmp := metaPath + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, metaPath)
}

func (m *Manager) loadExistingCheckpoints() error {
	entries, err := os.ReadDir(m.stagingDir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".checkpoint.json") {
			continue
		}
		fullPath := filepath.Join(m.stagingDir, entry.Name())
		data, err := os.ReadFile(fullPath)
		if err != nil {
			continue
		}
		var cp FileCheckpoint
		if err := json.Unmarshal(data, &cp); err != nil {
			continue
		}
		if _, err := os.Stat(cp.TempFilePath); err == nil {
			if cp.VerifiedChunks == nil {
				cp.VerifiedChunks = make(map[int]bool)
			}
			m.checkpoints[checkpointKey(cp.TransferID, cp.FileID)] = &cp
		}
	}
	return nil
}

// InspectLocalFile extracts FileMetadata (name, size, MIME type, extension, streaming SHA-256) without loading the file into RAM
func InspectLocalFile(filePath string, chunkSize int) (protocol.FileMetadata, error) {
	info, err := os.Stat(filePath)
	if err != nil {
		return protocol.FileMetadata{}, err
	}
	if info.IsDir() {
		return protocol.FileMetadata{}, fmt.Errorf("%s is a directory", filePath)
	}
	if chunkSize <= 0 {
		chunkSize = protocol.DefaultChunkSize
	}

	hashHex, size, err := security.ComputeFileSHA256(filePath)
	if err != nil {
		return protocol.FileMetadata{}, err
	}

	ext := strings.ToLower(filepath.Ext(info.Name()))
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	totalChunks := 1
	if size > 0 {
		totalChunks = int((size + int64(chunkSize) - 1) / int64(chunkSize))
	}

	fid := "file_" + hashHex[:16]
	return protocol.FileMetadata{
		FileID:      fid,
		FileName:    info.Name(),
		FileSize:    size,
		MimeType:    mimeType,
		Extension:   strings.TrimPrefix(ext, "."),
		SHA256:      hashHex,
		ChunkSize:   chunkSize,
		TotalChunks: totalChunks,
		SourcePath:  filePath,
	}, nil
}
