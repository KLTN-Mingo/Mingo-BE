"use strict";
// src/controllers/media.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMediaShares = exports.shareMedia = exports.getMediaCommentReplies = exports.createMediaCommentReply = exports.createMediaComment = exports.getMediaComments = exports.getMediaLikes = exports.unlikeMedia = exports.likeMedia = exports.deleteMedia = exports.updateMedia = exports.getPostMedia = exports.getMediaById = exports.createMedia = void 0;
const async_handler_1 = require("../utils/async-handler");
const response_1 = require("../utils/response");
const errors_1 = require("../errors");
const media_service_1 = require("../services/media.service");
// Helper to get userId from request
function getUserId(req) {
    const userId = req.user?.userId;
    if (!userId) {
        throw new errors_1.ValidationError("Không tìm thấy thông tin người dùng");
    }
    return userId;
}
// Helper to get optional userId
function getOptionalUserId(req) {
    return req.user?.userId;
}
// Helper to get string param
function getParam(param) {
    if (Array.isArray(param))
        return param[0];
    return param || "";
}
// ══════════════════════════════════════════════════════════════════════════════
// CRUD
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/posts/:postId/media
 * @desc    Thêm media cho post
 * @access  Private (owner only)
 */
exports.createMedia = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const postId = getParam(req.params.postId);
    const userId = getUserId(req);
    const result = await media_service_1.MediaService.createMedia(postId, userId, req.body);
    (0, response_1.sendCreated)(res, result, "Thêm media thành công");
});
/**
 * @route   GET /api/media/:mediaId
 * @desc    Lấy chi tiết media
 * @access  Private
 */
exports.getMediaById = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const currentUserId = getOptionalUserId(req);
    const result = await media_service_1.MediaService.getMediaById(mediaId, currentUserId);
    (0, response_1.sendSuccess)(res, result, "Lấy media thành công");
});
/**
 * @route   GET /api/posts/:postId/media
 * @desc    Lấy tất cả media của post
 * @access  Private
 */
exports.getPostMedia = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const postId = getParam(req.params.postId);
    const currentUserId = getOptionalUserId(req);
    const result = await media_service_1.MediaService.getPostMedia(postId, currentUserId);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách media thành công");
});
/**
 * @route   PUT /api/media/:mediaId
 * @desc    Cập nhật media
 * @access  Private (owner only)
 */
exports.updateMedia = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const userId = getUserId(req);
    const result = await media_service_1.MediaService.updateMedia(mediaId, userId, req.body);
    (0, response_1.sendSuccess)(res, result, "Cập nhật media thành công");
});
/**
 * @route   DELETE /api/media/:mediaId
 * @desc    Xóa media
 * @access  Private (owner only)
 */
exports.deleteMedia = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const userId = getUserId(req);
    await media_service_1.MediaService.deleteMedia(mediaId, userId);
    (0, response_1.sendSuccess)(res, null, "Xóa media thành công");
});
// ══════════════════════════════════════════════════════════════════════════════
// LIKE / UNLIKE
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/media/:mediaId/like
 * @desc    Like media
 * @access  Private
 */
exports.likeMedia = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const userId = getUserId(req);
    await media_service_1.MediaService.likeMedia(mediaId, userId);
    (0, response_1.sendSuccess)(res, null, "Like media thành công");
});
/**
 * @route   DELETE /api/media/:mediaId/like
 * @desc    Unlike media
 * @access  Private
 */
exports.unlikeMedia = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const userId = getUserId(req);
    await media_service_1.MediaService.unlikeMedia(mediaId, userId);
    (0, response_1.sendSuccess)(res, null, "Unlike media thành công");
});
/**
 * @route   GET /api/media/:mediaId/likes
 * @desc    Lấy danh sách người đã like media
 * @access  Private
 */
exports.getMediaLikes = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const { page = "1", limit = "20" } = req.query;
    const result = await media_service_1.MediaService.getMediaLikes(mediaId, parseInt(page), parseInt(limit));
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách likes thành công");
});
// ══════════════════════════════════════════════════════════════════════════════
// COMMENTS
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/media/:mediaId/comments
 * @desc    Lấy comments của media
 * @access  Private
 */
exports.getMediaComments = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const currentUserId = getOptionalUserId(req);
    const { page = "1", limit = "20" } = req.query;
    const result = await media_service_1.MediaService.getMediaComments(mediaId, parseInt(page), parseInt(limit), currentUserId);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách comments thành công");
});
/**
 * @route   POST /api/media/:mediaId/comments
 * @desc    Tạo comment cho media
 * @access  Private
 */
exports.createMediaComment = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const userId = getUserId(req);
    const { contentText } = req.body;
    const result = await media_service_1.MediaService.createMediaComment(mediaId, userId, contentText);
    (0, response_1.sendCreated)(res, result, "Tạo comment thành công");
});
/**
 * @route   POST /api/media/:mediaId/comments/:commentId/replies
 * @desc    Tạo reply cho comment trên media
 * @access  Private
 */
exports.createMediaCommentReply = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const parentCommentId = getParam(req.params.commentId);
    const userId = getUserId(req);
    const { contentText, originalCommentId } = req.body;
    const result = await media_service_1.MediaService.createMediaCommentReply(mediaId, userId, parentCommentId, originalCommentId || parentCommentId, contentText);
    (0, response_1.sendCreated)(res, result, "Tạo reply thành công");
});
/**
 * @route   GET /api/media/:mediaId/comments/:commentId/replies
 * @desc    Lấy replies của comment trên media
 * @access  Private
 */
exports.getMediaCommentReplies = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const commentId = getParam(req.params.commentId);
    const currentUserId = getOptionalUserId(req);
    const { page = "1", limit = "20" } = req.query;
    const result = await media_service_1.MediaService.getMediaCommentReplies(commentId, parseInt(page), parseInt(limit), currentUserId);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách replies thành công");
});
// ══════════════════════════════════════════════════════════════════════════════
// SHARE
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/media/:mediaId/share
 * @desc    Share media
 * @access  Private
 */
exports.shareMedia = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const userId = getUserId(req);
    const { caption } = req.body;
    await media_service_1.MediaService.shareMedia(mediaId, userId, caption);
    (0, response_1.sendSuccess)(res, null, "Share media thành công");
});
/**
 * @route   GET /api/media/:mediaId/shares
 * @desc    Lấy danh sách người đã share media
 * @access  Private
 */
exports.getMediaShares = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const mediaId = getParam(req.params.mediaId);
    const { page = "1", limit = "20" } = req.query;
    const result = await media_service_1.MediaService.getMediaShares(mediaId, parseInt(page), parseInt(limit));
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách shares thành công");
});
