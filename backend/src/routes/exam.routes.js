
import express from "express";

import {
  getExamResults,
  publishExamResults,
} from "../controllers/result.controller.js";
import { getQuestionAnalytics } from "../controllers/question-analytics.controller.js";

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

import {
  listExamAnnouncements,
  createExamAnnouncement,
} from "../controllers/announcement.controller.js";

import {
  getExamMonitor,
  listExamDisruptions,
} from "../controllers/monitor.controller.js";

import {
  listExamCompensations,
  grantAttemptCompensation,
} from "../controllers/compensation.controller.js";

import {
  getExamGradingQueue,
  saveWrittenGrade,
} from "../controllers/grading.controller.js";

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

// Automatically evaluate an exam (choice questions; written left for manual grading)
router.patch("/:examId/evaluate", evaluateExam);

// Written-answer grading queue + save
router.get("/:examId/grading", getExamGradingQueue);
router.put(
  "/:examId/attempts/:attemptId/answers/:questionId/grade",
  saveWrittenGrade
);

// Results management
router.get("/:examId/analytics/questions", getQuestionAnalytics);
router.get("/:examId/results", getExamResults);
router.patch("/:examId/results/publish", publishExamResults);

// Live monitoring aggregate (poll; not websocket presence)
router.get("/:examId/monitor", getExamMonitor);

// Connection disruption history (derived from AttemptEvent network pairs)
router.get("/:examId/disruptions", listExamDisruptions);

// Compensation audit trail + grants (extends attempt expiresAt)
router.get("/:examId/compensations", listExamCompensations);
router.post(
  "/:examId/attempts/:attemptId/compensation",
  grantAttemptCompensation
);

// Exam announcements (monitor)
router.get("/:examId/announcements", listExamAnnouncements);
router.post("/:examId/announcements", createExamAnnouncement);

export default router;