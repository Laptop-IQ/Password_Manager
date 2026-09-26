import mongoose from "mongoose";

const passwordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    websiteName: {
      type: String,
      required: [true, "Website name is required"],
      trim: true,
    },

    url: {
      type: String,
      required: [true, "URL is required"],
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
    },

    username: {
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

    tags: {
      type: [String],
      default: [],
    },

    isFavorite: {
      type: Boolean,
      default: false,
    },

    // Snapshot of previous encrypted passwords, newest first.
    // Populated automatically whenever the password field changes.
    history: [
      {
        password: { type: String }, // encrypted, same as the main field
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Password = mongoose.model("Password", passwordSchema);

export default Password;
