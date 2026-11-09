import express from "express";
import { rateLimit } from "express-rate-limit";

import {
  requestRegistrationEmailOtp,
  verifyRegistrationEmailOtp,
  login,
  getCurrentUser,
} from "../controllers/authController.js";

import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

const registrationOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many OTP requests. Please try again after 15 minutes.",
  },
});

const registrationVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many registration attempts. Please try again later.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: "Too many failed login attempts. Please try again after 15 minutes.",
  },
});

// Registration
router.post(
  "/register/email-otp",
  registrationOtpLimiter,
  requestRegistrationEmailOtp
);

router.post(
  "/register/verify-email",
  registrationVerifyLimiter,
  verifyRegistrationEmailOtp
);

// Login
router.post(
  "/login",
  loginLimiter,
  login
);

// Protected current-user endpoint
router.get("/me", requireAuth, getCurrentUser);

export default router;
