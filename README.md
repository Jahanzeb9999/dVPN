# dVPN MVP - Decentralized VPN with Blockchain Integration

A minimal viable product (MVP) for a decentralized VPN system that combines smart contracts with off-chain WireGuard VPN nodes for trust-minimized bandwidth provision and payment.

## 🏗️ Architecture Overview

### On-Chain Components (EVM L2/Rollup)
- **NodeRegistry**: Manages node stakes, metadata, and reputation
- **PaymentHub**: Handles probabilistic/streaming micro-payments
- **dVPNToken**: Native ecosystem token for payments and staking
- **GovernanceDAO**: Parameter tweaks and fee schedule management

### Off-Chain Components
- **VPN Node Software** (TypeScript): WireGuard daemon with bandwidth metering
- **Mobile dVPN App**: User interface for consumers and providers
- **API Bridge**: Connects blockchain contracts with VPN operations

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Hardhat for smart contract development
- WireGuard tools installed on your system
- A Linux-based system (for WireGuard support)

### 1. Setup Project
```bash
# Clone and install dependencies
git clone <repository-url>
cd dvpn-mvp
npm run setup
```

### 2. Deploy Smart Contracts
```bash
# Start local blockchain
npm run node

# In another terminal, deploy contracts
npm run deploy
```

### 3. Configure VPN Node
```bash
# Copy environment template
cd vpn_node
cp env.example .env

# Edit .env with your configuration
# Add contract addresses from deployment output
# Add your private key for the node
```

### 4. Start VPN Node
```bash
# Start the VPN node
npm run start-vpn

# Or for development with hot reload
npm run start-vpn-dev
```

## 📁 Project Structure

```
dvpn-mvp/
├── contracts/                 # Smart contracts
│   ├── NodeRegistry.sol      # Node management and reputation
│   ├── PaymentHub.sol        # Payment processing and streaming
│   └── dVPNToken.sol         # Native token contract
├── scripts/
│   └── deploy.js             # Contract deployment script
├── vpn_node/                 # TypeScript VPN node software
│   ├── src/
│   │   ├── api/              # Express API server
│   │   ├── services/         # Business logic services
│   │   ├── utils/            # Utility functions
│   │   ├── types/            # TypeScript type definitions
│   │   └── main.ts           # Main application entry point
│   ├── package.json          # Node dependencies
│   └── tsconfig.json         # TypeScript configuration
├── mobile_app/               # React Native mobile app (future)
└── package.json              # Main project configuration
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `vpn_node` directory:

```env
# Blockchain Configuration
RPC_URL=http://localhost:8545
PRIVATE_KEY=your_private_key_here

# Contract Addresses (from deployment)
TOKEN_ADDRESS=0x...
NODE_REGISTRY_ADDRESS=0x...
PAYMENT_HUB_ADDRESS=0x...

# WireGuard Configuration
WG_INTERFACE=wg0
WG_PORT=51820
WG_NETWORK=10.0.0.0/24

# API Configuration
API_PORT=5000
```

### Smart Contract Parameters

- **Min Stake**: 1000 DVPN tokens
- **Reputation Decay**: 1 point per day
- **Slash Amount**: 500 DVPN tokens
- **Payment Fee**: 0.5% (50 basis points)
- **Min Payment**: 1 DVPN token

## 🌐 API Endpoints

The VPN node exposes a REST API for management and monitoring:

### Health & Status
- `GET /health` - Health check
- `GET /status` - Node status and statistics
- `GET /wireguard/status` - WireGuard interface status

### Client Management
- `POST /connect` - Connect a new client
- `POST /disconnect` - Disconnect a client
- `GET /clients` - List connected clients

### Bandwidth Monitoring
- `GET /bandwidth` - Bandwidth statistics
- `GET /clients` - Per-client bandwidth stats

### Blockchain Operations
- `GET /blockchain/balance` - Token balance
- `GET /blockchain/node-info` - Node registry info
- `POST /blockchain/register` - Register node
- `POST /blockchain/unregister` - Unregister node

## 🔐 Security Features

### Smart Contract Security
- **Reentrancy Protection**: All external calls protected
- **Access Control**: Owner-only functions for critical operations
- **Stake Slashing**: Penalty mechanism for misbehavior
- **Reputation System**: Trust scoring for nodes

### VPN Security
- **WireGuard Protocol**: Modern, secure VPN protocol
- **Key Management**: Secure key generation and storage
- **Bandwidth Verification**: Signed receipts for usage tracking
- **Client Isolation**: Per-client IP allocation

## 💰 Token Economics

### dVPN Token (DVPN)
- **Total Supply**: 15 million tokens
- **Initial Supply**: 10 million (for staking and payments)
- **Reward Supply**: 5 million (for node rewards)

### Payment Flow
1. **Consumer** creates payment stream to **Node**
2. **Node** provides VPN service and tracks bandwidth
3. **Node** reports usage with signed receipts
4. **PaymentHub** processes payments with fee deduction
5. **Node** receives payment in DVPN tokens

### Staking Mechanism
- **Min Stake**: 1000 DVPN tokens per node
- **Reputation**: Affects payment priority and slashing
- **Slashing**: Penalty for malicious behavior
- **Unstaking**: 24-hour cooldown period

## 🧪 Testing

### Smart Contract Tests
```bash
npm run test
```

### VPN Node Tests
```bash
cd vpn_node
npm test
```

### Integration Tests
```bash
# Test complete flow
npm run test:integration
```

## 📱 Mobile App (Future)

The mobile app will provide:
- **Consumer Mode**: Connect to dVPN nodes
- **Provider Mode**: Share bandwidth and earn tokens
- **Wallet Integration**: EIP-4337 Account Abstraction
- **Real-time Dashboard**: Earnings and usage statistics

## 🔄 Development Workflow

### Smart Contract Development
1. Modify contracts in `contracts/`
2. Update tests in `test/`
3. Deploy with `npm run deploy`
4. Update environment variables

### VPN Node Development
1. Modify TypeScript code in `vpn_node/src/`
2. Build with `npm run build`
3. Test with `npm run dev`
4. Deploy with `npm start`

## 🚨 Important Notes

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended)
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 10GB available space
- **Network**: Stable internet connection

### Security Considerations
- **Private Keys**: Never commit private keys to version control
- **Firewall**: Configure firewall rules for WireGuard
- **Updates**: Keep system and dependencies updated
- **Monitoring**: Monitor node performance and security

### Production Deployment
- Use production blockchain network (Ethereum mainnet, Polygon, etc.)
- Implement proper logging and monitoring
- Set up automated backups
- Use hardware security modules (HSMs) for key management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: Create GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the docs folder for detailed guides

## 🔮 Roadmap

### Phase 1 (Current - MVP)
- ✅ Basic smart contracts
- ✅ TypeScript VPN node
- ✅ WireGuard integration
- ✅ Bandwidth tracking
- ✅ Payment processing

### Phase 2 (Next)
- 📱 Mobile app development
- 🔐 Advanced security features
- 📊 Analytics dashboard
- 🌐 Multi-chain support

### Phase 3 (Future)
- 🤖 AI-powered node selection
- 🔄 Cross-chain payments
- 📈 Advanced reputation system
- 🌍 Global node network

---

**Built with ❤️ by the dVPN Team** 

┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT SIDE                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   dVPN App  │    │  Wallet     │    │ WireGuard   │        │
│  │             │    │             │    │   Client    │        │
│  │ • Connect   │───►│ • Create    │───►│ • Encrypt   │        │
│  │ • Pay       │    │ • Stream    │    │ • Tunnel    │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ dVPNToken   │    │PaymentHub   │    │NodeRegistry │        │
│  │             │    │             │    │             │        │
│  │ • ERC20     │    │ • Streams   │    │ • Nodes     │        │
│  │ • Rewards   │    │ • Payments  │    │ • Stakes    │        │
│  │ • Staking   │    │ • Fees      │    │ • Reputation│        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NODE SIDE                                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ Blockchain  │    │ Bandwidth   │    │ WireGuard   │        │
│  │ Service     │    │ Tracker     │    │   Server    │        │
│  │             │    │             │    │             │        │
│  │ • Contracts │    │ • Monitor   │    │ • Encrypt   │        │
│  │ • Payments  │    │ • Report    │    │ • Route     │        │
│  │ • Registry  │    │ • Stats     │    │ • Gateway   │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
└─────────────────────────────────────────────────────────────────┘ 
