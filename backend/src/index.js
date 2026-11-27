
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import examinerRoutes from "./routes/examiner.routes.js";

import examRoutes from "./routes/exam.routes.js";

import questionCategoryRoutes from "./routes/question-category.routes.js";

import questionRoutes from "./routes/question.routes.js";

import candidateRoutes from "./routes/candidate.routes.js";

import attemptRoutes from "./routes/attempt.routes.js";

import disputeRoutes from "./routes/dispute.routes.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ExamFlow API is running.",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/examiner", examinerRoutes);
app.use("/api/examiner/exams", examRoutes);
app.use("/api/examiner/question-categories", questionCategoryRoutes);
app.use("/api/examiner/questions", questionRoutes);
app.use("/api/examiner/candidates", candidateRoutes);
app.use("/api/examiner", attemptRoutes);
app.use("/api/examiner/disputes", disputeRoutes);

// Start server
app.listen(port, () => {
  console.log(`ExamFlow API running on http://localhost:${port}`);
});
