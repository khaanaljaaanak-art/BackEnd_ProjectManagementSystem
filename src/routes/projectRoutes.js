import express from "express";
import {
  createProject,
  getAllProjects,
} from "../controllers/projectController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Supervisor creates project
router.post(
  "/",
  protect,
  authorize("supervisor", "admin"),
  createProject
);

// Students & supervisors view projects
router.get("/", protect, getAllProjects);

export default router;
