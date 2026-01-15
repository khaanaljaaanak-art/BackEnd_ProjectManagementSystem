import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  submitAssessment,
  getSubmissionsByAssessment,
  gradeSubmission,
  getMySubmissionForAssessment,
} from "../controllers/submissionController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || "").slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { files: 3 },
});

// Student submits
router.post("/", protect, authorize("student"), submitAssessment);

// Student uploads up to 3 files (returns URLs)
router.post(
  "/upload",
  protect,
  authorize("student"),
  (req, res, next) => {
    upload.array("files", 3)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "Upload failed" });
      }
      next();
    });
  },
  (req, res) => {
    const files = req.files || [];
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    if (files.length > 3) {
      return res.status(400).json({ message: "You can upload at most 3 files" });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const urls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);
    res.json({ urls });
  }
);

// Student checks their own submission
router.get(
  "/mine/:assessmentId",
  protect,
  authorize("student"),
  getMySubmissionForAssessment
);

// Supervisor views submissions
router.get(
  "/:assessmentId",
  protect,
  authorize("supervisor", "admin"),
  getSubmissionsByAssessment
);

// Supervisor grades
router.put(
  "/grade/:submissionId",
  protect,
  authorize("supervisor", "admin"),
  gradeSubmission
);

export default router;
