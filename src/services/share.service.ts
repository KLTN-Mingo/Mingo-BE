import { Types } from "mongoose";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { getRedisClient } from "../lib/redis";
import { RepostDto, SendDMShareDto } from "../dtos/share.dto";
import { PostModel } from "../models/post.model";
import { RepostModel } from "../models/repost.model";
import { ShareMessageModel } from "../models/share-message.model";
import { FollowModel, FollowStatus } from "../models/follow.model";
import { UserModel } from "../models/user.model";
import { NotificationGateway } from "../socket/notification.gateway";

const FRIENDS_CACHE_TTL_SECONDS = 5 * 60;
const SHARE_RATE_LIMIT = 20;
const SHARE_RATE_WINDOW_SECONDS = 60;

async function enforceShareRateLimit(userId: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const key = `ratelimit:share:${userId}`;
  const total = await redis.incr(key);
  if (total === 1) {
    await redis.expire(key, SHARE_RATE_WINDOW_SECONDS);
  }

  if (total > SHARE_RATE_LIMIT) {
    throw new ValidationError(
      "Bạn đã vượt quá giới hạn 20 lần chia sẻ trong 1 phút",
      "SHARE_RATE_LIMIT_EXCEEDED"
    );
  }
}

async function getFriendsOfUserCached(userId: string): Promise<string[]> {
  const key = `friends:${userId}`;
  const redis = await getRedisClient();

  if (redis) {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as string[];
    }
  }

  const userObjectId = new Types.ObjectId(userId);
  const following = await FollowModel.find({
    followerId: userObjectId,
    followStatus: FollowStatus.ACCEPTED,
  })
    .select("followingId")
    .lean();

  const followingIds = following.map((row) => row.followingId.toString());
  if (!followingIds.length) {
    if (redis) {
      await redis.setEx(key, FRIENDS_CACHE_TTL_SECONDS, JSON.stringify([]));
    }
    return [];
  }

  const mutualRows = await FollowModel.find({
    followerId: { $in: followingIds.map((id) => new Types.ObjectId(id)) },
    followingId: userObjectId,
    followStatus: FollowStatus.ACCEPTED,
  })
    .select("followerId")
    .lean();

  const friendIds = mutualRows.map((row) => row.followerId.toString());
  if (redis) {
    await redis.setEx(key, FRIENDS_CACHE_TTL_SECONDS, JSON.stringify(friendIds));
  }

  return friendIds;
}

async function validatePostForShare(postId: string) {
  const post = await PostModel.findById(postId).select("userId isHidden").lean();
  if (!post || post.isHidden) {
    throw new NotFoundError("Bài viết không tồn tại hoặc đã bị xoá", "POST_NOT_FOUND");
  }
  return post;
}

export const ShareService = {
  async sendDM(senderId: string, dto: SendDMShareDto) {
    await enforceShareRateLimit(senderId);
    const post = await validatePostForShare(dto.postId);

    const recipientIds = Array.from(new Set(dto.recipientIds));
    if (!recipientIds.length) {
      throw new ValidationError("Danh sách người nhận không hợp lệ", "RECIPIENTS_INVALID");
    }
    if (recipientIds.length > 10) {
      throw new ValidationError("Chỉ được gửi tối đa 10 người", "RECIPIENTS_LIMIT_EXCEEDED");
    }
    if (recipientIds.some((id) => id === senderId)) {
      throw new ValidationError("Không thể gửi share cho chính mình", "RECIPIENT_SELF_INVALID");
    }

    const [sender, friends] = await Promise.all([
      UserModel.findById(senderId).select("name avatar").lean(),
      getFriendsOfUserCached(senderId),
    ]);

    const friendSet = new Set(friends);
    const invalidRecipients = recipientIds.filter((id) => !friendSet.has(id));
    if (invalidRecipients.length > 0) {
      throw new ValidationError(
        "Chỉ có thể DM share cho bạn bè",
        "RECIPIENT_NOT_FRIEND"
      );
    }

    const records = await ShareMessageModel.insertMany(
      recipientIds.map((recipientId) => ({
        postId: new Types.ObjectId(dto.postId),
        senderId: new Types.ObjectId(senderId),
        recipientId: new Types.ObjectId(recipientId),
        message: dto.message?.trim() || "",
      }))
    );

    for (const record of records) {
      NotificationGateway.emitDmShare(record.recipientId.toString(), {
        type: "dm_share",
        shareId: record._id.toString(),
        postId: dto.postId,
        actor: {
          id: senderId,
          name: sender?.name,
          avatar: sender?.avatar,
        },
        recipientId: record.recipientId.toString(),
        message: dto.message,
        createdAt: record.createdAt.toISOString(),
      });
    }

    // Notify owner for share activity if post owner differs from sender.
    if (post.userId.toString() !== senderId) {
      NotificationGateway.emitDmShare(post.userId.toString(), {
        type: "dm_share",
        shareId: records[0]._id.toString(),
        postId: dto.postId,
        actor: {
          id: senderId,
          name: sender?.name,
          avatar: sender?.avatar,
        },
        recipientId: post.userId.toString(),
        message: dto.message,
        createdAt: records[0].createdAt.toISOString(),
      });
    }

    return {
      postId: dto.postId,
      recipientIds,
      sentCount: records.length,
    };
  },

  async repost(authorId: string, dto: RepostDto) {
    await enforceShareRateLimit(authorId);
    const post = await validatePostForShare(dto.postId);

    if (post.userId.toString() === authorId) {
      throw new ValidationError("Không thể repost bài viết của chính mình", "REPOST_OWN_POST_FORBIDDEN");
    }

    const existed = await RepostModel.findOne({
      authorId: new Types.ObjectId(authorId),
      postId: new Types.ObjectId(dto.postId),
      isDeleted: false,
    })
      .select("_id")
      .lean();

    if (existed) {
      throw new ConflictError("Bạn đã repost bài viết này rồi", "REPOST_DUPLICATED");
    }

    const [author, repost] = await Promise.all([
      UserModel.findById(authorId).select("name avatar").lean(),
      RepostModel.create({
        authorId: new Types.ObjectId(authorId),
        postId: new Types.ObjectId(dto.postId),
        comment: dto.comment?.trim() || "",
        isDeleted: false,
      }),
    ]);

    await PostModel.findByIdAndUpdate(dto.postId, { $inc: { repostCount: 1 } });

    NotificationGateway.emitRepost(post.userId.toString(), {
      type: "repost",
      shareId: repost._id.toString(),
      postId: dto.postId,
      actor: {
        id: authorId,
        name: author?.name,
        avatar: author?.avatar,
      },
      recipientId: post.userId.toString(),
      message: dto.comment,
      createdAt: repost.createdAt.toISOString(),
    });

    return {
      repostId: repost._id.toString(),
      postId: dto.postId,
      comment: repost.comment,
      createdAt: repost.createdAt,
    };
  },
};
