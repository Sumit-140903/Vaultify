
const { ethers } = require("hardhat");

async function main() {
  const provider = ethers.provider;

  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();

  console.log("Connected network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log("Latest block:", blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
