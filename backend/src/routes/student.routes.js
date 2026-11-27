
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

import { reportAttemptEvent } from "../controllers/candidate-event.controller.js";
import {
  getCandidatePreferences,
  updateCandidatePreferences,
  getAttemptScratchpad,
  saveAttemptScratchpad,
} from "../controllers/candidate-workspace.controller.js";

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
router.get("/attempts/:attemptId/scratchpad", getAttemptScratchpad);
router.put("/attempts/:attemptId/scratchpad", saveAttemptScratchpad);
router.post("/attempts/:attemptId/submit", submitCandidateAttempt);
router.post("/attempts/:attemptId/events", reportAttemptEvent);
router.get("/preferences", getCandidatePreferences);
router.patch("/preferences", updateCandidatePreferences);

// Published results
router.get("/results", getCandidateResults);
router.get("/announcements", getCandidateAnnouncements);

// Result disputes
router.post("/results/:resultId/disputes", createCandidateDispute);
router.get("/disputes", getCandidateDisputes);

export default router;
