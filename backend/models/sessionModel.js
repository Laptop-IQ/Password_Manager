import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    userAgent: {
      type: String,
      default: "Unknown device",
    },

    ip: {
      type: String,
      default: null,
    },

    lastActiveAt: {
      type: Date,
      default: Date.now,
    },

    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },

    // JWTs issued for this session carry this id in the "sid" claim, so a
    // revoked session immediately invalidates its token on the next request.
  },
  {
    timestamps: true,
  },
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;
