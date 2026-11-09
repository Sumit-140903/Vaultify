import crypto from "node:crypto";
import mongoose from "mongoose";
import { readFile } from "node:fs/promises";

import Document from "../models/Document.js";
import VerificationRecord from "../models/VerificationRecord.js";
import { getStoredFilePath } from "../services/fileStorageService.js";
import {
  readPrivateDocument,
  isDocumentPathForOwner,
} from "../services/vercelBlobService.js";

function calculateSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Verify an original document or an uploaded comparison file.
export const verifyDocument = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      message: "Invalid document ID.",
    });
  }

  try {
    // Only retrieve documents owned by the logged-in user.
    const document = await Document.findOne({
      _id: id,
      owner: req.user._id,
    });

    if (!document) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }

    let fileBuffer;
    let source;

    // A comparison file is uploaded through Multer memory storage.
    if (req.file) {
      fileBuffer = req.file.buffer;
      source = "comparison";
    } else {
      // Otherwise, verify the original file stored on the backend.
      // Retrieve new documents from private Vercel Blob storage.
      // Older documents remain supported in local filesystem storage.
      if (
        isDocumentPathForOwner(
          document.storedName,
          req.user._id.toString()
        )
      ) {
        const storedFile = await readPrivateDocument(document.storedName);

        if (!storedFile) {
          return res.status(404).json({
            message: "Original document file is missing from private storage.",
          });
        }

        fileBuffer = storedFile.buffer;
      } else {
        const filePath = getStoredFilePath(document.storedName);

        try {
          fileBuffer = await readFile(filePath);
        } catch (error) {
          if (error.code === "ENOENT") {
            return res.status(404).json({
              message: "Original document file is missing from storage.",
            });
          }

          throw error;
        }
      }

      source = "stored";
    }

    // Calculate the SHA-256 hash on the backend.
    const calculatedHash = calculateSha256(fileBuffer);
    const storedHash = document.sha256.toLowerCase();

    const success =
      calculatedHash.toLowerCase() === storedHash;

    const verifiedAt = new Date();

    const message = success
      ? "Integrity check passed. The file matches the original SHA-256 hash."
      : "Integrity check failed. The file does not match the original SHA-256 hash.";

    // Save the verification result permanently in MongoDB.
    const verificationRecord = await VerificationRecord.create({
      owner: req.user._id,
      document: document._id,
      documentName: document.originalName,
      calculatedHash,
      storedHash,
      success,
      source,
      message,
      verifiedAt,
    });

    // Update document status only when checking its stored original.
    if (source === "stored") {
      document.status = success ? "Verified" : "Pending";
      await document.save();
    }

    return res.status(201).json({
      message,
      verification: {
        id: verificationRecord._id.toString(),
        documentId: document._id.toString(),
        documentName: document.originalName,
        success,
        source,
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
    console.error("Document verification failed:", error.message);

    return res.status(500).json({
      message: "Unable to verify the document. Please try again.",
    });
  }
};

// Retrieve the logged-in user's verification history.
export const getVerificationHistory = async (req, res) => {
  try {
    const records = await VerificationRecord.find({
      owner: req.user._id,
    })
      .sort({ verifiedAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      verifications: records.map((record) => ({
        id: record._id.toString(),
        documentId: record.document.toString(),
        documentName: record.documentName,
        success: record.success,
        source: record.source,
        calculatedHash: record.calculatedHash,
        storedHash: record.storedHash,
        message: record.message,
        verifiedAt: record.verifiedAt,
      })),
    });
  } catch (error) {
    console.error(
      "Unable to retrieve verification history:",
      error.message
    );

    return res.status(500).json({
      message: "Unable to retrieve verification history.",
    });
  }
};