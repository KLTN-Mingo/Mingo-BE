// src/routes/post.routes.ts

import { Router } from "express";
import {
  getAllPosts,
  getTrendingPosts,
  getFeedPosts,
  submitFeedFeedback,
  getFeedMetrics,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  getPostStats,
  getSavedPosts,
  savePost,
  unsavePost,
  sharePost,
} from "../controllers/post.controller";
import {
  getPostComments,
  createComment,
  createReply,
} from "../controllers/comment.controller";
import { createMedia, getPostMedia } from "../controllers/media.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// ── Special routes (trước :id để tránh conflict) ──────────────────────────────
router.get("/trending", getTrendingPosts);
router.get("/feed", authMiddleware, getFeedPosts);
router.post("/feed/feedback", authMiddleware, submitFeedFeedback);
router.get("/feed/metrics", authMiddleware, getFeedMetrics);
router.get("/stats/count", authMiddleware, getPostStats);

// ── Post CRUD ─────────────────────────────────────────────────────────────────
router.get("/", authMiddleware, getAllPosts);
router.post("/", authMiddleware, createPost);
router.get("/:id", authMiddleware, getPostById);
router.put("/:id", authMiddleware, updatePost);
router.delete("/:id", authMiddleware, deletePost);

// ── Like / Unlike post ────────────────────────────────────────────────────────
router.post("/:id/like", authMiddleware, likePost);
router.delete("/:id/like", authMiddleware, unlikePost);

router.post("/:id/save", authMiddleware, savePost);
router.delete("/:id/save", authMiddleware, unsavePost);
router.post("/:id/share", authMiddleware, sharePost);

// ── Comments của post ─────────────────────────────────────────────────────────
router.get("/:postId/comments", authMiddleware, getPostComments);
router.post("/:postId/comments", authMiddleware, createComment);
router.post(
  "/:postId/comments/:commentId/replies",
  authMiddleware,
  createReply
);

// ── Media của post ────────────────────────────────────────────────────────────
router.get("/:postId/media", authMiddleware, getPostMedia);
router.post("/:postId/media", authMiddleware, createMedia);

export default router;
