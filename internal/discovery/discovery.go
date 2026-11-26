package discovery

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/FahadKhan356/Droply/internal/protocol"
)

// Service handles UDP multicast/broadcast LAN discovery, deduplication, expiry, and manual fallback
type Service struct {
	mu              sync.RWMutex
	selfProvider    func() protocol.DeviceInfo
	peers           map[string]protocol.DeviceInfo // keyed by DeviceID (prevents duplicate entries)
	udpPort         int
	multicastAddr   string
	beaconInterval  time.Duration
	peerExpiryTTL   time.Duration
	visibilityMode  string // "everyone", "contacts", "hidden"
	isTrustedFn     func(deviceID string) bool
	onPeerUpdated   func(peer protocol.DeviceInfo)
	conn            *net.UDPConn
	cancelFn        context.CancelFunc
}

// Config configures the LAN Discovery Service
type Config struct {
	UDPPort        int
	MulticastAddr  string
	BeaconInterval time.Duration
	PeerExpiryTTL  time.Duration
	SelfProvider   func() protocol.DeviceInfo
	IsTrustedFn    func(deviceID string) bool
	OnPeerUpdated  func(peer protocol.DeviceInfo)
}

// NewService creates a new LAN discovery service
func NewService(cfg Config) *Service {
	if cfg.UDPPort <= 0 {
		cfg.UDPPort = protocol.DefaultDiscoveryUDP
	}
	if cfg.MulticastAddr == "" {
		cfg.MulticastAddr = protocol.MulticastGroupIPv4
	}
	if cfg.BeaconInterval <= 0 {
		cfg.BeaconInterval = 2 * time.Second
	}
	if cfg.PeerExpiryTTL <= 0 {
		cfg.PeerExpiryTTL = 10 * time.Second
	}
	return &Service{
		selfProvider:   cfg.SelfProvider,
		peers:          make(map[string]protocol.DeviceInfo),
		udpPort:        cfg.UDPPort,
		multicastAddr:  cfg.MulticastAddr,
		beaconInterval: cfg.BeaconInterval,
		peerExpiryTTL:  cfg.PeerExpiryTTL,
		visibilityMode: "everyone",
		isTrustedFn:    cfg.IsTrustedFn,
		onPeerUpdated:  cfg.OnPeerUpdated,
	}
}

// SetVisibility controls radar visibility ("everyone", "contacts", "hidden")
func (s *Service) SetVisibility(mode string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.visibilityMode = mode
}

// Start launches the UDP listener, periodic beacon broadcaster, and expired peer sweeper
func (s *Service) Start(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	s.cancelFn = cancel
	s.mu.Unlock()

	addr, err := net.ResolveUDPAddr("udp4", fmt.Sprintf("0.0.0.0:%d", s.udpPort))
	if err == nil {
		conn, listenErr := net.ListenUDP("udp4", addr)
		if listenErr == nil {
			s.mu.Lock()
			s.conn = conn
			s.mu.Unlock()
			go s.readLoop(ctx, conn)
		}
	}

	// Also attempt joining multicast group if supported on the host interface
	if mAddr, err := net.ResolveUDPAddr("udp4", s.multicastAddr); err == nil {
		if mConn, err := net.ListenMulticastUDP("udp4", nil, mAddr); err == nil {
			go s.readLoop(ctx, mConn)
		}
	}

	go s.broadcastLoop(ctx)
	go s.expiryLoop(ctx)
	return nil
}

// Stop halts discovery threads and closes UDP sockets
func (s *Service) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancelFn != nil {
		s.cancelFn()
		s.cancelFn = nil
	}
	if s.conn != nil {
		_ = s.conn.Close()
		s.conn = nil
	}
}

func (s *Service) broadcastLoop(ctx context.Context) {
	ticker := time.NewTicker(s.beaconInterval)
	defer ticker.Stop()
	_ = s.BroadcastNow()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_ = s.BroadcastNow()
		}
	}
}

// BroadcastNow immediately transmits a discovery beacon over UDP multicast and subnet broadcast
func (s *Service) BroadcastNow() error {
	s.mu.RLock()
	vis := s.visibilityMode
	s.mu.RUnlock()
	if vis == "hidden" {
		return nil
	}

	if s.selfProvider == nil {
		return nil
	}
	self := s.selfProvider()
	if self.IPAddress == "" {
		self.IPAddress = DetectLocalIPv4()
	}

	beacon := protocol.DiscoveryBeacon{
		Magic:           protocol.BeaconMagic,
		ProtocolVersion: protocol.ProtocolVersion,
		DeviceID:        self.DeviceID,
		DeviceName:      self.DeviceName,
		DeviceType:      self.DeviceType,
		Platform:        self.Platform,
		IPAddress:       self.IPAddress,
		Port:            self.Port,
		TLSFingerprint:  self.TLSFingerprint,
		Capabilities:    self.Capabilities,
		Timestamp:       time.Now().Unix(),
	}

	payload, err := json.Marshal(beacon)
	if err != nil {
		return err
	}

	targets := []string{
		s.multicastAddr,
		fmt.Sprintf("255.255.255.255:%d", s.udpPort),
		fmt.Sprintf("127.0.0.1:%d", s.udpPort),
	}

	for _, target := range targets {
		raddr, err := net.ResolveUDPAddr("udp4", target)
		if err != nil {
			continue
		}
		conn, err := net.DialUDP("udp4", nil, raddr)
		if err != nil {
			continue
		}
		_, _ = conn.Write(payload)
		_ = conn.Close()
	}
	return nil
}

func (s *Service) readLoop(ctx context.Context, conn *net.UDPConn) {
	buf := make([]byte, 8192)
	for {
		select {
		case <-ctx.Done():
			return
		default:
			_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
			n, remoteAddr, err := conn.ReadFromUDP(buf)
			if err != nil {
				continue
			}
			var beacon protocol.DiscoveryBeacon
			if err := json.Unmarshal(buf[:n], &beacon); err != nil {
				continue
			}
			remoteIP := ""
			if remoteAddr != nil && remoteAddr.IP != nil {
				remoteIP = remoteAddr.IP.String()
			}
			_, _ = s.IngestBeacon(beacon, remoteIP)
		}
	}
}

// IngestBeacon validates and deduplicates an incoming discovery beacon
func (s *Service) IngestBeacon(beacon protocol.DiscoveryBeacon, senderIP string) (bool, error) {
	if beacon.Magic != protocol.BeaconMagic {
		return false, protocol.NewError(protocol.ErrCodeInvalidMetadata, "invalid beacon magic")
	}
	if err := protocol.ValidateProtocolVersion(beacon.ProtocolVersion); err != nil {
		return false, err
	}
	if strings.TrimSpace(beacon.DeviceID) == "" || strings.TrimSpace(beacon.DeviceName) == "" {
		return false, protocol.NewError(protocol.ErrCodeInvalidMetadata, "beacon missing device_id or device_name")
	}

	if s.selfProvider != nil {
		self := s.selfProvider()
		if beacon.DeviceID == self.DeviceID {
			return false, nil // Ignore own loopback beacon
		}
	}

	s.mu.Lock()
	if s.visibilityMode == "contacts" && s.isTrustedFn != nil && !s.isTrustedFn(beacon.DeviceID) {
		s.mu.Unlock()
		return false, nil
	}

	ip := beacon.IPAddress
	if senderIP != "" && (ip == "" || ip == "0.0.0.0" || ip == "127.0.0.1") {
		ip = senderIP
	}

	trusted := false
	if s.isTrustedFn != nil {
		trusted = s.isTrustedFn(beacon.DeviceID)
	}

	existing, exists := s.peers[beacon.DeviceID]
	connState := protocol.ConnStateDiscovering
	if exists && existing.ConnectionState == protocol.ConnStateConnected {
		connState = protocol.ConnStateConnected
	}

	peer := protocol.DeviceInfo{
		DeviceID:        beacon.DeviceID,
		DeviceName:      beacon.DeviceName,
		DeviceType:      beacon.DeviceType,
		Platform:        beacon.Platform,
		IPAddress:       ip,
		Port:            beacon.Port,
		Capabilities:    beacon.Capabilities,
		ProtocolVersion: beacon.ProtocolVersion,
		TLSFingerprint:  beacon.TLSFingerprint,
		Online:          true,
		LastSeen:        time.Now(),
		ConnectionState: connState,
		Trusted:         trusted,
		DistanceHint:    "1.5m",
		ProtocolBadge:   "Direct P2P",
	}
	s.peers[beacon.DeviceID] = peer
	cb := s.onPeerUpdated
	s.mu.Unlock()

	if cb != nil {
		cb(peer)
	}
	return !exists, nil
}

// RegisterManualPeer allows fallback registration via manual IP+port or scanned QR code when UDP is blocked
func (s *Service) RegisterManualPeer(peer protocol.DeviceInfo) (protocol.DeviceInfo, error) {
	if strings.TrimSpace(peer.IPAddress) == "" || peer.Port <= 0 || peer.Port > 65535 {
		return protocol.DeviceInfo{}, protocol.NewError(protocol.ErrCodeInvalidMetadata, "valid IP address and port required")
	}
	if strings.TrimSpace(peer.DeviceID) == "" {
		peer.DeviceID = fmt.Sprintf("manual_%s_%d", strings.ReplaceAll(peer.IPAddress, ".", "_"), peer.Port)
	}
	if strings.TrimSpace(peer.DeviceName) == "" {
		peer.DeviceName = fmt.Sprintf("Peer (%s:%d)", peer.IPAddress, peer.Port)
	}
	if peer.DeviceType == "" {
		peer.DeviceType = "mac"
	}
	if peer.ProtocolVersion == "" {
		peer.ProtocolVersion = protocol.ProtocolVersion
	}
	peer.Online = true
	peer.LastSeen = time.Now()
	if peer.ConnectionState == "" {
		peer.ConnectionState = protocol.ConnStateConnected
	}

	s.mu.Lock()
	s.peers[peer.DeviceID] = peer
	s.mu.Unlock()
	return peer, nil
}

// SweepExpired marks or removes expired devices that have not been seen within peerExpiryTTL
func (s *Service) SweepExpired() int {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	removed := 0
	for id, peer := range s.peers {
		if now.Sub(peer.LastSeen) > s.peerExpiryTTL {
			delete(s.peers, id)
			removed++
		}
	}
	return removed
}

func (s *Service) expiryLoop(ctx context.Context) {
	ticker := time.NewTicker(s.peerExpiryTTL / 2)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.SweepExpired()
		}
	}
}

// ListPeers returns all currently discovered peers sorted by DeviceName
func (s *Service) ListPeers() []protocol.DeviceInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := make([]protocol.DeviceInfo, 0, len(s.peers))
	for _, p := range s.peers {
		list = append(list, p)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].DeviceName < list[j].DeviceName
	})
	return list
}

// GetPeer retrieves a discovered peer by DeviceID
func (s *Service) GetPeer(deviceID string) (protocol.DeviceInfo, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.peers[deviceID]
	return p, ok
}

// ClearPeers resets the discovery cache (used on network change or manual rescan)
func (s *Service) ClearPeers() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.peers = make(map[string]protocol.DeviceInfo)
}

// DetectLocalIPv4 finds the primary non-loopback IPv4 address of the host machine
func DetectLocalIPv4() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			ip4 := ip.To4()
			if ip4 != nil {
				return ip4.String()
			}
		}
	}
	return "127.0.0.1"
}

// SameSubnet24 checks whether two IPv4 addresses are within the same /24 subnet
func SameSubnet24(ipA, ipB string) bool {
	a := net.ParseIP(ipA).To4()
	b := net.ParseIP(ipB).To4()
	if a == nil || b == nil {
		return false
	}
	return a[0] == b[0] && a[1] == b[1] && a[2] == b[2]
}
