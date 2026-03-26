"use strict";
// src/routes/post.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const post_controller_1 = require("../controllers/post.controller");
const comment_controller_1 = require("../controllers/comment.controller");
const media_controller_1 = require("../controllers/media.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── Special routes (trước :id để tránh conflict) ──────────────────────────────
router.get("/trending", post_controller_1.getTrendingPosts);
router.get("/feed", auth_middleware_1.authMiddleware, post_controller_1.getFeedPosts);
router.post("/feed/feedback", auth_middleware_1.authMiddleware, post_controller_1.submitFeedFeedback);
router.get("/feed/metrics", auth_middleware_1.authMiddleware, post_controller_1.getFeedMetrics);
router.get("/stats/count", auth_middleware_1.authMiddleware, post_controller_1.getPostStats);
// ── Post CRUD ─────────────────────────────────────────────────────────────────
router.get("/", auth_middleware_1.authMiddleware, post_controller_1.getAllPosts);
router.post("/", auth_middleware_1.authMiddleware, post_controller_1.createPost);
router.get("/:id", auth_middleware_1.authMiddleware, post_controller_1.getPostById);
router.put("/:id", auth_middleware_1.authMiddleware, post_controller_1.updatePost);
router.delete("/:id", auth_middleware_1.authMiddleware, post_controller_1.deletePost);
// ── Like / Unlike post ────────────────────────────────────────────────────────
router.post("/:id/like", auth_middleware_1.authMiddleware, post_controller_1.likePost);
router.delete("/:id/like", auth_middleware_1.authMiddleware, post_controller_1.unlikePost);
// ── Comments của post ─────────────────────────────────────────────────────────
router.get("/:postId/comments", auth_middleware_1.authMiddleware, comment_controller_1.getPostComments);
router.post("/:postId/comments", auth_middleware_1.authMiddleware, comment_controller_1.createComment);
router.post("/:postId/comments/:commentId/replies", auth_middleware_1.authMiddleware, comment_controller_1.createReply);
// ── Media của post ────────────────────────────────────────────────────────────
router.get("/:postId/media", auth_middleware_1.authMiddleware, media_controller_1.getPostMedia);
router.post("/:postId/media", auth_middleware_1.authMiddleware, media_controller_1.createMedia);
exports.default = router;
