import mongoose from "mongoose";

const totpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    issuer: {
      type: String,
      required: [true, "Issuer / service name is required"],
      trim: true,
    },

    accountName: {
      type: String,
      trim: true,
      default: null,
    },

    // Base32 TOTP secret — stored encrypted (AES-256-GCM), never in plain text.
    secret: {
      type: String,
      required: [true, "TOTP secret is required"],
    },

    category: {
      type: String,
      trim: true,
      default: "General",
    },

    isFavorite: {
      type: Boolean,
      default: false,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Totp = mongoose.model("Totp", totpSchema);

export default Totp;
