import mongoose from "mongoose";

const walletLoginChallengeSchema = new mongoose.Schema(
  {
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

// Only one active login challenge per wallet.
walletLoginChallengeSchema.index(
  { walletAddress: 1 },
  { unique: true }
);

// Expired challenges are automatically cleaned up.
walletLoginChallengeSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

const WalletLoginChallenge = mongoose.model(
  "WalletLoginChallenge",
  walletLoginChallengeSchema
);

export default WalletLoginChallenge;
