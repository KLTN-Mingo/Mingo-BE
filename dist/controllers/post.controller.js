"use strict";
// src/controllers/post.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlikePost = exports.likePost = exports.deletePost = exports.updatePost = exports.createPost = exports.getPostById = exports.getPostStats = exports.getFeedPosts = exports.getTrendingPosts = exports.getAllPosts = void 0;
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../errors");
const response_1 = require("../utils/response");
const post_model_1 = require("../models/post.model");
const post_service_1 = require("../services/post.service");
// ─── Helper ───────────────────────────────────────────────────────────────────
function validateVisibility(visibility) {
    if (!Object.values(post_model_1.PostVisibility).includes(visibility)) {
        throw new errors_1.ValidationError(`Chế độ hiển thị không hợp lệ. Các giá trị hợp lệ: ${Object.values(post_model_1.PostVisibility).join(", ")}`, "INVALID_VISIBILITY");
    }
}
// ─── Controllers ─────────────────────────────────────────────────────────────
/**
 * @route   GET /api/posts
 * @desc    Lấy tất cả bài viết
 * @access  Private
 */
exports.getAllPosts = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const currentUserId = req.user?.userId;
    const posts = await post_service_1.PostService.getAllPosts(currentUserId);
    (0, response_1.sendSuccess)(res, posts);
});
/**
 * @route   GET /api/posts/trending
 * @desc    Lấy top 10 bài viết trending
 * @access  Public
 */
exports.getTrendingPosts = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const currentUserId = req.user?.userId;
    const posts = await post_service_1.PostService.getTrendingPosts(currentUserId);
    (0, response_1.sendSuccess)(res, posts);
});
/**
 * @route   GET /api/posts/feed
 * @desc    Lấy feed bài viết của user hiện tại (từ những người đang follow)
 * @access  Private
 */
exports.getFeedPosts = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { page: pageStr, limit: limitStr } = req.query;
    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 10;
    if (page < 1)
        throw new errors_1.ValidationError("Số trang phải lớn hơn 0");
    if (limit < 1 || limit > 50)
        throw new errors_1.ValidationError("Limit phải từ 1 đến 50");
    const result = await post_service_1.PostService.getFeedPosts(userId, page, limit);
    (0, response_1.sendPaginated)(res, result.posts, result.pagination);
});
/**
 * @route   GET /api/posts/stats/count
 * @desc    Đếm tổng số bài viết
 * @access  Private + Admin
 */
exports.getPostStats = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const [total, today] = await Promise.all([
        post_service_1.PostService.countPosts(),
        post_service_1.PostService.countPostsToday(),
    ]);
    (0, response_1.sendSuccess)(res, { total, today });
});
/**
 * @route   GET /api/posts/:id
 * @desc    Lấy chi tiết bài viết theo ID
 * @access  Private
 */
exports.getPostById = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user?.userId;
    const post = await post_service_1.PostService.getPostById(id, currentUserId);
    (0, response_1.sendSuccess)(res, post);
});
/**
 * @route   POST /api/posts
 * @desc    Tạo bài viết mới
 * @access  Private
 */
exports.createPost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { contentText, visibility = post_model_1.PostVisibility.PUBLIC, mediaFiles = [], hashtags = [], mentions = [], locationName, locationLatitude, locationLongitude, } = req.body;
    // Validation
    if (!contentText?.trim() && mediaFiles.length === 0) {
        throw new errors_1.ValidationError("Bài viết phải có nội dung hoặc ít nhất một file media", "EMPTY_POST");
    }
    if (contentText && contentText.length > 10000) {
        throw new errors_1.ValidationError("Nội dung bài viết không được vượt quá 10000 ký tự");
    }
    validateVisibility(visibility);
    if (mediaFiles.length > 10) {
        throw new errors_1.ValidationError("Mỗi bài viết chỉ được đính kèm tối đa 10 file media");
    }
    if (hashtags.length > 30) {
        throw new errors_1.ValidationError("Mỗi bài viết chỉ được có tối đa 30 hashtag");
    }
    if (mentions.length > 50) {
        throw new errors_1.ValidationError("Mỗi bài viết chỉ được tag tối đa 50 người");
    }
    const post = await post_service_1.PostService.createPost(userId, {
        contentText,
        visibility,
        mediaFiles,
        hashtags,
        mentions,
        locationName,
        locationLatitude,
        locationLongitude,
    });
    (0, response_1.sendSuccess)(res, post, "Tạo bài viết thành công", 201);
});
/**
 * @route   PUT /api/posts/:id
 * @desc    Cập nhật bài viết (chỉ chủ bài viết)
 * @access  Private
 */
exports.updatePost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { contentText, visibility } = req.body;
    if (!contentText && !visibility) {
        throw new errors_1.ValidationError("Cần có ít nhất một trường để cập nhật");
    }
    if (contentText !== undefined) {
        if (contentText.trim().length === 0) {
            throw new errors_1.ValidationError("Nội dung bài viết không được để trống");
        }
        if (contentText.length > 10000) {
            throw new errors_1.ValidationError("Nội dung bài viết không được vượt quá 10000 ký tự");
        }
    }
    if (visibility !== undefined) {
        validateVisibility(visibility);
    }
    const post = await post_service_1.PostService.updatePost(id, userId, {
        contentText,
        visibility,
    });
    (0, response_1.sendSuccess)(res, post, "Cập nhật bài viết thành công");
});
/**
 * @route   DELETE /api/posts/:id
 * @desc    Xóa bài viết (chủ bài viết hoặc admin)
 * @access  Private
 */
exports.deletePost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    const isAdmin = currentUser?.role === "admin";
    await post_service_1.PostService.deletePost(id, currentUser.userId, isAdmin);
    (0, response_1.sendSuccess)(res, null, "Xóa bài viết thành công");
});
/**
 * @route   POST /api/posts/:id/like
 * @desc    Like bài viết
 * @access  Private
 */
exports.likePost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    await post_service_1.PostService.likePost(id, userId);
    (0, response_1.sendSuccess)(res, null, "Đã thích bài viết");
});
/**
 * @route   DELETE /api/posts/:id/like
 * @desc    Bỏ like bài viết
 * @access  Private
 */
exports.unlikePost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    await post_service_1.PostService.unlikePost(id, userId);
    (0, response_1.sendSuccess)(res, null, "Đã bỏ thích bài viết");
});
