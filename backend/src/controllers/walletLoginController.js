import crypto from "node:crypto";
import { getAddress, verifyMessage } from "ethers";

import User from "../models/User.js";
import WalletLoginChallenge from "../models/WalletLoginChallenge.js";
import { createToken, publicUser } from "./authController.js";

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

// POST /api/auth/wallet-login/challenge
export const createWalletLoginChallenge = async (req, res) => {
  const checksumAddress = normalizeWalletAddress(
    req.body?.walletAddress
  );

  if (!checksumAddress) {
    return res.status(400).json({
      message: "Provide a valid Ethereum wallet address.",
    });
  }

  const walletAddress = checksumAddress.toLowerCase();

  try {
    const applicationUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");

    const application = new URL(applicationUrl);

    if (!["http:", "https:"].includes(application.protocol)) {
      throw new Error("Invalid application URL configuration.");
    }

    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + CHALLENGE_TTL_MS
    );

    const nonce = crypto.randomBytes(32).toString("hex");

    const message = [
      "Vaultify Wallet Login",
      "",
      `Domain: ${application.host}`,
      `URI: ${applicationUrl}`,
      "Version: 1",
      `Chain ID: ${SEPOLIA_CHAIN_ID}`,
      `Wallet Address: ${checksumAddress}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expiresAt.toISOString()}`,
      "",
      "Sign this message to authenticate to Vaultify.",
      "This signature does not authorize blockchain transactions",
      "or transfer any funds.",
    ].join("\n");

    await WalletLoginChallenge.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
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
      message: "Wallet login challenge created.",
      walletAddress: checksumAddress,
      challenge: message,
      expiresAt,
    });
  } catch (error) {
    console.error(
      "Wallet login challenge creation failed:",
      error.message
    );

    return res.status(500).json({
      message: "Unable to create a wallet login challenge.",
    });
  }
};

// POST /api/auth/wallet-login/verify
export const verifyWalletLogin = async (req, res) => {
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

  try {
    const challenge = await WalletLoginChallenge.findOne({
      walletAddress,
      expiresAt: { $gt: new Date() },
    });

    if (!challenge) {
      return res.status(401).json({
        message: "Wallet login challenge is invalid or expired. Please try again.",
      });
    }

    let recoveredAddress;

    try {
      recoveredAddress = getAddress(
        verifyMessage(challenge.message, signature)
      );
    } catch {
      return res.status(401).json({
        message: "Wallet signature verification failed.",
      });
    }

    if (recoveredAddress.toLowerCase() !== walletAddress) {
      return res.status(401).json({
        message: "Wallet signature verification failed.",
      });
    }

    // Atomically consume the challenge to prevent replay attacks.
    const consumedChallenge =
      await WalletLoginChallenge.findOneAndDelete({
        _id: challenge._id,
        walletAddress,
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: { $gt: new Date() },
      });

    if (!consumedChallenge) {
      return res.status(409).json({
        message: "This wallet login challenge has already been used. Please try again.",
      });
    }

    // Wallet login is allowed only for an existing verified association.
    const user = await User.findOne({
      walletAddress,
      emailVerified: true,
    });

    if (!user) {
      return res.status(401).json({
        message: "No verified Vaultify account is associated with this wallet. Sign in using your existing account first.",
      });
    }

    const token = createToken(user._id);

    return res.json({
      message: "Wallet login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Wallet login verification failed:", error.message);

    return res.status(500).json({
      message: "Unable to authenticate with this wallet.",
    });
  }
};
