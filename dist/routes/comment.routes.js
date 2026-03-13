"use strict";
// src/routes/comment.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const comment_controller_1 = require("../controllers/comment.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ── Single comment ────────────────────────────────────────────────────────────
router.get("/:commentId", auth_middleware_1.authMiddleware, comment_controller_1.getCommentById);
router.put("/:commentId", auth_middleware_1.authMiddleware, comment_controller_1.updateComment);
router.delete("/:commentId", auth_middleware_1.authMiddleware, comment_controller_1.deleteComment);
// ── Replies ───────────────────────────────────────────────────────────────────
router.get("/:commentId/replies", auth_middleware_1.authMiddleware, comment_controller_1.getCommentReplies);
// ── Like / Unlike ─────────────────────────────────────────────────────────────
router.post("/:commentId/like", auth_middleware_1.authMiddleware, comment_controller_1.likeComment);
router.delete("/:commentId/like", auth_middleware_1.authMiddleware, comment_controller_1.unlikeComment);
exports.default = router;
