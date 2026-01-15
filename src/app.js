import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";

dotenv.config({ path: path.resolve("../.env") });

const app = express();
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static(path.resolve("uploads")));

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// Express 5 + path-to-regexp v6 doesn't accept "*" as a path pattern.
app.options(/.*/, cors(corsOptions));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/submissions", submissionRoutes);

const PORT = process.env.PORT || 5000;

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Check your .env file.");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB Atlas connected");
};

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

start();
