import express from "express";
import {
  createAssessment,
  getAssessmentsByProject,
  updateAssessment,
  deleteAssessment,
} from "../controllers/assessmentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin creates assessment
router.post("/", protect, authorize("admin"), createAssessment);

// Get assessments for a project
router.get("/:projectId", protect, getAssessmentsByProject);

// Admin updates/deletes assessments
router.put("/item/:assessmentId", protect, authorize("admin"), updateAssessment);
router.delete("/item/:assessmentId", protect, authorize("admin"), deleteAssessment);

export default router;
