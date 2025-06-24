package wireguard

import (
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

	"dvpn-node/internal/types"

	"github.com/sirupsen/logrus"
	"golang.zx2c4.com/wireguard/wgctrl"
	"golang.zx2c4.com/wireguard/wgctrl/wgtypes"
)

// WireGuardService manages WireGuard interface and peers
type WireGuardService struct {
	config     *types.NodeConfig
	logger     *logrus.Logger
	device     *wgctrl.Client
	peers      map[string]*types.Peer
	peersMutex sync.RWMutex
	startTime  time.Time
}

// NewWireGuardService creates a new WireGuard service
func NewWireGuardService(config *types.NodeConfig, logger *logrus.Logger) (*WireGuardService, error) {
	device, err := wgctrl.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create wgctrl client: %w", err)
	}

	service := &WireGuardService{
		config:    config,
		logger:    logger,
		device:    device,
		peers:     make(map[string]*types.Peer),
		startTime: time.Now(),
	}

	// Initialize WireGuard interface
	if err := service.initializeInterface(); err != nil {
		return nil, fmt.Errorf("failed to initialize interface: %w", err)
	}

	return service, nil
}

// initializeInterface sets up the WireGuard interface
func (w *WireGuardService) initializeInterface() error {
	w.logger.Info("Initializing WireGuard interface...")

	// Check if interface exists
	_, err := w.device.Device(w.config.WGInterface)
	if err != nil {
		// Try to find utun interface on macOS
		if w.isMacOS() {
			w.logger.Info("macOS detected, checking for utun interface...")
			// On macOS, WireGuard interfaces are named utunX
			for i := 0; i < 10; i++ {
				utunName := fmt.Sprintf("utun%d", i)
				if _, err := w.device.Device(utunName); err == nil {
					w.logger.Infof("Found existing WireGuard interface: %s", utunName)
					w.config.WGInterface = utunName
					break
				}
			}
		}

		// If still no interface found, try to create one
		if _, err := w.device.Device(w.config.WGInterface); err != nil {
			w.logger.Infof("No existing interface found, creating: %s", w.config.WGInterface)
			if err := w.createInterface(); err != nil {
				return fmt.Errorf("failed to create interface: %w", err)
			}
		}
	}

	// Try to configure the interface (skip if it fails on macOS)
	if err := w.configureInterface(); err != nil {
		if w.isMacOS() {
			w.logger.Warn("Skipping interface configuration on macOS (interface may already be configured)")
		} else {
			return fmt.Errorf("failed to configure interface: %w", err)
		}
	}

	w.logger.Info("WireGuard interface initialized successfully")
	return nil
}

// isMacOS checks if running on macOS
func (w *WireGuardService) isMacOS() bool {
	return strings.Contains(strings.ToLower(runtime.GOOS), "darwin")
}

// createInterface creates the WireGuard interface
func (w *WireGuardService) createInterface() error {
	w.logger.Infof("Creating WireGuard interface: %s", w.config.WGInterface)

	// Use wg-quick to create interface (simplified)
	cmd := exec.Command("wg-quick", "up", w.config.WGInterface)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to create interface: %w", err)
	}

	return nil
}

// configureInterface configures the WireGuard interface
func (w *WireGuardService) configureInterface() error {
	w.logger.Infof("Configuring WireGuard interface: %s", w.config.WGInterface)

	// Parse private key
	privateKey, err := wgtypes.ParseKey(w.config.WGPrivateKey)
	if err != nil {
		return fmt.Errorf("invalid private key: %w", err)
	}

	// Configure device
	config := wgtypes.Config{
		PrivateKey: &privateKey,
		ListenPort: &w.config.WGPort,
	}

	if err := w.device.ConfigureDevice(w.config.WGInterface, config); err != nil {
		return fmt.Errorf("failed to configure device: %w", err)
	}

	return nil
}

// AddPeer adds a new peer to the WireGuard interface
func (w *WireGuardService) AddPeer(publicKey string, allowedIPs []string) error {
	w.logger.Infof("Adding peer: %s with IPs: %v", publicKey, allowedIPs)

	// Parse public key
	peerKey, err := wgtypes.ParseKey(publicKey)
	if err != nil {
		return fmt.Errorf("invalid public key: %w", err)
	}

	// Convert string IPs to net.IPNet
	var ipNets []net.IPNet
	for _, ipStr := range allowedIPs {
		_, ipNet, err := net.ParseCIDR(ipStr)
		if err != nil {
			return fmt.Errorf("invalid IP address: %s", ipStr)
		}
		ipNets = append(ipNets, *ipNet)
	}

	// Add peer to WireGuard
	config := wgtypes.Config{
		Peers: []wgtypes.PeerConfig{
			{
				PublicKey:  peerKey,
				AllowedIPs: ipNets,
			},
		},
	}

	if err := w.device.ConfigureDevice(w.config.WGInterface, config); err != nil {
		return fmt.Errorf("failed to add peer: %w", err)
	}

	// Store peer information
	w.peersMutex.Lock()
	w.peers[publicKey] = &types.Peer{
		PublicKey:  publicKey,
		AllowedIPs: allowedIPs,
		LastSeen:   time.Now(),
		IsActive:   true,
	}
	w.peersMutex.Unlock()

	w.logger.Infof("Peer %s added successfully", publicKey)
	return nil
}

// RemovePeer removes a peer from the WireGuard interface
func (w *WireGuardService) RemovePeer(publicKey string) error {
	w.logger.Infof("Removing peer: %s", publicKey)

	// Parse public key
	peerKey, err := wgtypes.ParseKey(publicKey)
	if err != nil {
		return fmt.Errorf("invalid public key: %w", err)
	}

	// Remove peer from WireGuard
	config := wgtypes.Config{
		Peers: []wgtypes.PeerConfig{
			{
				PublicKey: peerKey,
				Remove:    true,
			},
		},
	}

	if err := w.device.ConfigureDevice(w.config.WGInterface, config); err != nil {
		return fmt.Errorf("failed to remove peer: %w", err)
	}

	// Remove from local storage
	w.peersMutex.Lock()
	delete(w.peers, publicKey)
	w.peersMutex.Unlock()

	w.logger.Infof("Peer %s removed successfully", publicKey)
	return nil
}

// GetPeers returns all peers
func (w *WireGuardService) GetPeers() map[string]*types.Peer {
	w.peersMutex.RLock()
	defer w.peersMutex.RUnlock()

	peers := make(map[string]*types.Peer)
	for key, peer := range w.peers {
		peers[key] = peer
	}

	return peers
}

// GetPeer returns a specific peer
func (w *WireGuardService) GetPeer(publicKey string) (*types.Peer, bool) {
	w.peersMutex.RLock()
	defer w.peersMutex.RUnlock()

	peer, exists := w.peers[publicKey]
	return peer, exists
}

// UpdatePeerStats updates peer statistics
func (w *WireGuardService) UpdatePeerStats() error {
	device, err := w.device.Device(w.config.WGInterface)
	if err != nil {
		return fmt.Errorf("failed to get device: %w", err)
	}

	w.peersMutex.Lock()
	defer w.peersMutex.Unlock()

	for _, peer := range device.Peers {
		peerKey := peer.PublicKey.String()
		if storedPeer, exists := w.peers[peerKey]; exists {
			storedPeer.BytesRx = peer.ReceiveBytes
			storedPeer.BytesTx = peer.TransmitBytes
			storedPeer.LastSeen = time.Now()
			storedPeer.IsActive = true
		}
	}

	return nil
}

// GetTotalBandwidth returns total bandwidth usage
func (w *WireGuardService) GetTotalBandwidth() (int64, int64) {
	w.peersMutex.RLock()
	defer w.peersMutex.RUnlock()

	var totalRx, totalTx int64
	for _, peer := range w.peers {
		totalRx += peer.BytesRx
		totalTx += peer.BytesTx
	}

	return totalRx, totalTx
}

// GetConnectedPeersCount returns the number of connected peers
func (w *WireGuardService) GetConnectedPeersCount() int {
	w.peersMutex.RLock()
	defer w.peersMutex.RUnlock()

	count := 0
	for _, peer := range w.peers {
		if peer.IsActive {
			count++
		}
	}

	return count
}

// GetPublicKey returns the node's public key
func (w *WireGuardService) GetPublicKey() string {
	return w.config.WGPublicKey
}

// GetInterfaceName returns the interface name
func (w *WireGuardService) GetInterfaceName() string {
	return w.config.WGInterface
}

// Close closes the WireGuard service
func (w *WireGuardService) Close() error {
	if w.device != nil {
		return w.device.Close()
	}
	return nil
}
