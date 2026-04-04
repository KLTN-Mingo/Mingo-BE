"use strict";
// src/controllers/post.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharePost = exports.unsavePost = exports.savePost = exports.getSavedPosts = exports.unlikePost = exports.likePost = exports.deletePost = exports.updatePost = exports.createPost = exports.getPostById = exports.getPostStats = exports.getFeedMetrics = exports.submitFeedFeedback = exports.getFeedPosts = exports.getTrendingPosts = exports.getAllPosts = void 0;
const mongoose_1 = require("mongoose");
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../errors");
const response_1 = require("../utils/response");
const post_model_1 = require("../models/post.model");
const post_service_1 = require("../services/post.service");
const interaction_tracker_service_1 = require("../services/interaction-tracker.service");
const user_interaction_model_1 = require("../models/user-interaction.model");
const feed_analytics_service_1 = require("../services/feed-analytics.service");
// ─── Helper ───────────────────────────────────────────────────────────────────
function validateVisibility(visibility) {
    if (!Object.values(post_model_1.PostVisibility).includes(visibility)) {
        throw new errors_1.ValidationError(`Chế độ hiển thị không hợp lệ. Các giá trị hợp lệ: ${Object.values(post_model_1.PostVisibility).join(", ")}`, "INVALID_VISIBILITY");
    }
}
function trackPostInteractionSafely(payload) {
    void interaction_tracker_service_1.interactionTrackerService.track(payload).catch((err) => {
        console.error("[PostController] track interaction error:", err);
    });
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
 * @query   tab=friends | explore (mặc định: explore)
 * @desc    Tab "friends": bài từ bạn bè/bạn thân (người đang follow), sort mới nhất. Tab "explore": feed khám phá đề xuất cá nhân hóa.
 * @access  Private
 */
exports.getFeedPosts = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { page: pageStr, limit: limitStr, tab: tabStr, } = req.query;
    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 10;
    const tab = tabStr === "friends" ? "friends" : "explore";
    if (page < 1)
        throw new errors_1.ValidationError("Số trang phải lớn hơn 0");
    if (limit < 1 || limit > 50)
        throw new errors_1.ValidationError("Limit phải từ 1 đến 50");
    const result = await post_service_1.PostService.getFeedPosts(userId, page, limit, tab);
    (0, response_1.sendPaginated)(res, result.posts, result.pagination);
});
/**
 * @route   POST /api/posts/feed/feedback
 * @desc    Nhận feedback để điều chỉnh profile recommendation
 * @access  Private
 */
exports.submitFeedFeedback = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { postId, feedbackType, tab } = req.body;
    if (!postId || !feedbackType) {
        throw new errors_1.ValidationError("postId và feedbackType là bắt buộc");
    }
    if (!mongoose_1.Types.ObjectId.isValid(postId)) {
        throw new errors_1.ValidationError("postId không hợp lệ", "INVALID_POST_ID");
    }
    const feedbackToInteraction = {
        hide: user_interaction_model_1.InteractionType.HIDE,
        not_interested: user_interaction_model_1.InteractionType.NOT_INTERESTED,
        see_more: user_interaction_model_1.InteractionType.SEE_MORE,
    };
    const interactionType = feedbackToInteraction[feedbackType];
    if (!interactionType) {
        throw new errors_1.ValidationError("feedbackType không hợp lệ. Chỉ chấp nhận: hide, not_interested, see_more", "INVALID_FEEDBACK_TYPE");
    }
    const source = tab === "friends" ? user_interaction_model_1.InteractionSource.FEED : user_interaction_model_1.InteractionSource.EXPLORE;
    const payload = {
        userId,
        postId,
        type: interactionType,
        source,
    };
    await interaction_tracker_service_1.interactionTrackerService.track(payload);
    (0, response_1.sendSuccess)(res, { postId, feedbackType, source }, "Đã ghi nhận phản hồi feed");
});
/**
 * @route   GET /api/posts/feed/metrics
 * @query   days=7&tab=friends|explore
 * @desc    Tổng hợp CTR/engagement cho feed recommendation
 * @access  Private
 */
exports.getFeedMetrics = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { days: daysStr, tab: tabStr } = req.query;
    const days = daysStr ? Number.parseInt(daysStr, 10) : 7;
    if (Number.isNaN(days) || days < 1 || days > 90) {
        throw new errors_1.ValidationError("days phải nằm trong khoảng 1 đến 90");
    }
    const tab = tabStr === "friends" || tabStr === "explore" ? tabStr : undefined;
    const metrics = await feed_analytics_service_1.feedAnalyticsService.getMetrics(days, tab);
    (0, response_1.sendSuccess)(res, metrics);
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
    if (currentUserId) {
        trackPostInteractionSafely({
            userId: currentUserId,
            postId: id,
            type: user_interaction_model_1.InteractionType.VIEW,
            source: user_interaction_model_1.InteractionSource.PROFILE,
        });
    }
    (0, response_1.sendSuccess)(res, post);
});
/**
 * @route   POST /api/posts
 * @desc    Tạo bài viết mới
 * @access  Private
 */
exports.createPost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { contentText, contentRichText, visibility = post_model_1.PostVisibility.PUBLIC, mediaFiles = [], hashtags = [], mentions = [], locationName, locationLatitude, locationLongitude, } = req.body;
    // Validation
    if (!contentText?.trim() && mediaFiles.length === 0) {
        throw new errors_1.ValidationError("Bài viết phải có nội dung hoặc ít nhất một file media", "EMPTY_POST");
    }
    if (contentText && contentText.length > 10000) {
        throw new errors_1.ValidationError("Nội dung bài viết không được vượt quá 10000 ký tự");
    }
    if (contentRichText && contentRichText.length > 50000) {
        throw new errors_1.ValidationError("Rich text không được vượt quá 50000 ký tự");
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
    const { contentText, contentRichText, visibility } = req.body;
    if (!contentText && !visibility && contentRichText === undefined) {
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
    if (contentRichText !== undefined && contentRichText.length > 50000) {
        throw new errors_1.ValidationError("Rich text không được vượt quá 50000 ký tự");
    }
    if (visibility !== undefined) {
        validateVisibility(visibility);
    }
    const post = await post_service_1.PostService.updatePost(id, userId, {
        contentText,
        contentRichText,
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
    trackPostInteractionSafely({
        userId,
        postId: id,
        type: user_interaction_model_1.InteractionType.LIKE,
        source: user_interaction_model_1.InteractionSource.PROFILE,
    });
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
/**
 * @route   GET /api/posts/saved
 */
exports.getSavedPosts = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const page = parseInt(req.query.page || "1", 10) || 1;
    const limit = Math.min(50, parseInt(req.query.limit || "20", 10) || 20);
    if (page < 1)
        throw new errors_1.ValidationError("Số trang phải lớn hơn 0");
    const result = await post_service_1.PostService.getSavedPosts(userId, page, limit);
    (0, response_1.sendPaginated)(res, result.posts, result.pagination);
});
/**
 * @route   POST /api/posts/:id/save
 */
exports.savePost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { collectionName } = req.body;
    await post_service_1.PostService.savePost(id, userId, collectionName);
    trackPostInteractionSafely({
        userId,
        postId: id,
        type: user_interaction_model_1.InteractionType.SAVE,
        source: user_interaction_model_1.InteractionSource.PROFILE,
    });
    (0, response_1.sendSuccess)(res, null, "Đã lưu bài viết");
});
/**
 * @route   DELETE /api/posts/:id/save
 */
exports.unsavePost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    await post_service_1.PostService.unsavePost(id, userId);
    (0, response_1.sendSuccess)(res, null, "Đã bỏ lưu bài viết");
});
/**
 * @route   POST /api/posts/:id/share
 */
exports.sharePost = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    const { sharedTo = "feed", caption } = req.body;
    const allowed = ["feed", "message", "external"];
    if (!allowed.includes(sharedTo)) {
        throw new errors_1.ValidationError("sharedTo phải là feed, message hoặc external");
    }
    await post_service_1.PostService.sharePost(id, userId, sharedTo, caption);
    trackPostInteractionSafely({
        userId,
        postId: id,
        type: user_interaction_model_1.InteractionType.SHARE,
        source: user_interaction_model_1.InteractionSource.PROFILE,
    });
    (0, response_1.sendSuccess)(res, null, "Đã chia sẻ bài viết");
});
