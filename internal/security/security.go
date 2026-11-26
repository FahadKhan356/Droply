package security

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/protocol"
)

// TLSIdentity holds the device's X.509 certificate, TLS 1.3 configuration, and SHA-256 fingerprint
type TLSIdentity struct {
	Certificate tls.Certificate
	CertPEM     []byte
	KeyPEM      []byte
	Fingerprint string
}

// LoadOrGenerateTLS generates or loads an ECDSA P-256 certificate for TLS 1.3 peer-to-peer encryption
func LoadOrGenerateTLS(storageDir, deviceID string) (*TLSIdentity, error) {
	if err := os.MkdirAll(storageDir, 0700); err != nil {
		return nil, err
	}
	certPath := filepath.Join(storageDir, "device_cert.pem")
	keyPath := filepath.Join(storageDir, "device_key.pem")

	if certPEM, err1 := os.ReadFile(certPath); err1 == nil {
		if keyPEM, err2 := os.ReadFile(keyPath); err2 == nil {
			if cert, err3 := tls.X509KeyPair(certPEM, keyPEM); err3 == nil && len(cert.Certificate) > 0 {
				sum := sha256.Sum256(cert.Certificate[0])
				return &TLSIdentity{
					Certificate: cert,
					CertPEM:     certPEM,
					KeyPEM:      keyPEM,
					Fingerprint: "SHA256:" + hex.EncodeToString(sum[:]),
				}, nil
			}
		}
	}

	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ECDSA key: %w", err)
	}

	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return nil, err
	}

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"DROPly Local P2P Fabric"},
			CommonName:   deviceID,
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("0.0.0.0")},
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return nil, fmt.Errorf("failed to create certificate: %w", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	privBytes, err := x509.MarshalECPrivateKey(priv)
	if err != nil {
		return nil, err
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: privBytes})

	_ = os.WriteFile(certPath, certPEM, 0600)
	_ = os.WriteFile(keyPath, keyPEM, 0600)

	tlsCert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return nil, err
	}

	sum := sha256.Sum256(derBytes)
	return &TLSIdentity{
		Certificate: tlsCert,
		CertPEM:     certPEM,
		KeyPEM:      keyPEM,
		Fingerprint: "SHA256:" + hex.EncodeToString(sum[:]),
	}, nil
}

// ServerTLSConfig returns a strict TLS 1.3 configuration for the transfer server
func (id *TLSIdentity) ServerTLSConfig() *tls.Config {
	return &tls.Config{
		Certificates: []tls.Certificate{id.Certificate},
		MinVersion:   tls.VersionTLS13,
	}
}

// ClientTLSConfig creates a TLS 1.3 client config that optionally pins the peer's SHA-256 certificate fingerprint
func (id *TLSIdentity) ClientTLSConfig(expectedFingerprint string) *tls.Config {
	return &tls.Config{
		Certificates:       []tls.Certificate{id.Certificate},
		MinVersion:         tls.VersionTLS13,
		InsecureSkipVerify: true, // P2P uses self-signed certs verified via custom PeerCertificate fingerprint check
		VerifyPeerCertificate: func(rawCerts [][]byte, _ [][]*x509.Certificate) error {
			if expectedFingerprint == "" {
				return nil
			}
			if len(rawCerts) == 0 {
				return fmt.Errorf("no peer certificate presented")
			}
			sum := sha256.Sum256(rawCerts[0])
			actual := "SHA256:" + hex.EncodeToString(sum[:])
			if !strings.EqualFold(actual, expectedFingerprint) {
				return fmt.Errorf("TLS certificate fingerprint mismatch: got %s, expected %s", actual, expectedFingerprint)
			}
			return nil
		},
	}
}

// GenerateRandomToken generates a cryptographically secure hex token of byteLen bytes
func GenerateRandomToken(byteLen int) (string, error) {
	buf := make([]byte, byteLen)
	if _, err := io.ReadFull(rand.Reader, buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// GenerateNumericPIN generates a 4-digit numeric PIN code (e.g., "8924")
func GenerateNumericPIN() (string, error) {
	max := big.NewInt(9000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%04d", n.Int64()+1000), nil
}

var unsafeCharsRegex = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]`)

// SanitizeFilename strips any directory components, control characters, and traversal sequences
func SanitizeFilename(rawName string) (string, error) {
	if strings.TrimSpace(rawName) == "" {
		return "", protocol.NewError(protocol.ErrCodeInvalidMetadata, "empty filename")
	}
	if protocol.ContainsPathTraversal(rawName) {
		return "", protocol.NewError(protocol.ErrCodePathTraversal, fmt.Sprintf("path traversal rejected: %q", rawName))
	}
	// Replace backslashes and take base name only
	normalized := strings.ReplaceAll(rawName, "\\", "/")
	base := filepath.Base(normalized)
	if base == "." || base == ".." || base == "/" || base == "" {
		return "", protocol.NewError(protocol.ErrCodePathTraversal, fmt.Sprintf("invalid base filename: %q", rawName))
	}
	clean := unsafeCharsRegex.ReplaceAllString(base, "_")
	clean = strings.TrimLeft(clean, ".")
	if clean == "" {
		clean = "received_file"
	}
	return clean, nil
}

// SafeDestinationPath resolves a safe destination file path strictly confined within destDir.
// If a file with the same name exists, it appends a numeric counter so existing files are never overwritten.
func SafeDestinationPath(destDir, rawFilename string) (string, error) {
	safeName, err := SanitizeFilename(rawFilename)
	if err != nil {
		return "", err
	}
	absDir, err := filepath.Abs(destDir)
	if err != nil {
		return "", err
	}
	candidate := filepath.Join(absDir, safeName)
	rel, err := filepath.Rel(absDir, candidate)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", protocol.NewError(protocol.ErrCodePathTraversal, "destination escapes target directory")
	}

	ext := filepath.Ext(safeName)
	stem := strings.TrimSuffix(safeName, ext)
	finalPath := candidate
	for idx := 1; idx < 1000; idx++ {
		if _, err := os.Stat(finalPath); os.IsNotExist(err) {
			break
		}
		finalPath = filepath.Join(absDir, fmt.Sprintf("%s_(%d)%s", stem, idx, ext))
	}
	return finalPath, nil
}

// ComputeFileSHA256 computes the SHA-256 hash of a file using streaming I/O without loading it into memory
func ComputeFileSHA256(path string) (string, int64, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()

	h := sha256.New()
	buf := make([]byte, 128*1024) // 128 KB bounded buffer
	var total int64
	for {
		n, readErr := f.Read(buf)
		if n > 0 {
			total += int64(n)
			_, _ = h.Write(buf[:n])
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return "", total, readErr
		}
	}
	return hex.EncodeToString(h.Sum(nil)), total, nil
}

// RateLimiter implements per-IP token-bucket connection rate limiting to prevent brute-force attacks
type RateLimiter struct {
	mu          sync.Mutex
	maxAttempts int
	window      time.Duration
	attempts    map[string][]time.Time
}

// NewRateLimiter creates a rate limiter allowing maxAttempts per window per source IP
func NewRateLimiter(maxAttempts int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		maxAttempts: maxAttempts,
		window:      window,
		attempts:    make(map[string][]time.Time),
	}
}

// Allow checks if a request from ip is permitted under the rate limit
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)
	history := rl.attempts[ip]

	valid := make([]time.Time, 0, len(history))
	for _, t := range history {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	if len(valid) >= rl.maxAttempts {
		rl.attempts[ip] = valid
		return false
	}
	valid = append(valid, now)
	rl.attempts[ip] = valid
	return true
}
