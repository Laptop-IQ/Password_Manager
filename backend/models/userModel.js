import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,

    isVerified: { type: Boolean, default: false },

    otp: String,
    otpExpire: Date,

    // ---- Two-Factor Authentication (login) ----
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null }, // encrypted base32 secret
    twoFactorTempSecret: { type: String, default: null }, // encrypted, set during setup until confirmed
    twoFactorRecoveryCodes: { type: [String], default: [] }, // hashed one-time recovery codes
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
