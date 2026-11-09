
import { ethers } from "ethers";
import vaultifyArtifact from "../contracts/Vaultify.json";

const CONTRACT_ADDRESS =
  "0x0c1a6998f1eA988E8F5B56271c0Ac9c296c9f1A7";

const SEPOLIA_CHAIN_ID = 11155111n;

const CONTRACT_ABI = vaultifyArtifact.abi;

// Verify the active MetaMask account before creating a transaction signer.
async function getVerifiedSigner(expectedWalletAddress) {
  if (!window.ethereum) {
    throw new Error("MetaMask is required.");
  }

  if (
    typeof expectedWalletAddress !== "string" ||
    !expectedWalletAddress.trim()
  ) {
    throw new Error(
      "A verified Vaultify wallet association is required."
    );
  }

  let expectedAddress;

  try {
    expectedAddress = ethers.getAddress(expectedWalletAddress);
  } catch {
    throw new Error("The associated Vaultify wallet address is invalid.");
  }

  const readProvider = new ethers.BrowserProvider(window.ethereum);

  // Check the selected account and network before obtaining a signer.
  const [accounts, chainId] = await Promise.all([
    window.ethereum.request({ method: "eth_accounts" }),
    window.ethereum.request({ method: "eth_chainId" }),
  ]);

  if (BigInt(chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("Please switch MetaMask to Ethereum Sepolia.");
  }

  if (!accounts?.length) {
    throw new Error("Connect your verified MetaMask wallet first.");
  }

  if (
    ethers.getAddress(accounts[0]).toLowerCase() !==
    expectedAddress.toLowerCase()
  ) {
    throw new Error(
      "The selected MetaMask account does not match your verified Vaultify wallet."
    );
  }

  const signer = await readProvider.getSigner(expectedAddress);
  const signerAddress = ethers.getAddress(await signer.getAddress());

  if (
    signerAddress.toLowerCase() !== expectedAddress.toLowerCase()
  ) {
    throw new Error(
      "The transaction signer does not match your verified Vaultify wallet."
    );
  }

  // Check again in case the account or network changed during setup.
  const [latestAccounts, latestChainId] = await Promise.all([
    window.ethereum.request({ method: "eth_accounts" }),
    window.ethereum.request({ method: "eth_chainId" }),
  ]);

  if (
    !latestAccounts?.length ||
    ethers.getAddress(latestAccounts[0]).toLowerCase() !==
      expectedAddress.toLowerCase()
  ) {
    throw new Error(
      "MetaMask account changed. Please reconnect your verified wallet."
    );
  }

  if (BigInt(latestChainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error("Please switch MetaMask to Ethereum Sepolia.");
  }

  return { readProvider, signer, expectedAddress };
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask.");
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  if (!accounts?.length) {
    throw new Error("Please connect your MetaMask wallet.");
  }

  const chainId = await window.ethereum.request({
    method: "eth_chainId",
  });

  if (BigInt(chainId) !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      "Please switch MetaMask to Ethereum Sepolia."
    );
  }

  return ethers.getAddress(accounts[0]);
}

// Transaction-capable contract: always requires the verified wallet.
export async function getVaultifyContract(expectedWalletAddress) {
  const { signer } = await getVerifiedSigner(expectedWalletAddress);

  return new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    signer
  );
}

export async function registerDocumentHash(
  documentId,
  hash,
  expectedWalletAddress
) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error("Invalid SHA-256 hash.");
  }

  const contract = await getVaultifyContract(expectedWalletAddress);
  const bytes32Hash = `0x${hash}`;

  const transaction = await contract.registerDocument(
    documentId,
    bytes32Hash
  );

  await transaction.wait();

  return transaction.hash;
}

export async function verifyDocumentOnChain(
  documentId,
  hash,
  expectedWalletAddress
) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error("Invalid SHA-256 hash.");
  }

  const contract = await getVaultifyContract(expectedWalletAddress);

  return contract.verifyDocument(
    documentId,
    `0x${hash}`
  );
}

// Read-only contract access does not request a transaction signer.
export async function getDocumentRecordFromChain(documentId) {
  if (!window.ethereum) {
    throw new Error("MetaMask is required to access the Sepolia provider.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();

  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error("Please switch MetaMask to Ethereum Sepolia.");
  }

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    provider
  );

  const [documentHash, owner, registeredAt, exists] =
    await contract.getDocumentHash(documentId);

  return {
    documentHash,
    owner,
    registeredAt: Number(registeredAt),
    exists,
  };
}
