package types

import (
	"time"

	"github.com/ethereum/go-ethereum/common"
)

// NodeConfig holds the configuration for the VPN node
type NodeConfig struct {
	RPCURL           string `env:"RPC_URL" envDefault:"https://testnet-rpc.mawari.network"`
	PrivateKey       string `env:"PRIVATE_KEY"`
	TokenAddress     string `env:"TOKEN_ADDRESS"`
	NodeRegistryAddr string `env:"NODE_REGISTRY_ADDRESS"`
	PaymentHubAddr   string `env:"PAYMENT_HUB_ADDRESS"`

	// WireGuard Configuration
	WGInterface  string `env:"WG_INTERFACE" envDefault:"wg0"`
	WGPort       int    `env:"WG_PORT" envDefault:"51820"`
	WGPrivateKey string `env:"WG_PRIVATE_KEY"`
	WGPublicKey  string `env:"WG_PUBLIC_KEY"`
	WGSubnet     string `env:"WG_SUBNET" envDefault:"10.0.0.1/24"`

	// API Configuration
	APIPort         int  `env:"API_PORT" envDefault:"3000"`
	EnableWebSocket bool `env:"ENABLE_WEBSOCKET" envDefault:"true"`

	// Node Metadata
	NodeLocation  string `env:"NODE_LOCATION" envDefault:"Toronto, Canada"`
	NodeBandwidth int64  `env:"NODE_BANDWIDTH" envDefault:"1000000000"`        // 1GB in bytes
	MinStake      string `env:"MIN_STAKE" envDefault:"1000000000000000000000"` // 1000 tokens in wei
}

// NodeInfo represents a node in the registry
type NodeInfo struct {
	Owner                  common.Address `json:"owner"`
	Metadata               string         `json:"metadata"`
	Stake                  string         `json:"stake"`
	Reputation             uint64         `json:"reputation"`
	LastActive             uint64         `json:"lastActive"`
	IsActive               bool           `json:"isActive"`
	TotalBandwidthProvided uint64         `json:"totalBandwidthProvided"`
	TotalEarnings          string         `json:"totalEarnings"`
}

// Peer represents a WireGuard peer/client
type Peer struct {
	PublicKey  string    `json:"publicKey"`
	AllowedIPs []string  `json:"allowedIPs"`
	Endpoint   string    `json:"endpoint,omitempty"`
	LastSeen   time.Time `json:"lastSeen"`
	BytesRx    int64     `json:"bytesRx"`
	BytesTx    int64     `json:"bytesTx"`
	IsActive   bool      `json:"isActive"`
}

// PaymentStream represents a payment stream from a client
type PaymentStream struct {
	StreamID  string `json:"streamId"`
	Sender    string `json:"sender"`
	Recipient string `json:"recipient"`
	Amount    string `json:"amount"`
	StartTime uint64 `json:"startTime"`
	EndTime   uint64 `json:"endTime"`
	Withdrawn string `json:"withdrawn"`
	IsActive  bool   `json:"isActive"`
}

// BandwidthUsage tracks bandwidth consumption
type BandwidthUsage struct {
	PeerPublicKey string    `json:"peerPublicKey"`
	BytesRx       int64     `json:"bytesRx"`
	BytesTx       int64     `json:"bytesTx"`
	Timestamp     time.Time `json:"timestamp"`
}

// APIResponse represents a standard API response
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// WebSocketMessage represents a WebSocket message
type WebSocketMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// NodeStatus represents the current status of the node
type NodeStatus struct {
	IsRegistered   bool             `json:"isRegistered"`
	IsActive       bool             `json:"isActive"`
	Reputation     uint64           `json:"reputation"`
	TotalEarnings  string           `json:"totalEarnings"`
	ConnectedPeers int              `json:"connectedPeers"`
	TotalBandwidth int64            `json:"totalBandwidth"`
	Uptime         time.Duration    `json:"uptime"`
	Peers          map[string]*Peer `json:"peers"`
}
