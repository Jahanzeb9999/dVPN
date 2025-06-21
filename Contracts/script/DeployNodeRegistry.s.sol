// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/NodeRegistry.sol";
import "../src/dVPNToken.sol";

contract DeployNodeRegistryScript is Script {
    NodeRegistry public nodeRegistry;
    dVPNToken public token;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying NodeRegistry...");
        console.log("Token address:", tokenAddress);
        
        // Verify token exists
        token = dVPNToken(tokenAddress);
        console.log("   Token name:", token.name());
        console.log("   Token symbol:", token.symbol());
        
        nodeRegistry = new NodeRegistry(tokenAddress);
        
        console.log("NodeRegistry deployed at:", address(nodeRegistry));
        console.log("   Min stake:", nodeRegistry.minStake() / 10**18, "DVPN");
        console.log("   Slash amount:", nodeRegistry.slashAmount() / 10**18, "DVPN");

        vm.stopBroadcast();

        // Display registry info
        console.log("\n=== NodeRegistry Deployment ===");
        console.log("Address:", address(nodeRegistry));
        console.log("Token Address:", tokenAddress);
        console.log("Min Stake:", nodeRegistry.minStake() / 10**18, "DVPN");
        console.log("Slash Amount:", nodeRegistry.slashAmount() / 10**18, "DVPN");
        console.log("Deployer:", msg.sender);
        console.log("Timestamp:", block.timestamp);
        console.log("===============================");
    }
} 