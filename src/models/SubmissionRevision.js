import mongoose from "mongoose";

const submissionRevisionSchema = new mongoose.Schema(
  {
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedRole: {
      type: String,
      enum: ["student", "supervisor", "admin"],
      required: true,
    },
    changeType: {
      type: String,
      enum: ["submit", "grade_update", "feedback_update"],
      required: true,
    },
    fileUrl: {
      type: String,
      default: "",
    },
    fileUrls: {
      type: [String],
      default: [],
    },
    marks: {
      type: Number,
      default: null,
    },
    feedback: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

submissionRevisionSchema.index({ submission: 1, version: 1 }, { unique: true });

const SubmissionRevision = mongoose.model("SubmissionRevision", submissionRevisionSchema);

export default SubmissionRevision;
