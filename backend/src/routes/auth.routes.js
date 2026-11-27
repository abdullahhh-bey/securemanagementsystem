
import express from "express";
import {
  login,
  logout,
  getMe,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Login
router.post("/login", login);

// Logout
router.post("/logout", logout);

// Get currently authenticated user
router.get("/me", protect, getMe);

export default router;
