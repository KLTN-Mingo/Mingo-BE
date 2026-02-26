// src/controllers/follow.controller.ts

import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { FollowService } from "../services/follow.service";
import { FollowStatus } from "../models/follow.model";
import { sendSuccess, sendCreated } from "../utils/response";
import { ValidationError } from "../errors";

// Helper to get userId from request
function getUserId(req: Request): string {
  const userId = (req as any).user?.userId;
  if (!userId) {
    throw new ValidationError("Không tìm thấy thông tin người dùng");
  }
  return userId;
}

// Helper to get string param
function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

// ══════════════════════════════════════════════════════════════════════════════
// FOLLOW REQUEST HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// Gửi follow request
export const sendFollowRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { userId: targetId } = req.body;

    const result = await FollowService.sendFollowRequest(userId, targetId);
    sendCreated(res, result, "Đã gửi yêu cầu follow");
  }
);

// Phản hồi follow request (accept/reject)
export const respondFollowRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const requestId = getParam(req.params.requestId);
    const { accept } = req.body;

    const result = await FollowService.respondFollowRequest(
      userId,
      requestId,
      accept
    );

    const message = accept
      ? "Đã chấp nhận yêu cầu follow"
      : "Đã từ chối yêu cầu follow";

    sendSuccess(res, result, message);
  }
);

// Hủy follow request đã gửi
export const cancelFollowRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const targetId = getParam(req.params.userId);

    await FollowService.cancelFollowRequest(userId, targetId);
    sendSuccess(res, null, "Đã hủy yêu cầu follow");
  }
);

// Unfollow
export const unfollow = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const targetId = getParam(req.params.userId);

  await FollowService.unfollow(userId, targetId);
  sendSuccess(res, null, "Đã hủy follow");
});

// Xóa follower
export const removeFollower = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const followerId = getParam(req.params.userId);

    await FollowService.removeFollower(userId, followerId);
    sendSuccess(res, null, "Đã xóa người follow");
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// CLOSE FRIEND REQUEST HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// Gửi request bạn thân
export const sendCloseFriendRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { userId: targetId } = req.body;

    const result = await FollowService.sendCloseFriendRequest(userId, targetId);
    sendCreated(res, result, "Đã gửi yêu cầu bạn thân");
  }
);

// Phản hồi request bạn thân
export const respondCloseFriendRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const requestId = getParam(req.params.requestId);
    const { accept } = req.body;

    const result = await FollowService.respondCloseFriendRequest(
      userId,
      requestId,
      accept
    );

    const message = accept
      ? "Đã chấp nhận yêu cầu bạn thân"
      : "Đã từ chối yêu cầu bạn thân";

    sendSuccess(res, result, message);
  }
);

// Hủy bạn thân
export const removeCloseFriend = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const targetId = getParam(req.params.userId);

    await FollowService.removeCloseFriend(userId, targetId);
    sendSuccess(res, null, "Đã hủy bạn thân");
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// QUERY HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// Lấy danh sách followers
export const getFollowers = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId);
    const { page = 1, limit = 20, status } = req.query;

    const result = await FollowService.getFollowers(
      userId,
      currentUserId,
      Number(page),
      Number(limit),
      status as FollowStatus | undefined
    );

    sendSuccess(res, result, "Lấy danh sách followers thành công");
  }
);

// Lấy danh sách following
export const getFollowing = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId);
    const { page = 1, limit = 20, status } = req.query;

    const result = await FollowService.getFollowing(
      userId,
      currentUserId,
      Number(page),
      Number(limit),
      status as FollowStatus | undefined
    );

    sendSuccess(res, result, "Lấy danh sách following thành công");
  }
);

// Lấy danh sách bạn bè (mutual follow)
export const getFriends = asyncHandler(async (req: Request, res: Response) => {
  const userId = getParam(req.params.userId);
  const { page = 1, limit = 20 } = req.query;

  const result = await FollowService.getFriends(
    userId,
    Number(page),
    Number(limit)
  );

  sendSuccess(res, result, "Lấy danh sách bạn bè thành công");
});

// Lấy danh sách bạn thân
export const getCloseFriends = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId) || currentUserId;
    const { page = 1, limit = 20 } = req.query;

    const result = await FollowService.getCloseFriends(
      userId,
      Number(page),
      Number(limit)
    );

    sendSuccess(res, result, "Lấy danh sách bạn thân thành công");
  }
);

// Lấy danh sách follow request pending (received)
export const getPendingFollowRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { page = 1, limit = 20 } = req.query;

    const result = await FollowService.getPendingFollowRequests(
      userId,
      Number(page),
      Number(limit)
    );

    sendSuccess(res, result, "Lấy danh sách yêu cầu follow thành công");
  }
);

// Lấy danh sách follow request đã gửi (sent)
export const getSentFollowRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { page = 1, limit = 20 } = req.query;

    const result = await FollowService.getSentFollowRequests(
      userId,
      Number(page),
      Number(limit)
    );

    sendSuccess(res, result, "Lấy danh sách yêu cầu đã gửi thành công");
  }
);

// Lấy danh sách close friend request pending (received)
export const getPendingCloseFriendRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { page = 1, limit = 20 } = req.query;

    const result = await FollowService.getPendingCloseFriendRequests(
      userId,
      Number(page),
      Number(limit)
    );

    sendSuccess(res, result, "Lấy danh sách yêu cầu bạn thân thành công");
  }
);

// Lấy relationship status
export const getRelationshipStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = getUserId(req);
    const targetId = getParam(req.params.userId);

    const result = await FollowService.getRelationshipStatus(
      currentUserId,
      targetId
    );

    sendSuccess(res, result, "Lấy trạng thái quan hệ thành công");
  }
);

// Lấy follow stats
export const getFollowStats = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId) || currentUserId;

    const result = await FollowService.getFollowStats(userId);

    sendSuccess(res, result, "Lấy thống kê follow thành công");
  }
);
