
import mongoose from "mongoose";
import { access } from "node:fs/promises";

import Document from "../models/Document.js";
import {
  storeUploadedFile,
  getStoredFilePath,
  deleteStoredFile,
} from "../services/fileStorageService.js";

import {
  createPrivateDocumentDownloadUrl,
  deletePrivateDocument,
  isDocumentPathForOwner,
} from "../services/vercelBlobService.js";
const ALLOWED_CATEGORIES = new Set([
  "Identity",
  "Education",
  "Finance",
  "Medical",
  "Other",
]);

// Return document metadata without exposing the private server filename.
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

// Sanitize the display/download filename independently of the storage path.
function safeDownloadName(filename) {
  return (
    String(filename)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
      .replace(/["<>:|?*]/g, "_")
      .slice(0, 255) || "document"
  );
}

// POST /api/documents
export const uploadDocument = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message: 'Select a file in the "document" upload field.',
    });
  }
  const category = req.body?.category;

if (
  typeof category !== "string" ||
  !ALLOWED_CATEGORIES.has(category)
) {
  return res.status(400).json({
    message: "Choose a valid document category.",
  });
}

  let storedFile = null;

  try {
    const originalName = safeDownloadName(req.file.originalname);

    // Store the bytes and calculate SHA-256 on the server.
    storedFile = await storeUploadedFile(req.file);

    // Ownership comes from the verified token, never from request body data.
    const document = await Document.create({
      owner: req.user._id,
      originalName,
      category,
      storedName: storedFile.storedName,
      mimeType: req.file.mimetype,
      size: storedFile.size,
      sha256: storedFile.sha256,
      status: "Pending",
    });

    return res.status(201).json({
      message: "Document uploaded successfully.",
      document: publicDocument(document),
    });
  } catch (error) {
    // If MongoDB creation fails after saving the file, attempt cleanup.
    if (storedFile?.storedName) {
      try {
        await deleteStoredFile(storedFile.storedName);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up an incomplete upload:",
          cleanupError.message
        );
      }
    }

    console.error("Document upload failed:", error.message);

    return res.status(500).json({
      message: "Unable to save the document. Please try again.",
    });
  }
};

// GET /api/documents
export const listDocuments = async (req, res) => {
  try {
    // Never list documents for an owner supplied by the browser.
    const documents = await Document.find({
      owner: req.user._id,
    }).sort({ createdAt: -1 });

    return res.json({
      documents: documents.map(publicDocument),
    });
  } catch (error) {
    console.error("Listing documents failed:", error.message);

    return res.status(500).json({
      message: "Unable to load your documents.",
    });
  }
};

// GET /api/documents/:id/download
export const downloadDocument = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid document ID.",
    });
  }

  try {
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!document) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }

    // New Vercel Blob documents use short-lived private download URLs.
    // Existing local documents continue using the original filesystem path.
    if (
      isDocumentPathForOwner(
        document.storedName,
        req.user._id.toString()
      )
    ) {
      const { presignedUrl } = await createPrivateDocumentDownloadUrl(
        document.storedName,
        req.user._id.toString()
      );

      return res.redirect(302, presignedUrl);
    }

    const filePath = getStoredFilePath(document.storedName);

    try {
      await access(filePath);
    } catch {
      return res.status(404).json({
        message: "The stored document file could not be found.",
      });
    }

    // Serve only after checking ownership, as a download attachment.
    return res.download(
      filePath,
      safeDownloadName(document.originalName),
      (error) => {
        if (error) {
          console.error("Document download failed:", error.message);

          if (!res.headersSent) {
            res.status(500).json({
              message: "Unable to download the document.",
            });
          }
        }
      }
    );
  } catch (error) {
    console.error("Downloading document failed:", error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Unable to download the document.",
      });
    }
  }
};

// DELETE /api/documents/:id
export const removeDocument = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid document ID.",
    });
  }

  try {
    // A user cannot delete a record owned by another user.
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!document) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }

    // Remove the database record first so it is no longer accessible.
    await document.deleteOne();

    try {
      if (
        isDocumentPathForOwner(
          document.storedName,
          req.user._id.toString()
        )
      ) {
        await deletePrivateDocument(document.storedName);
      } else {
        await deleteStoredFile(document.storedName);
      }
    } catch (cleanupError) {
      // The record has been removed; log orphaned-file cleanup failures.
      console.error(
        "Private file cleanup failed:",
        cleanupError.message
      );
    }

    return res.json({
      message: "Document deleted successfully.",
    });
  } catch (error) {
    console.error("Document deletion failed:", error.message);

    return res.status(500).json({
      message: "Unable to delete the document.",
    });
  }
};
