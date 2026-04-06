import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Assessment from "../models/Assessment.js";
import Submission from "../models/Submission.js";
import ActivityLog from "../models/ActivityLog.js";
import SystemSetting from "../models/SystemSetting.js";
import Dispute from "../models/Dispute.js";
import { logActivity } from "../utils/activityLogger.js";

const getOrCreateSettings = async () => {
  const existing = await SystemSetting.findOne().sort({ createdAt: -1 });
  if (existing) return existing;
  return SystemSetting.create({});
};

export const listUsers = async (_req, res) => {
  try {
    const users = await User.find().select("name email role createdAt").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

export const createUserByAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password and role are required" });
    }

    if (!["student", "supervisor", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role,
    });

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "user.create",
      targetType: "user",
      targetId: created._id,
      meta: { role: created.role },
    });

    res.status(201).json({
      _id: created._id,
      name: created.name,
      email: created.email,
      role: created.role,
      createdAt: created.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create user" });
  }
};

export const updateUserByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role, password } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof name === "string") user.name = name.trim();
    if (typeof email === "string") user.email = email.trim().toLowerCase();
    if (["student", "supervisor", "admin"].includes(role)) user.role = role;
    if (typeof password === "string" && password.trim()) {
      user.password = await bcrypt.hash(password, 10);
    }

    const updated = await user.save();

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "user.update",
      targetType: "user",
      targetId: updated._id,
      meta: { role: updated.role },
    });

    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Email is already in use" });
    }
    res.status(500).json({ message: "Failed to update user" });
  }
};

export const deleteUserByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) {
      return res.status(400).json({ message: "Admin cannot delete own account" });
    }

    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "user.delete",
      targetType: "user",
      targetId: deleted._id,
      meta: { role: deleted.role },
    });

    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user" });
  }
};

export const getSystemSettings = async (_req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const { submissionEnabled, maintenanceMode } = req.body;

    if (typeof submissionEnabled === "boolean") settings.submissionEnabled = submissionEnabled;
    if (typeof maintenanceMode === "boolean") settings.maintenanceMode = maintenanceMode;

    const updated = await settings.save();

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "settings.update",
      targetType: "systemSetting",
      targetId: updated._id,
      meta: {
        submissionEnabled: updated.submissionEnabled,
        maintenanceMode: updated.maintenanceMode,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update settings" });
  }
};

export const getAdminOverview = async (_req, res) => {
  try {
    const [
      users,
      projects,
      approvedProjects,
      assessments,
      submissions,
      gradedSubmissions,
      openDisputes,
    ] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Project.countDocuments({ approved: true }),
      Assessment.countDocuments(),
      Submission.countDocuments(),
      Submission.countDocuments({ marks: { $ne: null } }),
      Dispute.countDocuments({ status: "open" }),
    ]);

    const submissionRate = assessments > 0 ? Number((submissions / assessments).toFixed(2)) : 0;
    const gradingRate = submissions > 0 ? Number((gradedSubmissions / submissions).toFixed(2)) : 0;

    res.json({
      totals: {
        users,
        projects,
        approvedProjects,
        assessments,
        submissions,
        openDisputes,
      },
      rates: {
        submissionRate,
        gradingRate,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch overview" });
  }
};

export const getActivityLogs = async (_req, res) => {
  try {
    const logs = await ActivityLog.find()
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .limit(80);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
};

export const listDisputesForAdmin = async (_req, res) => {
  try {
    const disputes = await Dispute.find()
      .populate("raisedBy", "name email role")
      .populate("againstUser", "name email role")
      .populate("resolvedBy", "name email role")
      .sort({ createdAt: -1 });

    res.json(disputes);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch disputes" });
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { resolutionNote } = req.body;

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      return res.status(404).json({ message: "Dispute not found" });
    }

    dispute.status = "resolved";
    dispute.resolutionNote = resolutionNote || "Resolved by admin";
    dispute.resolvedBy = req.user.id;
    dispute.resolvedAt = new Date();

    const updated = await dispute.save();

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "dispute.resolve",
      targetType: "dispute",
      targetId: updated._id,
    });

    const populated = await Dispute.findById(updated._id)
      .populate("raisedBy", "name email role")
      .populate("againstUser", "name email role")
      .populate("resolvedBy", "name email role");

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to resolve dispute" });
  }
};
