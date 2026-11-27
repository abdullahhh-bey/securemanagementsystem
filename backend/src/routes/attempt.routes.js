
import express from "express";
import {
  getExamAttempts,
  getAttemptById,
  getAttemptEvents,
} from "../controllers/attempt.controller.js";
import {
  protect,
  authorize,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, authorize("EXAMINER"));

router.get("/exams/:examId/attempts", getExamAttempts);
router.get("/exams/:examId/attempts/:attemptId", getAttemptById);
router.get(
  "/exams/:examId/attempts/:attemptId/events",
  getAttemptEvents
);

export default router;
