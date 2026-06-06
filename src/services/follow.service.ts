// src/services/follow.service.ts

import mongoose, { ClientSession, Types } from "mongoose";
import {
  FollowModel,
  FollowStatus,
  CloseFriendStatus,
} from "../models/follow.model";
import { UserModel } from "../models/user.model";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "../errors";
import { toUserMinimal } from "../dtos/user.dto";
import {
  FollowResponseDto,
  FollowerDto,
  FollowingDto,
  FriendDto,
  CloseFriendDto,
  FollowRequestDto,
  CloseFriendRequestDto,
  PaginatedFollowersDto,
  PaginatedFollowingDto,
  PaginatedFriendsDto,
  PaginatedCloseFriendsDto,
  PaginatedFollowRequestsDto,
  PaginatedCloseFriendRequestsDto,
  FollowStatsDto,
  RelationshipStatusDto,
  RelationshipType,
  determineRelationshipType,
} from "../dtos/follow.dto";
import { NotificationService } from "./notification.service";
import { BlockModel } from "../models/block.model";
import { invalidateRelationshipCaches } from "./relationship-cache.service";
import { isAcceptedRelationship } from "../utils/relationship.util";

// Helper: validate ObjectId
function assertObjectId(id: string, label: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${label} không hợp lệ`);
  }
}

// Helper: check user exists
async function assertUserExists(userId: string, label = "Người dùng") {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new NotFoundError(`${label} không tồn tại`);
  }
  return user;
}

async function withRelationshipTransaction<T>(
  work: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

async function assertUsersNotBlocked(
  firstUserId: string,
  secondUserId: string,
  session?: ClientSession
): Promise<void> {
  const block = await BlockModel.findOne({
    $or: [
      { blockerId: firstUserId, blockedId: secondUserId },
      { blockerId: secondUserId, blockedId: firstUserId },
    ],
  })
    .session(session || null)
    .lean();

  if (block) {
    throw new ForbiddenError("Không thể thực hiện thao tác do quan hệ chặn");
  }
}

async function adjustUserCounter(
  userId: Types.ObjectId | string,
  field: "followersCount" | "followingCount",
  delta: number,
  session: ClientSession
): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    [
      {
        $set: {
          [field]: {
            $max: [
              0,
              {
                $add: [{ $ifNull: [`$${field}`, 0] }, delta],
              },
            ],
          },
        },
      },
    ],
    { session, updatePipeline: true }
  );
}

async function clearCloseFriendState(
  firstUserId: string,
  secondUserId: string,
  session: ClientSession
): Promise<void> {
  await FollowModel.updateMany(
    {
      $or: [
        { followerId: firstUserId, followingId: secondUserId },
        { followerId: secondUserId, followingId: firstUserId },
      ],
    },
    {
      $set: { closeFriendStatus: CloseFriendStatus.NONE },
      $unset: { closeFriendRequestedBy: 1, closeFriendRequestedAt: 1 },
    },
    { session }
  );
}

export const FollowService = {
  // ══════════════════════════════════════════════════════════════════════════════
  // FOLLOW REQUESTS
  // ══════════════════════════════════════════════════════════════════════════════

  // Gửi follow request
  async sendFollowRequest(
    followerId: string,
    followingId: string
  ): Promise<FollowResponseDto> {
    assertObjectId(followerId, "ID người follow");
    assertObjectId(followingId, "ID người được follow");

    if (followerId === followingId) {
      throw new ValidationError("Không thể tự follow chính mình");
    }

    await assertUserExists(followingId, "Người dùng bạn muốn follow");

    await assertUsersNotBlocked(followerId, followingId);

    // Check if already exists
    const existing = await FollowModel.findOne({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
    });

    if (existing) {
      if (existing.followStatus === FollowStatus.ACCEPTED) {
        throw new ConflictError("Bạn đã follow người này rồi");
      }
      if (existing.followStatus === FollowStatus.PENDING) {
        throw new ConflictError("Yêu cầu follow đang chờ xác nhận");
      }
      // If rejected, allow re-request
      existing.followStatus = FollowStatus.PENDING;
      existing.closeFriendStatus = CloseFriendStatus.NONE;
      existing.closeFriendRequestedBy = undefined;
      existing.closeFriendRequestedAt = undefined;
      await existing.save();
      void NotificationService.notifyFollowRequest(followingId, followerId).catch(
        (err) => {
          console.error("[FollowService] notify follow request error:", err);
        }
      );
      return this.toFollowResponse(existing);
    }

    let follow;
    try {
      follow = await FollowModel.create({
        followerId: new Types.ObjectId(followerId),
        followingId: new Types.ObjectId(followingId),
        followStatus: FollowStatus.PENDING,
        closeFriendStatus: CloseFriendStatus.NONE,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictError("Yêu cầu follow đã tồn tại");
      }
      throw error;
    }

    void NotificationService.notifyFollowRequest(followingId, followerId).catch(
      (err) => {
        console.error("[FollowService] notify follow request error:", err);
      }
    );

    return this.toFollowResponse(follow);
  },

  // Phản hồi follow request (accept/reject)
  async respondFollowRequest(
    userId: string,
    requestId: string,
    accept: boolean
  ): Promise<FollowResponseDto> {
    assertObjectId(requestId, "ID yêu cầu");

    const follow = await withRelationshipTransaction(async (session) => {
      const current = await FollowModel.findById(requestId).session(session);
      if (!current) {
        throw new NotFoundError("Yêu cầu follow không tồn tại");
      }
      if (current.followingId.toString() !== userId) {
        throw new ForbiddenError("Bạn không có quyền phản hồi yêu cầu này");
      }

      const updated = await FollowModel.findOneAndUpdate(
        {
          _id: current._id,
          followingId: new Types.ObjectId(userId),
          followStatus: FollowStatus.PENDING,
        },
        {
          $set: {
            followStatus: accept
              ? FollowStatus.ACCEPTED
              : FollowStatus.REJECTED,
          },
        },
        { new: true, session }
      );
      if (!updated) {
        throw new ConflictError("Yêu cầu này đã được xử lý");
      }

      if (accept) {
        await Promise.all([
          adjustUserCounter(updated.followerId, "followingCount", 1, session),
          adjustUserCounter(updated.followingId, "followersCount", 1, session),
        ]);
      }
      return updated;
    });

    await invalidateRelationshipCaches(
      follow.followerId.toString(),
      follow.followingId.toString()
    );

    if (accept) {
      void NotificationService.notifyFollowAccepted(
        follow.followerId.toString(),
        userId
      ).catch((err) => {
        console.error("[FollowService] notify follow accepted error:", err);
      });
    }

    return this.toFollowResponse(follow);
  },

  // Hủy follow request đã gửi
  async cancelFollowRequest(
    followerId: string,
    followingId: string
  ): Promise<void> {
    assertObjectId(followingId, "ID người được follow");

    const follow = await FollowModel.findOne({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
      followStatus: FollowStatus.PENDING,
    });

    if (!follow) {
      throw new NotFoundError("Không tìm thấy yêu cầu follow đang chờ");
    }

    await follow.deleteOne();
  },

  // Unfollow
  async unfollow(followerId: string, followingId: string): Promise<void> {
    assertObjectId(followingId, "ID người được follow");

    await withRelationshipTransaction(async (session) => {
      const follow = await FollowModel.findOne({
        followerId: new Types.ObjectId(followerId),
        followingId: new Types.ObjectId(followingId),
      }).session(session);

      if (!follow) {
        throw new NotFoundError("Bạn chưa follow người này");
      }

      await FollowModel.deleteOne({ _id: follow._id }, { session });
      await clearCloseFriendState(followerId, followingId, session);

      if (follow.followStatus === FollowStatus.ACCEPTED) {
        await Promise.all([
          adjustUserCounter(followerId, "followingCount", -1, session),
          adjustUserCounter(followingId, "followersCount", -1, session),
        ]);
      }
    });

    await invalidateRelationshipCaches(followerId, followingId);
  },

  // Xóa follower (remove someone who follows you)
  async removeFollower(userId: string, followerId: string): Promise<void> {
    assertObjectId(followerId, "ID người follow");

    await withRelationshipTransaction(async (session) => {
      const follow = await FollowModel.findOne({
        followerId: new Types.ObjectId(followerId),
        followingId: new Types.ObjectId(userId),
        followStatus: FollowStatus.ACCEPTED,
      }).session(session);

      if (!follow) {
        throw new NotFoundError("Người này không follow bạn");
      }

      await FollowModel.deleteOne({ _id: follow._id }, { session });
      await clearCloseFriendState(userId, followerId, session);
      await Promise.all([
        adjustUserCounter(followerId, "followingCount", -1, session),
        adjustUserCounter(userId, "followersCount", -1, session),
      ]);
    });

    await invalidateRelationshipCaches(userId, followerId);
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CLOSE FRIEND REQUESTS
  // ══════════════════════════════════════════════════════════════════════════════

  // Gửi request bạn thân
  async sendCloseFriendRequest(
    requesterId: string,
    targetId: string
  ): Promise<FollowResponseDto> {
    assertObjectId(targetId, "ID người dùng");

    if (requesterId === targetId) {
      throw new ValidationError("Không thể tự gửi request bạn thân cho mình");
    }

    const updated = await withRelationshipTransaction(async (session) => {
      await assertUsersNotBlocked(requesterId, targetId, session);

      const rows = await FollowModel.find({
        $or: [
          { followerId: requesterId, followingId: targetId },
          { followerId: targetId, followingId: requesterId },
        ],
        followStatus: FollowStatus.ACCEPTED,
      }).session(session);

      if (rows.length !== 2) {
        throw new ValidationError(
          "Cả hai phải là bạn bè (mutual follow) mới có thể gửi request bạn thân"
        );
      }
      if (
        rows.some(
          (row) => row.closeFriendStatus === CloseFriendStatus.ACCEPTED
        )
      ) {
        throw new ConflictError("Hai bạn đã là bạn thân rồi");
      }
      if (
        rows.some((row) => row.closeFriendStatus === CloseFriendStatus.PENDING)
      ) {
        throw new ConflictError("Yêu cầu bạn thân đang chờ xác nhận");
      }

      const now = new Date();
      const result = await FollowModel.updateMany(
        { _id: { $in: rows.map((row) => row._id) } },
        {
          $set: {
            closeFriendStatus: CloseFriendStatus.PENDING,
            closeFriendRequestedBy: new Types.ObjectId(requesterId),
            closeFriendRequestedAt: now,
          },
        },
        { session }
      );
      if (result.modifiedCount !== 2) {
        throw new ConflictError("Quan hệ bạn bè đã thay đổi, vui lòng thử lại");
      }

      return FollowModel.findOne({
        followerId: requesterId,
        followingId: targetId,
      }).session(session);
    });

    void NotificationService.notifyCloseFriendRequest(targetId, requesterId).catch(
      (err) => {
        console.error("[FollowService] notify close-friend request error:", err);
      }
    );

    await invalidateRelationshipCaches(requesterId, targetId);
    return this.toFollowResponse(updated!);
  },

  // Phản hồi request bạn thân
  async respondCloseFriendRequest(
    userId: string,
    requestId: string,
    accept: boolean
  ): Promise<FollowResponseDto> {
    assertObjectId(requestId, "ID yêu cầu");

    const result = await withRelationshipTransaction(async (session) => {
      const follow = await FollowModel.findById(requestId).session(session);
      if (!follow) {
        throw new NotFoundError("Yêu cầu không tồn tại");
      }
      if (follow.closeFriendStatus !== CloseFriendStatus.PENDING) {
        throw new ConflictError("Yêu cầu này đã được xử lý");
      }

      const requesterId = follow.closeFriendRequestedBy?.toString();
      if (!requesterId || requesterId === userId) {
        throw new ForbiddenError("Bạn không thể phản hồi request này");
      }

      const participantIds = [
        follow.followerId.toString(),
        follow.followingId.toString(),
      ];
      if (!participantIds.includes(userId)) {
        throw new ForbiddenError("Bạn không có quyền phản hồi yêu cầu này");
      }

      const otherUserId = participantIds.find((id) => id !== userId);
      if (!otherUserId || otherUserId !== requesterId) {
        throw new ForbiddenError("Yêu cầu không thuộc về người dùng này");
      }

      const newStatus = accept
        ? CloseFriendStatus.ACCEPTED
        : CloseFriendStatus.REJECTED;
      const update = await FollowModel.updateMany(
        {
          $or: [
            { followerId: userId, followingId: otherUserId },
            { followerId: otherUserId, followingId: userId },
          ],
          followStatus: FollowStatus.ACCEPTED,
          closeFriendStatus: CloseFriendStatus.PENDING,
          closeFriendRequestedBy: new Types.ObjectId(requesterId),
        },
        {
          $set: { closeFriendStatus: newStatus },
          $unset: { closeFriendRequestedBy: 1, closeFriendRequestedAt: 1 },
        },
        { session }
      );
      if (update.modifiedCount !== 2) {
        throw new ConflictError("Quan hệ bạn bè đã thay đổi, vui lòng thử lại");
      }

      const updated = await FollowModel.findById(follow._id).session(session);
      return { updated, requesterId, otherUserId };
    });

    await invalidateRelationshipCaches(userId, result.otherUserId);

    if (accept) {
      void NotificationService.notifyCloseFriendAccepted(
        result.requesterId,
        userId
      ).catch((err) => {
        console.error("[FollowService] notify close-friend accepted error:", err);
      });
    }

    return this.toFollowResponse(result.updated!);
  },

  // Hủy bạn thân
  async removeCloseFriend(userId: string, targetId: string): Promise<void> {
    assertObjectId(targetId, "ID người dùng");

    await withRelationshipTransaction(async (session) => {
      const existing = await FollowModel.exists({
        $or: [
          { followerId: userId, followingId: targetId },
          { followerId: targetId, followingId: userId },
        ],
        closeFriendStatus: {
          $in: [CloseFriendStatus.PENDING, CloseFriendStatus.ACCEPTED],
        },
      }).session(session);
      if (!existing) {
        throw new NotFoundError("Không tìm thấy quan hệ bạn thân");
      }

      await clearCloseFriendState(userId, targetId, session);
    });

    await invalidateRelationshipCaches(userId, targetId);
  },

  async blockUser(
    blockerId: string,
    blockedId: string,
    reason?: string
  ): Promise<{ id: string; blockedId: string }> {
    assertObjectId(blockedId, "ID người dùng");
    if (blockerId === blockedId) {
      throw new ValidationError("Không thể chặn chính mình");
    }
    await assertUserExists(blockedId);

    const block = await withRelationshipTransaction(async (session) => {
      const existingBlock = await BlockModel.findOne({
        blockerId,
        blockedId,
      }).session(session);
      if (existingBlock) {
        throw new ConflictError("Đã chặn người dùng này trước đó");
      }

      const followRows = await FollowModel.find({
        $or: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId },
        ],
      }).session(session);

      for (const row of followRows) {
        if (row.followStatus !== FollowStatus.ACCEPTED) continue;
        await Promise.all([
          adjustUserCounter(row.followerId, "followingCount", -1, session),
          adjustUserCounter(row.followingId, "followersCount", -1, session),
        ]);
      }

      await FollowModel.deleteMany(
        {
          $or: [
            { followerId: blockerId, followingId: blockedId },
            { followerId: blockedId, followingId: blockerId },
          ],
        },
        { session }
      );

      try {
        const [created] = await BlockModel.create(
          [
            {
              blockerId: new Types.ObjectId(blockerId),
              blockedId: new Types.ObjectId(blockedId),
              reason: reason?.slice(0, 500),
            },
          ],
          { session }
        );
        return created;
      } catch (error: any) {
        if (error?.code === 11000) {
          throw new ConflictError("Đã chặn người dùng này trước đó");
        }
        throw error;
      }
    });

    await invalidateRelationshipCaches(blockerId, blockedId);
    return { id: block._id.toString(), blockedId };
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // QUERY METHODS
  // ══════════════════════════════════════════════════════════════════════════════

  // Lấy danh sách followers
  async getFollowers(
    userId: string,
    currentUserId: string,
    page = 1,
    limit = 20,
    status?: FollowStatus
  ): Promise<PaginatedFollowersDto> {
    assertObjectId(userId, "ID người dùng");

    const query: any = {
      followingId: new Types.ObjectId(userId),
    };
    if (status) {
      query.followStatus = status;
    } else {
      query.followStatus = FollowStatus.ACCEPTED;
    }

    const [followers, total] = await Promise.all([
      FollowModel.find(query)
        .populate("followerId", "name avatar verified")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FollowModel.countDocuments(query),
    ]);

    // Check if current user follows back each follower
    const followerIds = followers.map((f) => f.followerId._id || f.followerId);
    const currentUserFollows = await FollowModel.find({
      followerId: new Types.ObjectId(currentUserId),
      followingId: { $in: followerIds },
      followStatus: FollowStatus.ACCEPTED,
    }).lean();

    const followingSet = new Set(
      currentUserFollows.map((f) => f.followingId.toString())
    );

    const totalPages = Math.ceil(total / limit);

    return {
      followers: followers.map((f) => {
        const followerUser = f.followerId as any;
        const isFollowingBack = followingSet.has(followerUser._id.toString());
        const relationshipType = determineRelationshipType(
          isFollowingBack,
          true,
          isFollowingBack ? FollowStatus.ACCEPTED : undefined,
          f.followStatus,
          f.closeFriendStatus
        );

        return {
          id: f._id.toString(),
          follower: toUserMinimal(followerUser),
          followStatus: f.followStatus,
          closeFriendStatus: f.closeFriendStatus,
          followedAt: f.createdAt,
          isFollowingBack,
          relationshipType,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // Lấy danh sách following
  async getFollowing(
    userId: string,
    currentUserId: string,
    page = 1,
    limit = 20,
    status?: FollowStatus
  ): Promise<PaginatedFollowingDto> {
    assertObjectId(userId, "ID người dùng");

    const query: any = {
      followerId: new Types.ObjectId(userId),
    };
    if (status) {
      query.followStatus = status;
    } else {
      query.followStatus = FollowStatus.ACCEPTED;
    }

    const [following, total] = await Promise.all([
      FollowModel.find(query)
        .populate("followingId", "name avatar verified")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FollowModel.countDocuments(query),
    ]);

    // Check if each following user follows back
    const followingIds = following.map(
      (f) => f.followingId._id || f.followingId
    );
    const followsBack = await FollowModel.find({
      followerId: { $in: followingIds },
      followingId: new Types.ObjectId(userId),
      followStatus: FollowStatus.ACCEPTED,
    }).lean();

    const followerSet = new Set(
      followsBack.map((f) => f.followerId.toString())
    );

    const totalPages = Math.ceil(total / limit);

    return {
      following: following.map((f) => {
        const followingUser = f.followingId as any;
        const isFollower = followerSet.has(followingUser._id.toString());
        const relationshipType = determineRelationshipType(
          true,
          isFollower,
          f.followStatus,
          isFollower ? FollowStatus.ACCEPTED : undefined,
          f.closeFriendStatus
        );

        return {
          id: f._id.toString(),
          following: toUserMinimal(followingUser),
          followStatus: f.followStatus,
          closeFriendStatus: f.closeFriendStatus,
          followedAt: f.createdAt,
          isFollower,
          relationshipType,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // Lấy danh sách bạn bè (mutual follow)
  async getFriends(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedFriendsDto> {
    assertObjectId(userId, "ID người dùng");

    const userObjectId = new Types.ObjectId(userId);

    // Find users where both follow each other
    const following = await FollowModel.find({
      followerId: userObjectId,
      followStatus: FollowStatus.ACCEPTED,
    })
      .select("followingId closeFriendStatus createdAt")
      .lean();

    const followingIds = following.map((f) => f.followingId);

    // Find which of those also follow back
    const mutualFollows = await FollowModel.find({
      followerId: { $in: followingIds },
      followingId: userObjectId,
      followStatus: FollowStatus.ACCEPTED,
    })
      .select("followerId closeFriendStatus createdAt")
      .lean();

    const mutualSet = new Map(
      mutualFollows.map((f) => [
        f.followerId.toString(),
        {
          createdAt: f.createdAt,
          closeFriendStatus: f.closeFriendStatus,
        },
      ])
    );

    // Filter to only mutual
    const friends = following.filter((f) =>
      mutualSet.has(f.followingId.toString())
    );

    const total = friends.length;
    const totalPages = Math.ceil(total / limit);
    const paginated = friends.slice((page - 1) * limit, page * limit);

    // Populate user info
    const friendIds = paginated.map((f) => f.followingId);
    const users = await UserModel.find({ _id: { $in: friendIds } })
      .select("name avatar verified")
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    return {
      friends: paginated.map((f) => {
        const user = userMap.get(f.followingId.toString());
        const friendsSince = new Date(
          Math.max(
            f.createdAt.getTime(),
            mutualSet
              .get(f.followingId.toString())
              ?.createdAt.getTime() || 0
          )
        );
        const isCloseFriend =
          f.closeFriendStatus === CloseFriendStatus.ACCEPTED &&
          mutualSet.get(f.followingId.toString())?.closeFriendStatus ===
            CloseFriendStatus.ACCEPTED;

        return {
          id: f.followingId.toString(),
          user: user ? toUserMinimal(user) : { id: f.followingId.toString(), verified: false },
          isCloseFriend,
          closeFriendStatus: isCloseFriend
            ? CloseFriendStatus.ACCEPTED
            : CloseFriendStatus.NONE,
          friendsSince,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // Lấy danh sách bạn thân
  async getCloseFriends(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedCloseFriendsDto> {
    assertObjectId(userId, "ID người dùng");

    const query = {
      followerId: new Types.ObjectId(userId),
      followStatus: FollowStatus.ACCEPTED,
      closeFriendStatus: CloseFriendStatus.ACCEPTED,
    };

    const candidates = await FollowModel.find(query)
      .populate("followingId", "name avatar verified")
      .sort({ closeFriendRequestedAt: -1 })
      .lean();

    const candidateIds = candidates
      .map((row) => (row.followingId as any)?._id)
      .filter(Boolean);
    const reverseRows = await FollowModel.find({
      followerId: { $in: candidateIds },
      followingId: new Types.ObjectId(userId),
      followStatus: FollowStatus.ACCEPTED,
      closeFriendStatus: CloseFriendStatus.ACCEPTED,
    })
      .select("followerId")
      .lean();
    const reverseIds = new Set(
      reverseRows.map((row) => row.followerId.toString())
    );
    const validCloseFriends = candidates.filter((row) =>
      reverseIds.has((row.followingId as any)?._id?.toString())
    );
    const total = validCloseFriends.length;
    const closeFriends = validCloseFriends.slice(
      (page - 1) * limit,
      page * limit
    );

    const totalPages = Math.ceil(total / limit);

    return {
      closeFriends: closeFriends.map((f) => ({
        id: f._id.toString(),
        user: toUserMinimal(f.followingId as any),
        closeFriendSince: f.closeFriendRequestedAt || f.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // Lấy danh sách follow request pending (received)
  async getPendingFollowRequests(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedFollowRequestsDto> {
    const query = {
      followingId: new Types.ObjectId(userId),
      followStatus: FollowStatus.PENDING,
    };

    const [requests, total] = await Promise.all([
      FollowModel.find(query)
        .populate("followerId", "name avatar verified")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FollowModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      requests: requests.map((r) => ({
        id: r._id.toString(),
        user: toUserMinimal(r.followerId as any),
        status: r.followStatus,
        requestedAt: r.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // Lấy danh sách follow request đã gửi (sent)
  async getSentFollowRequests(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedFollowRequestsDto> {
    const query = {
      followerId: new Types.ObjectId(userId),
      followStatus: FollowStatus.PENDING,
    };

    const [requests, total] = await Promise.all([
      FollowModel.find(query)
        .populate("followingId", "name avatar verified")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FollowModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      requests: requests.map((r) => ({
        id: r._id.toString(),
        user: toUserMinimal(r.followingId as any),
        status: r.followStatus,
        requestedAt: r.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // Lấy danh sách close friend request pending (received)
  async getPendingCloseFriendRequests(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedCloseFriendRequestsDto> {
    const query = {
      followingId: new Types.ObjectId(userId),
      followStatus: FollowStatus.ACCEPTED,
      closeFriendStatus: CloseFriendStatus.PENDING,
      closeFriendRequestedBy: { $ne: new Types.ObjectId(userId) },
    };

    const [requests, total] = await Promise.all([
      FollowModel.find(query)
        .populate("followerId", "name avatar verified")
        .populate("followingId", "name avatar verified")
        .sort({ closeFriendRequestedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FollowModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      requests: requests.map((r) => {
        const requesterId = r.closeFriendRequestedBy?.toString();
        const requester =
          (r.followerId as any)._id?.toString() === requesterId
            ? r.followerId
            : r.followingId;

        return {
          id: r._id.toString(),
          user: toUserMinimal(requester as any),
          status: r.closeFriendStatus,
          requestedAt: r.closeFriendRequestedAt || r.updatedAt,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // Lấy relationship status giữa 2 user
  async getRelationshipStatus(
    currentUserId: string,
    targetUserId: string
  ): Promise<RelationshipStatusDto> {
    assertObjectId(targetUserId, "ID người dùng");

    if (currentUserId === targetUserId) {
      return {
        isFollowing: false,
        isFollower: false,
        isFriend: false,
        isCloseFriend: false,
        closeFriendStatus: CloseFriendStatus.NONE,
        relationshipType: RelationshipType.NONE,
      };
    }

    const [followToTarget, followFromTarget, block] = await Promise.all([
      FollowModel.findOne({
        followerId: new Types.ObjectId(currentUserId),
        followingId: new Types.ObjectId(targetUserId),
      }).lean(),
      FollowModel.findOne({
        followerId: new Types.ObjectId(targetUserId),
        followingId: new Types.ObjectId(currentUserId),
      }).lean(),
      BlockModel.findOne({
        $or: [
          { blockerId: currentUserId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: currentUserId },
        ],
      }).lean(),
    ]);

    if (block) {
      return {
        isFollowing: false,
        isFollower: false,
        isFriend: false,
        isCloseFriend: false,
        closeFriendStatus: CloseFriendStatus.NONE,
        relationshipType: RelationshipType.NONE,
      };
    }

    const isFollowing = isAcceptedRelationship(followToTarget);
    const isFollower = isAcceptedRelationship(followFromTarget);
    const followStatus = followToTarget?.followStatus;
    const followerStatus = followFromTarget?.followStatus;

    const isFriend =
      isFollowing &&
      isFollower &&
      followStatus === FollowStatus.ACCEPTED &&
      followerStatus === FollowStatus.ACCEPTED;

    const hasMutualCloseFriendState =
      isFriend &&
      followToTarget?.closeFriendStatus === CloseFriendStatus.ACCEPTED &&
      followFromTarget?.closeFriendStatus === CloseFriendStatus.ACCEPTED;
    const rawCloseFriendStatus =
      followToTarget?.closeFriendStatus || CloseFriendStatus.NONE;
    const closeFriendStatus = hasMutualCloseFriendState
      ? CloseFriendStatus.ACCEPTED
      : rawCloseFriendStatus === CloseFriendStatus.ACCEPTED
        ? CloseFriendStatus.NONE
        : rawCloseFriendStatus;
    const isCloseFriend = hasMutualCloseFriendState;

    const relationshipType = determineRelationshipType(
      isFollowing,
      isFollower,
      followStatus,
      followerStatus,
      closeFriendStatus
    );

    return {
      isFollowing,
      isFollower,
      followStatus,
      followerStatus,
      isFriend,
      isCloseFriend,
      closeFriendStatus,
      closeFriendRequestedBy: followToTarget?.closeFriendRequestedBy?.toString(),
      relationshipType,
    };
  },

  // Lấy thống kê follow
  async getFollowStats(userId: string): Promise<FollowStatsDto> {
    assertObjectId(userId, "ID người dùng");

    const userObjectId = new Types.ObjectId(userId);

    const [
      followersCount,
      followingCount,
      closeFriendsCount,
      pendingFollowRequestsCount,
      pendingCloseFriendRequestsCount,
      following,
    ] = await Promise.all([
      FollowModel.countDocuments({
        followingId: userObjectId,
        followStatus: FollowStatus.ACCEPTED,
      }),
      FollowModel.countDocuments({
        followerId: userObjectId,
        followStatus: FollowStatus.ACCEPTED,
      }),
      FollowModel.countDocuments({
        followerId: userObjectId,
        followStatus: FollowStatus.ACCEPTED,
        closeFriendStatus: CloseFriendStatus.ACCEPTED,
      }),
      FollowModel.countDocuments({
        followingId: userObjectId,
        followStatus: FollowStatus.PENDING,
      }),
      FollowModel.countDocuments({
        followingId: userObjectId,
        followStatus: FollowStatus.ACCEPTED,
        closeFriendStatus: CloseFriendStatus.PENDING,
        closeFriendRequestedBy: { $ne: userObjectId },
      }),
      FollowModel.find({
        followerId: userObjectId,
        followStatus: FollowStatus.ACCEPTED,
      })
        .select("followingId")
        .lean(),
    ]);

    // Count mutual follows (friends)
    const followingIds = following.map((f) => f.followingId);
    const friendsCount = await FollowModel.countDocuments({
      followerId: { $in: followingIds },
      followingId: userObjectId,
      followStatus: FollowStatus.ACCEPTED,
    });

    return {
      followersCount,
      followingCount,
      friendsCount,
      closeFriendsCount,
      pendingFollowRequestsCount,
      pendingCloseFriendRequestsCount,
    };
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ══════════════════════════════════════════════════════════════════════════════

  toFollowResponse(follow: any): FollowResponseDto {
    return {
      id: follow._id.toString(),
      followerId: follow.followerId.toString(),
      followingId: follow.followingId.toString(),
      followStatus: follow.followStatus,
      closeFriendStatus: follow.closeFriendStatus,
      createdAt: follow.createdAt,
      updatedAt: follow.updatedAt,
    };
  },
};
