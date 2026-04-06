import User from "../models/User.js";
import Project from "../models/Project.js";
import Assessment from "../models/Assessment.js";
import Submission from "../models/Submission.js";
import SubmissionRevision from "../models/SubmissionRevision.js";
import Notification from "../models/Notification.js";
import Rubric from "../models/Rubric.js";
import Message from "../models/Message.js";
import { logActivity } from "../utils/activityLogger.js";

export const getStudentOverview = async (req, res) => {
  try {
    const assignedProject = await Project.findOne({ selectedBy: req.user.id }).populate(
      "supervisors",
      "name email role"
    );

    const availableProjects = await Project.find({
      approved: true,
      status: "available",
    }).populate("supervisors", "name email role");

    const admins = await User.find({ role: "admin" }).select("name email role");

    res.json({
      assignedProject,
      availableProjects,
      admins,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch student overview" });
  }
};

export const getAssessmentStatus = async (req, res) => {
  try {
    const project = await Project.findOne({ selectedBy: req.user.id }).select("_id title");
    if (!project) {
      return res.json([]);
    }

    const assessments = await Assessment.find({ project: project._id }).sort({ deadline: 1 });
    const assessmentIds = assessments.map((assessment) => assessment._id);

    const submissions = await Submission.find({
      student: req.user.id,
      assessment: { $in: assessmentIds },
    });

    const submissionByAssessmentId = new Map(
      submissions.map((submission) => [String(submission.assessment), submission])
    );

    const now = Date.now();

    const rows = assessments.map((assessment) => {
      const submission = submissionByAssessmentId.get(String(assessment._id));
      const effectiveDeadline = assessment.extendedDeadline || assessment.deadline;
      const isPastDeadline = effectiveDeadline
        ? now > new Date(effectiveDeadline).getTime()
        : false;

      let status = "pending";
      if (submission?.status === "graded") {
        status = "graded";
      } else if (submission) {
        status = "submitted";
      } else if (isPastDeadline) {
        status = "deadline-missed";
      }

      return {
        assessment,
        submission,
        status,
        effectiveDeadline,
      };
    });

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assessment status" });
  }
};

export const getMarksWithRubrics = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate({
        path: "assessment",
        select: "title project deadline extendedDeadline",
        populate: { path: "project", select: "title description" },
      })
      .sort({ updatedAt: -1 });

    const assessmentIds = submissions
      .map((submission) => submission.assessment?._id)
      .filter(Boolean);

    const rubrics = await Rubric.find({ assessment: { $in: assessmentIds } });
    const rubricByAssessmentId = new Map(
      rubrics.map((rubric) => [String(rubric.assessment), rubric])
    );

    const rows = submissions.map((submission) => ({
      submission,
      rubric: rubricByAssessmentId.get(String(submission.assessment?._id)) || null,
    }));

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch marks and rubrics" });
  }
};

export const getStudentHistory = async (req, res) => {
  try {
    const submissions = await Submission.find({ student: req.user.id })
      .populate({
        path: "assessment",
        select: "title project",
        populate: { path: "project", select: "title" },
      })
      .sort({ updatedAt: -1 });

    const submissionIds = submissions.map((submission) => submission._id);

    const revisions = await SubmissionRevision.find({ submission: { $in: submissionIds } })
      .populate("changedBy", "name email role")
      .sort({ createdAt: -1 });

    const revisionsBySubmissionId = new Map();
    revisions.forEach((revision) => {
      const key = String(revision.submission);
      const current = revisionsBySubmissionId.get(key) || [];
      current.push(revision);
      revisionsBySubmissionId.set(key, current);
    });

    const result = submissions.map((submission) => ({
      submission,
      revisions: revisionsBySubmissionId.get(String(submission._id)) || [],
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch performance history" });
  }
};

export const getStudentNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

export const markStudentNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const updated = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update notification" });
  }
};

export const getStudentContacts = async (req, res) => {
  try {
    const assignedProject = await Project.findOne({ selectedBy: req.user.id }).populate(
      "supervisors",
      "name email role"
    );

    const admins = await User.find({ role: "admin" }).select("name email role");

    const supervisors = assignedProject?.supervisors || [];

    res.json({
      project: assignedProject,
      supervisors,
      admins,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch contacts" });
  }
};

export const getStudentConversation = async (req, res) => {
  try {
    const { withUserId } = req.query;

    if (!withUserId) {
      return res.status(400).json({ message: "withUserId is required" });
    }

    const peer = await User.findById(withUserId).select("_id role name email");
    if (!peer || !["supervisor", "admin"].includes(peer.role)) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, recipient: withUserId },
        { sender: withUserId, recipient: req.user.id },
      ],
    })
      .populate("sender", "name email role")
      .populate("recipient", "name email role")
      .sort({ createdAt: 1 })
      .limit(300);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch conversation" });
  }
};

export const sendStudentMessage = async (req, res) => {
  try {
    const { recipientId, text, projectId, assessmentId } = req.body;

    if (!recipientId || !text) {
      return res.status(400).json({ message: "recipientId and text are required" });
    }

    const recipient = await User.findById(recipientId).select("_id role name");
    if (!recipient || !["supervisor", "admin"].includes(recipient.role)) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const message = await Message.create({
      sender: req.user.id,
      recipient: recipientId,
      project: projectId || null,
      assessment: assessmentId || null,
      text: text.trim(),
    });

    await Notification.create({
      recipient: recipientId,
      type: "message",
      title: "New student message",
      message: text.trim().slice(0, 120),
      data: {
        messageId: message._id,
        projectId: projectId || null,
        assessmentId: assessmentId || null,
      },
    });

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "message.send",
      targetType: "message",
      targetId: message._id,
      meta: { recipientId },
    });

    const populated = await Message.findById(message._id)
      .populate("sender", "name email role")
      .populate("recipient", "name email role");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to send message" });
  }
};
