import Submission from "../models/Submission.js";
import Assessment from "../models/Assessment.js";

/**
 * Student submits assessment
 */
export const submitAssessment = async (req, res) => {
  try {
    const { assessmentId, fileUrl, fileUrls } = req.body;

    const normalizedFileUrls = Array.isArray(fileUrls)
      ? fileUrls.filter(Boolean)
      : fileUrl
        ? [fileUrl]
        : [];

    if (!assessmentId) {
      return res.status(400).json({ message: "assessmentId is required" });
    }

    if (normalizedFileUrls.length === 0) {
      return res
        .status(400)
        .json({ message: "Provide a file URL or upload up to 3 files" });
    }

    if (normalizedFileUrls.length > 3) {
      return res
        .status(400)
        .json({ message: "You can upload at most 3 files" });
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const effectiveDeadline = assessment.extendedDeadline || assessment.deadline;
    if (effectiveDeadline && Date.now() > new Date(effectiveDeadline).getTime()) {
      return res.status(400).json({ message: "Deadline has passed" });
    }

    const existing = await Submission.findOne({
      assessment: assessmentId,
      student: req.user.id,
    });
    if (existing) {
      return res.status(409).json({ message: "You have already submitted" });
    }

    const submission = await Submission.create({
      assessment: assessmentId,
      student: req.user.id,
      fileUrl: normalizedFileUrls[0] || "",
      fileUrls: normalizedFileUrls,
    });

    res.status(201).json(submission);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "You have already submitted" });
    }
    res.status(500).json({ message: "Submission failed" });
  }
};

/**
 * Student fetches their own submission for an assessment
 */
export const getMySubmissionForAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const submission = await Submission.findOne({
      assessment: assessmentId,
      student: req.user.id,
    }).populate("assessment", "title deadline extendedDeadline");

    if (!submission) {
      return res.status(404).json({ message: "No submission found" });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch submission" });
  }
};

/**
 * Supervisor views submissions
 */
export const getSubmissionsByAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const submissions = await Submission.find({ assessment: assessmentId })
      .populate("student", "name email");

    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch submissions" });
  }
};

/**
 * Supervisor grades submission
 */
export const gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { marks, feedback } = req.body;

    const submission = await Submission.findByIdAndUpdate(
      submissionId,
      { marks, feedback },
      { new: true }
    );

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: "Failed to grade submission" });
  }
};
