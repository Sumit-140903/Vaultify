import crypto from "node:crypto";
import mongoose from "mongoose";

import Document from "../models/Document.js";
import VerificationRecord from "../models/VerificationRecord.js";
import BlobUploadIntent from "../models/BlobUploadIntent.js";

import {
  readPrivateDocument,
  deletePrivateDocument,
  isDocumentPathForOwner,
  MAX_DOCUMENT_SIZE_BYTES,
} from "../services/vercelBlobService.js";

import { validateFileContent } from "../middleware/uploadMiddleware.js";

async function cleanupComparisonBlob(pathname) {
  try {
    await deletePrivateDocument(pathname);
  } catch (error) {
    console.error("Comparison Blob cleanup failed:", error.message);
  }
}

export const completeBlobComparisonVerification = async (req, res) => {
  const { id } = req.params;
  const { pathname } = req.body || {};
  const ownerId = req.user._id.toString();

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid document ID.",
    });
  }

  if (!isDocumentPathForOwner(pathname, ownerId)) {
    return res.status(400).json({
      message: "Invalid comparison-file storage path.",
    });
  }

  let intent = null;

  try {
    const document = await Document.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!document) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }

    // Atomically consume the exact comparison authorization.
    intent = await BlobUploadIntent.findOneAndUpdate(
      {
        owner: req.user._id,
        pathname,
        purpose: "comparison",
        document: document._id,
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
        message: "Comparison upload authorization is missing, expired, or already used.",
      });
    }

    const comparisonFile = await readPrivateDocument(pathname);

    if (!comparisonFile) {
      await cleanupComparisonBlob(pathname);

      return res.status(400).json({
        message: "The comparison file could not be found in private storage.",
      });
    }

    if (
      comparisonFile.size !== intent.declaredSize ||
      comparisonFile.size < 1 ||
      comparisonFile.size > MAX_DOCUMENT_SIZE_BYTES ||
      comparisonFile.contentType !== intent.mimeType
    ) {
      await cleanupComparisonBlob(pathname);

      return res.status(400).json({
        message: "Comparison file size or content type does not match its authorization.",
      });
    }

    try {
      await validateFileContent({
        buffer: comparisonFile.buffer,
        mimetype: comparisonFile.contentType,
      });
    } catch (validationError) {
      await cleanupComparisonBlob(pathname);

      return res.status(400).json({
        message:
          validationError.message || "The comparison file failed validation.",
      });
    }

    const calculatedHash = crypto
      .createHash("sha256")
      .update(comparisonFile.buffer)
      .digest("hex");

    const storedHash = document.sha256.toLowerCase();
    const success = calculatedHash.toLowerCase() === storedHash;

    const verifiedAt = new Date();

    const message = success
      ? "Integrity check passed. The file matches the original SHA-256 hash."
      : "Integrity check failed. The file does not match the original SHA-256 hash.";

    const verificationRecord = await VerificationRecord.create({
      owner: req.user._id,
      document: document._id,
      documentName: document.originalName,
      calculatedHash,
      storedHash,
      success,
      source: "comparison",
      message,
      verifiedAt,
    });

    // Comparison files are temporary and are never added to the library.
    await cleanupComparisonBlob(pathname);

    return res.status(201).json({
      message,
      verification: {
        id: verificationRecord._id.toString(),
        documentId: document._id.toString(),
        documentName: document.originalName,
        success,
        source: "comparison",
        calculatedHash,
        storedHash,
        verifiedAt,
      },
      document: {
        id: document._id.toString(),
        status: document.status,
      },
    });
  } catch (error) {
    if (intent?.pathname) {
      await cleanupComparisonBlob(intent.pathname);
    }

    console.error("Blob comparison verification failed:", error.message);

    return res.status(500).json({
      message: "Unable to verify the comparison file. Please try again.",
    });
  }
};
