import crypto from "node:crypto";
import mongoose from "mongoose";

import Document from "../models/Document.js";
import BlobUploadIntent from "../models/BlobUploadIntent.js";

import {
  createPrivateDocumentUploadUrl,
  readPrivateDocument,
  deletePrivateDocument,
  isAllowedDocumentMimeType,
  isDocumentPathForOwner,
  MAX_DOCUMENT_SIZE_BYTES,
} from "../services/vercelBlobService.js";

import { validateFileContent } from "../middleware/uploadMiddleware.js";

const ALLOWED_CATEGORIES = new Set([
  "Identity",
  "Education",
  "Finance",
  "Medical",
  "Other",
]);

function safeDownloadName(filename) {
  return (
    String(filename)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
      .replace(/["<>:|?*]/g, "_")
      .slice(0, 255) || "document"
  );
}

async function cleanupBlob(pathname) {
  try {
    await deletePrivateDocument(pathname);
  } catch (error) {
    console.error("Blob cleanup failed:", error.message);
  }
}

function publicDocument(document) {
  return {
    id: document._id.toString(),
    name: document.originalName,
    originalName: document.originalName,
    category: document.category,
    mimeType: document.mimeType,
    size: document.size,
    hash: document.sha256,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

// POST /api/documents/upload-intents
export const createBlobUploadIntent = async (req, res) => {
  const {
    originalName,
    mimeType,
    size,
    category = "Other",
    purpose = "document",
    documentId,
  } = req.body || {};

  if (
    typeof originalName !== "string" ||
    !originalName.trim() ||
    typeof mimeType !== "string" ||
    !isAllowedDocumentMimeType(mimeType)
  ) {
    return res.status(400).json({
      message: "Provide a valid filename and supported file type.",
    });
  }

  if (
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > MAX_DOCUMENT_SIZE_BYTES
  ) {
    return res.status(400).json({
      message: "File size must be between 1 byte and 10 MB.",
    });
  }

  if (!["document", "comparison"].includes(purpose)) {
    return res.status(400).json({
      message: "Invalid upload purpose.",
    });
  }

  if (!ALLOWED_CATEGORIES.has(category)) {
    return res.status(400).json({
      message: "Choose a valid document category.",
    });
  }

  let comparisonDocument = null;

  if (purpose === "comparison") {
    if (!mongoose.isValidObjectId(documentId)) {
      return res.status(400).json({
        message: "A valid document ID is required for comparison.",
      });
    }

    comparisonDocument = await Document.findOne({
      _id: documentId,
      owner: req.user._id,
    });

    if (!comparisonDocument) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }
  }

  try {
    const originalFileName = safeDownloadName(originalName);

    const upload = await createPrivateDocumentUploadUrl(
      req.user._id.toString(),
      mimeType
    );

    await BlobUploadIntent.create({
      owner: req.user._id,
      pathname: upload.pathname,
      mimeType,
      originalName: originalFileName,
      category,
      purpose,
      document: comparisonDocument?._id || null,
      declaredSize: size,
      expiresAt: new Date(upload.expiresAt),
    });

    return res.status(201).json({
      message: "Upload authorization created.",
      upload: {
        pathname: upload.pathname,
        url: upload.presignedUrl,
        expiresAt: upload.expiresAt,
      },
    });
  } catch (error) {
    console.error("Creating Blob upload intent failed:", error.message);

    return res.status(500).json({
      message: "Unable to authorize this upload. Please try again.",
    });
  }
};

// POST /api/documents/complete-upload
export const completeBlobDocumentUpload = async (req, res) => {
  const { pathname } = req.body || {};
  const ownerId = req.user._id.toString();

  if (!isDocumentPathForOwner(pathname, ownerId)) {
    return res.status(400).json({
      message: "Invalid document storage path.",
    });
  }

  let intent;

  try {
    // Atomically consume the intent to prevent replay.
    intent = await BlobUploadIntent.findOneAndUpdate(
      {
        owner: req.user._id,
        pathname,
        purpose: "document",
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          consumedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (!intent) {
      return res.status(400).json({
        message: "Upload authorization is missing, expired, or already used.",
      });
    }

    const storedFile = await readPrivateDocument(pathname);

    if (!storedFile) {
      await cleanupBlob(pathname);

      return res.status(400).json({
        message: "The uploaded document could not be found in private storage.",
      });
    }

    if (
      storedFile.size !== intent.declaredSize ||
      storedFile.size < 1 ||
      storedFile.size > MAX_DOCUMENT_SIZE_BYTES ||
      storedFile.contentType !== intent.mimeType
    ) {
      await cleanupBlob(pathname);

      return res.status(400).json({
        message: "Uploaded file size or content type does not match its authorization.",
      });
    }

    try {
      // Reuse Vaultify's existing content-signature and text validation.
      await validateFileContent({
        buffer: storedFile.buffer,
        mimetype: storedFile.contentType,
      });
    } catch (validationError) {
      await cleanupBlob(pathname);

      return res.status(400).json({
        message:
          validationError.message || "The uploaded file failed validation.",
      });
    }

    const sha256 = crypto
      .createHash("sha256")
      .update(storedFile.buffer)
      .digest("hex");

    const document = await Document.create({
      owner: req.user._id,
      originalName: intent.originalName,
      category: intent.category,
      storedName: pathname,
      mimeType: storedFile.contentType,
      size: storedFile.size,
      sha256,
      status: "Pending",
    });

    return res.status(201).json({
      message: "Document uploaded successfully.",
      document: publicDocument(document),
    });
  } catch (error) {
    if (intent?.pathname) {
      await cleanupBlob(intent.pathname);
    }

    console.error("Completing Blob upload failed:", error.message);

    return res.status(500).json({
      message: "Unable to complete the document upload. Please try again.",
    });
  }
};

// DELETE /api/documents/upload-intents
export const cancelBlobUploadIntent = async (req, res) => {
  const { pathname } = req.body || {};

  if (!isDocumentPathForOwner(pathname, req.user._id.toString())) {
    return res.status(400).json({
      message: "Invalid document storage path.",
    });
  }

  try {
    // Claim the pending intent so completion and cancellation cannot
    // both process the same upload.
    const intent = await BlobUploadIntent.findOneAndUpdate(
      {
        owner: req.user._id,
        pathname,
        purpose: { $in: ["document", "comparison"] },
        consumedAt: null,
      },
      {
        $set: {
          consumedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (!intent) {
      return res.status(204).end();
    }

    try {
      await deletePrivateDocument(pathname);
      await BlobUploadIntent.deleteOne({ _id: intent._id });
      return res.status(204).end();
    } catch (error) {
      await BlobUploadIntent.updateOne(
        { _id: intent._id },
        { $set: { consumedAt: null } }
      );
      throw error;
    }
  } catch (error) {
    console.error("Cancelling Blob upload failed:", error.message);

    return res.status(500).json({
      message: "Unable to clean up the incomplete upload.",
    });
  }
};
