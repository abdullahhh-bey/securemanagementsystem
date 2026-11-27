import express from "express";
import { getCandidates } from "../controllers/enrollment.controller.js";
import { protect, authorize } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, authorize("EXAMINER"));

router.get("/", getCandidates);

export default router;