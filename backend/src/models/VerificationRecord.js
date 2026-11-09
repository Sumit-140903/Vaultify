
import mongoose from "mongoose";

const verificationRecordSchema = new mongoose.Schema(
  {
    // The Vaultify account that performed the verification.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // The document that was checked.
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },

    documentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    // SHA-256 calculated by the backend.
    calculatedHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/i,
    },

    // Original SHA-256 saved during document upload.
    storedHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/i,
    },

    success: {
      type: Boolean,
      required: true,
    },

    // Identifies what was checked.
    source: {
      type: String,
      enum: ["stored", "comparison"],
      default: "stored",
      required: true,
    },

    message: {
      type: String,
      required: true,
      maxlength: 500,
    },

    verifiedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Efficiently retrieve a user's verification history.
verificationRecordSchema.index({
  owner: 1,
  verifiedAt: -1,
});

// Efficiently retrieve verification attempts for a document.
verificationRecordSchema.index({
  document: 1,
  verifiedAt: -1,
});

const VerificationRecord = mongoose.model(
  "VerificationRecord",
  verificationRecordSchema
);

export default VerificationRecord;
