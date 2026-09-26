import User from "../models/userModel.js";
import Session from "../models/sessionModel.js";
import bcrypt from "bcryptjs";
import { generateOTP } from "../utils/generateOTP.js";
import { sendEmail } from "../utils/sendEmail.js";
import jwt from "jsonwebtoken";
import validator from "validator";
import { sendOtpMail } from "../emailVerify/sendOtpMail.js";
import { verifyOtpMail } from "../emailVerify/verifyOtpMail.js";
import { encryptPassword, decryptPassword } from "../utils/crypto.js";
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  generateQrCodeDataUrl,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCodes,
  matchRecoveryCode,
} from "../utils/totp.js";

const JWT_SECRET = process.env.JWT_SECRET;

const TOKEN_EXPIRES = "30d";
const PENDING_2FA_TOKEN_EXPIRES = "5m";

const createFullToken = (userId, sessionId) =>
  jwt.sign({ id: userId, sid: sessionId }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES,
  });

const createPending2FAToken = (userId) =>
  jwt.sign({ id: userId, pending2FA: true }, JWT_SECRET, {
    expiresIn: PENDING_2FA_TOKEN_EXPIRES,
  });

// Creates a Session record for this login and returns a signed JWT for it.
const startSession = async (user, req) => {
  const session = await Session.create({
    user: user._id,
    userAgent: req.headers["user-agent"] || "Unknown device",
    ip: req.ip || req.headers["x-forwarded-for"] || null,
  });

  return { token: createFullToken(user._id, session._id), session };
};

// GET CURRENT USER
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name email twoFactorEnabled createdAt",
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// UPDATE PASSWORD
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const user = await User.findById(req.user.id).select("password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ message: "Wrong current password" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc Register new user & send OTP for email verification
 */
export const registerUser = async (req, res) => {
  try {
    let { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    email = email.toLowerCase();

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      otp,
      otpExpire: Date.now() + 10 * 60 * 1000,
    });

    // ⚡ FAST RESPONSE
    res.status(201).json({
      success: true,
      message: "OTP sent to your email",
      user: { name: user.name, email: user.email },
    });

    // 🔥 BACKGROUND EMAIL
    verifyOtpMail(otp, email, "Signup Verification")
      .then(() => console.log("OTP sent"))
      .catch(err => console.error("Email error:", err));

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Verify Signup OTP
 */
export const verifySignupOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp || user.otpExpire < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    const { token } = await startSession(user, req);

    res.json({
      success: true,
      token,
      user: { name: user.name, email: user.email },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Resend OTP
 */
export const resendSignupOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "Already verified" });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    res.json({ success: true, message: "OTP resent" });

    verifyOtpMail(otp, email, "Signup Verification")
      .catch(err => console.error(err));

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Login user (returns a full session token, or asks for a 2FA code)
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email: email.toLowerCase() });

    // Generic message for both "no such user" and "wrong password" —
    // avoids leaking which emails are registered.
    const invalidCredsMsg = "Invalid email or password";

    if (!user) return res.status(401).json({ message: invalidCredsMsg });

    if (!user.isVerified)
      return res
        .status(403)
        .json({ message: "Verify your account via OTP first" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: invalidCredsMsg });

    // If 2FA is enabled, don't issue a full session token yet.
    if (user.twoFactorEnabled) {
      return res.json({
        success: true,
        twoFactorRequired: true,
        preAuthToken: createPending2FAToken(user._id),
      });
    }

    const { token } = await startSession(user, req);

    res.json({
      success: true,
      token,
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("LoginUser Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * @desc Complete login by verifying a TOTP code (or a recovery code)
 *       against the pre-auth token issued by loginUser.
 */
export const verifyLogin2FA = async (req, res) => {
  try {
    const { preAuthToken, code } = req.body;

    if (!preAuthToken || !code) {
      return res.status(400).json({ message: "Code is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(preAuthToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Login session expired. Please log in again." });
    }

    if (!decoded.pending2FA) {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ message: "Two-factor authentication is not active" });
    }

    const secret = decryptPassword(user.twoFactorSecret);
    let verified = verifyTotpCode(code, secret);

    // Fall back to a one-time recovery code if the TOTP code didn't match.
    if (!verified && /^[A-Z0-9]{5}-[A-Z0-9]{5}$/i.test(code.trim())) {
      const matchIndex = await matchRecoveryCode(
        code.trim().toUpperCase(),
        user.twoFactorRecoveryCodes,
      );

      if (matchIndex !== -1) {
        verified = true;
        // Recovery codes are single-use — remove it once consumed.
        user.twoFactorRecoveryCodes.splice(matchIndex, 1);
        await user.save();
      }
    }

    if (!verified) {
      return res.status(401).json({ message: "Invalid or expired code" });
    }

    const { token } = await startSession(user, req);

    res.json({
      success: true,
      token,
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("VerifyLogin2FA Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------
// Two-Factor Authentication setup (requires an authenticated session)
// ---------------------

export const setupTwoFactor = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: "Two-factor authentication is already enabled" });
    }

    const secret = generateTotpSecret();
    user.twoFactorTempSecret = encryptPassword(secret);
    await user.save();

    const otpAuthUrl = buildOtpAuthUrl(user.email, secret);
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpAuthUrl);

    res.json({
      success: true,
      secret, // shown once for manual entry
      qrCodeDataUrl,
    });
  } catch (err) {
    console.error("SetupTwoFactor Error:", err);
    res.status(500).json({ message: "Failed to start 2FA setup" });
  }
};

export const verifyTwoFactorSetup = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code is required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.twoFactorTempSecret) {
      return res.status(400).json({ message: "Start 2FA setup first" });
    }

    const secret = decryptPassword(user.twoFactorTempSecret);

    if (!verifyTotpCode(code, secret)) {
      return res.status(401).json({ message: "Invalid code. Please try again." });
    }

    const recoveryCodes = generateRecoveryCodes();

    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorTempSecret = null;
    user.twoFactorEnabled = true;
    user.twoFactorRecoveryCodes = await hashRecoveryCodes(recoveryCodes);
    await user.save();

    res.json({
      success: true,
      message: "Two-factor authentication enabled",
      recoveryCodes, // shown once — user must save these
    });
  } catch (err) {
    console.error("VerifyTwoFactorSetup Error:", err);
    res.status(500).json({ message: "Failed to enable 2FA" });
  }
};

export const disableTwoFactor = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: "Password is required" });

    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Wrong password" });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorTempSecret = null;
    user.twoFactorRecoveryCodes = [];
    await user.save();

    res.json({ success: true, message: "Two-factor authentication disabled" });
  } catch (err) {
    console.error("DisableTwoFactor Error:", err);
    res.status(500).json({ message: "Failed to disable 2FA" });
  }
};

// ---------------------
// Session management
// ---------------------

export const listSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user._id, revoked: false })
      .sort({ lastActiveAt: -1 })
      .lean();

    const withCurrentFlag = sessions.map((s) => ({
      ...s,
      isCurrent: String(s._id) === String(req.sessionId),
    }));

    res.json({ success: true, data: withCurrentFlag });
  } catch (err) {
    console.error("ListSessions Error:", err);
    res.status(500).json({ message: "Failed to load sessions" });
  }
};

export const revokeSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Session.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { revoked: true },
      { new: true },
    );

    if (!session) return res.status(404).json({ message: "Session not found" });

    res.json({ success: true, message: "Session logged out" });
  } catch (err) {
    console.error("RevokeSession Error:", err);
    res.status(500).json({ message: "Failed to log out session" });
  }
};

export const revokeOtherSessions = async (req, res) => {
  try {
    await Session.updateMany(
      { user: req.user._id, _id: { $ne: req.sessionId } },
      { revoked: true },
    );

    res.json({ success: true, message: "Logged out from all other devices" });
  } catch (err) {
    console.error("RevokeOtherSessions Error:", err);
    res.status(500).json({ message: "Failed to log out other sessions" });
  }
};

export const logout = async (req, res) => {
  try {
    if (req.sessionId) {
      await Session.findByIdAndUpdate(req.sessionId, { revoked: true });
    }
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    console.error("Logout Error:", err);
    res.status(500).json({ message: "Failed to log out" });
  }
};

// Request Password Reset (Send OTP)
// ---------------------
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });

    // Always respond the same way whether or not the email exists,
    // so this endpoint can't be used to enumerate registered accounts.
    if (user) {
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpire = Date.now() + 10 * 60 * 1000; // 10 min
      await user.save();

      await sendOtpMail(email, otp, "Password Reset");
    }

    res.status(200).json({
      success: true,
      message: "If that email is registered, an OTP has been sent to it",
    });
  } catch (err) {
    console.error("ForgotPassword Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------
// Verify OTP + Reset Password
// ---------------------
export const verifyForgotOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp || user.otpExpire < Date.now())
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("VerifyForgotOTP Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp || user.otpExpire < Date.now())
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("ResetPassword Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};



export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id; // auth middleware se aata hai

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(userId);
    await Session.deleteMany({ user: userId });

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting account",
      error: error.message,
    });
  }
};
