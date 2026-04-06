import express from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  listUsers,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  getSystemSettings,
  updateSystemSettings,
  getAdminOverview,
  getActivityLogs,
  listDisputesForAdmin,
  resolveDispute,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/users", listUsers);
router.post("/users", createUserByAdmin);
router.put("/users/:userId", updateUserByAdmin);
router.delete("/users/:userId", deleteUserByAdmin);

router.get("/settings", getSystemSettings);
router.put("/settings", updateSystemSettings);

router.get("/reports/overview", getAdminOverview);
router.get("/activity", getActivityLogs);

router.get("/disputes", listDisputesForAdmin);
router.put("/disputes/:disputeId/resolve", resolveDispute);

export default router;
