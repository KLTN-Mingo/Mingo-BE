// src/controllers/follow.controller.ts

import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { FollowService } from "../services/follow.service";
import {
  interactionTrackerService,
  TrackPayload,
} from "../services/interaction-tracker.service";
import {
  InteractionSource,
  InteractionType,
} from "../models/user-interaction.model";
import { sendSuccess, sendCreated } from "../utils/response";
import { ForbiddenError, ValidationError } from "../errors";
import {
  assertFollowStatus,
  normalizeRelationshipPagination,
  parseRelationshipBoolean,
} from "../utils/relationship.util";
import { canReadRelationshipStatusFilter } from "../utils/relationship-visibility.util";

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

function getInteractionSource(value: unknown): InteractionSource {
  return Object.values(InteractionSource).includes(value as InteractionSource)
    ? (value as InteractionSource)
    : InteractionSource.FEED;
}

function getPagination(req: Request): { page: number; limit: number } {
  return normalizeRelationshipPagination(req.query.page, req.query.limit);
}

function trackFollowFromPostSafely(payload: TrackPayload): void {
  void interactionTrackerService.track(payload).catch((err) => {
    console.error("[FollowController] track follow_from_post error:", err);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// FOLLOW REQUEST HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// Gửi follow request
export const sendFollowRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { userId: targetId, postId, source, deviceType } = req.body;

    const result = await FollowService.sendFollowRequest(userId, targetId);

    if (typeof postId === "string" && postId.trim().length > 0) {
      trackFollowFromPostSafely({
        userId,
        postId,
        type: InteractionType.FOLLOW_FROM_POST,
        source: getInteractionSource(source),
        deviceType,
      });
    }

    sendCreated(res, result, "Đã gửi yêu cầu follow");
  }
);

// Phản hồi follow request (accept/reject)
export const respondFollowRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const requestId = getParam(req.params.requestId);
    const accept = parseRelationshipBoolean(req.body.accept, "accept");

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
    const accept = parseRelationshipBoolean(req.body.accept, "accept");

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
    const { page, limit } = getPagination(req);
    const status = assertFollowStatus(req.query.status);
    if (
      !canReadRelationshipStatusFilter({
        currentUserId,
        targetUserId: userId,
        status,
      })
    ) {
      throw new ForbiddenError(
        "Không thể xem trạng thái follow riêng tư của người khác"
      );
    }

    const result = await FollowService.getFollowers(
      userId,
      currentUserId,
      page,
      limit,
      status
    );

    sendSuccess(res, result, "Lấy danh sách followers thành công");
  }
);

// Lấy danh sách following
export const getFollowing = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId);
    const { page, limit } = getPagination(req);
    const status = assertFollowStatus(req.query.status);
    if (
      !canReadRelationshipStatusFilter({
        currentUserId,
        targetUserId: userId,
        status,
      })
    ) {
      throw new ForbiddenError(
        "Không thể xem trạng thái follow riêng tư của người khác"
      );
    }

    const result = await FollowService.getFollowing(
      userId,
      currentUserId,
      page,
      limit,
      status
    );

    sendSuccess(res, result, "Lấy danh sách following thành công");
  }
);

// Lấy danh sách bạn bè (mutual follow)
export const getFriends = asyncHandler(async (req: Request, res: Response) => {
  const userId = getParam(req.params.userId);
  const { page, limit } = getPagination(req);

  const result = await FollowService.getFriends(
    userId,
    page,
    limit
  );

  sendSuccess(res, result, "Lấy danh sách bạn bè thành công");
});

// Lấy danh sách bạn thân
export const getCloseFriends = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = getUserId(req);
    const userId = getParam(req.params.userId) || currentUserId;
    if (userId !== currentUserId) {
      throw new ForbiddenError("Không thể xem danh sách bạn thân của người khác");
    }
    const { page, limit } = getPagination(req);

    const result = await FollowService.getCloseFriends(
      userId,
      page,
      limit
    );

    sendSuccess(res, result, "Lấy danh sách bạn thân thành công");
  }
);

// Lấy danh sách follow request pending (received)
export const getPendingFollowRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { page, limit } = getPagination(req);

    const result = await FollowService.getPendingFollowRequests(
      userId,
      page,
      limit
    );

    sendSuccess(res, result, "Lấy danh sách yêu cầu follow thành công");
  }
);

// Lấy danh sách follow request đã gửi (sent)
export const getSentFollowRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { page, limit } = getPagination(req);

    const result = await FollowService.getSentFollowRequests(
      userId,
      page,
      limit
    );

    sendSuccess(res, result, "Lấy danh sách yêu cầu đã gửi thành công");
  }
);

// Lấy danh sách close friend request pending (received)
export const getPendingCloseFriendRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { page, limit } = getPagination(req);

    const result = await FollowService.getPendingCloseFriendRequests(
      userId,
      page,
      limit
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
