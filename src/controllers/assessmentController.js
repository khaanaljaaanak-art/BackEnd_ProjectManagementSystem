import Assessment from "../models/Assessment.js";

/**
 * Supervisor: Create assessment
 */
export const createAssessment = async (req, res) => {
  try {
    const { projectId, title, deadline } = req.body;

    const assessment = await Assessment.create({
      project: projectId,
      title,
      deadline,
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

    const assessments = await Assessment.find({ project: projectId });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assessments" });
  }
};
