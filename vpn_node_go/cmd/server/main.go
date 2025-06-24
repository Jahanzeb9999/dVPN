package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"dvpn-node/internal/api"
	"dvpn-node/internal/blockchain"
	"dvpn-node/internal/types"
	"dvpn-node/internal/wireguard"

	"github.com/joho/godotenv"
	"github.com/sirupsen/logrus"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Initialize logger
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})
	logger.SetLevel(logrus.InfoLevel)

	logger.Info("Starting dVPN Node (Go Backend)...")

	// Load configuration
	config := &types.NodeConfig{
		RPCURL:           getEnv("RPC_URL", "https://testnet-rpc.mawari.network"),
		PrivateKey:       getEnv("PRIVATE_KEY", ""),
		TokenAddress:     getEnv("TOKEN_ADDRESS", ""),
		NodeRegistryAddr: getEnv("NODE_REGISTRY_ADDRESS", ""),
		PaymentHubAddr:   getEnv("PAYMENT_HUB_ADDRESS", ""),
		WGInterface:      getEnv("WG_INTERFACE", "wg0"),
		WGPort:           getEnvAsInt("WG_PORT", 51820),
		WGPrivateKey:     getEnv("WG_PRIVATE_KEY", ""),
		WGPublicKey:      getEnv("WG_PUBLIC_KEY", ""),
		WGSubnet:         getEnv("WG_SUBNET", "10.0.0.1/24"),
		APIPort:          getEnvAsInt("API_PORT", 3000),
		EnableWebSocket:  getEnvAsBool("ENABLE_WEBSOCKET", true),
		NodeLocation:     getEnv("NODE_LOCATION", "Toronto, Canada"),
		NodeBandwidth:    getEnvAsInt64("NODE_BANDWIDTH", 1000000000),
		MinStake:         getEnv("MIN_STAKE", "1000000000000000000000"),
	}

	// Validate required configuration
	if config.PrivateKey == "" {
		logger.Fatal("PRIVATE_KEY environment variable is required")
	}
	if config.TokenAddress == "" {
		logger.Fatal("TOKEN_ADDRESS environment variable is required")
	}
	if config.NodeRegistryAddr == "" {
		logger.Fatal("NODE_REGISTRY_ADDRESS environment variable is required")
	}
	if config.PaymentHubAddr == "" {
		logger.Fatal("PAYMENT_HUB_ADDRESS environment variable is required")
	}
	if config.WGPrivateKey == "" {
		logger.Fatal("WG_PRIVATE_KEY environment variable is required")
	}
	if config.WGPublicKey == "" {
		logger.Fatal("WG_PUBLIC_KEY environment variable is required")
	}

	logger.Info("Configuration loaded successfully")

	// Initialize blockchain service
	blockchainService, err := blockchain.NewBlockchainService(config, logger)
	if err != nil {
		logger.Fatalf("Failed to initialize blockchain service: %v", err)
	}
	defer blockchainService.Close()

	logger.Info("Blockchain service initialized")

	// Initialize WireGuard service
	wireguardService, err := wireguard.NewWireGuardService(config, logger)
	if err != nil {
		logger.Fatalf("Failed to initialize WireGuard service: %v", err)
	}
	defer wireguardService.Close()

	logger.Info("WireGuard service initialized")

	// Initialize API server
	apiServer := api.NewServer(config, logger, blockchainService, wireguardService)

	// Start background tasks
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start stats monitoring
	go monitorStats(ctx, logger, wireguardService, blockchainService)

	// Start API server
	go func() {
		if err := apiServer.Start(); err != nil {
			logger.Fatalf("Failed to start API server: %v", err)
		}
	}()

	logger.Info("dVPN Node started successfully")
	logger.Infof("API server running on port %d", config.APIPort)
	logger.Infof("WireGuard interface: %s", config.WGInterface)
	logger.Infof("Node public key: %s", config.WGPublicKey)

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	logger.Info("Shutting down dVPN Node...")
	cancel()
	time.Sleep(2 * time.Second) // Give background tasks time to clean up
	logger.Info("dVPN Node shutdown complete")
}

// monitorStats monitors and logs statistics periodically
func monitorStats(ctx context.Context, logger *logrus.Logger, wireguard *wireguard.WireGuardService, blockchain *blockchain.BlockchainService) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Update peer statistics
			if err := wireguard.UpdatePeerStats(); err != nil {
				logger.Errorf("Failed to update peer stats: %v", err)
				continue
			}

			// Get statistics
			peers := wireguard.GetPeers()
			connectedPeers := wireguard.GetConnectedPeersCount()
			totalRx, totalTx := wireguard.GetTotalBandwidth()

			// Get wallet balance
			walletAddress := blockchain.GetWalletAddress()
			balance, err := blockchain.GetTokenBalance(walletAddress)
			if err != nil {
				logger.Errorf("Failed to get balance: %v", err)
				continue
			}

			logger.Infof("Stats - Connected Peers: %d/%d, Bandwidth: %d bytes, Balance: %s tokens",
				connectedPeers, len(peers), totalRx+totalTx, balance.String())
		}
	}
}

// Helper functions for environment variables
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
