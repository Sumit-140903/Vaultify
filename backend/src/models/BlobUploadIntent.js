import mongoose from "mongoose";

const blobUploadIntentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    pathname: {
      type: String,
      required: true,
      unique: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    originalName: {
      type: String,
      required: true,
      maxlength: 255,
    },

    category: {
      type: String,
      enum: ["Identity", "Education", "Finance", "Medical", "Other"],
      default: "Other",
      required: true,
    },

    purpose: {
      type: String,
      enum: ["document", "comparison"],
      required: true,
    },

    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },

    declaredSize: {
      type: Number,
      required: true,
      min: 1,
      max: 10 * 1024 * 1024,
    },

    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },

    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

blobUploadIntentSchema.index({ owner: 1, pathname: 1 });

const BlobUploadIntent = mongoose.model(
  "BlobUploadIntent",
  blobUploadIntentSchema
);

export default BlobUploadIntent;
