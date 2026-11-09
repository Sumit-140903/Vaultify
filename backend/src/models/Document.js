
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    // The MongoDB account that owns this document.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // The original filename shown in the Vaultify dashboard.
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    category: {
  type: String,
  required: true,
  trim: true,
  maxlength: 100,
  default: "Other",
},

    // A server-generated filename used for private file storage.
    // Never use an uploaded filename directly as a disk path.
    storedName: {
      type: String,
      required: true,
      unique: true,
    },

    // The uploaded file's reported media type.
    mimeType: {
      type: String,
      required: true,
      maxlength: 150,
    },

    // The actual file size, measured in bytes.
    size: {
      type: Number,
      required: true,
      min: 0,
    },

    // SHA-256 hash calculated by the backend.
    sha256: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/i,
    },

    // Updated later when verification succeeds.
    status: {
      type: String,
      enum: ["Pending", "Verified"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

// Efficiently retrieve one user's documents, newest first.
documentSchema.index({ owner: 1, createdAt: -1 });

const Document = mongoose.model("Document", documentSchema);

export default Document;
