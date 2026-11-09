import {
  uploadRateLimiter,
  limitConcurrentUploads,
  blobUploadIntentRateLimiter,
  blobUploadCompletionRateLimiter,
  blobUploadCancellationRateLimiter,
} from "../middleware/uploadProtectionMiddleware.js";
import express from "express";

import { requireAuth } from "../middleware/authMiddleware.js";
import { uploadSingleDocument } from "../middleware/uploadMiddleware.js";

import {
  uploadDocument,
  listDocuments,
  downloadDocument,
  removeDocument,
} from "../controllers/documentController.js";

import {
  createBlobUploadIntent,
  completeBlobDocumentUpload,
  cancelBlobUploadIntent,
} from "../controllers/blobUploadController.js";

const router = express.Router();

// Authorize a direct upload to private Vercel Blob storage.
router.post(
  "/upload-intents",
  requireAuth,
  blobUploadIntentRateLimiter,
  createBlobUploadIntent
);

// Cancel an incomplete direct upload and remove its temporary Blob.
router.delete(
  "/upload-intents",
  requireAuth,
  blobUploadCancellationRateLimiter,
  cancelBlobUploadIntent
);


// Validate and register a completed private Blob upload.
router.post(
  "/complete-upload",
  requireAuth,
  blobUploadCompletionRateLimiter,
  limitConcurrentUploads,
  completeBlobDocumentUpload
);


// List the authenticated user's documents.
router.get("/", requireAuth, listDocuments);

// Upload one document.
// Authenticate before Multer processes the file.
router.post(
  "/",
  requireAuth,
  uploadRateLimiter,
  limitConcurrentUploads,
  uploadSingleDocument,
  uploadDocument
);

// Download one document after verifying ownership.
router.get("/:id/download", requireAuth, downloadDocument);

// Delete one document after verifying ownership.
router.delete("/:id", requireAuth, removeDocument);

export default router;
