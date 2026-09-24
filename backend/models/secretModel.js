import mongoose from "mongoose";

const secretSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    secretType: {
      type: String,
      required: [true, "Secret type is required"],
      enum: {
        values: [
          "tpin",
          "upi_pin",
          "atm_pin",
          "net_banking_password",
          "security_answer",
          "recovery_code",
          "other",
        ],
        message: "Invalid secret type",
      },
      default: "other",
    },

    // Stored encrypted (AES-256-GCM) — never stored in plain text.
    value: {
      type: String,
      required: [true, "Secret value is required"],
    },

    issuer: {
      type: String,
      trim: true,
      default: null,
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

const Secret = mongoose.model("Secret", secretSchema);

export default Secret;
