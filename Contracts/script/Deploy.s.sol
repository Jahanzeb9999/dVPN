// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/dVPNToken.sol";
import "../src/NodeRegistry.sol";
import "../src/PaymentHub.sol";

contract DeployScript is Script {
    // Contract instances
    dVPNToken public token;
    NodeRegistry public nodeRegistry;
    PaymentHub public paymentHub;

    // Deployment addresses
    address public deployer;
    
    // Constants
    uint256 public constant INITIAL_STAKE = 1000 * 10**18; // 1000 tokens
    uint256 public constant MIN_PAYMENT = 1 * 10**18; // 1 token
    uint256 public constant PAYMENT_FEE = 50; // 0.5%

    function setUp() public {
        deployer = msg.sender;
    }

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("Starting dVPN contract deployment...");
        console.log("Deployer address:", deployer);

        // Step 1: Deploy dVPN Token
        console.log("\nDeploying dVPN Token...");
        token = new dVPNToken();
        console.log("dVPN Token deployed at:", address(token));
        console.log("   Initial supply:", token.totalSupply() / 10**18, "DVPN");

        // Step 2: Deploy NodeRegistry
        console.log("\nDeploying NodeRegistry...");
        nodeRegistry = new NodeRegistry(address(token));
        console.log("NodeRegistry deployed at:", address(nodeRegistry));

        // Step 3: Deploy PaymentHub
        console.log("\nDeploying PaymentHub...");
        paymentHub = new PaymentHub(address(token), address(nodeRegistry));
        console.log("PaymentHub deployed at:", address(paymentHub));

        // Step 4: Transfer PaymentHub ownership to NodeRegistry
        console.log("\nTransferring PaymentHub ownership to NodeRegistry...");
        paymentHub.transferOwnership(address(nodeRegistry));
        console.log("PaymentHub ownership transferred");

        // Step 5: Mint initial tokens to deployer for testing
        console.log("\nMinting initial tokens to deployer...");
        uint256 initialAmount = 10000 * 10**18; // 10,000 tokens
        token.mintRewards(deployer, initialAmount);
        console.log("Minted", initialAmount / 10**18, "DVPN tokens to deployer");

        vm.stopBroadcast();

        // Step 6: Verify deployment
        console.log("\nVerifying deployment...");
        verifyDeployment();

        // Step 7: Display deployment info
        displayDeploymentInfo();

        console.log("\ndVPN deployment completed successfully!");
        console.log("\nDeployment Summary:");
        console.log("   dVPN Token:", address(token));
        console.log("   NodeRegistry:", address(nodeRegistry));
        console.log("   PaymentHub:", address(paymentHub));
        console.log("   Deployer:", deployer);
        console.log("   Deployer Balance:", token.balanceOf(deployer) / 10**18, "DVPN");
    }

    function verifyDeployment() internal view {
        require(address(token) != address(0), "Token not deployed");
        require(address(nodeRegistry) != address(0), "NodeRegistry not deployed");
        require(address(paymentHub) != address(0), "PaymentHub not deployed");
        require(token.balanceOf(deployer) >= 10000 * 10**18, "Insufficient deployer balance");
        require(paymentHub.owner() == address(nodeRegistry), "PaymentHub ownership not transferred");
        
        console.log("All contracts deployed and configured correctly");
    }

    function displayDeploymentInfo() internal view {
        console.log("\n=== dVPN Deployment Info ===");
        console.log("Network: Mawari Network Testnet");
        console.log("Deployer:", deployer);
        console.log("dVPN Token:", address(token));
        console.log("NodeRegistry:", address(nodeRegistry));
        console.log("PaymentHub:", address(paymentHub));
        console.log("Deployer Balance:", token.balanceOf(deployer) / 10**18, "DVPN");
        console.log("Timestamp:", block.timestamp);
        console.log("=============================");
    }
} 