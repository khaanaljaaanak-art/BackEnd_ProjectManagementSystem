import Project from "../models/Project.js";

/**
 * Supervisor: Create a project
 */
export const createProject = async (req, res) => {
  try {
    const { title, description } = req.body;

    const project = await Project.create({
      title,
      description,
      supervisors: [req.user.id],
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
    const projects = await Project.find().populate(
      "supervisors",
      "name email"
    );
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};
