
import express from "express";

import {
  protect,
  authorize,
} from "../middleware/auth.middleware.js";

import {
  getCandidateExams,
  getCandidateExam,
  startCandidateAttempt,
  getCandidateAttemptWorkspace,
  saveCandidateAnswer,
  submitCandidateAttempt,
  getCandidateResults,
  getCandidateAnnouncements,
  createCandidateDispute,
  getCandidateDisputes,
} from "../controllers/candidate.controller.js";

const router = express.Router();

router.use(protect, authorize("CANDIDATE"));

router.get("/exams", getCandidateExams);
router.get("/exams/:id", getCandidateExam);
router.post("/exams/:examId/attempts", startCandidateAttempt);
router.get(
  "/attempts/:attemptId/workspace",
  getCandidateAttemptWorkspace
);
router.put(
  "/attempts/:attemptId/questions/:attemptQuestionId/answer",
  saveCandidateAnswer
);
router.post("/attempts/:attemptId/submit", submitCandidateAttempt);

// Published results
router.get("/results", getCandidateResults);
router.get("/announcements", getCandidateAnnouncements);

// Result disputes
router.post("/results/:resultId/disputes", createCandidateDispute);
router.get("/disputes", getCandidateDisputes);

export default router;
