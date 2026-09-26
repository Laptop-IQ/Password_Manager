import mongoose from "mongoose";

const cardSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    cardType: {
      type: String,
      required: [true, "Card type is required"],
      enum: {
        values: ["debit", "credit"],
        message: "Card type must be either 'debit' or 'credit'",
      },
    },

    cardholderName: {
      type: String,
      required: [true, "Cardholder name is required"],
      trim: true,
    },

    bankName: {
      type: String,
      required: [true, "Bank / issuer name is required"],
      trim: true,
    },

    // Stored encrypted (AES-256-GCM) — never stored in plain text.
    cardNumber: {
      type: String,
      required: [true, "Card number is required"],
    },

    expiryMonth: {
      type: String,
      required: [true, "Expiry month is required"],
    },

    expiryYear: {
      type: String,
      required: [true, "Expiry year is required"],
    },

    // Stored encrypted (AES-256-GCM) — never stored in plain text.
    cvv: {
      type: String,
      required: [true, "CVV is required"],
    },

    // Optional ATM / card PIN. Stored encrypted when present.
    pin: {
      type: String,
      default: null,
    },

    nickname: {
      type: String,
      trim: true,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
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
  },
  {
    timestamps: true,
  },
);

const Card = mongoose.model("Card", cardSchema);

export default Card;
