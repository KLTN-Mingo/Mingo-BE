"use strict";
// src/controllers/comment.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlikeComment = exports.likeComment = exports.deleteComment = exports.updateComment = exports.getCommentReplies = exports.getCommentById = exports.createReply = exports.createComment = exports.getPostComments = void 0;
const async_handler_1 = require("../utils/async-handler");
const response_1 = require("../utils/response");
const errors_1 = require("../errors");
const comment_service_1 = require("../services/comment.service");
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
// POST COMMENTS
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/posts/:postId/comments
 * @desc    Lấy comments cấp 1 của một post
 * @access  Private
 */
exports.getPostComments = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const postId = getParam(req.params.postId);
    const currentUserId = getOptionalUserId(req);
    const { page = "1", limit = "20" } = req.query;
    const result = await comment_service_1.CommentService.getPostComments(postId, parseInt(page), parseInt(limit), currentUserId);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách comments thành công");
});
/**
 * @route   POST /api/posts/:postId/comments
 * @desc    Tạo comment mới cho post
 * @access  Private
 */
exports.createComment = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const postId = getParam(req.params.postId);
    const userId = getUserId(req);
    const { contentText } = req.body;
    const result = await comment_service_1.CommentService.createComment(postId, userId, {
        contentText,
    });
    (0, response_1.sendCreated)(res, result, "Tạo comment thành công");
});
/**
 * @route   POST /api/posts/:postId/comments/:commentId/replies
 * @desc    Tạo reply cho comment
 * @access  Private
 */
exports.createReply = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const postId = getParam(req.params.postId);
    const parentCommentId = getParam(req.params.commentId);
    const userId = getUserId(req);
    const { contentText, originalCommentId } = req.body;
    const result = await comment_service_1.CommentService.createReply(postId, userId, {
        parentCommentId,
        contentText,
        originalCommentId: originalCommentId || parentCommentId,
    });
    (0, response_1.sendCreated)(res, result, "Tạo reply thành công");
});
// ══════════════════════════════════════════════════════════════════════════════
// SINGLE COMMENT
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   GET /api/comments/:commentId
 * @desc    Lấy chi tiết comment
 * @access  Private
 */
exports.getCommentById = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const commentId = getParam(req.params.commentId);
    const currentUserId = getOptionalUserId(req);
    const result = await comment_service_1.CommentService.getCommentById(commentId, currentUserId);
    (0, response_1.sendSuccess)(res, result, "Lấy comment thành công");
});
/**
 * @route   GET /api/comments/:commentId/replies
 * @desc    Lấy replies của comment
 * @access  Private
 */
exports.getCommentReplies = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const commentId = getParam(req.params.commentId);
    const currentUserId = getOptionalUserId(req);
    const { page = "1", limit = "20" } = req.query;
    const result = await comment_service_1.CommentService.getCommentReplies(commentId, parseInt(page), parseInt(limit), currentUserId);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách replies thành công");
});
/**
 * @route   PUT /api/comments/:commentId
 * @desc    Cập nhật comment
 * @access  Private (owner only)
 */
exports.updateComment = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const commentId = getParam(req.params.commentId);
    const userId = getUserId(req);
    const { contentText } = req.body;
    const result = await comment_service_1.CommentService.updateComment(commentId, userId, {
        contentText,
    });
    (0, response_1.sendSuccess)(res, result, "Cập nhật comment thành công");
});
/**
 * @route   DELETE /api/comments/:commentId
 * @desc    Xóa comment
 * @access  Private (owner only)
 */
exports.deleteComment = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const commentId = getParam(req.params.commentId);
    const userId = getUserId(req);
    await comment_service_1.CommentService.deleteComment(commentId, userId);
    (0, response_1.sendSuccess)(res, null, "Xóa comment thành công");
});
// ══════════════════════════════════════════════════════════════════════════════
// LIKE / UNLIKE
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   POST /api/comments/:commentId/like
 * @desc    Like comment
 * @access  Private
 */
exports.likeComment = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const commentId = getParam(req.params.commentId);
    const userId = getUserId(req);
    await comment_service_1.CommentService.likeComment(commentId, userId);
    (0, response_1.sendSuccess)(res, null, "Like comment thành công");
});
/**
 * @route   DELETE /api/comments/:commentId/like
 * @desc    Unlike comment
 * @access  Private
 */
exports.unlikeComment = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const commentId = getParam(req.params.commentId);
    const userId = getUserId(req);
    await comment_service_1.CommentService.unlikeComment(commentId, userId);
    (0, response_1.sendSuccess)(res, null, "Unlike comment thành công");
});
