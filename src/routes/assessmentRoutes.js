import express from "express";
import {
  createAssessment,
  getAssessmentsByProject,
} from "../controllers/assessmentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Supervisor creates assessment
router.post(
  "/",
  protect,
  authorize("supervisor", "admin"),
  createAssessment
);

// Get assessments for a project
router.get("/:projectId", protect, getAssessmentsByProject);

export default router;
