// src/routes/culture.routes.ts
import { Router } from "express";
import {
  getPostCultureTerms,
  reAnalyzePost,
  reportTerm,
  getDictionary,
  addSlangEntry,
  toggleSlangEntry,
} from "../controllers/culture.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminMiddleware } from "../middleware/admin.middleware";

const router = Router();

// User routes
router.get("/posts/:postId/culture-terms", authMiddleware, getPostCultureTerms);
router.post("/posts/:postId/reanalyze", authMiddleware, reAnalyzePost);
router.post("/posts/:postId/report-term", authMiddleware, reportTerm);

// Admin routes
router.get("/admin/slang-dictionary", adminMiddleware, getDictionary);
router.post("/admin/slang-dictionary", adminMiddleware, addSlangEntry);
router.patch(
  "/admin/slang-dictionary/:id/toggle",
  adminMiddleware,
  toggleSlangEntry
);

export default router;
