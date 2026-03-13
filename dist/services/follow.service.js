"use strict";
// src/services/follow.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowService = void 0;
const mongoose_1 = require("mongoose");
const follow_model_1 = require("../models/follow.model");
const user_model_1 = require("../models/user.model");
const errors_1 = require("../errors");
const user_dto_1 = require("../dtos/user.dto");
const follow_dto_1 = require("../dtos/follow.dto");
// Helper: validate ObjectId
function assertObjectId(id, label) {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new errors_1.ValidationError(`${label} không hợp lệ`);
    }
}
// Helper: check user exists
async function assertUserExists(userId, label = "Người dùng") {
    const user = await user_model_1.UserModel.findById(userId);
    if (!user) {
        throw new errors_1.NotFoundError(`${label} không tồn tại`);
    }
    return user;
}
exports.FollowService = {
    // ══════════════════════════════════════════════════════════════════════════════
    // FOLLOW REQUESTS
    // ══════════════════════════════════════════════════════════════════════════════
    // Gửi follow request
    async sendFollowRequest(followerId, followingId) {
        assertObjectId(followerId, "ID người follow");
        assertObjectId(followingId, "ID người được follow");
        if (followerId === followingId) {
            throw new errors_1.ValidationError("Không thể tự follow chính mình");
        }
        await assertUserExists(followingId, "Người dùng bạn muốn follow");
        // Check if already exists
        const existing = await follow_model_1.FollowModel.findOne({
            followerId: new mongoose_1.Types.ObjectId(followerId),
            followingId: new mongoose_1.Types.ObjectId(followingId),
        });
        if (existing) {
            if (existing.followStatus === follow_model_1.FollowStatus.ACCEPTED) {
                throw new errors_1.ConflictError("Bạn đã follow người này rồi");
            }
            if (existing.followStatus === follow_model_1.FollowStatus.PENDING) {
                throw new errors_1.ConflictError("Yêu cầu follow đang chờ xác nhận");
            }
            // If rejected, allow re-request
            existing.followStatus = follow_model_1.FollowStatus.PENDING;
            await existing.save();
            return this.toFollowResponse(existing);
        }
        const follow = await follow_model_1.FollowModel.create({
            followerId: new mongoose_1.Types.ObjectId(followerId),
            followingId: new mongoose_1.Types.ObjectId(followingId),
            followStatus: follow_model_1.FollowStatus.PENDING,
            closeFriendStatus: follow_model_1.CloseFriendStatus.NONE,
        });
        return this.toFollowResponse(follow);
    },
    // Phản hồi follow request (accept/reject)
    async respondFollowRequest(userId, requestId, accept) {
        assertObjectId(requestId, "ID yêu cầu");
        const follow = await follow_model_1.FollowModel.findById(requestId);
        if (!follow) {
            throw new errors_1.NotFoundError("Yêu cầu follow không tồn tại");
        }
        // Only the followingId (receiver) can respond
        if (follow.followingId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Bạn không có quyền phản hồi yêu cầu này");
        }
        if (follow.followStatus !== follow_model_1.FollowStatus.PENDING) {
            throw new errors_1.ConflictError("Yêu cầu này đã được xử lý");
        }
        follow.followStatus = accept ? follow_model_1.FollowStatus.ACCEPTED : follow_model_1.FollowStatus.REJECTED;
        await follow.save();
        // Update follower/following counts if accepted
        if (accept) {
            await Promise.all([
                user_model_1.UserModel.findByIdAndUpdate(follow.followerId, {
                    $inc: { followingCount: 1 },
                }),
                user_model_1.UserModel.findByIdAndUpdate(follow.followingId, {
                    $inc: { followersCount: 1 },
                }),
            ]);
        }
        return this.toFollowResponse(follow);
    },
    // Hủy follow request đã gửi
    async cancelFollowRequest(followerId, followingId) {
        assertObjectId(followingId, "ID người được follow");
        const follow = await follow_model_1.FollowModel.findOne({
            followerId: new mongoose_1.Types.ObjectId(followerId),
            followingId: new mongoose_1.Types.ObjectId(followingId),
            followStatus: follow_model_1.FollowStatus.PENDING,
        });
        if (!follow) {
            throw new errors_1.NotFoundError("Không tìm thấy yêu cầu follow đang chờ");
        }
        await follow.deleteOne();
    },
    // Unfollow
    async unfollow(followerId, followingId) {
        assertObjectId(followingId, "ID người được follow");
        const follow = await follow_model_1.FollowModel.findOne({
            followerId: new mongoose_1.Types.ObjectId(followerId),
            followingId: new mongoose_1.Types.ObjectId(followingId),
        });
        if (!follow) {
            throw new errors_1.NotFoundError("Bạn chưa follow người này");
        }
        const wasAccepted = follow.followStatus === follow_model_1.FollowStatus.ACCEPTED;
        await follow.deleteOne();
        // Update counts if was accepted
        if (wasAccepted) {
            await Promise.all([
                user_model_1.UserModel.findByIdAndUpdate(followerId, {
                    $inc: { followingCount: -1 },
                }),
                user_model_1.UserModel.findByIdAndUpdate(followingId, {
                    $inc: { followersCount: -1 },
                }),
            ]);
        }
    },
    // Xóa follower (remove someone who follows you)
    async removeFollower(userId, followerId) {
        assertObjectId(followerId, "ID người follow");
        const follow = await follow_model_1.FollowModel.findOne({
            followerId: new mongoose_1.Types.ObjectId(followerId),
            followingId: new mongoose_1.Types.ObjectId(userId),
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
        });
        if (!follow) {
            throw new errors_1.NotFoundError("Người này không follow bạn");
        }
        await follow.deleteOne();
        await Promise.all([
            user_model_1.UserModel.findByIdAndUpdate(followerId, {
                $inc: { followingCount: -1 },
            }),
            user_model_1.UserModel.findByIdAndUpdate(userId, {
                $inc: { followersCount: -1 },
            }),
        ]);
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // CLOSE FRIEND REQUESTS
    // ══════════════════════════════════════════════════════════════════════════════
    // Gửi request bạn thân
    async sendCloseFriendRequest(requesterId, targetId) {
        assertObjectId(targetId, "ID người dùng");
        if (requesterId === targetId) {
            throw new errors_1.ValidationError("Không thể tự gửi request bạn thân cho mình");
        }
        // Check if they are mutual friends (both follow each other)
        const [followToTarget, followFromTarget] = await Promise.all([
            follow_model_1.FollowModel.findOne({
                followerId: new mongoose_1.Types.ObjectId(requesterId),
                followingId: new mongoose_1.Types.ObjectId(targetId),
                followStatus: follow_model_1.FollowStatus.ACCEPTED,
            }),
            follow_model_1.FollowModel.findOne({
                followerId: new mongoose_1.Types.ObjectId(targetId),
                followingId: new mongoose_1.Types.ObjectId(requesterId),
                followStatus: follow_model_1.FollowStatus.ACCEPTED,
            }),
        ]);
        if (!followToTarget || !followFromTarget) {
            throw new errors_1.ValidationError("Cả hai phải là bạn bè (mutual follow) mới có thể gửi request bạn thân");
        }
        // Check current close friend status
        if (followToTarget.closeFriendStatus === follow_model_1.CloseFriendStatus.ACCEPTED) {
            throw new errors_1.ConflictError("Hai bạn đã là bạn thân rồi");
        }
        if (followToTarget.closeFriendStatus === follow_model_1.CloseFriendStatus.PENDING) {
            throw new errors_1.ConflictError("Yêu cầu bạn thân đang chờ xác nhận");
        }
        // Update both follow records
        const now = new Date();
        await Promise.all([
            follow_model_1.FollowModel.findByIdAndUpdate(followToTarget._id, {
                closeFriendStatus: follow_model_1.CloseFriendStatus.PENDING,
                closeFriendRequestedBy: new mongoose_1.Types.ObjectId(requesterId),
                closeFriendRequestedAt: now,
            }),
            follow_model_1.FollowModel.findByIdAndUpdate(followFromTarget._id, {
                closeFriendStatus: follow_model_1.CloseFriendStatus.PENDING,
                closeFriendRequestedBy: new mongoose_1.Types.ObjectId(requesterId),
                closeFriendRequestedAt: now,
            }),
        ]);
        const updated = await follow_model_1.FollowModel.findById(followToTarget._id);
        return this.toFollowResponse(updated);
    },
    // Phản hồi request bạn thân
    async respondCloseFriendRequest(userId, requestId, accept) {
        assertObjectId(requestId, "ID yêu cầu");
        const follow = await follow_model_1.FollowModel.findById(requestId);
        if (!follow) {
            throw new errors_1.NotFoundError("Yêu cầu không tồn tại");
        }
        if (follow.closeFriendStatus !== follow_model_1.CloseFriendStatus.PENDING) {
            throw new errors_1.ConflictError("Yêu cầu này đã được xử lý");
        }
        // Only the non-requester can respond
        if (follow.closeFriendRequestedBy?.toString() === userId) {
            throw new errors_1.ForbiddenError("Bạn không thể phản hồi request của chính mình");
        }
        // Make sure user is part of this relationship
        const isFollower = follow.followerId.toString() === userId;
        const isFollowing = follow.followingId.toString() === userId;
        if (!isFollower && !isFollowing) {
            throw new errors_1.ForbiddenError("Bạn không có quyền phản hồi yêu cầu này");
        }
        const newStatus = accept
            ? follow_model_1.CloseFriendStatus.ACCEPTED
            : follow_model_1.CloseFriendStatus.REJECTED;
        // Update both follow records
        const otherUserId = isFollower
            ? follow.followingId
            : follow.followerId;
        await Promise.all([
            follow_model_1.FollowModel.findByIdAndUpdate(follow._id, {
                closeFriendStatus: newStatus,
            }),
            follow_model_1.FollowModel.findOneAndUpdate({
                followerId: otherUserId,
                followingId: new mongoose_1.Types.ObjectId(userId),
            }, {
                closeFriendStatus: newStatus,
            }),
        ]);
        const updated = await follow_model_1.FollowModel.findById(follow._id);
        return this.toFollowResponse(updated);
    },
    // Hủy bạn thân
    async removeCloseFriend(userId, targetId) {
        assertObjectId(targetId, "ID người dùng");
        const [follow1, follow2] = await Promise.all([
            follow_model_1.FollowModel.findOne({
                followerId: new mongoose_1.Types.ObjectId(userId),
                followingId: new mongoose_1.Types.ObjectId(targetId),
            }),
            follow_model_1.FollowModel.findOne({
                followerId: new mongoose_1.Types.ObjectId(targetId),
                followingId: new mongoose_1.Types.ObjectId(userId),
            }),
        ]);
        if (!follow1 && !follow2) {
            throw new errors_1.NotFoundError("Không tìm thấy quan hệ với người này");
        }
        // Reset close friend status on both
        await Promise.all([
            follow1 &&
                follow_model_1.FollowModel.findByIdAndUpdate(follow1._id, {
                    closeFriendStatus: follow_model_1.CloseFriendStatus.NONE,
                    closeFriendRequestedBy: undefined,
                    closeFriendRequestedAt: undefined,
                }),
            follow2 &&
                follow_model_1.FollowModel.findByIdAndUpdate(follow2._id, {
                    closeFriendStatus: follow_model_1.CloseFriendStatus.NONE,
                    closeFriendRequestedBy: undefined,
                    closeFriendRequestedAt: undefined,
                }),
        ]);
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // QUERY METHODS
    // ══════════════════════════════════════════════════════════════════════════════
    // Lấy danh sách followers
    async getFollowers(userId, currentUserId, page = 1, limit = 20, status) {
        assertObjectId(userId, "ID người dùng");
        const query = {
            followingId: new mongoose_1.Types.ObjectId(userId),
        };
        if (status) {
            query.followStatus = status;
        }
        else {
            query.followStatus = follow_model_1.FollowStatus.ACCEPTED;
        }
        const [followers, total] = await Promise.all([
            follow_model_1.FollowModel.find(query)
                .populate("followerId", "name avatar verified")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            follow_model_1.FollowModel.countDocuments(query),
        ]);
        // Check if current user follows back each follower
        const followerIds = followers.map((f) => f.followerId._id || f.followerId);
        const currentUserFollows = await follow_model_1.FollowModel.find({
            followerId: new mongoose_1.Types.ObjectId(currentUserId),
            followingId: { $in: followerIds },
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
        }).lean();
        const followingSet = new Set(currentUserFollows.map((f) => f.followingId.toString()));
        const totalPages = Math.ceil(total / limit);
        return {
            followers: followers.map((f) => {
                const followerUser = f.followerId;
                const isFollowingBack = followingSet.has(followerUser._id.toString());
                const relationshipType = (0, follow_dto_1.determineRelationshipType)(isFollowingBack, true, isFollowingBack ? follow_model_1.FollowStatus.ACCEPTED : undefined, f.followStatus, f.closeFriendStatus);
                return {
                    id: f._id.toString(),
                    follower: (0, user_dto_1.toUserMinimal)(followerUser),
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
    async getFollowing(userId, currentUserId, page = 1, limit = 20, status) {
        assertObjectId(userId, "ID người dùng");
        const query = {
            followerId: new mongoose_1.Types.ObjectId(userId),
        };
        if (status) {
            query.followStatus = status;
        }
        else {
            query.followStatus = follow_model_1.FollowStatus.ACCEPTED;
        }
        const [following, total] = await Promise.all([
            follow_model_1.FollowModel.find(query)
                .populate("followingId", "name avatar verified")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            follow_model_1.FollowModel.countDocuments(query),
        ]);
        // Check if each following user follows back
        const followingIds = following.map((f) => f.followingId._id || f.followingId);
        const followsBack = await follow_model_1.FollowModel.find({
            followerId: { $in: followingIds },
            followingId: new mongoose_1.Types.ObjectId(userId),
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
        }).lean();
        const followerSet = new Set(followsBack.map((f) => f.followerId.toString()));
        const totalPages = Math.ceil(total / limit);
        return {
            following: following.map((f) => {
                const followingUser = f.followingId;
                const isFollower = followerSet.has(followingUser._id.toString());
                const relationshipType = (0, follow_dto_1.determineRelationshipType)(true, isFollower, f.followStatus, isFollower ? follow_model_1.FollowStatus.ACCEPTED : undefined, f.closeFriendStatus);
                return {
                    id: f._id.toString(),
                    following: (0, user_dto_1.toUserMinimal)(followingUser),
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
    async getFriends(userId, page = 1, limit = 20) {
        assertObjectId(userId, "ID người dùng");
        const userObjectId = new mongoose_1.Types.ObjectId(userId);
        // Find users where both follow each other
        const following = await follow_model_1.FollowModel.find({
            followerId: userObjectId,
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
        })
            .select("followingId closeFriendStatus createdAt")
            .lean();
        const followingIds = following.map((f) => f.followingId);
        // Find which of those also follow back
        const mutualFollows = await follow_model_1.FollowModel.find({
            followerId: { $in: followingIds },
            followingId: userObjectId,
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
        })
            .select("followerId createdAt")
            .lean();
        const mutualSet = new Map(mutualFollows.map((f) => [f.followerId.toString(), f.createdAt]));
        // Filter to only mutual
        const friends = following.filter((f) => mutualSet.has(f.followingId.toString()));
        const total = friends.length;
        const totalPages = Math.ceil(total / limit);
        const paginated = friends.slice((page - 1) * limit, page * limit);
        // Populate user info
        const friendIds = paginated.map((f) => f.followingId);
        const users = await user_model_1.UserModel.find({ _id: { $in: friendIds } })
            .select("name avatar verified")
            .lean();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        return {
            friends: paginated.map((f) => {
                const user = userMap.get(f.followingId.toString());
                const friendsSince = new Date(Math.max(f.createdAt.getTime(), mutualSet.get(f.followingId.toString())?.getTime() || 0));
                return {
                    id: f.followingId.toString(),
                    user: user ? (0, user_dto_1.toUserMinimal)(user) : { id: f.followingId.toString(), verified: false },
                    isCloseFriend: f.closeFriendStatus === follow_model_1.CloseFriendStatus.ACCEPTED,
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
    async getCloseFriends(userId, page = 1, limit = 20) {
        assertObjectId(userId, "ID người dùng");
        const query = {
            followerId: new mongoose_1.Types.ObjectId(userId),
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
            closeFriendStatus: follow_model_1.CloseFriendStatus.ACCEPTED,
        };
        const [closeFriends, total] = await Promise.all([
            follow_model_1.FollowModel.find(query)
                .populate("followingId", "name avatar verified")
                .sort({ closeFriendRequestedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            follow_model_1.FollowModel.countDocuments(query),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            closeFriends: closeFriends.map((f) => ({
                id: f._id.toString(),
                user: (0, user_dto_1.toUserMinimal)(f.followingId),
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
    async getPendingFollowRequests(userId, page = 1, limit = 20) {
        const query = {
            followingId: new mongoose_1.Types.ObjectId(userId),
            followStatus: follow_model_1.FollowStatus.PENDING,
        };
        const [requests, total] = await Promise.all([
            follow_model_1.FollowModel.find(query)
                .populate("followerId", "name avatar verified")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            follow_model_1.FollowModel.countDocuments(query),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            requests: requests.map((r) => ({
                id: r._id.toString(),
                user: (0, user_dto_1.toUserMinimal)(r.followerId),
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
    async getSentFollowRequests(userId, page = 1, limit = 20) {
        const query = {
            followerId: new mongoose_1.Types.ObjectId(userId),
            followStatus: follow_model_1.FollowStatus.PENDING,
        };
        const [requests, total] = await Promise.all([
            follow_model_1.FollowModel.find(query)
                .populate("followingId", "name avatar verified")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            follow_model_1.FollowModel.countDocuments(query),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            requests: requests.map((r) => ({
                id: r._id.toString(),
                user: (0, user_dto_1.toUserMinimal)(r.followingId),
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
    async getPendingCloseFriendRequests(userId, page = 1, limit = 20) {
        const query = {
            $or: [
                { followerId: new mongoose_1.Types.ObjectId(userId) },
                { followingId: new mongoose_1.Types.ObjectId(userId) },
            ],
            closeFriendStatus: follow_model_1.CloseFriendStatus.PENDING,
            closeFriendRequestedBy: { $ne: new mongoose_1.Types.ObjectId(userId) },
        };
        const [requests, total] = await Promise.all([
            follow_model_1.FollowModel.find(query)
                .populate("followerId", "name avatar verified")
                .populate("followingId", "name avatar verified")
                .sort({ closeFriendRequestedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            follow_model_1.FollowModel.countDocuments(query),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            requests: requests.map((r) => {
                const requesterId = r.closeFriendRequestedBy?.toString();
                const requester = r.followerId._id?.toString() === requesterId
                    ? r.followerId
                    : r.followingId;
                return {
                    id: r._id.toString(),
                    user: (0, user_dto_1.toUserMinimal)(requester),
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
    async getRelationshipStatus(currentUserId, targetUserId) {
        assertObjectId(targetUserId, "ID người dùng");
        if (currentUserId === targetUserId) {
            return {
                isFollowing: false,
                isFollower: false,
                isFriend: false,
                isCloseFriend: false,
                closeFriendStatus: follow_model_1.CloseFriendStatus.NONE,
                relationshipType: follow_dto_1.RelationshipType.NONE,
            };
        }
        const [followToTarget, followFromTarget] = await Promise.all([
            follow_model_1.FollowModel.findOne({
                followerId: new mongoose_1.Types.ObjectId(currentUserId),
                followingId: new mongoose_1.Types.ObjectId(targetUserId),
            }).lean(),
            follow_model_1.FollowModel.findOne({
                followerId: new mongoose_1.Types.ObjectId(targetUserId),
                followingId: new mongoose_1.Types.ObjectId(currentUserId),
            }).lean(),
        ]);
        const isFollowing = !!followToTarget;
        const isFollower = !!followFromTarget;
        const followStatus = followToTarget?.followStatus;
        const followerStatus = followFromTarget?.followStatus;
        const isFriend = isFollowing &&
            isFollower &&
            followStatus === follow_model_1.FollowStatus.ACCEPTED &&
            followerStatus === follow_model_1.FollowStatus.ACCEPTED;
        const closeFriendStatus = followToTarget?.closeFriendStatus || follow_model_1.CloseFriendStatus.NONE;
        const isCloseFriend = closeFriendStatus === follow_model_1.CloseFriendStatus.ACCEPTED;
        const relationshipType = (0, follow_dto_1.determineRelationshipType)(isFollowing, isFollower, followStatus, followerStatus, closeFriendStatus);
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
    async getFollowStats(userId) {
        assertObjectId(userId, "ID người dùng");
        const userObjectId = new mongoose_1.Types.ObjectId(userId);
        const [followersCount, followingCount, closeFriendsCount, pendingFollowRequestsCount, pendingCloseFriendRequestsCount, following,] = await Promise.all([
            follow_model_1.FollowModel.countDocuments({
                followingId: userObjectId,
                followStatus: follow_model_1.FollowStatus.ACCEPTED,
            }),
            follow_model_1.FollowModel.countDocuments({
                followerId: userObjectId,
                followStatus: follow_model_1.FollowStatus.ACCEPTED,
            }),
            follow_model_1.FollowModel.countDocuments({
                followerId: userObjectId,
                closeFriendStatus: follow_model_1.CloseFriendStatus.ACCEPTED,
            }),
            follow_model_1.FollowModel.countDocuments({
                followingId: userObjectId,
                followStatus: follow_model_1.FollowStatus.PENDING,
            }),
            follow_model_1.FollowModel.countDocuments({
                $or: [{ followerId: userObjectId }, { followingId: userObjectId }],
                closeFriendStatus: follow_model_1.CloseFriendStatus.PENDING,
                closeFriendRequestedBy: { $ne: userObjectId },
            }),
            follow_model_1.FollowModel.find({
                followerId: userObjectId,
                followStatus: follow_model_1.FollowStatus.ACCEPTED,
            })
                .select("followingId")
                .lean(),
        ]);
        // Count mutual follows (friends)
        const followingIds = following.map((f) => f.followingId);
        const friendsCount = await follow_model_1.FollowModel.countDocuments({
            followerId: { $in: followingIds },
            followingId: userObjectId,
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
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
    toFollowResponse(follow) {
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
