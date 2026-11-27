
import "dotenv/config";
import bcrypt from "bcryptjs";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

import prisma from "../db/db.js";
import { protect, authorize } from "./middleware/auth.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import { createAdminRouter } from "./routes/admin.routes.js";
import examinerRoutes from "./routes/examiner.routes.js";

import examRoutes from "./routes/exam.routes.js";

import questionCategoryRoutes from "./routes/question-category.routes.js";

import questionRoutes from "./routes/question.routes.js";

import candidateRoutes from "./routes/candidate.routes.js";

import attemptRoutes from "./routes/attempt.routes.js";

import disputeRoutes from "./routes/dispute.routes.js";

import studentRoutes from "./routes/student.routes.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const frontendDistPath = fileURLToPath(
  new URL("../../frontend/dist/", import.meta.url),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ExamFlow API is running.",
  });
});

const adminRoutes = createAdminRouter({
  prisma,
  authenticate: protect,
  requireAdmin: authorize("ADMIN"),
  getActorId: (req) => req.user?.id,
  hashPassword: (password) => bcrypt.hash(password, 12),
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/examiner", examinerRoutes);
app.use("/api/examiner/exams", examRoutes);
app.use("/api/examiner/question-categories", questionCategoryRoutes);
app.use("/api/examiner/questions", questionRoutes);
app.use("/api/examiner/candidates", candidateRoutes);
app.use("/api/examiner", attemptRoutes);
app.use("/api/examiner/disputes", disputeRoutes);
app.use("/api/candidate", studentRoutes);

// Serve the frontend and support client-side routes in production.
app.use(express.static(frontendDistPath));
app.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(frontendDistPath, "index.html"));
});

// Start server
app.listen(port, () => {
  console.log(`ExamFlow running on port ${port}`);
});
