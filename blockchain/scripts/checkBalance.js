
const { ethers } = require("hardhat");

async function main() {
  const [wallet] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(wallet.address);

  console.log("Network: Sepolia");
  console.log("Wallet address:", wallet.address);
  console.log(
    "Test ETH balance:",
    ethers.formatEther(balance),
    "ETH"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
