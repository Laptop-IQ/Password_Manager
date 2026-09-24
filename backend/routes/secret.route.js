import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  createSecret,
  getAllSecrets,
  getSecretById,
  updateSecret,
  deleteSecret,
} from "../controllers/secretController.js";

const router = express.Router();

// Every secret route requires a valid, logged-in user.
router.use(authMiddleware);

// Create a new secret
router.post("/", createSecret);

// Get all secrets belonging to the logged-in user
router.get("/", getAllSecrets);

// Get single secret by ID (only if it belongs to the logged-in user)
router.get("/:id", getSecretById);

// Update secret (only if it belongs to the logged-in user)
router.put("/:id", updateSecret);

// Delete secret (only if it belongs to the logged-in user)
router.delete("/:id", deleteSecret);

export default router;
