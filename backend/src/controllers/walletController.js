
import crypto from "node:crypto";
import { getAddress, verifyMessage } from "ethers";

import User from "../models/User.js";
import WalletChallenge from "../models/WalletChallenge.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SEPOLIA_CHAIN_ID = 11155111;

function normalizeWalletAddress(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return getAddress(value.trim());
  } catch {
    return null;
  }
}

// POST /api/wallet/challenge
export const createWalletChallenge = async (req, res) => {
  const checksumAddress = normalizeWalletAddress(
    req.body?.walletAddress
  );

  if (!checksumAddress) {
    return res.status(400).json({
      message: "Provide a valid Ethereum wallet address.",
    });
  }

  const walletAddress = checksumAddress.toLowerCase();

  // An existing verified association cannot be silently replaced.
  if (
    req.user.walletAddress &&
    req.user.walletAddress.toLowerCase() !== walletAddress
  ) {
    return res.status(409).json({
      message:
        "A different wallet is already associated with this account.",
    });
  }

  try {
    const nonce = crypto.randomBytes(32).toString("hex");

    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + CHALLENGE_TTL_MS
    );

    const applicationUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");

    // The exact message is stored and later verified by the backend.
    const message = [
      "Vaultify Wallet Association",
      "",
      `URI: ${applicationUrl}`,
      `Account ID: ${req.user._id.toString()}`,
      `Wallet Address: ${checksumAddress}`,
      `Chain ID: ${SEPOLIA_CHAIN_ID}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
      "",
      "Sign this message to prove control of this wallet.",
      "This signature does not authorize blockchain transactions",
      "or transfer any funds.",
    ].join("\n");

    // Replace any previous pending challenge for this user.
    const challenge = await WalletChallenge.findOneAndUpdate(
      { owner: req.user._id },
      {
        $set: {
          owner: req.user._id,
          walletAddress,
          nonce,
          message,
          expiresAt,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json({
      message: "Wallet verification challenge created.",
      walletAddress: checksumAddress,
      challenge: challenge.message,
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    console.error(
      "Wallet challenge creation failed:",
      error.message
    );

    return res.status(500).json({
      message: "Unable to create the wallet verification challenge.",
    });
  }
};

// POST /api/wallet/verify
export const verifyAndAssociateWallet = async (req, res) => {
  const checksumAddress = normalizeWalletAddress(
    req.body?.walletAddress
  );

  const signature = req.body?.signature;

  if (!checksumAddress) {
    return res.status(400).json({
      message: "Provide a valid Ethereum wallet address.",
    });
  }

  if (
    typeof signature !== "string" ||
    signature.length > 200 ||
    !/^0x[0-9a-fA-F]+$/.test(signature)
  ) {
    return res.status(400).json({
      message: "Provide a valid wallet signature.",
    });
  }

  const walletAddress = checksumAddress.toLowerCase();

  // Never permit an existing association to be replaced here.
  if (
    req.user.walletAddress &&
    req.user.walletAddress.toLowerCase() !== walletAddress
  ) {
    return res.status(409).json({
      message:
        "A different wallet is already associated with this account.",
    });
  }

  try {
    const challenge = await WalletChallenge.findOne({
      owner: req.user._id,
      walletAddress,
    });

    if (!challenge) {
      return res.status(400).json({
        message: "No matching wallet challenge exists. Request a new one.",
      });
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await WalletChallenge.deleteOne({
        _id: challenge._id,
      });

      return res.status(400).json({
        message: "Wallet challenge expired. Please try again.",
      });
    }

    // Recover the signer from the exact message issued by this backend.
    let recoveredAddress;

    try {
      recoveredAddress = getAddress(
        verifyMessage(challenge.message, signature)
      );
    } catch {
      return res.status(400).json({
        message: "Wallet signature verification failed.",
      });
    }

    if (recoveredAddress.toLowerCase() !== walletAddress) {
      return res.status(401).json({
        message:
          "The signature does not belong to the requested wallet.",
      });
    }

    // Consume the challenge atomically. Only one verification request
    // can successfully consume this exact, unexpired challenge.
    const consumedChallenge =
      await WalletChallenge.findOneAndDelete({
        _id: challenge._id,
        owner: req.user._id,
        walletAddress,
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: { $gt: new Date() },
      });

    if (!consumedChallenge) {
      return res.status(409).json({
        message:
          "Challenge has expired or has already been used. Request a new one.",
      });
    }

    // Associate the wallet only if the account is currently unlinked
    // or already has this exact wallet.
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        $or: [
          { walletAddress: null },
          { walletAddress },
        ],
      },
      {
        $set: {
          walletAddress,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedUser) {
      return res.status(409).json({
        message:
          "Your account already has a different associated wallet.",
      });
    }

    return res.json({
      message: "Wallet ownership verified and associated successfully.",
      walletAddress: updatedUser.walletAddress,
    });
  } catch (error) {
    // The MongoDB unique index also protects against concurrent
    // attempts to associate the same wallet with different accounts.
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "This wallet is already associated with another Vaultify account.",
      });
    }

    console.error(
      "Wallet verification failed:",
      error.message
    );

    return res.status(500).json({
      message: "Unable to verify and associate the wallet.",
    });
  }
};
