package api

import (
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"dvpn-node/internal/blockchain"
	"dvpn-node/internal/types"
	"dvpn-node/internal/wireguard"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// Server represents the API server
type Server struct {
	config           *types.NodeConfig
	logger           *logrus.Logger
	blockchain       *blockchain.BlockchainService
	wireguard        *wireguard.WireGuardService
	upgrader         websocket.Upgrader
	wsConnections    map[*websocket.Conn]bool
	wsConnectionsMux sync.RWMutex
}

// NewServer creates a new API server
func NewServer(config *types.NodeConfig, logger *logrus.Logger, blockchain *blockchain.BlockchainService, wireguard *wireguard.WireGuardService) *Server {
	return &Server{
		config:        config,
		logger:        logger,
		blockchain:    blockchain,
		wireguard:     wireguard,
		wsConnections: make(map[*websocket.Conn]bool),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for development
			},
		},
	}
}

// Start starts the API server
func (s *Server) Start() error {
	router := gin.Default()

	// CORS middleware
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// API routes
	api := router.Group("/api/v1")
	{
		// Node information
		api.GET("/node/status", s.getNodeStatus)
		api.GET("/node/info", s.getNodeInfo)
		api.POST("/node/register", s.registerNode)

		// Peer management
		api.GET("/peers", s.getPeers)
		api.POST("/peers", s.addPeer)
		api.DELETE("/peers/:publicKey", s.removePeer)
		api.GET("/peers/:publicKey", s.getPeer)

		// Blockchain
		api.GET("/blockchain/balance/:address", s.getBalance)
		api.POST("/blockchain/stream", s.createPaymentStream)
		api.GET("/blockchain/stream/:streamId", s.getStream)
		api.POST("/blockchain/withdraw", s.withdrawFromStream)

		// Statistics
		api.GET("/stats/bandwidth", s.getBandwidthStats)
		api.GET("/stats/peers", s.getPeerStats)
	}

	// WebSocket endpoint
	if s.config.EnableWebSocket {
		router.GET("/ws", s.handleWebSocket)
	}

	// Health check
	router.GET("/health", s.healthCheck)

	s.logger.Infof("Starting API server on port %d", s.config.APIPort)
	return router.Run(fmt.Sprintf(":%d", s.config.APIPort))
}

// getNodeStatus returns the current node status
func (s *Server) getNodeStatus(c *gin.Context) {
	peers := s.wireguard.GetPeers()
	connectedPeers := s.wireguard.GetConnectedPeersCount()
	totalRx, totalTx := s.wireguard.GetTotalBandwidth()

	status := &types.NodeStatus{
		IsRegistered:   true, // TODO: Check from blockchain
		IsActive:       true,
		Reputation:     100, // TODO: Get from blockchain
		TotalEarnings:  "0", // TODO: Get from blockchain
		ConnectedPeers: connectedPeers,
		TotalBandwidth: totalRx + totalTx,
		Uptime:         time.Since(time.Now()), // TODO: Track actual uptime
		Peers:          peers,
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    status,
	})
}

// getNodeInfo returns node information from blockchain
func (s *Server) getNodeInfo(c *gin.Context) {
	walletAddress := s.blockchain.GetWalletAddress()
	nodeInfo, err := s.blockchain.GetNodeInfo(walletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    nodeInfo,
	})
}

// registerNode registers the node in the blockchain
func (s *Server) registerNode(c *gin.Context) {
	var request struct {
		Metadata string `json:"metadata"`
		Stake    string `json:"stake"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
		return
	}

	stake, ok := new(big.Int).SetString(request.Stake, 10)
	if !ok {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   "Invalid stake amount",
		})
		return
	}

	if err := s.blockchain.RegisterNode(request.Metadata, stake); err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Message: "Node registered successfully",
	})
}

// getPeers returns all peers
func (s *Server) getPeers(c *gin.Context) {
	peers := s.wireguard.GetPeers()

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    peers,
	})
}

// addPeer adds a new peer
func (s *Server) addPeer(c *gin.Context) {
	var request struct {
		PublicKey  string   `json:"publicKey"`
		AllowedIPs []string `json:"allowedIPs"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
		return
	}

	if err := s.wireguard.AddPeer(request.PublicKey, request.AllowedIPs); err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Broadcast to WebSocket clients
	s.broadcastWebSocket(types.WebSocketMessage{
		Type: "peer_added",
		Payload: map[string]interface{}{
			"publicKey":  request.PublicKey,
			"allowedIPs": request.AllowedIPs,
		},
	})

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Message: "Peer added successfully",
	})
}

// removePeer removes a peer
func (s *Server) removePeer(c *gin.Context) {
	publicKey := c.Param("publicKey")

	if err := s.wireguard.RemovePeer(publicKey); err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Broadcast to WebSocket clients
	s.broadcastWebSocket(types.WebSocketMessage{
		Type: "peer_removed",
		Payload: map[string]interface{}{
			"publicKey": publicKey,
		},
	})

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Message: "Peer removed successfully",
	})
}

// getPeer returns a specific peer
func (s *Server) getPeer(c *gin.Context) {
	publicKey := c.Param("publicKey")

	peer, exists := s.wireguard.GetPeer(publicKey)
	if !exists {
		c.JSON(http.StatusNotFound, types.APIResponse{
			Success: false,
			Error:   "Peer not found",
		})
		return
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    peer,
	})
}

// getBalance returns token balance for an address
func (s *Server) getBalance(c *gin.Context) {
	address := c.Param("address")

	balance, err := s.blockchain.GetTokenBalance(address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"address": address,
			"balance": balance.String(),
		},
	})
}

// createPaymentStream creates a payment stream
func (s *Server) createPaymentStream(c *gin.Context) {
	var request struct {
		Recipient string `json:"recipient"`
		Amount    string `json:"amount"`
		Duration  uint64 `json:"duration"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
		return
	}

	amount, ok := new(big.Int).SetString(request.Amount, 10)
	if !ok {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   "Invalid amount",
		})
		return
	}

	streamID, err := s.blockchain.CreatePaymentStream(request.Recipient, amount, request.Duration)
	if err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"streamId": streamID,
		},
	})
}

// getStream returns payment stream information
func (s *Server) getStream(c *gin.Context) {
	streamID := c.Param("streamId")

	stream, err := s.blockchain.GetStream(streamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data:    stream,
	})
}

// withdrawFromStream withdraws from a payment stream
func (s *Server) withdrawFromStream(c *gin.Context) {
	var request struct {
		StreamID string `json:"streamId"`
		Amount   string `json:"amount"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   "Invalid request body",
		})
		return
	}

	amount, ok := new(big.Int).SetString(request.Amount, 10)
	if !ok {
		c.JSON(http.StatusBadRequest, types.APIResponse{
			Success: false,
			Error:   "Invalid amount",
		})
		return
	}

	if err := s.blockchain.WithdrawFromStream(request.StreamID, amount); err != nil {
		c.JSON(http.StatusInternalServerError, types.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Message: "Withdrawal successful",
	})
}

// getBandwidthStats returns bandwidth statistics
func (s *Server) getBandwidthStats(c *gin.Context) {
	totalRx, totalTx := s.wireguard.GetTotalBandwidth()

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"totalRx": totalRx,
			"totalTx": totalTx,
			"total":   totalRx + totalTx,
		},
	})
}

// getPeerStats returns peer statistics
func (s *Server) getPeerStats(c *gin.Context) {
	peers := s.wireguard.GetPeers()
	connectedCount := s.wireguard.GetConnectedPeersCount()

	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"totalPeers":        len(peers),
			"connectedPeers":    connectedCount,
			"disconnectedPeers": len(peers) - connectedCount,
		},
	})
}

// healthCheck returns health status
func (s *Server) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, types.APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
		},
	})
}

// handleWebSocket handles WebSocket connections
func (s *Server) handleWebSocket(c *gin.Context) {
	conn, err := s.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		s.logger.Errorf("Failed to upgrade connection to WebSocket: %v", err)
		return
	}

	// Add connection to the pool
	s.wsConnectionsMux.Lock()
	s.wsConnections[conn] = true
	s.wsConnectionsMux.Unlock()

	s.logger.Info("New WebSocket connection established")

	// Send initial status
	status := &types.NodeStatus{
		IsRegistered:   true,
		IsActive:       true,
		Reputation:     100,
		TotalEarnings:  "0",
		ConnectedPeers: s.wireguard.GetConnectedPeersCount(),
		Peers:          s.wireguard.GetPeers(),
	}

	message := types.WebSocketMessage{
		Type:    "status",
		Payload: status,
	}

	if err := conn.WriteJSON(message); err != nil {
		s.logger.Errorf("Failed to send initial status: %v", err)
	}

	// Handle WebSocket messages
	for {
		var message types.WebSocketMessage
		if err := conn.ReadJSON(&message); err != nil {
			s.logger.Errorf("WebSocket read error: %v", err)
			break
		}

		// Handle different message types
		switch message.Type {
		case "ping":
			conn.WriteJSON(types.WebSocketMessage{
				Type: "pong",
			})
		}
	}

	// Remove connection from the pool
	s.wsConnectionsMux.Lock()
	delete(s.wsConnections, conn)
	s.wsConnectionsMux.Unlock()

	conn.Close()
	s.logger.Info("WebSocket connection closed")
}

// broadcastWebSocket broadcasts a message to all WebSocket clients
func (s *Server) broadcastWebSocket(message types.WebSocketMessage) {
	s.wsConnectionsMux.RLock()
	defer s.wsConnectionsMux.RUnlock()

	for conn := range s.wsConnections {
		if err := conn.WriteJSON(message); err != nil {
			s.logger.Errorf("Failed to send WebSocket message: %v", err)
			conn.Close()
			delete(s.wsConnections, conn)
		}
	}
}
