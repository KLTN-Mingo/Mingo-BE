"use strict";
// src/routes/media.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const media_controller_1 = require("../controllers/media.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Tất cả routes đều cần authenticate
router.use(auth_middleware_1.authMiddleware);
// ══════════════════════════════════════════════════════════════════════════════
// SINGLE MEDIA
// ══════════════════════════════════════════════════════════════════════════════
// Lấy chi tiết media
router.get("/:mediaId", media_controller_1.getMediaById);
// Cập nhật media
router.put("/:mediaId", media_controller_1.updateMedia);
// Xóa media
router.delete("/:mediaId", media_controller_1.deleteMedia);
// ══════════════════════════════════════════════════════════════════════════════
// LIKE / UNLIKE
// ══════════════════════════════════════════════════════════════════════════════
// Like media
router.post("/:mediaId/like", media_controller_1.likeMedia);
// Unlike media
router.delete("/:mediaId/like", media_controller_1.unlikeMedia);
// Lấy danh sách người đã like
router.get("/:mediaId/likes", media_controller_1.getMediaLikes);
// ══════════════════════════════════════════════════════════════════════════════
// COMMENTS
// ══════════════════════════════════════════════════════════════════════════════
// Lấy comments của media
router.get("/:mediaId/comments", media_controller_1.getMediaComments);
// Tạo comment cho media
router.post("/:mediaId/comments", media_controller_1.createMediaComment);
// Lấy replies của comment
router.get("/:mediaId/comments/:commentId/replies", media_controller_1.getMediaCommentReplies);
// Tạo reply cho comment
router.post("/:mediaId/comments/:commentId/replies", media_controller_1.createMediaCommentReply);
// ══════════════════════════════════════════════════════════════════════════════
// SHARE
// ══════════════════════════════════════════════════════════════════════════════
// Share media
router.post("/:mediaId/share", media_controller_1.shareMedia);
// Lấy danh sách người đã share
router.get("/:mediaId/shares", media_controller_1.getMediaShares);
exports.default = router;
