import express from "express";
import { createDispute, getMyDisputes } from "../controllers/disputeController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, authorize("student", "supervisor"), createDispute);
router.get("/mine", protect, authorize("student", "supervisor"), getMyDisputes);

export default router;
