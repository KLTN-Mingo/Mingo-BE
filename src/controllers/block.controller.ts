// src/controllers/block.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/async-handler";
import { ValidationError } from "../errors";
import { sendSuccess, sendPaginated } from "../utils/response";
import { BlockModel } from "../models/block.model";
import { UserModel } from "../models/user.model";
import { toUserMinimal } from "../dtos/user.dto";
import { FollowService } from "../services/follow.service";

/**
 * @route   POST /api/follow/blocks
 * @body    { userId: string, reason?: string }
 */
export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const me = (req as any).user?.userId as string;
  const { userId: targetId, reason } = req.body as {
    userId?: string;
    reason?: string;
  };

  if (!targetId || !Types.ObjectId.isValid(targetId)) {
    throw new ValidationError("userId không hợp lệ");
  }
  if (targetId === me) {
    throw new ValidationError("Không thể chặn chính mình");
  }

  const result = await FollowService.blockUser(me, targetId, reason);
  sendSuccess(res, result, "Đã chặn người dùng");
});

/**
 * @route   DELETE /api/follow/blocks/:userId
 */
export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
  const me = (req as any).user?.userId as string;
  const { userId: targetId } = req.params as { userId: string };

  if (!Types.ObjectId.isValid(targetId)) {
    throw new ValidationError("userId không hợp lệ");
  }

  await BlockModel.deleteOne({
    blockerId: new Types.ObjectId(me),
    blockedId: new Types.ObjectId(targetId),
  });

  sendSuccess(res, null, "Đã bỏ chặn");
});

/**
 * @route   GET /api/follow/blocks?page&limit
 */
export const getBlockedUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const me = (req as any).user?.userId as string;
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt((req.query.limit as string) || "20", 10))
    );

    const filter = { blockerId: new Types.ObjectId(me) };
    const [total, rows] = await Promise.all([
      BlockModel.countDocuments(filter),
      BlockModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("blockedId", "name avatar phoneNumber verified")
        .lean(),
    ]);

    const blockedUsers = (rows as any[]).map((r) => ({
      blockedAt: r.createdAt,
      reason: r.reason,
      user: r.blockedId ? toUserMinimal(r.blockedId) : undefined,
      userId: r.blockedId?._id?.toString(),
    }));

    sendPaginated(res, blockedUsers, { page, limit, total });
  }
);
