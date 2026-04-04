"use strict";
// src/controllers/follow.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFollowStats = exports.getRelationshipStatus = exports.getPendingCloseFriendRequests = exports.getSentFollowRequests = exports.getPendingFollowRequests = exports.getCloseFriends = exports.getFriends = exports.getFollowing = exports.getFollowers = exports.removeCloseFriend = exports.respondCloseFriendRequest = exports.sendCloseFriendRequest = exports.removeFollower = exports.unfollow = exports.cancelFollowRequest = exports.respondFollowRequest = exports.sendFollowRequest = void 0;
const async_handler_1 = require("../utils/async-handler");
const follow_service_1 = require("../services/follow.service");
const response_1 = require("../utils/response");
const errors_1 = require("../errors");
// Helper to get userId from request
function getUserId(req) {
    const userId = req.user?.userId;
    if (!userId) {
        throw new errors_1.ValidationError("Không tìm thấy thông tin người dùng");
    }
    return userId;
}
// Helper to get string param
function getParam(param) {
    if (Array.isArray(param))
        return param[0];
    return param || "";
}
// ══════════════════════════════════════════════════════════════════════════════
// FOLLOW REQUEST HANDLERS
// ══════════════════════════════════════════════════════════════════════════════
// Gửi follow request
exports.sendFollowRequest = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { userId: targetId } = req.body;
    const result = await follow_service_1.FollowService.sendFollowRequest(userId, targetId);
    (0, response_1.sendCreated)(res, result, "Đã gửi yêu cầu follow");
});
// Phản hồi follow request (accept/reject)
exports.respondFollowRequest = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const requestId = getParam(req.params.requestId);
    const { accept } = req.body;
    const result = await follow_service_1.FollowService.respondFollowRequest(userId, requestId, accept);
    const message = accept
        ? "Đã chấp nhận yêu cầu follow"
        : "Đã từ chối yêu cầu follow";
    (0, response_1.sendSuccess)(res, result, message);
});
// Hủy follow request đã gửi
exports.cancelFollowRequest = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const targetId = getParam(req.params.userId);
    await follow_service_1.FollowService.cancelFollowRequest(userId, targetId);
    (0, response_1.sendSuccess)(res, null, "Đã hủy yêu cầu follow");
});
// Unfollow
exports.unfollow = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const targetId = getParam(req.params.userId);
    await follow_service_1.FollowService.unfollow(userId, targetId);
    (0, response_1.sendSuccess)(res, null, "Đã hủy follow");
});
// Xóa follower
exports.removeFollower = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const followerId = getParam(req.params.userId);
    await follow_service_1.FollowService.removeFollower(userId, followerId);
    (0, response_1.sendSuccess)(res, null, "Đã xóa người follow");
});
// ══════════════════════════════════════════════════════════════════════════════
// CLOSE FRIEND REQUEST HANDLERS
// ══════════════════════════════════════════════════════════════════════════════
// Gửi request bạn thân
exports.sendCloseFriendRequest = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { userId: targetId } = req.body;
    const result = await follow_service_1.FollowService.sendCloseFriendRequest(userId, targetId);
    (0, response_1.sendCreated)(res, result, "Đã gửi yêu cầu bạn thân");
});
// Phản hồi request bạn thân
exports.respondCloseFriendRequest = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const requestId = getParam(req.params.requestId);
    const { accept } = req.body;
    const result = await follow_service_1.FollowService.respondCloseFriendRequest(userId, requestId, accept);
    const message = accept
        ? "Đã chấp nhận yêu cầu bạn thân"
        : "Đã từ chối yêu cầu bạn thân";
    (0, response_1.sendSuccess)(res, result, message);
});
// Hủy bạn thân
exports.removeCloseFriend = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const targetId = getParam(req.params.userId);
    await follow_service_1.FollowService.removeCloseFriend(userId, targetId);
    (0, response_1.sendSuccess)(res, null, "Đã hủy bạn thân");
});
// ══════════════════════════════════════════════════════════════════════════════
// QUERY HANDLERS
// ══════════════════════════════════════════════════════════════════════════════
// Lấy danh sách followers
exports.getFollowers = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId);
    const { page = 1, limit = 20, status } = req.query;
    const result = await follow_service_1.FollowService.getFollowers(userId, currentUserId, Number(page), Number(limit), status);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách followers thành công");
});
// Lấy danh sách following
exports.getFollowing = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId);
    const { page = 1, limit = 20, status } = req.query;
    const result = await follow_service_1.FollowService.getFollowing(userId, currentUserId, Number(page), Number(limit), status);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách following thành công");
});
// Lấy danh sách bạn bè (mutual follow)
exports.getFriends = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getParam(req.params.userId);
    const { page = 1, limit = 20 } = req.query;
    const result = await follow_service_1.FollowService.getFriends(userId, Number(page), Number(limit));
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách bạn bè thành công");
});
// Lấy danh sách bạn thân
exports.getCloseFriends = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId) || currentUserId;
    const { page = 1, limit = 20 } = req.query;
    const result = await follow_service_1.FollowService.getCloseFriends(userId, Number(page), Number(limit));
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách bạn thân thành công");
});
// Lấy danh sách follow request pending (received)
exports.getPendingFollowRequests = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { page = 1, limit = 20 } = req.query;
    const result = await follow_service_1.FollowService.getPendingFollowRequests(userId, Number(page), Number(limit));
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách yêu cầu follow thành công");
});
// Lấy danh sách follow request đã gửi (sent)
exports.getSentFollowRequests = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { page = 1, limit = 20 } = req.query;
    const result = await follow_service_1.FollowService.getSentFollowRequests(userId, Number(page), Number(limit));
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách yêu cầu đã gửi thành công");
});
// Lấy danh sách close friend request pending (received)
exports.getPendingCloseFriendRequests = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { page = 1, limit = 20 } = req.query;
    const result = await follow_service_1.FollowService.getPendingCloseFriendRequests(userId, Number(page), Number(limit));
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách yêu cầu bạn thân thành công");
});
// Lấy relationship status
exports.getRelationshipStatus = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const currentUserId = getUserId(req);
    const targetId = getParam(req.params.userId);
    const result = await follow_service_1.FollowService.getRelationshipStatus(currentUserId, targetId);
    (0, response_1.sendSuccess)(res, result, "Lấy trạng thái quan hệ thành công");
});
// Lấy follow stats
exports.getFollowStats = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId) || currentUserId;
    const result = await follow_service_1.FollowService.getFollowStats(userId);
    (0, response_1.sendSuccess)(res, result, "Lấy thống kê follow thành công");
});
