
import express from "express";
import {
  getExaminerDisputes,
  updateDispute,
} from "../controllers/dispute.controller.js";
import {
  protect,
  authorize,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, authorize("EXAMINER"));

router.get("/", getExaminerDisputes);
router.patch("/:disputeId", updateDispute);

export default router;
