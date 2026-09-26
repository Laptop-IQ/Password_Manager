import express from "express";
import {
  registerUser,
  loginUser,
  verifyLogin2FA,
  getCurrentUser,
  updatePassword,
  verifySignupOTP,
  resendSignupOTP,
  forgotPassword,
  verifyForgotOTP,
  resetPassword,
  deleteAccount,
  setupTwoFactor,
  verifyTwoFactorSetup,
  disableTwoFactor,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  logout,
} from "../controllers/userController.js";

import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/login/verify-2fa", verifyLogin2FA);
router.post("/verify-signup-otp", verifySignupOTP);
router.post("/resend-signup-otp", resendSignupOTP);
router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-otp", verifyForgotOTP);
router.post("/reset-password", resetPassword);

// Protected routes
router.get("/me", authMiddleware, getCurrentUser);
router.put("/password", authMiddleware, updatePassword);
router.post("/logout", authMiddleware, logout);

// Two-factor authentication
router.post("/2fa/setup", authMiddleware, setupTwoFactor);
router.post("/2fa/verify-setup", authMiddleware, verifyTwoFactorSetup);
router.post("/2fa/disable", authMiddleware, disableTwoFactor);

// Session management
router.get("/sessions", authMiddleware, listSessions);
router.delete("/sessions/:id", authMiddleware, revokeSession);
router.post("/sessions/logout-others", authMiddleware, revokeOtherSessions);

// DELETE ACCOUNT
router.delete("/delete-account", authMiddleware, deleteAccount);

export default router;
