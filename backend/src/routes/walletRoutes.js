import express from "express";
import { rateLimit } from "express-rate-limit";

import { requireAuth } from "../middleware/authMiddleware.js";

import {
  createWalletChallenge,
  verifyAndAssociateWallet,
} from "../controllers/walletController.js";

const router = express.Router();

const walletIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many wallet requests. Please try again later.",
  },
});

const walletChallengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user._id.toString(),
  message: {
    message: "Too many wallet challenges. Please try again later.",
  },
});

const walletVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user._id.toString(),
  message: {
    message: "Too many wallet verification attempts. Please try again later.",
  },
});

// Generate an authenticated wallet ownership challenge.
router.post(
  "/challenge",
  walletIpLimiter,
  requireAuth,
  walletChallengeLimiter,
  createWalletChallenge
);

// Verify the MetaMask signature and associate the wallet.
router.post(
  "/verify",
  walletIpLimiter,
  requireAuth,
  walletVerifyLimiter,
  verifyAndAssociateWallet
);

export default router;
