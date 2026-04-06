import Project from "../models/Project.js";
import { logActivity } from "../utils/activityLogger.js";

/**
 * Admin: Create a project
 */
export const createProject = async (req, res) => {
  try {
    const { title, description, supervisors = [] } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "title and description are required" });
    }

    const project = await Project.create({
      title,
      description,
      supervisors: Array.isArray(supervisors) ? supervisors : [],
      approved: req.user.role === "admin",
      approvedBy: req.user.role === "admin" ? req.user.id : null,
      approvedAt: req.user.role === "admin" ? new Date() : null,
    });

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "project.create",
      targetType: "project",
      targetId: project._id,
      meta: { title: project.title },
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: "Failed to create project" });
  }
};

/**
 * Get all projects (students can browse)
 */
export const getAllProjects = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "student") {
      filter = { approved: true, status: "available" };
    }
    if (req.user.role === "supervisor") {
      filter = { supervisors: req.user.id };
    }

    const projects = await Project.find(filter).populate(
      "supervisors",
      "name email"
    );
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};

/**
 * Admin: Update a project
 */
export const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, status, supervisors } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (typeof title === "string") project.title = title.trim();
    if (typeof description === "string") project.description = description.trim();
    if (["available", "unavailable"].includes(status)) project.status = status;
    if (Array.isArray(supervisors)) project.supervisors = supervisors;

    const updated = await project.save();

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "project.update",
      targetType: "project",
      targetId: updated._id,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update project" });
  }
};

/**
 * Admin: Delete a project
 */
export const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findByIdAndDelete(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "project.delete",
      targetType: "project",
      targetId: project._id,
      meta: { title: project.title },
    });

    res.json({ message: "Project deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete project" });
  }
};

/**
 * Admin: Approve a project
 */
export const approveProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findByIdAndUpdate(
      projectId,
      {
        approved: true,
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "project.approve",
      targetType: "project",
      targetId: project._id,
      meta: { title: project.title },
    });

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: "Failed to approve project" });
  }
};

/**
 * Admin: list pending projects
 */
export const getPendingProjects = async (_req, res) => {
  try {
    const projects = await Project.find({ approved: false }).populate(
      "supervisors",
      "name email"
    );
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending projects" });
  }
};

/**
 * Student: Assign self to a project
 */
export const assignProjectToStudent = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!project.approved || project.status !== "available") {
      return res.status(400).json({ message: "Project is not available for assignment" });
    }

    if (project.selectedBy && String(project.selectedBy) !== req.user.id) {
      return res.status(409).json({ message: "Project already assigned to another student" });
    }

    await Project.updateMany({ selectedBy: req.user.id }, { selectedBy: null });
    project.selectedBy = req.user.id;
    await project.save();

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "project.assign",
      targetType: "project",
      targetId: project._id,
    });

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: "Failed to assign project" });
  }
};
