// src/routes/media.routes.ts

import { Router } from "express";
import {
  getMediaById,
  updateMedia,
  deleteMedia,
  likeMedia,
  unlikeMedia,
  getMediaLikes,
  getMediaComments,
  createMediaComment,
  createMediaCommentReply,
  getMediaCommentReplies,
  shareMedia,
  getMediaShares,
} from "../controllers/media.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Tất cả routes đều cần authenticate
router.use(authMiddleware);

// ══════════════════════════════════════════════════════════════════════════════
// SINGLE MEDIA
// ══════════════════════════════════════════════════════════════════════════════

// Lấy chi tiết media
router.get("/:mediaId", getMediaById);

// Cập nhật media
router.put("/:mediaId", updateMedia);

// Xóa media
router.delete("/:mediaId", deleteMedia);

// ══════════════════════════════════════════════════════════════════════════════
// LIKE / UNLIKE
// ══════════════════════════════════════════════════════════════════════════════

// Like media
router.post("/:mediaId/like", likeMedia);

// Unlike media
router.delete("/:mediaId/like", unlikeMedia);

// Lấy danh sách người đã like
router.get("/:mediaId/likes", getMediaLikes);

// ══════════════════════════════════════════════════════════════════════════════
// COMMENTS
// ══════════════════════════════════════════════════════════════════════════════

// Lấy comments của media
router.get("/:mediaId/comments", getMediaComments);

// Tạo comment cho media
router.post("/:mediaId/comments", createMediaComment);

// Lấy replies của comment
router.get("/:mediaId/comments/:commentId/replies", getMediaCommentReplies);

// Tạo reply cho comment
router.post("/:mediaId/comments/:commentId/replies", createMediaCommentReply);

// ══════════════════════════════════════════════════════════════════════════════
// SHARE
// ══════════════════════════════════════════════════════════════════════════════

// Share media
router.post("/:mediaId/share", shareMedia);

// Lấy danh sách người đã share
router.get("/:mediaId/shares", getMediaShares);

export default router;
