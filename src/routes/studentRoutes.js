import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  getStudentOverview,
  getAssessmentStatus,
  getMarksWithRubrics,
  getStudentHistory,
  getStudentNotifications,
  markStudentNotificationRead,
  getStudentContacts,
  getStudentConversation,
  sendStudentMessage,
} from "../controllers/studentController.js";

const router = express.Router();

router.use(protect, authorize("student"));

router.get("/overview", getStudentOverview);
router.get("/status", getAssessmentStatus);
router.get("/marks", getMarksWithRubrics);
router.get("/history", getStudentHistory);
router.get("/notifications", getStudentNotifications);
router.put("/notifications/:notificationId/read", markStudentNotificationRead);
router.get("/contacts", getStudentContacts);
router.get("/messages", getStudentConversation);
router.post("/messages", sendStudentMessage);

export default router;
