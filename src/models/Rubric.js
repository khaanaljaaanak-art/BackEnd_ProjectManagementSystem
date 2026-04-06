import mongoose from "mongoose";

const rubricCriteriaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const rubricSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      unique: true,
    },
    criteria: {
      type: [rubricCriteriaSchema],
      default: [],
    },
    totalMarks: {
      type: Number,
      default: 100,
      min: 0,
    },
  },
  { timestamps: true }
);

const Rubric = mongoose.model("Rubric", rubricSchema);

export default Rubric;
