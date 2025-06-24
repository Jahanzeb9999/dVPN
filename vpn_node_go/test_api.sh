#!/bin/bash

echo "🧪 Testing dVPN Node API"
echo "=========================="

# Health check
echo "1. Health Check:"
curl -s http://localhost:3000/health | jq .
echo ""

# Node status
echo "2. Node Status:"
curl -s http://localhost:3000/api/v1/node/status | jq .
echo ""

# Node info
echo "3. Node Info (Blockchain):"
curl -s http://localhost:3000/api/v1/node/info | jq .
echo ""

# Get wallet address from node info
echo "4. Getting Wallet Address:"
WALLET_ADDRESS=$(curl -s http://localhost:3000/api/v1/node/info | jq -r '.data.owner')
echo "Wallet Address: $WALLET_ADDRESS"
echo ""

# Check balance
echo "5. Token Balance:"
curl -s http://localhost:3000/api/v1/blockchain/balance/$WALLET_ADDRESS | jq .
echo ""

# Peers
echo "6. Current Peers:"
curl -s http://localhost:3000/api/v1/peers | jq .
echo ""

# Stats
echo "7. Bandwidth Stats:"
curl -s http://localhost:3000/api/v1/stats/bandwidth | jq .
echo ""

echo "8. Peer Stats:"
curl -s http://localhost:3000/api/v1/stats/peers | jq .
echo ""

echo "✅ API tests completed!" 