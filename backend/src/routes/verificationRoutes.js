import {
  uploadRateLimiter,
  limitConcurrentUploads,
} from "../middleware/uploadProtectionMiddleware.js";
import express from "express";

import { requireAuth } from "../middleware/authMiddleware.js";
import {
  blobUploadCompletionRateLimiter,
} from "../middleware/uploadProtectionMiddleware.js";
import { uploadSingleDocument } from "../middleware/uploadMiddleware.js";

import {
  verifyDocument,
  getVerificationHistory,
} from "../controllers/verificationController.js";

import {
  completeBlobComparisonVerification,
} from "../controllers/blobVerificationController.js";

const router = express.Router();

// Complete comparison-file verification from private Blob storage.
router.post(
  "/:id/verify-blob",
  requireAuth,
  blobUploadCompletionRateLimiter,
  limitConcurrentUploads,
  completeBlobComparisonVerification
);


// Retrieve the logged-in user's verification history.
router.get("/", requireAuth, getVerificationHistory);

// Verify an original document or an uploaded comparison file.
router.post(
  "/:id/verify",
  requireAuth,
  uploadRateLimiter,
  limitConcurrentUploads,
  uploadSingleDocument,
  verifyDocument
);

export default router;
