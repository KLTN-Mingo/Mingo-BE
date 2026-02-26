// src/routes/follow.routes.ts

import { Router } from "express";
import {
  sendFollowRequest,
  respondFollowRequest,
  cancelFollowRequest,
  unfollow,
  removeFollower,
  sendCloseFriendRequest,
  respondCloseFriendRequest,
  removeCloseFriend,
  getFollowers,
  getFollowing,
  getFriends,
  getCloseFriends,
  getPendingFollowRequests,
  getSentFollowRequests,
  getPendingCloseFriendRequests,
  getRelationshipStatus,
  getFollowStats,
} from "../controllers/follow.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Tất cả routes đều cần authenticate
router.use(authMiddleware);

// ══════════════════════════════════════════════════════════════════════════════
// FOLLOW REQUEST ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// Gửi follow request
router.post("/request", sendFollowRequest);

// Phản hồi follow request (accept/reject)
router.put("/request/:requestId/respond", respondFollowRequest);

// Hủy follow request đã gửi
router.delete("/request/:userId", cancelFollowRequest);

// Unfollow
router.delete("/:userId", unfollow);

// Xóa follower (remove someone who follows you)
router.delete("/follower/:userId", removeFollower);

// ══════════════════════════════════════════════════════════════════════════════
// CLOSE FRIEND REQUEST ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// Gửi request bạn thân
router.post("/close-friend/request", sendCloseFriendRequest);

// Phản hồi request bạn thân
router.put(
  "/close-friend/request/:requestId/respond",
  respondCloseFriendRequest
);

// Hủy bạn thân
router.delete("/close-friend/:userId", removeCloseFriend);

// ══════════════════════════════════════════════════════════════════════════════
// QUERY ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// Lấy danh sách pending follow requests (received)
router.get("/requests/pending", getPendingFollowRequests);

// Lấy danh sách sent follow requests
router.get("/requests/sent", getSentFollowRequests);

// Lấy danh sách pending close friend requests (received)
router.get("/close-friend/requests/pending", getPendingCloseFriendRequests);

// Lấy follow stats của user
router.get("/stats", getFollowStats);
router.get("/stats/:userId", getFollowStats);

// Lấy relationship status với user khác
router.get("/relationship/:userId", getRelationshipStatus);

// Lấy danh sách followers của user
router.get("/:userId/followers", getFollowers);

// Lấy danh sách following của user
router.get("/:userId/following", getFollowing);

// Lấy danh sách bạn bè (mutual follow)
router.get("/:userId/friends", getFriends);

// Lấy danh sách bạn thân
router.get("/close-friends", getCloseFriends);
router.get("/:userId/close-friends", getCloseFriends);

export default router;
