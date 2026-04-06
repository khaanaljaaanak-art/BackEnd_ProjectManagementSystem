import express from "express";
import {
  createProject,
  getAllProjects,
  updateProject,
  deleteProject,
  approveProject,
  getPendingProjects,
  assignProjectToStudent,
} from "../controllers/projectController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin creates project
router.post("/", protect, authorize("admin"), createProject);

// Role-aware listing: students see only approved + available
router.get("/", protect, getAllProjects);

// Admin project controls
router.get("/pending", protect, authorize("admin"), getPendingProjects);
router.patch("/:projectId/approve", protect, authorize("admin"), approveProject);
router.patch("/:projectId/assign", protect, authorize("student"), assignProjectToStudent);
router.put("/:projectId", protect, authorize("admin"), updateProject);
router.delete("/:projectId", protect, authorize("admin"), deleteProject);

export default router;
