
import express from "express";
import { getExaminerDashboard } from "../controllers/examiner.controller.js";
import {
  protect,
  authorize,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Examiner dashboard
router.get(
  "/dashboard",
  protect,
  authorize("EXAMINER"),
  getExaminerDashboard
);

export default router;
