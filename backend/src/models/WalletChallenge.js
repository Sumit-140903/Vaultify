
import mongoose from "mongoose";

const walletChallengeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      match: /^0x[a-f0-9]{40}$/,
    },

    nonce: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One pending wallet challenge per Vaultify account.
walletChallengeSchema.index(
  { owner: 1 },
  { unique: true }
);

// MongoDB automatically removes expired challenges.
walletChallengeSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const WalletChallenge = mongoose.model(
  "WalletChallenge",
  walletChallengeSchema
);

export default WalletChallenge;
