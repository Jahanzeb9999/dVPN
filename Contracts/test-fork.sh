#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Default RPC URL for Arbitrum Sepolia
ARBITRUM_SEPOLIA_RPC="https://sepolia-rollup.arbitrum.io/rpc"

echo -e "${BLUE}🌐 LicenseTierNFT Fork Tests${NC}"
echo "================================================="

# Check if custom RPC is provided
if [ ! -z "$1" ]; then
    ARBITRUM_SEPOLIA_RPC="$1"
    echo -e "${YELLOW}📡 Using custom RPC: $ARBITRUM_SEPOLIA_RPC${NC}"
fi

# Set environment variable
export ARBITRUM_SEPOLIA_RPC="$ARBITRUM_SEPOLIA_RPC"

echo -e "${PURPLE}🔗 Connecting to network...${NC}"
echo "RPC URL: $ARBITRUM_SEPOLIA_RPC"

# Function to run tests with proper fork configuration
run_fork_tests() {
    local test_name="$1"
    local pattern="$2"
    local extra_args="$3"
    local use_fork="$4"
    
    echo -e "\n${YELLOW}🧪 Running $test_name${NC}"
    echo "----------------------------------------"
    
    # Build the forge command
    local forge_cmd="forge test"
    
    # Add fork URL if specified
    if [ "$use_fork" = "true" ]; then
        forge_cmd="$forge_cmd --fork-url $ARBITRUM_SEPOLIA_RPC"
        echo -e "${BLUE}🔄 Using fork mode with RPC: $ARBITRUM_SEPOLIA_RPC${NC}"
    else
        echo -e "${BLUE}🏠 Running on local Anvil${NC}"
    fi
    
    # Add test contract filter
    forge_cmd="$forge_cmd --match-contract LicenseTierNFTForkTest"
    
    # Add test pattern if specified
    if [ ! -z "$pattern" ]; then
        forge_cmd="$forge_cmd --match-test $pattern"
    fi
    
    # Add gas reporting and verbosity
    forge_cmd="$forge_cmd --gas-report -vv"
    
    # Add extra arguments
    if [ ! -z "$extra_args" ]; then
        forge_cmd="$forge_cmd $extra_args"
    fi
    
    echo -e "${PURPLE}Executing: $forge_cmd${NC}"
    
    # Execute the command
    eval $forge_cmd
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $test_name passed!${NC}"
    else
        echo -e "${RED}❌ $test_name failed!${NC}"
        return 1
    fi
}

# Function to check network connection
check_network() {
    echo -e "${BLUE}🔍 Checking network connection...${NC}"
    
    # Try to get the latest block number
    BLOCK_NUMBER=$(cast block-number --rpc-url "$ARBITRUM_SEPOLIA_RPC" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Connected to network${NC}"
        echo -e "📊 Latest block number: ${BLOCK_NUMBER}"
        
        # Get chain ID to confirm we're on the right network
        CHAIN_ID=$(cast chain-id --rpc-url "$ARBITRUM_SEPOLIA_RPC" 2>/dev/null)
        echo -e "🔗 Chain ID: ${CHAIN_ID}"
        
        if [ "$CHAIN_ID" = "421614" ]; then
            echo -e "${GREEN}✅ Confirmed: Arbitrum Sepolia (Chain ID: 421614)${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Chain ID ${CHAIN_ID} - not Arbitrum Sepolia${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Failed to connect to RPC${NC}"
        echo -e "${YELLOW}💡 Will run tests on local Anvil instead${NC}"
        return 1
    fi
}

# Determine test mode
echo -e "\n${PURPLE}🚀 Starting Test Suite${NC}"

# Check if we should use fork mode
USE_FORK="false"
if check_network; then
    USE_FORK="true"
    echo -e "${GREEN}🌐 Fork mode enabled${NC}"
else
    echo -e "${YELLOW}🏠 Using local mode${NC}"
fi

echo -e "\n${BLUE}📋 Test Categories Available:${NC}"
echo "1. All Tests"
echo "2. Network Conditions (flexible/strict)"
echo "3. Gas Usage Tests"
echo "4. Custom Errors"
echo "5. Real World Scenarios"
echo "6. Token Locking"
echo "7. TGE Workflow"
echo "8. Multicall Tests"
echo "9. Comprehensive State Check"

# Parse test category argument
TEST_CATEGORY="$2"
if [ -z "$TEST_CATEGORY" ]; then
    echo -e "\n${YELLOW}🎯 Running all tests...${NC}"
    run_fork_tests "All Fork Tests" "" "" "$USE_FORK"
else
    case "$TEST_CATEGORY" in
        "network")
            echo -e "\n${YELLOW}Running both flexible and strict network tests...${NC}"
            run_fork_tests "Network Conditions (Flexible)" "testFork_NetworkConditions" "" "$USE_FORK"
            run_fork_tests "Network Conditions (Strict)" "testFork_NetworkConditions_StrictFork" "" "$USE_FORK"
            ;;
        "gas")
            run_fork_tests "Gas Usage Tests" "testFork_GasUsage" "" "$USE_FORK"
            ;;
        "errors")
            run_fork_tests "Custom Errors" "testFork_CustomErrors" "" "$USE_FORK"
            ;;
        "real-world")
            run_fork_tests "Real World Scenarios" "testFork_RealWorldScenario" "" "$USE_FORK"
            ;;
        "locking")
            run_fork_tests "Token Locking" "testFork_TokenLocking" "" "$USE_FORK"
            ;;
        "tge")
            run_fork_tests "TGE Workflow" "testFork_TGE" "" "$USE_FORK"
            ;;
        "multicall")
            run_fork_tests "Multicall Tests" "testFork_Multicall" "" "$USE_FORK"
            ;;
        "state")
            run_fork_tests "Comprehensive State Check" "testFork_ComprehensiveStateCheck" "" "$USE_FORK"
            ;;
        "local")
            echo -e "\n${YELLOW}🏠 Forcing local mode...${NC}"
            run_fork_tests "Local Tests" "" "" "false"
            ;;
        "fork")
            echo -e "\n${YELLOW}🌐 Forcing fork mode...${NC}"
            run_fork_tests "Fork Tests" "" "" "true"
            ;;
        *)
            echo -e "${RED}❌ Unknown test category: $TEST_CATEGORY${NC}"
            echo -e "${YELLOW}💡 Available categories: network, gas, errors, real-world, locking, tge, multicall, state, local, fork${NC}"
            exit 1
            ;;
    esac
fi

# Additional detailed tests with verbose output
if [ "$TEST_CATEGORY" = "" ] || [ "$TEST_CATEGORY" = "all" ]; then
    echo -e "\n${PURPLE}🔬 Running Detailed Error Tests${NC}"
    run_fork_tests "Custom Error Validation" "testFork_CustomErrors_AllScenarios" "--verbosity 3" "$USE_FORK"

    # Performance analysis
    echo -e "\n${PURPLE}⚡ Performance Analysis${NC}"
    run_fork_tests "Gas Usage Analysis" "testFork_GasUsage" "--gas-report" "$USE_FORK"
fi

# Generate coverage report if requested
if [ "$3" = "coverage" ]; then
    echo -e "\n${PURPLE}📊 Generating Coverage Report${NC}"
    
    if [ "$USE_FORK" = "true" ]; then
        forge coverage \
            --fork-url "$ARBITRUM_SEPOLIA_RPC" \
            --match-contract "LicenseTierNFTForkTest" \
            --report lcov
    else
        forge coverage \
            --match-contract "LicenseTierNFTForkTest" \
            --report lcov
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Coverage report generated${NC}"
    else
        echo -e "${RED}❌ Coverage report failed${NC}"
    fi
fi

echo -e "\n${GREEN}🎉 Testing completed!${NC}"
echo -e "${BLUE}💡 Usage Tips:${NC}"
echo -e "  • Run specific tests: ./test-fork.sh <rpc-url> <category>"
echo -e "  • Force local mode: ./test-fork.sh local"
echo -e "  • Force fork mode: ./test-fork.sh <rpc-url> fork"
echo -e "  • Generate coverage: ./test-fork.sh <rpc-url> <category> coverage"
echo -e "  • Categories: network, gas, errors, real-world, locking, tge, multicall, state"
echo -e ""
echo -e "${BLUE}🔧 Examples:${NC}"
echo -e "  ./test-fork.sh                                    # Auto-detect mode, run all tests"
echo -e "  ./test-fork.sh local                              # Force local Anvil testing"
echo -e "  ./test-fork.sh https://arb-sepolia.rpc.com network # Fork test network conditions"
echo -e "  ./test-fork.sh https://arb-sepolia.rpc.com gas     # Fork test gas usage"