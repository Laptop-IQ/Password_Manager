import express from "express";
import {
  createPassword,
  getAllPasswords,
  getPasswordById,
  updatePassword,
  deletePassword,
} from "../controllers/passwordController.js";

const router = express.Router();

// Create a new password
router.post("/", createPassword);

// Get all passwords
router.get("/", getAllPasswords);

// Get single password by ID
router.get("/:id", getPasswordById);

// Update password
router.put("/:id", updatePassword);

// Delete password
router.delete("/:id", deletePassword);

export default router;
