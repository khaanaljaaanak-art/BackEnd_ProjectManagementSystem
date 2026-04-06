import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  getAssignedStudentsProgress,
  getRubricByAssessment,
  getSubmissionHistory,
  getSupervisorNotifications,
  markNotificationAsRead,
  getConversation,
  sendMessageToStudent,
} from "../controllers/supervisorController.js";

const router = express.Router();

router.use(protect, authorize("supervisor"));

router.get("/students/progress", getAssignedStudentsProgress);
router.get("/rubrics/:assessmentId", getRubricByAssessment);
router.get("/history/:assessmentId", getSubmissionHistory);
router.get("/notifications", getSupervisorNotifications);
router.put("/notifications/:notificationId/read", markNotificationAsRead);
router.get("/messages", getConversation);
router.post("/messages", sendMessageToStudent);

export default router;
