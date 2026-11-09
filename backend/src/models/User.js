
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    walletAddress: {
  type: String,
  default: null,
  lowercase: true,
  trim: true,
  match: /^0x[0-9a-f]{40}$/,
},
  },
  {
    timestamps: true,
  }
);

// A verified wallet can belong to only one Vaultify account.
// Unlinked users with null wallet addresses are excluded.
userSchema.index(
  { walletAddress: 1 },
  {
    unique: true,
    partialFilterExpression: {
      walletAddress: { $type: "string" },
    },
    name: "unique_wallet_address",
  }
);
const User = mongoose.model("User", userSchema);

export default User;

