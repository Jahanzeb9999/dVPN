// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/PaymentHub.sol";
import "../src/NodeRegistry.sol";
import "../src/dVPNToken.sol";

contract DeployPaymentHubScript is Script {
    PaymentHub public paymentHub;
    NodeRegistry public nodeRegistry;
    dVPNToken public token;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        address registryAddress = vm.envAddress("NODE_REGISTRY_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying PaymentHub...");
        console.log("Token address:", tokenAddress);
        console.log("NodeRegistry address:", registryAddress);
        
        // Verify contracts exist
        token = dVPNToken(tokenAddress);
        nodeRegistry = NodeRegistry(registryAddress);
        
        console.log("   Token name:", token.name());
        console.log("   Registry min stake:", nodeRegistry.minStake() / 10**18, "DVPN");
        
        paymentHub = new PaymentHub(tokenAddress, registryAddress);
        
        console.log("PaymentHub deployed at:", address(paymentHub));
        console.log("   Min payment:", paymentHub.minPayment() / 10**18, "DVPN");
        console.log("   Payment fee:", paymentHub.paymentFee(), " basis points");

        vm.stopBroadcast();

        // Display payment hub info
        console.log("\n=== PaymentHub Deployment ===");
        console.log("Address:", address(paymentHub));
        console.log("Token Address:", tokenAddress);
        console.log("NodeRegistry Address:", registryAddress);
        console.log("Min Payment:", paymentHub.minPayment() / 10**18, "DVPN");
        console.log("Payment Fee:", paymentHub.paymentFee(), " basis points");
        console.log("Deployer:", msg.sender);
        console.log("Timestamp:", block.timestamp);
        console.log("=============================");
    }
} 