import Assessment from "../models/Assessment.js";
import Project from "../models/Project.js";
import Notification from "../models/Notification.js";
import { logActivity } from "../utils/activityLogger.js";

/**
 * Admin: Create assessment
 */
export const createAssessment = async (req, res) => {
  try {
    const { projectId, title, deadline } = req.body;

    if (!projectId || !title || !deadline) {
      return res.status(400).json({ message: "projectId, title, deadline are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const assessment = await Assessment.create({
      project: projectId,
      title,
      deadline,
    });

    if (project.selectedBy) {
      await Notification.create({
        recipient: project.selectedBy,
        type: "deadline_update",
        title: "New assessment published",
        message: `A new assessment '${assessment.title}' was added with a deadline.`,
        data: {
          assessmentId: assessment._id,
          projectId,
          deadline: assessment.deadline,
        },
      });
    }

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "assessment.create",
      targetType: "assessment",
      targetId: assessment._id,
      meta: { projectId },
    });

    res.status(201).json(assessment);
  } catch (error) {
    res.status(500).json({ message: "Failed to create assessment" });
  }
};

/**
 * Get assessments for a project
 */
export const getAssessmentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (req.user.role === "student") {
      const project = await Project.findById(projectId).select("approved status");
      if (!project || !project.approved || project.status !== "available") {
        return res.status(403).json({ message: "Project is not available for students" });
      }
    }

    const assessments = await Assessment.find({ project: projectId });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assessments" });
  }
};

/**
 * Admin: Update assessment and deadlines
 */
export const updateAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { title, deadline, extendedDeadline } = req.body;

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (typeof title === "string") assessment.title = title.trim();
    if (deadline) assessment.deadline = deadline;
    if (extendedDeadline !== undefined) assessment.extendedDeadline = extendedDeadline;

    const updated = await assessment.save();

    const project = await Project.findById(updated.project).select("selectedBy");
    if (project?.selectedBy) {
      await Notification.create({
        recipient: project.selectedBy,
        type: "deadline_update",
        title: "Assessment deadline updated",
        message: `Deadline updated for '${updated.title}'.`,
        data: {
          assessmentId: updated._id,
          projectId: updated.project,
          deadline: updated.deadline,
          extendedDeadline: updated.extendedDeadline,
        },
      });
    }

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "assessment.update",
      targetType: "assessment",
      targetId: updated._id,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update assessment" });
  }
};

/**
 * Admin: Delete assessment
 */
export const deleteAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const deleted = await Assessment.findByIdAndDelete(assessmentId);
    if (!deleted) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "assessment.delete",
      targetType: "assessment",
      targetId: deleted._id,
    });

    res.json({ message: "Assessment deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete assessment" });
  }
};
