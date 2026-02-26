// src/routes/comment.routes.ts

import { Router } from "express";
import {
  getCommentById,
  getCommentReplies,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment,
} from "../controllers/comment.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// ── Single comment ────────────────────────────────────────────────────────────
router.get("/:commentId", authMiddleware, getCommentById);
router.put("/:commentId", authMiddleware, updateComment);
router.delete("/:commentId", authMiddleware, deleteComment);

// ── Replies ───────────────────────────────────────────────────────────────────
router.get("/:commentId/replies", authMiddleware, getCommentReplies);

// ── Like / Unlike ─────────────────────────────────────────────────────────────
router.post("/:commentId/like", authMiddleware, likeComment);
router.delete("/:commentId/like", authMiddleware, unlikeComment);

export default router;
