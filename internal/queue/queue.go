package queue

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/internal/security"
	"github.com/FahadKhan356/Droply/internal/transfer"
)

// Job represents a queued file transfer job with priority and cancellation support
type Job struct {
	TransferID string              `json:"transfer_id"`
	SessionID  string              `json:"session_id"`
	Peer       protocol.DeviceInfo `json:"peer"`
	FilePaths  []string            `json:"file_paths"`
	Priority   int                 `json:"priority"` // Higher = higher priority
	Status     protocol.TransferStatus `json:"status"`
	CreatedAt  time.Time           `json:"created_at"`
	ErrorMsg   string              `json:"error_msg,omitempty"`
}

// Manager orchestrates concurrent transfers using a bounded worker pool and priority queue
type Manager struct {
	mu            sync.Mutex
	engine        *transfer.Engine
	maxConcurrent int
	activeCount   int
	pending       []*Job
	jobs          map[string]*Job
	jobCancels    map[string]context.CancelFunc
	cond          *sync.Cond
	closed        bool
}

// NewManager creates a concurrent transfer Queue Manager with bounded goroutine workers
func NewManager(engine *transfer.Engine, maxConcurrent int) *Manager {
	if maxConcurrent <= 0 {
		maxConcurrent = 3
	}
	m := &Manager{
		engine:        engine,
		maxConcurrent: maxConcurrent,
		pending:       make([]*Job, 0),
		jobs:          make(map[string]*Job),
		jobCancels:    make(map[string]context.CancelFunc),
	}
	m.cond = sync.NewCond(&m.mu)
	for i := 0; i < maxConcurrent; i++ {
		go m.worker()
	}
	return m
}

// SetMaxConcurrent dynamically updates the concurrent transfer limit
func (m *Manager) SetMaxConcurrent(limit int) {
	if limit <= 0 {
		return
	}
	m.mu.Lock()
	prev := m.maxConcurrent
	m.maxConcurrent = limit
	m.mu.Unlock()
	if limit > prev {
		for i := 0; i < limit-prev; i++ {
			go m.worker()
		}
	}
	m.cond.Broadcast()
}

// Enqueue submits a new transfer job into the priority queue
func (m *Manager) Enqueue(sessionID string, peer protocol.DeviceInfo, filePaths []string, priority int) *Job {
	rnd, _ := security.GenerateRandomToken(8)
	job := &Job{
		TransferID: "tx_" + rnd,
		SessionID:  sessionID,
		Peer:       peer,
		FilePaths:  filePaths,
		Priority:   priority,
		Status:     protocol.StatusQueued,
		CreatedAt:  time.Now(),
	}

	m.mu.Lock()
	m.jobs[job.TransferID] = job
	m.pending = append(m.pending, job)
	sort.SliceStable(m.pending, func(i, j int) bool {
		return m.pending[i].Priority > m.pending[j].Priority
	})
	m.mu.Unlock()
	m.cond.Signal()
	return job
}

func (m *Manager) worker() {
	for {
		m.mu.Lock()
		for !m.closed && (len(m.pending) == 0 || m.activeCount >= m.maxConcurrent) {
			m.cond.Wait()
		}
		if m.closed {
			m.mu.Unlock()
			return
		}
		job := m.pending[0]
		m.pending = m.pending[1:]
		if job.Status == protocol.StatusCancelled {
			m.mu.Unlock()
			continue
		}
		m.activeCount++
		job.Status = protocol.StatusTransferring
		ctx, cancel := context.WithCancel(context.Background())
		m.jobCancels[job.TransferID] = cancel
		m.mu.Unlock()

		rec, err := m.engine.SendFiles(ctx, job.TransferID, job.SessionID, job.Peer, job.FilePaths)

		m.mu.Lock()
		m.activeCount--
		delete(m.jobCancels, job.TransferID)
		if err != nil {
			if rec != nil {
				job.Status = rec.Status
			} else {
				job.Status = protocol.StatusFailed
			}
			job.ErrorMsg = err.Error()
		} else {
			job.Status = protocol.StatusCompleted
		}
		m.mu.Unlock()
		m.cond.Broadcast()
	}
}

// CancelJob cancels either a queued or currently running job
func (m *Manager) CancelJob(transferID string) error {
	m.mu.Lock()
	job, ok := m.jobs[transferID]
	if !ok {
		m.mu.Unlock()
		return m.engine.CancelTransfer(transferID)
	}
	job.Status = protocol.StatusCancelled
	cancel := m.jobCancels[transferID]
	m.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	_ = m.engine.CancelTransfer(transferID)
	return nil
}

// RetryJob re-queues a failed or interrupted job
func (m *Manager) RetryJob(transferID string) (*Job, error) {
	m.mu.Lock()
	job, ok := m.jobs[transferID]
	if !ok {
		m.mu.Unlock()
		return nil, protocol.ErrNotFound
	}
	job.Status = protocol.StatusQueued
	job.ErrorMsg = ""
	m.pending = append(m.pending, job)
	sort.SliceStable(m.pending, func(i, j int) bool {
		return m.pending[i].Priority > m.pending[j].Priority
	})
	m.mu.Unlock()
	m.cond.Signal()
	return job, nil
}

// ListJobs returns all jobs tracked by the queue manager
func (m *Manager) ListJobs() []Job {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Job, 0, len(m.jobs))
	for _, j := range m.jobs {
		out = append(out, *j)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out
}

// Close shuts down the queue worker pool
func (m *Manager) Close() {
	m.mu.Lock()
	m.closed = true
	for _, cancel := range m.jobCancels {
		cancel()
	}
	m.mu.Unlock()
	m.cond.Broadcast()
}
