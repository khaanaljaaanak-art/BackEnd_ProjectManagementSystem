import Submission from "../models/Submission.js";
import Assessment from "../models/Assessment.js";
import Project from "../models/Project.js";
import SystemSetting from "../models/SystemSetting.js";
import SubmissionRevision from "../models/SubmissionRevision.js";
import Notification from "../models/Notification.js";
import { logActivity } from "../utils/activityLogger.js";

/**
 * Student submits assessment
 */
export const submitAssessment = async (req, res) => {
  try {
    const { assessmentId, fileUrl, fileUrls } = req.body;

    const settings =
      (await SystemSetting.findOne().sort({ createdAt: -1 })) ||
      (await SystemSetting.create({}));
    if (!settings.submissionEnabled) {
      return res.status(403).json({ message: "Submissions are currently disabled by admin" });
    }

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

    const project = await Project.findById(assessment.project).select(
      "approved status supervisors"
    );
    if (!project || !project.approved || project.status !== "available") {
      return res.status(403).json({ message: "Project is not available for submission" });
    }

    const effectiveDeadline = assessment.extendedDeadline || assessment.deadline;
    if (effectiveDeadline && Date.now() > new Date(effectiveDeadline).getTime()) {
      return res.status(400).json({ message: "Deadline has passed" });
    }

    const existing = await Submission.findOne({
      assessment: assessmentId,
      student: req.user.id,
    });

    let submission;
    let revisionVersion = 1;
    let isResubmission = false;

    if (existing) {
      const alreadyGraded =
        existing.status === "graded" ||
        existing.marks !== null ||
        (Array.isArray(existing.grades) && existing.grades.length > 0);

      if (alreadyGraded) {
        return res.status(400).json({
          message: "Resubmission is not allowed after supervisor grading.",
        });
      }

      isResubmission = true;
      revisionVersion = (existing.attemptCount || 1) + 1;
      existing.fileUrl = normalizedFileUrls[0] || "";
      existing.fileUrls = normalizedFileUrls;
      existing.status = "submitted";
      existing.attemptCount = revisionVersion;
      existing.lastSubmittedAt = new Date();
      existing.submittedAt = existing.submittedAt || new Date();
      submission = await existing.save();
    } else {
      submission = await Submission.create({
        assessment: assessmentId,
        student: req.user.id,
        fileUrl: normalizedFileUrls[0] || "",
        fileUrls: normalizedFileUrls,
        status: "submitted",
        attemptCount: 1,
        lastSubmittedAt: new Date(),
      });
    }

    await SubmissionRevision.create({
      submission: submission._id,
      version: revisionVersion,
      changedBy: req.user.id,
      changedRole: req.user.role,
      changeType: "submit",
      fileUrl: submission.fileUrl,
      fileUrls: submission.fileUrls,
      marks: submission.marks,
      feedback: submission.feedback,
      note: isResubmission ? "Student resubmitted before deadline" : "Initial submission",
    });

    const supervisorIds = Array.isArray(project.supervisors)
      ? project.supervisors.filter(Boolean)
      : [];
    if (supervisorIds.length > 0) {
      await Notification.insertMany(
        supervisorIds.map((supervisorId) => ({
          recipient: supervisorId,
          type: "submission_submitted",
          title: isResubmission ? "Student resubmitted work" : "New student submission",
          message: isResubmission
            ? "A student resubmitted work before the deadline."
            : "A student submitted work for your project.",
          data: {
            submissionId: submission._id,
            assessmentId,
            projectId: project._id,
            studentId: req.user.id,
            isResubmission,
          },
        }))
      );
    }

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "submission.create",
      targetType: "submission",
      targetId: submission._id,
      meta: { assessmentId },
    });

    res.status(201).json(submission);
  } catch (error) {
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
    })
      .populate("assessment", "title deadline extendedDeadline")
      .populate("grades.evaluator", "name email role");

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
      .populate("student", "name email")
      .populate("grades.evaluator", "name email role");

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

    const normalizedMarks = Number(marks);
    if (Number.isNaN(normalizedMarks)) {
      return res.status(400).json({ message: "Valid marks are required" });
    }

    const submission = await Submission.findById(submissionId).populate(
      "assessment",
      "project"
    );

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    if (req.user.role === "supervisor") {
      const hasAccess = await Project.exists({
        _id: submission.assessment?.project,
        supervisors: req.user.id,
      });

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied for this submission" });
      }
    }

    const existingGrades = Array.isArray(submission.grades) ? submission.grades : [];
    const alreadyGradedByCurrentUser = existingGrades.some(
      (grade) => String(grade.evaluator) === String(req.user.id)
    );

    if (alreadyGradedByCurrentUser) {
      return res.status(409).json({
        message: "You have already graded this submission once and cannot update it again.",
      });
    }

    submission.grades.push({
      evaluator: req.user.id,
      evaluatorRole: req.user.role,
      marks: normalizedMarks,
      feedback: feedback || "",
      gradedAt: new Date(),
    });

    submission.status = "graded";

    // Keep backward-compatible aggregate fields used by existing views.
    if (submission.marks === null || submission.marks === undefined) {
      submission.marks = normalizedMarks;
      submission.feedback = feedback || "";
    }

    await submission.save();

    const lastRevision = await SubmissionRevision.findOne({ submission: submission._id })
      .sort({ version: -1 })
      .select("version");
    const nextVersion = (lastRevision?.version || 0) + 1;

    await SubmissionRevision.create({
      submission: submission._id,
      version: nextVersion,
      changedBy: req.user.id,
      changedRole: req.user.role,
      changeType: "grade_update",
      fileUrl: submission.fileUrl,
      fileUrls: submission.fileUrls,
      marks: normalizedMarks,
      feedback: feedback || "",
      note: "Supervisor submitted marks/feedback",
    });

    await Notification.create({
      recipient: submission.student,
      type: "feedback_update",
      title: "Submission evaluated",
      message: "Your submission has been graded with feedback.",
      data: {
        submissionId: submission._id,
        marks: normalizedMarks,
      },
    });

    await logActivity({
      actor: req.user.id,
      actorRole: req.user.role,
      action: "submission.grade",
      targetType: "submission",
      targetId: submission._id,
      meta: { marks: normalizedMarks },
    });

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: "Failed to grade submission" });
  }
};
