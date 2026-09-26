import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  createTotp,
  getAllTotp,
  updateTotp,
  deleteTotp,
} from "../controllers/totpController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", createTotp);
router.get("/", getAllTotp);
router.put("/:id", updateTotp);
router.delete("/:id", deleteTotp);

export default router;
