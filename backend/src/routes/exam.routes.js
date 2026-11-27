
import express from "express";

import {
  getExamResults,
  publishExamResults,
} from "../controllers/result.controller.js";

import {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  publishExam,
} from "../controllers/exam.controller.js";

import {
  protect,
  authorize,
} from "../middleware/auth.middleware.js";

import {
  assignQuestion,
  removeQuestion,
} from "../controllers/exam-question.controller.js";

import {
  getExamEnrollments,
  enrollCandidate,
  withdrawCandidate,
} from "../controllers/enrollment.controller.js";

import { evaluateExam } from "../controllers/evaluation.controller.js";

const router = express.Router();

// Protect all examiner exam routes
router.use(protect, authorize("EXAMINER"));

// Create exam
router.post("/", createExam);

// Get all exams
router.get("/", getExams);

// Get a specific exam
router.get("/:examId", getExamById);

// Update exam
router.put("/:examId", updateExam);

// Delete exam
router.delete("/:examId", deleteExam);

// Publish exam
router.patch("/:examId/publish", publishExam);

// Assign question to exam
router.post("/:examId/questions", assignQuestion);

// Remove question from exam
router.delete(
  "/:examId/questions/:examQuestionId",
  removeQuestion
);

// Candidate enrollment
router.get("/:examId/enrollments", getExamEnrollments);
router.post("/:examId/enrollments", enrollCandidate);
router.patch(
  "/:examId/enrollments/:enrollmentId/withdraw",
  withdrawCandidate
);

// Automatically evaluate an exam
router.patch("/:examId/evaluate", evaluateExam);

// Results management
router.get("/:examId/results", getExamResults);
router.patch("/:examId/results/publish", publishExamResults);

export default router;