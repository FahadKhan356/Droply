# DROPly — Full-Stack Cross-Platform Local File-Sharing System
## Architecture & Wire Protocol Specification (v1.0)

---

## 1. System Architecture Overview

DROPly is built as a modular, high-performance peer-to-peer (P2P) local network file-sharing system powered by a **Go Networking Engine** (`cmd/droplyd`, `internal/*`, `pkg/engine`) that drives both the **React Native Mobile App** (`mobile/`) and the **Next.js Desktop Interface + Companion Daemon** (`web/` + `cmd/droplyd`).

### 1.1 Platform Embedding Strategy (Go Mobile vs. Native Process)
- **macOS / Windows / Linux Desktop**: Runs `droplyd` as a native background companion daemon (`cmd/droplyd`). The Next.js desktop interface communicates with the local companion daemon over a localhost Control API (`http://127.0.0.1:53318/api/v1/*`) and real-time WebSocket/SSE stream (`/api/v1/events`), giving the desktop UI full access to raw UDP multicast sockets, TLS 1.3 TCP listeners, and native filesystem streaming without browser sandbox limitations.
- **Android & iOS (React Native / Expo)**:
  - `pkg/engine` exposes a clean C-compatible / `gomobile bind` Go API (`Engine.Start()`, `Engine.Discover()`, `Engine.CreatePairingQR()`, `Engine.SendFiles()`, `Engine.PauseTransfer()`, `Engine.ResumeTransfer()`) that compiles to an `.aar` (Android) and `.xcframework` (iOS) for Expo Development Builds / bare React Native.
  - Simultaneously, the Go engine starts an embedded localhost control & event bridge so the React Native TypeScript layer (`mobile/src/services/droplyEngine.ts`) communicates via a unified, strongly-typed interface whether backed by `gomobile` JSI/NativeModule or the local Go daemon on the host/LAN.

### 1.2 Core Engine Modules
1. **Protocol Layer (`internal/protocol`)**: Wire message definitions, protocol version negotiation (`DROPLY/1.0`), error codes, and strict metadata validation.
2. **Security & Cryptography (`internal/security`)**: Ephemeral & persistent ECDSA P-256 TLS 1.3 certificate generation, SHA-256 certificate fingerprint pinning, HMAC-SHA256 one-time pairing tokens, path-traversal sanitization, token-bucket connection rate limiting, and atomic temporary file quarantine.
3. **Device & Trust Manager (`internal/device`)**: Local hardware identity, persistent Trusted Devices registry (register, verify fingerprint, rename, revoke trust, track last-connected timestamps and capabilities).
4. **LAN Discovery Service (`internal/discovery`)**: Dual-stack UDP multicast (`224.0.0.251:53319`) and subnet broadcast (`255.255.255.255:53319`) beacon emitter and listener, deduplication table, TTL expiration sweeper, plus HTTP probe fallback for multicast-blocked guest/enterprise networks.
5. **QR & PIN Pairing Service (`internal/pairing`)**: Short-lived (5-minute TTL), one-time cryptographic token generator, replay cache, PIN verification (`DROP-XXXX`), and mutual handshake confirmation.
6. **Connection Manager (`internal/connection`)**: Tracks peer lifecycle states (`Disconnected`, `Discovering`, `Connecting`, `Pairing`, `Connected`, `Transferring`, `Interrupted`, `Failed`), mutual TLS 1.3 handshake, heartbeat probes, and automatic reconnection.
7. **Storage & Checkpoint Manager (`internal/storage`)**: Disk space verification, safe filename sanitization, random `.droply.part.<uuid>` temporary files, bitmap chunk checkpoint persistence for crash/disconnect resume, and full-file SHA-256 verification before atomic `os.Rename` finalization.
8. **File Transfer Engine (`internal/transfer`)**: Bounded-memory (64 KB–4 MB configurable chunk size) streaming I/O over TLS 1.3 HTTP/TCP, token-bucket bandwidth shaping (QoS presets: Turbo, Balanced, Custom upload/download caps), incoming approval gate, pause/resume/cancel via `context.Context`.
9. **Transfer Queue Manager (`internal/queue`)**: Priority worker pool with configurable concurrency limits (`maxConcurrent`), multi-file batch orchestration, per-transfer cancellation, and live throughput calculation.
10. **Transfer History Manager (`internal/history`)**: Embedded transactional persistent database (`history.db.json` with atomic write-ahead journal and SQLite-compatible schema) storing sent/received records offline.

---

## 2. Wire Protocol Specification (`DROPLY/1.0`)

### 2.1 Discovery Beacon Frame (UDP Port `53319`)
Multicast group: `224.0.0.251:53319` and Broadcast `255.255.255.255:53319`.
```json
{
  "magic": "DROPLY_BEACON",
  "protocol_version": "1.0",
  "device_id": "dev_98a2e3545039",
  "device_name": "Studio Mac M2",
  "device_type": "mac",
  "platform": "darwin",
  "ip_address": "192.168.1.142",
  "port": 53317,
  "tls_fingerprint": "SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "capabilities": ["tls1.3", "chunk-resume", "multi-file", "qr-pair", "sha256-verify"],
  "timestamp": 1732620000
}
```

### 2.2 QR Pairing Payload Format
Encoded inside the QR code:
```json
{
  "v": "1.0",
  "sid": "pair_7f8a9b0c1d2e",
  "id": "dev_98a2e3545039",
  "name": "Elena's iPhone 15 Pro",
  "ip": "192.168.1.142",
  "port": 53317,
  "token": "f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4",
  "pin": "8924",
  "fp": "SHA256:...",
  "exp": 1732620300
}
```
- **Security Invariants**:
  - `token` is a 128-bit CSPRNG one-time nonce.
  - `exp` enforces a strict short expiry (default 300 seconds).
  - Once consumed or expired, any replay attempt returns `ERR_PAIRING_TOKEN_USED` or `ERR_PAIRING_EXPIRED`.

### 2.3 Peer-to-Peer Endpoints (TLS 1.3 over TCP Port `53317`)
- `POST /p2p/v1/handshake` — Validates protocol version, device identity, and heartbeat.
- `POST /p2p/v1/pair` — Validates QR one-time token or PIN, performs replay check, and registers mutual session authorization.
- `POST /p2p/v1/transfer/request` — Submits batch/file manifest (`TransferOffer`) to receiver. Receiver validates metadata, enforces size limits, checks disk space, and holds in `WaitingForApproval` until user accepts (or auto-accepts if device is trusted and user enabled `AutoAcceptTrusted`).
- `GET /p2p/v1/transfer/checkpoint?transfer_id=<id>&file_id=<fid>` — Returns the bitmask/highest contiguous verified chunk index for seamless resume after Wi-Fi drop or app restart.
- `PUT /p2p/v1/transfer/chunk` — Streams raw binary chunk (never Base64!) with headers:
  - `X-Droply-Protocol: 1.0`
  - `X-Droply-Session-ID: <session_id>`
  - `X-Droply-Transfer-ID: <transfer_id>`
  - `X-Droply-File-ID: <file_id>`
  - `X-Droply-Chunk-Index: <int>`
  - `X-Droply-Chunk-Offset: <int64>`
  - `X-Droply-Chunk-Size: <int>`
  - `X-Droply-Chunk-SHA256: <hex>`
  - `X-Droply-Total-Size: <int64>`
- `POST /p2p/v1/transfer/finalize` — Triggers full-file streaming SHA-256 verification on the receiver and atomic move from `.droply.part.<uuid>` to the final sanitized destination path.
