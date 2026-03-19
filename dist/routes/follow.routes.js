"use strict";
// src/routes/follow.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const follow_controller_1 = require("../controllers/follow.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Tất cả routes đều cần authenticate
router.use(auth_middleware_1.authMiddleware);
// ══════════════════════════════════════════════════════════════════════════════
// FOLLOW REQUEST ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// Gửi follow request
router.post("/request", follow_controller_1.sendFollowRequest);
// Phản hồi follow request (accept/reject)
router.put("/request/:requestId/respond", follow_controller_1.respondFollowRequest);
// Hủy follow request đã gửi
router.delete("/request/:userId", follow_controller_1.cancelFollowRequest);
// Unfollow
router.delete("/:userId", follow_controller_1.unfollow);
// Xóa follower (remove someone who follows you)
router.delete("/follower/:userId", follow_controller_1.removeFollower);
// ══════════════════════════════════════════════════════════════════════════════
// CLOSE FRIEND REQUEST ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// Gửi request bạn thân
router.post("/close-friend/request", follow_controller_1.sendCloseFriendRequest);
// Phản hồi request bạn thân
router.put("/close-friend/request/:requestId/respond", follow_controller_1.respondCloseFriendRequest);
// Hủy bạn thân
router.delete("/close-friend/:userId", follow_controller_1.removeCloseFriend);
// ══════════════════════════════════════════════════════════════════════════════
// QUERY ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// Lấy danh sách pending follow requests (received)
router.get("/requests/pending", follow_controller_1.getPendingFollowRequests);
// Lấy danh sách sent follow requests
router.get("/requests/sent", follow_controller_1.getSentFollowRequests);
// Lấy danh sách pending close friend requests (received)
router.get("/close-friend/requests/pending", follow_controller_1.getPendingCloseFriendRequests);
// Lấy follow stats của user
router.get("/stats", follow_controller_1.getFollowStats);
router.get("/stats/:userId", follow_controller_1.getFollowStats);
// Lấy relationship status với user khác
router.get("/relationship/:userId", follow_controller_1.getRelationshipStatus);
// Lấy danh sách followers của user
router.get("/:userId/followers", follow_controller_1.getFollowers);
// Lấy danh sách following của user
router.get("/:userId/following", follow_controller_1.getFollowing);
// Lấy danh sách bạn bè (mutual follow)
router.get("/:userId/friends", follow_controller_1.getFriends);
// Lấy danh sách bạn thân
router.get("/close-friends", follow_controller_1.getCloseFriends);
router.get("/:userId/close-friends", follow_controller_1.getCloseFriends);
exports.default = router;
