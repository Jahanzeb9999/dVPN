const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy dVPN Token
  const dVPNToken = await ethers.getContractFactory("dVPNToken");
  const token = await dVPNToken.deploy();
  await token.waitForDeployment();
  console.log("dVPN Token deployed to:", await token.getAddress());

  // Deploy NodeRegistry
  const NodeRegistry = await ethers.getContractFactory("NodeRegistry");
  const nodeRegistry = await NodeRegistry.deploy(await token.getAddress());
  await nodeRegistry.waitForDeployment();
  console.log("NodeRegistry deployed to:", await nodeRegistry.getAddress());

  // Deploy PaymentHub
  const PaymentHub = await ethers.getContractFactory("PaymentHub");
  const paymentHub = await PaymentHub.deploy(await token.getAddress(), await nodeRegistry.getAddress());
  await paymentHub.waitForDeployment();
  console.log("PaymentHub deployed to:", await paymentHub.getAddress());

  // Transfer ownership of PaymentHub to NodeRegistry for payment processing
  await paymentHub.transferOwnership(await nodeRegistry.getAddress());
  console.log("PaymentHub ownership transferred to NodeRegistry");

  // Mint some tokens to deployer for testing
  const mintAmount = ethers.parseEther("10000");
  await token.mintRewards(deployer.address, mintAmount);
  console.log(`Minted ${ethers.formatEther(mintAmount)} tokens to deployer`);

  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("dVPN Token:", await token.getAddress());
  console.log("NodeRegistry:", await nodeRegistry.getAddress());
  console.log("PaymentHub:", await paymentHub.getAddress());
  console.log("Deployer Balance:", ethers.formatEther(await token.balanceOf(deployer.address)), "DVPN");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 