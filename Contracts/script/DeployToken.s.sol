// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/dVPNToken.sol";

contract DeployTokenScript is Script {
    dVPNToken public token;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying dVPN Token...");
        
        token = new dVPNToken();
        
        console.log("dVPN Token deployed at:", address(token));
        console.log("   Name:", token.name());
        console.log("   Symbol:", token.symbol());
        console.log("   Total Supply:", token.totalSupply() / 10**18, "DVPN");
        console.log("   Deployer Balance:", token.balanceOf(msg.sender) / 10**18, "DVPN");

        vm.stopBroadcast();

        // Display token info
        console.log("\n=== dVPN Token Deployment ===");
        console.log("Address:", address(token));
        console.log("Name:", token.name());
        console.log("Symbol:", token.symbol());
        console.log("Total Supply:", token.totalSupply() / 10**18, "DVPN");
        console.log("Deployer:", msg.sender);
        console.log("Timestamp:", block.timestamp);
        console.log("=============================");
    }
} 