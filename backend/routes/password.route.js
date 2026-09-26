import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  createPassword,
  getAllPasswords,
  getPasswordById,
  getPasswordHistory,
  updatePassword,
  deletePassword,
} from "../controllers/passwordController.js";

const router = express.Router();

// Every password route requires a valid, logged-in user.
router.use(authMiddleware);

// Create a new password
router.post("/", createPassword);

// Get all passwords belonging to the logged-in user
router.get("/", getAllPasswords);

// Get single password by ID (only if it belongs to the logged-in user)
router.get("/:id", getPasswordById);

// Get password change history (only if it belongs to the logged-in user)
router.get("/:id/history", getPasswordHistory);

// Update password (only if it belongs to the logged-in user)
router.put("/:id", updatePassword);

// Delete password (only if it belongs to the logged-in user)
router.delete("/:id", deletePassword);

export default router;
