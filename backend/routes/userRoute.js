import express from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  updatePassword,
  verifySignupOTP,
  resendSignupOTP,
  forgotPassword,
  verifyForgotOTP,
  resetPassword,
  deleteAccount,
} from "../controllers/userController.js";

import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-signup-otp", verifySignupOTP);
router.post("/resend-signup-otp", resendSignupOTP);
router.post("/forgot-password", forgotPassword);
router.post("/verify-forgot-otp", verifyForgotOTP);
router.post("/reset-password", resetPassword);

// Protected routes
router.get("/me", authMiddleware, getCurrentUser);
router.put("/password", authMiddleware, updatePassword);


// DELETE ACCOUNT
router.delete("/delete-account", authMiddleware, deleteAccount);

export default router;
