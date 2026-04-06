import Assessment from "../models/Assessment.js";
import Project from "../models/Project.js";
import Submission from "../models/Submission.js";
import SubmissionRevision from "../models/SubmissionRevision.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import Rubric from "../models/Rubric.js";
import User from "../models/User.js";
import { logActivity } from "../utils/activityLogger.js";

const getSupervisorProjectIds = async (supervisorId) => {
  const projects = await Project.find({ supervisors: supervisorId }).select("_id title");
  return projects;
};

export const getAssignedStudentsProgress = async (req, res) => {
  try {
    const projects = await getSupervisorProjectIds(req.user.id);
    const projectIds = projects.map((project) => project._id);

    if (projectIds.length === 0) {
      return res.json([]);
    }

    const assessments = await Assessment.find({ project: { $in: projectIds } }).select(
      "_id project title deadline"
    );
    const assessmentIds = assessments.map((assessment) => assessment._id);

    const submissions = await Submission.find({ assessment: { $in: assessmentIds } })
      .populate("student", "name email")
      .populate("assessment", "title project")
      .sort({ submittedAt: -1 });

    const projectNameById = new Map(projects.map((project) => [String(project._id), project.title]));

    const progressByStudent = new Map();

    submissions.forEach((submission) => {
      const student = submission.student;
      if (!student?._id) return;

      const studentId = String(student._id);
      const current =
        progressByStudent.get(studentId) || {
          student: {
            _id: student._id,
            name: student.name,
            email: student.email,
          },
          projectTitles: new Set(),
          submissionsCount: 0,
          gradedCount: 0,
          totalMarks: 0,
          marksCount: 0,
          latestSubmissionAt: null,
        };

      const projectId = String(submission.assessment?.project || "");
      if (projectId && projectNameById.has(projectId)) {
        current.projectTitles.add(projectNameById.get(projectId));
      }

      current.submissionsCount += 1;

      if (submission.marks !== null && submission.marks !== undefined) {
        current.gradedCount += 1;
        current.totalMarks += Number(submission.marks);
        current.marksCount += 1;
      }

      const submittedAt = submission.submittedAt || submission.createdAt;
      if (!current.latestSubmissionAt || new Date(submittedAt) > new Date(current.latestSubmissionAt)) {
        current.latestSubmissionAt = submittedAt;
      }

      progressByStudent.set(studentId, current);
    });

    const result = Array.from(progressByStudent.values()).map((item) => ({
      student: item.student,
      projects: Array.from(item.projectTitles),
      submissionsCount: item.submissionsCount,
      gradedCount: item.gradedCount,
      averageMarks:
        item.marksCount > 0 ? Number((item.totalMarks / item.marksCount).toFixed(2)) : null,
      latestSubmissionAt: item.latestSubmissionAt,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assigned students and progress" });
  }
};

export const getRubricByAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await Assessment.findById(assessmentId).select("project title");
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const canAccess = await Project.exists({
      _id: assessment.project,
      supervisors: req.user.id,
    });

    if (!canAccess) {
      return res.status(403).json({ message: "Access denied for this assessment" });
    }

    let rubric = await Rubric.findOne({ assessment: assessmentId });

    if (!rubric) {
      rubric = {
        assessment: assessmentId,
        criteria: [
          { title: "Problem Understanding", description: "Requirement clarity", maxMarks: 20 },
          { title: "Implementation Quality", description: "Code quality and correctness", maxMarks: 40 },
          { title: "Documentation", description: "Report and clarity", maxMarks: 20 },
          { title: "Presentation", description: "Communication and explanation", maxMarks: 20 },
        ],
        totalMarks: 100,
      };
    }

    res.json(rubric);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch rubric" });
  }
};

export const getSubmissionHistory = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { studentId } = req.query;

    const assessment = await Assessment.findById(assessmentId).select("project");
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    const canAccess = await Project.exists({
      _id: assessment.project,
      supervisors: req.user.id,
    });

    if (!canAccess) {
      return res.status(403).json({ message: "Access denied for this assessment" });
    }

    const submissionFilter = { assessment: assessmentId };
    if (studentId) submissionFilter.student = studentId;

    const submissions = await Submission.find(submissionFilter)
      .populate("student", "name email")
      .sort({ submittedAt: -1 });

    const submissionIds = submissions.map((submission) => submission._id);

    const revisions = await SubmissionRevision.find({ submission: { $in: submissionIds } })
      .populate("changedBy", "name email role")
      .sort({ createdAt: -1 });

    const revisionsBySubmission = new Map();
    revisions.forEach((revision) => {
      const key = String(revision.submission);
      const current = revisionsBySubmission.get(key) || [];
      current.push(revision);
      revisionsBySubmission.set(key, current);
    });

    const response = submissions.map((submission) => ({
      submission,
      revisions: revisionsBySubmission.get(String(submission._id)) || [],
    }));

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch submission history" });
  }
};

export const getSupervisorNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(120);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: "Failed to update notification" });
  }
};

export const getConversation = async (req, res) => {
  try {
    const { studentId, projectId } = req.query;

    if (!studentId) {
      return res.status(400).json({ message: "studentId is required" });
    }

    const student = await User.findById(studentId).select("_id name email role");
    if (!student || student.role !== "student") {
      return res.status(404).json({ message: "Student not found" });
    }

    const filter = {
      $or: [
        { sender: req.user.id, recipient: studentId },
        { sender: studentId, recipient: req.user.id },
      ],
    };

    if (projectId) filter.project = projectId;

    const messages = await Message.find(filter)
      .populate("sender", "name email role")
      .populate("recipient", "name email role")
      .sort({ createdAt: 1 })
      .limit(300);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

export const sendMessageToStudent = async (req, res) => {
  try {
    const { studentId, text, projectId, assessmentId } = req.body;

    if (!studentId || !text) {
      return res.status(400).json({ message: "studentId and text are required" });
    }

    const student = await User.findById(studentId).select("_id role");
    if (!student || student.role !== "student") {
      return res.status(404).json({ message: "Student not found" });
    }

    const message = await Message.create({
      sender: req.user.id,
      recipient: studentId,
      project: projectId || null,
      assessment: assessmentId || null,
      text: text.trim(),
    });

    await Notification.create({
      recipient: studentId,
      type: "message",
      title: "New message from supervisor",
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
      meta: { recipientId: studentId },
    });

    const populated = await Message.findById(message._id)
      .populate("sender", "name email role")
      .populate("recipient", "name email role");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to send message" });
  }
};
