import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  createCard,
  getAllCards,
  getCardById,
  updateCard,
  deleteCard,
} from "../controllers/cardController.js";

const router = express.Router();

// Every card route requires a valid, logged-in user.
router.use(authMiddleware);

// Create a new card
router.post("/", createCard);

// Get all cards belonging to the logged-in user
router.get("/", getAllCards);

// Get single card by ID (only if it belongs to the logged-in user)
router.get("/:id", getCardById);

// Update card (only if it belongs to the logged-in user)
router.put("/:id", updateCard);

// Delete card (only if it belongs to the logged-in user)
router.delete("/:id", deleteCard);

export default router;
