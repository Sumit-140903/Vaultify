
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying Vaultify with:", deployer.address);

  const Vaultify = await ethers.getContractFactory("Vaultify");
  const vaultify = await Vaultify.deploy();

  console.log("Waiting for deployment confirmation...");
  await vaultify.waitForDeployment();

  const address = await vaultify.getAddress();
  const txHash = vaultify.deploymentTransaction().hash;

  console.log("Vaultify deployed successfully!");
  console.log("Contract address:", address);
  console.log("Deployment transaction:", txHash);
  console.log(
    "Sepolia explorer:",
    `https://sepolia.etherscan.io/address/${address}`
  );
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
