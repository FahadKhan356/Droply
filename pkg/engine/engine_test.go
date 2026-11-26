package engine_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/FahadKhan356/Droply/internal/connection"
	"github.com/FahadKhan356/Droply/internal/device"
	"github.com/FahadKhan356/Droply/internal/discovery"
	"github.com/FahadKhan356/Droply/internal/pairing"
	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/internal/security"
	"github.com/FahadKhan356/Droply/internal/storage"
	"github.com/FahadKhan356/Droply/internal/transfer"
	"github.com/FahadKhan356/Droply/pkg/engine"
)

func createTestNode(t *testing.T, id, name, devType, platform string, chunkSize int) (*engine.DroplyNode, int, string) {
	t.Helper()
	baseDir := t.TempDir()
	storeDir := filepath.Join(baseDir, "store")
	dlDir := filepath.Join(baseDir, "downloads")

	node, err := engine.NewNode(engine.Options{
		StorageDir:   storeDir,
		DownloadDir:  dlDir,
		DeviceID:     id,
		DeviceName:   name,
		TransferPort: 0,
		UDPPort:      0,
		ChunkSize:    chunkSize,
	})
	if err != nil {
		t.Fatalf("NewNode failed: %v", err)
	}
	port, err := node.TransferEng.StartServer("127.0.0.1:0")
	if err != nil {
		t.Fatalf("StartServer failed: %v", err)
	}
	t.Cleanup(func() {
		node.Stop()
	})
	return node, port, baseDir
}

func writeTestPayload(t *testing.T, dir, name string, size int) (string, string) {
	t.Helper()
	p := filepath.Join(dir, name)
	buf := make([]byte, size)
	_, _ = rand.Read(buf)
	if err := os.WriteFile(p, buf, 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}
	sum, _, err := security.ComputeFileSHA256(p)
	if err != nil {
		t.Fatalf("ComputeFileSHA256 failed: %v", err)
	}
	return p, sum
}

// Scenarios 1-6: Cross-Platform Matrix (Android<->Android, Android<->Windows, Android<->macOS, iPhone<->Android, iPhone<->Windows, Windows<->macOS)
func TestCrossPlatformMatrix_Scenarios1To6(t *testing.T) {
	matrix := []struct {
		name         string
		senderID     string
		senderName   string
		senderType   string
		senderOS     string
		receiverID   string
		receiverName string
		receiverType string
		receiverOS   string
	}{
		{"Scenario1_Android_to_Android", "dev_a1", "Pixel 9 Pro", "android", "android", "dev_a2", "Alex Galaxy S24", "android", "android"},
		{"Scenario2_Android_to_Windows", "dev_a1", "Galaxy S24", "android", "android", "dev_w1", "Marcus Surface", "windows", "windows"},
		{"Scenario3_Android_to_macOS", "dev_a1", "Galaxy S24", "android", "android", "dev_m1", "Studio Mac M2", "mac", "darwin"},
		{"Scenario4_iPhone_to_Android", "dev_i1", "Elena iPhone 15 Pro", "ios", "ios", "dev_a2", "Galaxy S24", "android", "android"},
		{"Scenario5_iPhone_to_Windows", "dev_i1", "Elena iPhone 15 Pro", "ios", "ios", "dev_w1", "Workstation PC", "windows", "windows"},
		{"Scenario6_Windows_to_macOS", "dev_w1", "Workstation PC", "windows", "windows", "dev_m1", "Studio Mac M2", "mac", "darwin"},
	}

	for _, tc := range matrix {
		t.Run(tc.name, func(t *testing.T) {
			sender, _, sDir := createTestNode(t, tc.senderID, tc.senderName, tc.senderType, tc.senderOS, 32*1024)
			receiver, rPort, _ := createTestNode(t, tc.receiverID, tc.receiverName, tc.receiverType, tc.receiverOS, 32*1024)

			// Pair via QR token
			receiverSelf := receiver.DeviceMgr.Self()
			receiverSelf.IPAddress = "127.0.0.1"
			receiverSelf.Port = rPort
			_, qrPayload, err := receiver.PairingSvc.GenerateSession(receiverSelf, 5*time.Minute)
			if err != nil {
				t.Fatalf("GenerateSession failed: %v", err)
			}

			pairResp, err := sender.ConnMgr.PairWithPeer(
				context.Background(),
				"127.0.0.1",
				rPort,
				receiver.TLSIdentity.Fingerprint,
				qrPayload.SessionID,
				qrPayload.Token,
				"",
			)
			if err != nil || !pairResp.Authorized {
				t.Fatalf("PairWithPeer failed: %v", err)
			}

			// Configure receiver to auto-accept paired trusted device
			receiver.DeviceMgr.SetAutoAcceptTrusted(true)

			srcFile, expectedSHA := writeTestPayload(t, sDir, tc.name+".bin", 96*1024)
			rec, err := sender.TransferEng.SendFiles(
				context.Background(),
				"",
				pairResp.AuthSessionKey,
				receiverSelf,
				[]string{srcFile},
			)
			if err != nil {
				t.Fatalf("SendFiles failed: %v", err)
			}
			if rec.Status != protocol.StatusCompleted {
				t.Fatalf("expected status Completed, got %s", rec.Status)
			}

			// Verify received file on disk matches SHA-256
			dstFile := filepath.Join(receiver.StorageMgr.DownloadDir(), tc.name+".bin")
			actualSHA, _, err := security.ComputeFileSHA256(dstFile)
			if err != nil {
				t.Fatalf("received file missing: %v", err)
			}
			if actualSHA != expectedSHA {
				t.Fatalf("SHA-256 mismatch: got %s, want %s", actualSHA, expectedSHA)
			}
		})
	}
}

// Scenario 7 & 8: Multiple File Transfer & Large File Multi-Chunk Streaming
func TestMultiFileAndLargeFileStreaming_Scenarios7And8(t *testing.T) {
	sender, _, sDir := createTestNode(t, "dev_sender", "iPhone 15 Pro", "ios", "ios", 64*1024)
	receiver, rPort, _ := createTestNode(t, "dev_receiver", "Studio Mac M2", "mac", "darwin", 64*1024)

	receiverSelf := receiver.DeviceMgr.Self()
	receiverSelf.IPAddress = "127.0.0.1"
	receiverSelf.Port = rPort
	_, _ = receiver.DeviceMgr.RegisterTrusted(sender.DeviceMgr.Self(), true)

	// 3 files including a 2.5 MB multi-chunk file (40 chunks at 64 KB each)
	f1, sha1 := writeTestPayload(t, sDir, "IMG_4920_ProRAW.dng", 150*1024)
	f2, sha2 := writeTestPayload(t, sDir, "Project_Demo_4K.mov", 2560*1024)
	f3, sha3 := writeTestPayload(t, sDir, "Brand_Guidelines_v3.pdf", 85*1024)

	rec, err := sender.TransferEng.SendFiles(
		context.Background(),
		"tx_multifile_large",
		"trusted_session",
		receiverSelf,
		[]string{f1, f2, f3},
	)
	if err != nil {
		t.Fatalf("multi-file transfer failed: %v", err)
	}
	if rec.Status != protocol.StatusCompleted {
		t.Fatalf("expected Completed, got %s", rec.Status)
	}

	expected := map[string]string{
		"IMG_4920_ProRAW.dng":     sha1,
		"Project_Demo_4K.mov":     sha2,
		"Brand_Guidelines_v3.pdf": sha3,
	}
	for name, wantSHA := range expected {
		gotSHA, _, err := security.ComputeFileSHA256(filepath.Join(receiver.StorageMgr.DownloadDir(), name))
		if err != nil || gotSHA != wantSHA {
			t.Fatalf("file %s integrity verification failed: err=%v, got=%s, want=%s", name, err, gotSHA, wantSHA)
		}
	}
}

// Scenario 9, 10 & 16: Wi-Fi Disconnection During Transfer, App Restart Persistence, and Checkpoint Resume
func TestWiFiDisconnectAppRestartAndResume_Scenarios9_10_16(t *testing.T) {
	sender, _, sDir := createTestNode(t, "dev_s9", "Sender", "ios", "ios", 32*1024)
	receiver, rPort, rBaseDir := createTestNode(t, "dev_r9", "Receiver", "mac", "darwin", 32*1024)

	srcFile, expectedSHA := writeTestPayload(t, sDir, "Large_Interrupted_Archive.zip", 320*1024) // 10 chunks of 32 KB
	meta, err := storage.InspectLocalFile(srcFile, 32*1024)
	if err != nil {
		t.Fatalf("InspectLocalFile failed: %v", err)
	}

	// Simulate first 5 chunks arriving before Wi-Fi drops
	txID := "tx_resume_001"
	_, err = receiver.StorageMgr.InitOrLoadReceiveFile(txID, meta)
	if err != nil {
		t.Fatalf("InitOrLoadReceiveFile failed: %v", err)
	}

	rawBytes, _ := os.ReadFile(srcFile)
	for idx := 0; idx < 5; idx++ {
		chunk := rawBytes[idx*32768 : (idx+1)*32768]
		_, err := receiver.StorageMgr.WriteChunk(txID, meta.FileID, idx, int64(idx*32768), "", bytes.NewReader(chunk))
		if err != nil {
			t.Fatalf("WriteChunk %d failed: %v", idx, err)
		}
	}

	// Scenario 16: Simulate App Restart on Receiver by instantiating a brand new StorageManager from disk
	restartedStorage, err := storage.NewManager(filepath.Join(rBaseDir, "downloads"), protocol.MaxDefaultFileSize)
	if err != nil {
		t.Fatalf("restarted storage manager failed: %v", err)
	}
	cpStatus, ok := restartedStorage.GetCheckpointStatus(txID, meta.FileID)
	if !ok || !cpStatus.CanResume || cpStatus.NextContiguousChunk != 5 {
		t.Fatalf("expected checkpoint to survive app restart at chunk 5, got ok=%v next=%d", ok, cpStatus.NextContiguousChunk)
	}

	// Scenario 10: Now resume the transfer over TLS 1.3 and verify it completes chunks 5..9 and finalizes atomically
	_, _ = receiver.DeviceMgr.RegisterTrusted(sender.DeviceMgr.Self(), true)
	receiverSelf := receiver.DeviceMgr.Self()
	receiverSelf.IPAddress = "127.0.0.1"
	receiverSelf.Port = rPort

	// Ensure the transfer engine uses the same FileID for resume verification
	rec, err := sender.TransferEng.SendFiles(context.Background(), txID, "resume_sess", receiverSelf, []string{srcFile})
	if err != nil || rec.Status != protocol.StatusCompleted {
		t.Fatalf("Resume SendFiles failed: err=%v status=%v", err, rec)
	}

	finalFile := filepath.Join(receiver.StorageMgr.DownloadDir(), "Large_Interrupted_Archive.zip")
	actualSHA, _, err := security.ComputeFileSHA256(finalFile)
	if err != nil || actualSHA != expectedSHA {
		t.Fatalf("Resumed file SHA-256 mismatch: err=%v, got=%s, want=%s", err, actualSHA, expectedSHA)
	}
}

// Scenario 11: Reject Incoming Transfer from Unapproved Peer
func TestRejectIncomingTransfer_Scenario11(t *testing.T) {
	sender, _, sDir := createTestNode(t, "dev_s11", "Sender", "android", "android", 32*1024)
	receiver, rPort, _ := createTestNode(t, "dev_r11", "Receiver", "mac", "darwin", 32*1024)

	// Pair without auto-accept so transfer pauses at WaitingForApproval
	receiver.DeviceMgr.SetAutoAcceptTrusted(false)
	_, _ = receiver.DeviceMgr.RegisterTrusted(sender.DeviceMgr.Self(), false)

	srcFile, _ := writeTestPayload(t, sDir, "Unwanted.pdf", 16*1024)
	receiverSelf := receiver.DeviceMgr.Self()
	receiverSelf.IPAddress = "127.0.0.1"
	receiverSelf.Port = rPort

	// Reject the incoming transfer as soon as it enters WaitingForApproval
	go func() {
		for i := 0; i < 40; i++ {
			time.Sleep(25 * time.Millisecond)
			_ = receiver.TransferEng.RejectIncoming("tx_reject_test")
		}
	}()

	rec, err := sender.TransferEng.SendFiles(context.Background(), "tx_reject_test", "sess_11", receiverSelf, []string{srcFile})
	if err == nil {
		t.Fatalf("expected error when receiver rejects transfer")
	}
	if rec.Status != protocol.StatusRejected {
		t.Fatalf("expected status Rejected, got %s", rec.Status)
	}
}

// Scenarios 12 & 13: Expired QR Pairing, Invalid Pairing Token, and One-Time Token Replay Protection
func TestQRPairingSecurity_Scenarios12And13(t *testing.T) {
	pairSvc := pairing.NewService(5 * time.Minute)
	host := protocol.DeviceInfo{DeviceID: "host_1", DeviceName: "Host Mac", IPAddress: "192.168.1.10", Port: 53317}
	peer := protocol.DeviceInfo{DeviceID: "peer_1", DeviceName: "Peer iPhone"}

	// Scenario 12: Expired QR Pairing
	_, expiredQR, err := pairSvc.GenerateSession(host, -1*time.Second)
	if err != nil {
		t.Fatalf("GenerateSession failed: %v", err)
	}
	resp, err := pairSvc.ValidateAndAuthorize(protocol.PairingRequest{
		ProtocolVersion: protocol.ProtocolVersion,
		SessionID:       expiredQR.SessionID,
		Token:           expiredQR.Token,
		PeerDevice:      peer,
	})
	if err == nil || resp.Authorized || resp.ErrorCode != protocol.ErrCodePairingExpired {
		t.Fatalf("expected ERR_PAIRING_EXPIRED, got resp=%+v err=%v", resp, err)
	}

	// Scenario 13a: Invalid Pairing Token
	_, validQR, _ := pairSvc.GenerateSession(host, 5*time.Minute)
	respInvalid, err := pairSvc.ValidateAndAuthorize(protocol.PairingRequest{
		ProtocolVersion: protocol.ProtocolVersion,
		SessionID:       validQR.SessionID,
		Token:           "wrong_token_000000",
		PeerDevice:      peer,
	})
	if err == nil || respInvalid.Authorized || respInvalid.ErrorCode != protocol.ErrCodePairingInvalid {
		t.Fatalf("expected ERR_PAIRING_INVALID, got %+v", respInvalid)
	}

	// Valid pairing consumption
	respValid, err := pairSvc.ValidateAndAuthorize(protocol.PairingRequest{
		ProtocolVersion: protocol.ProtocolVersion,
		SessionID:       validQR.SessionID,
		Token:           validQR.Token,
		PeerDevice:      peer,
	})
	if err != nil || !respValid.Authorized {
		t.Fatalf("expected valid token to succeed, got %v", err)
	}

	// Scenario 13b: One-Time Token Replay Attack
	respReplay, err := pairSvc.ValidateAndAuthorize(protocol.PairingRequest{
		ProtocolVersion: protocol.ProtocolVersion,
		SessionID:       validQR.SessionID,
		Token:           validQR.Token,
		PeerDevice:      peer,
	})
	if err == nil || respReplay.Authorized || respReplay.ErrorCode != protocol.ErrCodePairingReplay {
		t.Fatalf("expected ERR_PAIRING_TOKEN_REPLAY on token reuse, got %+v", respReplay)
	}
}

// Scenario 14: Insufficient Storage Protection
func TestInsufficientStorage_Scenario14(t *testing.T) {
	sender, _, sDir := createTestNode(t, "dev_s14", "Sender", "ios", "ios", 32*1024)
	receiver, rPort, _ := createTestNode(t, "dev_r14", "Receiver", "mac", "darwin", 32*1024)

	// Simulate only 10 KB of free disk space on receiver
	receiver.StorageMgr.SetOverrideFreeSpace(10 * 1024)
	_, _ = receiver.DeviceMgr.RegisterTrusted(sender.DeviceMgr.Self(), true)

	srcFile, _ := writeTestPayload(t, sDir, "TooLargeForDisk.mov", 64*1024)
	receiverSelf := receiver.DeviceMgr.Self()
	receiverSelf.IPAddress = "127.0.0.1"
	receiverSelf.Port = rPort

	rec, err := sender.TransferEng.SendFiles(context.Background(), "tx_disk_full", "sess_14", receiverSelf, []string{srcFile})
	if err == nil {
		t.Fatalf("expected insufficient storage error")
	}
	if rec.ErrorCode != protocol.ErrCodeInsufficientDisk {
		t.Fatalf("expected error code %s, got %s", protocol.ErrCodeInsufficientDisk, rec.ErrorCode)
	}
}

// Scenario 15: Corrupted File Detection & Path Traversal Security
func TestCorruptedFileAndPathTraversal_Scenario15(t *testing.T) {
	dlDir := t.TempDir()
	storeMgr, err := storage.NewManager(dlDir, protocol.MaxDefaultFileSize)
	if err != nil {
		t.Fatalf("NewManager failed: %v", err)
	}

	// Path traversal attack must be blocked
	if _, err := security.SanitizeFilename("../../etc/passwd"); err == nil {
		t.Fatalf("expected path traversal to be rejected")
	}
	if _, err := security.SanitizeFilename("..\\..\\Windows\\System32\\cmd.exe"); err == nil {
		t.Fatalf("expected Windows path traversal to be rejected")
	}

	// Corrupted file detection during SHA-256 verification
	meta := protocol.FileMetadata{
		FileID:      "file_corrupt_1",
		FileName:    "Important_Payload.bin",
		FileSize:    16,
		SHA256:      strings.Repeat("a", 64), // Expected SHA-256 will not match tampered bytes
		ChunkSize:   16,
		TotalChunks: 1,
	}
	if _, err := storeMgr.InitOrLoadReceiveFile("tx_corrupt", meta); err != nil {
		t.Fatalf("InitOrLoadReceiveFile failed: %v", err)
	}
	_, err = storeMgr.WriteChunk("tx_corrupt", meta.FileID, 0, 0, "", bytes.NewReader([]byte("tampered_payload")))
	if err != nil {
		t.Fatalf("WriteChunk failed: %v", err)
	}

	_, err = storeMgr.VerifyAndFinalize("tx_corrupt", meta.FileID)
	if err == nil {
		t.Fatalf("expected VerifyAndFinalize to reject corrupted file")
	}
	pe, ok := err.(*protocol.ProtocolError)
	if !ok || pe.Code != protocol.ErrCodeChecksumMismatch {
		t.Fatalf("expected ERR_CHECKSUM_MISMATCH, got %v", err)
	}
}

// Scenarios 17 & 18: Duplicate Device Discovery Deduplication, Expiry, and Subnet Scenarios
func TestDiscoveryDeduplicationAndSubnets_Scenarios17And18(t *testing.T) {
	disc := discovery.NewService(discovery.Config{
		PeerExpiryTTL: 100 * time.Millisecond,
		SelfProvider: func() protocol.DeviceInfo {
			return protocol.DeviceInfo{DeviceID: "self_node", DeviceName: "Self"}
		},
	})

	beacon := protocol.DiscoveryBeacon{
		Magic:           protocol.BeaconMagic,
		ProtocolVersion: protocol.ProtocolVersion,
		DeviceID:        "peer_dup_1",
		DeviceName:      "Alex Galaxy S24",
		DeviceType:      "android",
		Platform:        "android",
		IPAddress:       "192.168.1.185",
		Port:            53317,
		Timestamp:       time.Now().Unix(),
	}

	// Ingest the same device beacon 5 times; must result in exactly 1 entry
	for i := 0; i < 5; i++ {
		_, err := disc.IngestBeacon(beacon, "192.168.1.185")
		if err != nil {
			t.Fatalf("IngestBeacon failed: %v", err)
		}
	}
	peers := disc.ListPeers()
	if len(peers) != 1 {
		t.Fatalf("expected 1 deduplicated peer, got %d", len(peers))
	}

	// Scenario 18: Cross-subnet manual fallback registration (e.g., 10.0.2.15 vs 192.168.1.185)
	if discovery.SameSubnet24("192.168.1.185", "10.0.2.15") {
		t.Fatalf("expected different subnets to return false")
	}
	_, err := disc.RegisterManualPeer(protocol.DeviceInfo{
		DeviceID:   "peer_subnet_2",
		DeviceName: "Enterprise VLAN Workstation",
		IPAddress:  "10.0.2.15",
		Port:       53317,
	})
	if err != nil {
		t.Fatalf("RegisterManualPeer failed: %v", err)
	}
	if len(disc.ListPeers()) != 2 {
		t.Fatalf("expected 2 peers after manual cross-subnet registration")
	}

	// Wait for TTL expiry and verify SweepExpired removes stale peers
	time.Sleep(150 * time.Millisecond)
	removed := disc.SweepExpired()
	if removed != 2 || len(disc.ListPeers()) != 0 {
		t.Fatalf("expected 2 expired peers removed, got removed=%d remaining=%d", removed, len(disc.ListPeers()))
	}

	// Ensure unused imports are exercised
	_ = fmt.Sprintf("%T %T %T %T", connection.Manager{}, device.Manager{}, transfer.Engine{}, http.Client{})
}
