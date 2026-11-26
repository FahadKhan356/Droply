package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/FahadKhan356/Droply/internal/protocol"
	"github.com/FahadKhan356/Droply/pkg/engine"
)

func main() {
	deviceName := flag.String("name", "Studio Mac M2", "Broadcast device name on LAN")
	transferPort := flag.Int("port", protocol.DefaultTransferPort, "TLS 1.3 P2P transfer TCP port")
	controlPort := flag.Int("control-port", protocol.DefaultControlPort, "Local control API port for Desktop/Mobile UI")
	udpPort := flag.Int("udp-port", protocol.DefaultDiscoveryUDP, "UDP multicast/broadcast discovery port")
	storageDir := flag.String("storage-dir", "", "Directory for certificates, trusted devices, and transfer history")
	downloadDir := flag.String("download-dir", "", "Directory for received files")
	flag.Parse()

	node, err := engine.NewNode(engine.Options{
		StorageDir:   *storageDir,
		DownloadDir:  *downloadDir,
		DeviceName:   *deviceName,
		TransferPort: *transferPort,
		UDPPort:      *udpPort,
	})
	if err != nil {
		log.Fatalf("[DROPly] Failed to initialize Go networking engine: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	controlAddr := fmt.Sprintf("0.0.0.0:%d", *controlPort)
	transferAddr := fmt.Sprintf("0.0.0.0:%d", *transferPort)

	actualPort, err := node.Start(ctx, transferAddr, controlAddr)
	if err != nil {
		log.Fatalf("[DROPly] Engine startup error: %v", err)
	}

	self := node.DeviceMgr.Self()
	log.Printf("================================================================")
	log.Printf("DROPly Go P2P Engine & Companion Daemon v%s Online", protocol.ProtocolVersion)
	log.Printf("Device ID       : %s (%s)", self.DeviceName, self.DeviceID)
	log.Printf("Local LAN IP    : %s", self.IPAddress)
	log.Printf("TLS 1.3 P2P Port: %d (Fingerprint: %s)", actualPort, self.TLSFingerprint)
	log.Printf("Control Bridge  : http://127.0.0.1:%d/api/v1/status", *controlPort)
	log.Printf("Download Folder : %s", node.StorageMgr.DownloadDir())
	log.Printf("================================================================")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh

	log.Printf("[DROPly] Shutting down engine gracefully...")
	node.Stop()
}
