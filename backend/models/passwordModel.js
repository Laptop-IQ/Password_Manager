import mongoose from "mongoose";

const passwordSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: true,
  },
);

const Password = mongoose.model("Password", passwordSchema);

export default Password;
