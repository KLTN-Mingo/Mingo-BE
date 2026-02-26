// src/services/follow.service.ts

import { Types } from "mongoose";
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
      await existing.save();
      return this.toFollowResponse(existing);
    }

    const follow = await FollowModel.create({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
      followStatus: FollowStatus.PENDING,
      closeFriendStatus: CloseFriendStatus.NONE,
    });

    return this.toFollowResponse(follow);
  },

  // Phản hồi follow request (accept/reject)
  async respondFollowRequest(
    userId: string,
    requestId: string,
    accept: boolean
  ): Promise<FollowResponseDto> {
    assertObjectId(requestId, "ID yêu cầu");

    const follow = await FollowModel.findById(requestId);
    if (!follow) {
      throw new NotFoundError("Yêu cầu follow không tồn tại");
    }

    // Only the followingId (receiver) can respond
    if (follow.followingId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền phản hồi yêu cầu này");
    }

    if (follow.followStatus !== FollowStatus.PENDING) {
      throw new ConflictError("Yêu cầu này đã được xử lý");
    }

    follow.followStatus = accept ? FollowStatus.ACCEPTED : FollowStatus.REJECTED;
    await follow.save();

    // Update follower/following counts if accepted
    if (accept) {
      await Promise.all([
        UserModel.findByIdAndUpdate(follow.followerId, {
          $inc: { followingCount: 1 },
        }),
        UserModel.findByIdAndUpdate(follow.followingId, {
          $inc: { followersCount: 1 },
        }),
      ]);
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

    const follow = await FollowModel.findOne({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(followingId),
    });

    if (!follow) {
      throw new NotFoundError("Bạn chưa follow người này");
    }

    const wasAccepted = follow.followStatus === FollowStatus.ACCEPTED;

    await follow.deleteOne();

    // Update counts if was accepted
    if (wasAccepted) {
      await Promise.all([
        UserModel.findByIdAndUpdate(followerId, {
          $inc: { followingCount: -1 },
        }),
        UserModel.findByIdAndUpdate(followingId, {
          $inc: { followersCount: -1 },
        }),
      ]);
    }
  },

  // Xóa follower (remove someone who follows you)
  async removeFollower(userId: string, followerId: string): Promise<void> {
    assertObjectId(followerId, "ID người follow");

    const follow = await FollowModel.findOne({
      followerId: new Types.ObjectId(followerId),
      followingId: new Types.ObjectId(userId),
      followStatus: FollowStatus.ACCEPTED,
    });

    if (!follow) {
      throw new NotFoundError("Người này không follow bạn");
    }

    await follow.deleteOne();

    await Promise.all([
      UserModel.findByIdAndUpdate(followerId, {
        $inc: { followingCount: -1 },
      }),
      UserModel.findByIdAndUpdate(userId, {
        $inc: { followersCount: -1 },
      }),
    ]);
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

    // Check if they are mutual friends (both follow each other)
    const [followToTarget, followFromTarget] = await Promise.all([
      FollowModel.findOne({
        followerId: new Types.ObjectId(requesterId),
        followingId: new Types.ObjectId(targetId),
        followStatus: FollowStatus.ACCEPTED,
      }),
      FollowModel.findOne({
        followerId: new Types.ObjectId(targetId),
        followingId: new Types.ObjectId(requesterId),
        followStatus: FollowStatus.ACCEPTED,
      }),
    ]);

    if (!followToTarget || !followFromTarget) {
      throw new ValidationError(
        "Cả hai phải là bạn bè (mutual follow) mới có thể gửi request bạn thân"
      );
    }

    // Check current close friend status
    if (followToTarget.closeFriendStatus === CloseFriendStatus.ACCEPTED) {
      throw new ConflictError("Hai bạn đã là bạn thân rồi");
    }

    if (followToTarget.closeFriendStatus === CloseFriendStatus.PENDING) {
      throw new ConflictError("Yêu cầu bạn thân đang chờ xác nhận");
    }

    // Update both follow records
    const now = new Date();
    await Promise.all([
      FollowModel.findByIdAndUpdate(followToTarget._id, {
        closeFriendStatus: CloseFriendStatus.PENDING,
        closeFriendRequestedBy: new Types.ObjectId(requesterId),
        closeFriendRequestedAt: now,
      }),
      FollowModel.findByIdAndUpdate(followFromTarget._id, {
        closeFriendStatus: CloseFriendStatus.PENDING,
        closeFriendRequestedBy: new Types.ObjectId(requesterId),
        closeFriendRequestedAt: now,
      }),
    ]);

    const updated = await FollowModel.findById(followToTarget._id);
    return this.toFollowResponse(updated!);
  },

  // Phản hồi request bạn thân
  async respondCloseFriendRequest(
    userId: string,
    requestId: string,
    accept: boolean
  ): Promise<FollowResponseDto> {
    assertObjectId(requestId, "ID yêu cầu");

    const follow = await FollowModel.findById(requestId);
    if (!follow) {
      throw new NotFoundError("Yêu cầu không tồn tại");
    }

    if (follow.closeFriendStatus !== CloseFriendStatus.PENDING) {
      throw new ConflictError("Yêu cầu này đã được xử lý");
    }

    // Only the non-requester can respond
    if (follow.closeFriendRequestedBy?.toString() === userId) {
      throw new ForbiddenError("Bạn không thể phản hồi request của chính mình");
    }

    // Make sure user is part of this relationship
    const isFollower = follow.followerId.toString() === userId;
    const isFollowing = follow.followingId.toString() === userId;
    if (!isFollower && !isFollowing) {
      throw new ForbiddenError("Bạn không có quyền phản hồi yêu cầu này");
    }

    const newStatus = accept
      ? CloseFriendStatus.ACCEPTED
      : CloseFriendStatus.REJECTED;

    // Update both follow records
    const otherUserId = isFollower
      ? follow.followingId
      : follow.followerId;

    await Promise.all([
      FollowModel.findByIdAndUpdate(follow._id, {
        closeFriendStatus: newStatus,
      }),
      FollowModel.findOneAndUpdate(
        {
          followerId: otherUserId,
          followingId: new Types.ObjectId(userId),
        },
        {
          closeFriendStatus: newStatus,
        }
      ),
    ]);

    const updated = await FollowModel.findById(follow._id);
    return this.toFollowResponse(updated!);
  },

  // Hủy bạn thân
  async removeCloseFriend(userId: string, targetId: string): Promise<void> {
    assertObjectId(targetId, "ID người dùng");

    const [follow1, follow2] = await Promise.all([
      FollowModel.findOne({
        followerId: new Types.ObjectId(userId),
        followingId: new Types.ObjectId(targetId),
      }),
      FollowModel.findOne({
        followerId: new Types.ObjectId(targetId),
        followingId: new Types.ObjectId(userId),
      }),
    ]);

    if (!follow1 && !follow2) {
      throw new NotFoundError("Không tìm thấy quan hệ với người này");
    }

    // Reset close friend status on both
    await Promise.all([
      follow1 &&
        FollowModel.findByIdAndUpdate(follow1._id, {
          closeFriendStatus: CloseFriendStatus.NONE,
          closeFriendRequestedBy: undefined,
          closeFriendRequestedAt: undefined,
        }),
      follow2 &&
        FollowModel.findByIdAndUpdate(follow2._id, {
          closeFriendStatus: CloseFriendStatus.NONE,
          closeFriendRequestedBy: undefined,
          closeFriendRequestedAt: undefined,
        }),
    ]);
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
      .select("followerId createdAt")
      .lean();

    const mutualSet = new Map(
      mutualFollows.map((f) => [f.followerId.toString(), f.createdAt])
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
            mutualSet.get(f.followingId.toString())?.getTime() || 0
          )
        );

        return {
          id: f.followingId.toString(),
          user: user ? toUserMinimal(user) : { id: f.followingId.toString(), verified: false },
          isCloseFriend: f.closeFriendStatus === CloseFriendStatus.ACCEPTED,
          closeFriendStatus: f.closeFriendStatus,
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

    const [closeFriends, total] = await Promise.all([
      FollowModel.find(query)
        .populate("followingId", "name avatar verified")
        .sort({ closeFriendRequestedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FollowModel.countDocuments(query),
    ]);

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
      $or: [
        { followerId: new Types.ObjectId(userId) },
        { followingId: new Types.ObjectId(userId) },
      ],
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

    const [followToTarget, followFromTarget] = await Promise.all([
      FollowModel.findOne({
        followerId: new Types.ObjectId(currentUserId),
        followingId: new Types.ObjectId(targetUserId),
      }).lean(),
      FollowModel.findOne({
        followerId: new Types.ObjectId(targetUserId),
        followingId: new Types.ObjectId(currentUserId),
      }).lean(),
    ]);

    const isFollowing = !!followToTarget;
    const isFollower = !!followFromTarget;
    const followStatus = followToTarget?.followStatus;
    const followerStatus = followFromTarget?.followStatus;

    const isFriend =
      isFollowing &&
      isFollower &&
      followStatus === FollowStatus.ACCEPTED &&
      followerStatus === FollowStatus.ACCEPTED;

    const closeFriendStatus =
      followToTarget?.closeFriendStatus || CloseFriendStatus.NONE;
    const isCloseFriend = closeFriendStatus === CloseFriendStatus.ACCEPTED;

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
        closeFriendStatus: CloseFriendStatus.ACCEPTED,
      }),
      FollowModel.countDocuments({
        followingId: userObjectId,
        followStatus: FollowStatus.PENDING,
      }),
      FollowModel.countDocuments({
        $or: [{ followerId: userObjectId }, { followingId: userObjectId }],
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
