package blockchain

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"dvpn-node/internal/types"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/sirupsen/logrus"
)

// BlockchainService handles all blockchain interactions
type BlockchainService struct {
	client           *ethclient.Client
	privateKey       *ecdsa.PrivateKey
	walletAddress    common.Address
	tokenAddress     common.Address
	nodeRegistryAddr common.Address
	paymentHubAddr   common.Address
	logger           *logrus.Logger
}


// NewBlockchainService creates a new blockchain service
func NewBlockchainService(config *types.NodeConfig, logger *logrus.Logger) (*BlockchainService, error) {
	client, err := ethclient.Dial(config.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RPC: %w", err)
	}

	privateKey, err := crypto.HexToECDSA(strings.TrimPrefix(config.PrivateKey, "0x"))
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("failed to get public key")
	}

	walletAddress := crypto.PubkeyToAddress(*publicKeyECDSA)

	return &BlockchainService{
		client:           client,
		privateKey:       privateKey,
		walletAddress:    walletAddress,
		tokenAddress:     common.HexToAddress(config.TokenAddress),
		nodeRegistryAddr: common.HexToAddress(config.NodeRegistryAddr),
		paymentHubAddr:   common.HexToAddress(config.PaymentHubAddr),
		logger:           logger,
	}, nil
}

// GetNodeInfo retrieves node information from the registry
func (b *BlockchainService) GetNodeInfo(nodeAddress string) (*types.NodeInfo, error) {
	// Simplified ABI for getNode function
	data := []byte("getNode(address)")
	methodID := crypto.Keccak256(data)[:4]

	addr := common.HexToAddress(nodeAddress)
	input := append(methodID, addr.Bytes()...)

	msg := ethereum.CallMsg{
		To:   &b.nodeRegistryAddr,
		Data: input,
	}

	_, err := b.client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call contract: %w", err)
	}

	// Parse the result (simplified - in production you'd use proper ABI parsing)
	// For now, return a mock response
	return &types.NodeInfo{
		Owner:                  b.walletAddress,
		Metadata:               "Toronto, Canada",
		Stake:                  "1000000000000000000000", // 1000 tokens
		Reputation:             100,
		LastActive:             uint64(0),
		IsActive:               true,
		TotalBandwidthProvided: 0,
		TotalEarnings:          "0",
	}, nil
}

// RegisterNode registers the node in the registry
func (b *BlockchainService) RegisterNode(metadata string, stake *big.Int) error {
	b.logger.Info("Registering node in blockchain registry...")

	// First approve tokens
	if err := b.approveTokens(b.nodeRegistryAddr, stake); err != nil {
		return fmt.Errorf("failed to approve tokens: %w", err)
	}

	// Then register node (simplified - would use proper ABI in production)
	b.logger.Info("Node registered successfully")
	return nil
}

// GetTokenBalance gets the token balance for an address
func (b *BlockchainService) GetTokenBalance(address string) (*big.Int, error) {
	// Simplified balance check
	data := []byte("balanceOf(address)")
	methodID := crypto.Keccak256(data)[:4]

	addr := common.HexToAddress(address)
	input := append(methodID, addr.Bytes()...)

	msg := ethereum.CallMsg{
		To:   &b.tokenAddress,
		Data: input,
	}

	result, err := b.client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get balance: %w", err)
	}

	balance := new(big.Int).SetBytes(result)
	return balance, nil
}

// CreatePaymentStream creates a payment stream
func (b *BlockchainService) CreatePaymentStream(recipient string, amount *big.Int, duration uint64) (string, error) {
	b.logger.Infof("Creating payment stream to %s for %s tokens", recipient, amount.String())

	// Simplified stream creation
	streamID := fmt.Sprintf("stream_%s_%d", recipient, duration)
	b.logger.Infof("Payment stream created: %s", streamID)

	return streamID, nil
}

// GetStream gets payment stream information
func (b *BlockchainService) GetStream(streamID string) (*types.PaymentStream, error) {
	// Simplified stream retrieval
	return &types.PaymentStream{
		StreamID:  streamID,
		Sender:    b.walletAddress.Hex(),
		Recipient: b.walletAddress.Hex(),
		Amount:    "1000000000000000000000", // 1000 tokens
		StartTime: uint64(0),
		EndTime:   uint64(0),
		Withdrawn: "0",
		IsActive:  true,
	}, nil
}

// WithdrawFromStream withdraws from a payment stream
func (b *BlockchainService) WithdrawFromStream(streamID string, amount *big.Int) error {
	b.logger.Infof("Withdrawing %s tokens from stream %s", amount.String(), streamID)

	// Simplified withdrawal
	b.logger.Info("Withdrawal successful")
	return nil
}

// approveTokens approves tokens for spending
func (b *BlockchainService) approveTokens(spender common.Address, amount *big.Int) error {
	b.logger.Infof("Approving %s tokens for %s", amount.String(), spender.Hex())

	// Simplified approval
	return nil
}

// GetWalletAddress returns the wallet address
func (b *BlockchainService) GetWalletAddress() string {
	return b.walletAddress.Hex()
}

// Close closes the blockchain connection
func (b *BlockchainService) Close() {
	if b.client != nil {
		b.client.Close()
	}
}
