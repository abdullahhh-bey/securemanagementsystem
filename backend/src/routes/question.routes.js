
import express from "express";
import {
  createQuestion,
  getQuestions,
  getQuestionById,
  createQuestionVersion,
  deleteQuestion,
} from "../controllers/question.controller.js";
import {
  protect,
  authorize,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, authorize("EXAMINER"));

router.post("/", createQuestion);
router.get("/", getQuestions);
router.get("/:questionId", getQuestionById);
router.post("/:questionId/versions", createQuestionVersion);
router.delete("/:questionId", deleteQuestion);

export default router;
