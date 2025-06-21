# dVPN Contract Deployment Guide

This guide explains how to deploy the dVPN contracts to the Mawari Network testnet using Foundry.

## Prerequisites

1. **Foundry installed** - [Install Foundry](https://book.getfoundry.sh/getting-started/installation)
2. **Private key** - Your wallet private key for deployment
3. **Testnet tokens** - Some testnet tokens for gas fees

## Setup

1. **Clone and install dependencies:**
   ```bash
   cd Contracts
   forge install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file:**
   ```env
   PRIVATE_KEY=your_private_key_here
   RPC_URL=https://mawari-network-testnet.rpc.caldera.xyz/http
   CHAIN_ID=123456
   ```

## Deployment Options

### Option 1: Deploy All Contracts (Recommended)

Deploy all contracts in the correct order with proper configuration:

```bash
forge script script/Deploy.s.sol --rpc-url https://mawari-network-testnet.rpc.caldera.xyz/http --broadcast --verify
```

### Option 2: Deploy Contracts Individually

If you need to deploy contracts separately:

1. **Deploy Token:**
   ```bash
   forge script script/DeployToken.s.sol --rpc-url https://mawari-network-testnet.rpc.caldera.xyz/http --broadcast
   ```

2. **Deploy NodeRegistry:**
   ```bash
   # Set TOKEN_ADDRESS in .env first
   forge script script/DeployNodeRegistry.s.sol --rpc-url https://mawari-network-testnet.rpc.caldera.xyz/http --broadcast
   ```

3. **Deploy PaymentHub:**
   ```bash
   # Set TOKEN_ADDRESS and NODE_REGISTRY_ADDRESS in .env first
   forge script script/DeployPaymentHub.s.sol --rpc-url https://mawari-network-testnet.rpc.caldera.xyz/http --broadcast
   ```

## Deployment Output

After successful deployment, you'll see detailed information in the console including:

- Contract addresses for all deployed contracts
- Token information (name, symbol, total supply)
- Configuration parameters (min stake, payment fees, etc.)
- Deployer information and token balances
- Deployment timestamps

## Contract Addresses

The deployment will output contract addresses like:
```
dVPN Token: 0x...
NodeRegistry: 0x...
PaymentHub: 0x...
```

## Verification

1. **Check console output** - Review the deployment information displayed
2. **Verify on block explorer** - Check contract deployment on Mawari Network explorer
3. **Test basic functions** - Verify token balance and contract interactions

## Configuration for VPN Node

After deployment, update your VPN node's `.env` file with the contract addresses from the console output:

```env
TOKEN_ADDRESS=0x... # From deployment console output
NODE_REGISTRY_ADDRESS=0x... # From deployment console output  
PAYMENT_HUB_ADDRESS=0x... # From deployment console output
```

## Troubleshooting

### Common Issues

1. **Insufficient gas** - Ensure you have enough testnet tokens
2. **Wrong RPC URL** - Verify the Mawari Network RPC endpoint
3. **Private key format** - Use private key without 0x prefix
4. **Contract verification** - Some networks may require manual verification

### Gas Settings

If you encounter gas issues, try:

```bash
forge script script/Deploy.s.sol --rpc-url https://mawari-network-testnet.rpc.caldera.xyz/http --broadcast --gas-price 1000000000
```

## Security Notes

- **Never commit private keys** to version control
- **Use testnet first** before mainnet deployment
- **Verify contract addresses** before using in production
- **Keep deployment logs** for reference

## Next Steps

After deployment:

1. **Configure VPN Node** - Update environment variables with contract addresses
2. **Test Integration** - Verify blockchain connectivity
3. **Register Node** - Use the NodeRegistry to register your VPN node
4. **Start VPN Service** - Begin providing VPN services

## Support

For deployment issues:
- Check Foundry documentation
- Verify network connectivity
- Review contract compilation errors
- Check gas price and limits 