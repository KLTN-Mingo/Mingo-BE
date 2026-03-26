// src/services/feed.service.ts

import { Types } from "mongoose";
import {
  PostModel,
  PostVisibility,
  ModerationStatus,
} from "../models/post.model";
import {
  FollowModel,
  FollowStatus,
  CloseFriendStatus,
} from "../models/follow.model";
import { UserProfileModel } from "../models/user-profile.model";
import { scoringService } from "./scoring.service";
import {
  CANDIDATE_POOL_SIZE,
  MAX_POST_AGE_DAYS,
  EXPLORATION_RATE,
} from "../constants/feed.constants";
import type { IPost } from "../models/post.model";
import type { PaginatedPostsDto, PostResponseDto } from "../dtos/post.dto";
import { toPostResponse } from "../dtos/post.dto";
import type { PostMediaDto, PostLocationDto } from "../dtos/post.dto";
import type { UserMinimalDto } from "../dtos/user.dto";
import { BlockModel } from "../models/block.model";
import { UserInteractionModel } from "../models/user-interaction.model";
import { PostMediaModel } from "../models/post-media.model";
import { PostHashtagModel } from "../models/post-hashtag.model";
import { PostMentionModel } from "../models/post-mention.model";
import { LikeModel } from "../models/like.model";
import { UserModel } from "../models/user.model";
import { toUserMinimal } from "../dtos/user.dto";
import { feedAnalyticsService } from "./feed-analytics.service";

export interface SocialIds {
  followingIds: Set<string>;
  friendIds: Set<string>;
  closeFriendIds: Set<string>;
}

async function getSocialIds(userId: string): Promise<SocialIds> {
  const userObjectId = new Types.ObjectId(userId);

  const [followingRows, followersRows, closeFriendRows] = await Promise.all([
    FollowModel.find({
      followerId: userObjectId,
      followStatus: FollowStatus.ACCEPTED,
    })
      .select("followingId")
      .lean(),
    FollowModel.find({
      followingId: userObjectId,
      followStatus: FollowStatus.ACCEPTED,
    })
      .select("followerId")
      .lean(),
    FollowModel.find({
      $or: [{ followerId: userObjectId }, { followingId: userObjectId }],
      closeFriendStatus: CloseFriendStatus.ACCEPTED,
    })
      .select("followerId followingId")
      .lean(),
  ]);

  const followingIds = new Set(
    (followingRows as any[]).map((r) => r.followingId.toString())
  );
  const followerIds = new Set(
    (followersRows as any[]).map((r) => r.followerId.toString())
  );
  const friendIds = new Set<string>();
  followingIds.forEach((id) => {
    if (followerIds.has(id)) friendIds.add(id);
  });

  const closeFriendIds = new Set<string>();
  (closeFriendRows as any[]).forEach((r) => {
    const a = r.followerId?.toString();
    const b = r.followingId?.toString();
    if (a && a !== userId) closeFriendIds.add(a);
    if (b && b !== userId) closeFriendIds.add(b);
  });

  return { followingIds, friendIds, closeFriendIds };
}

/** User IDs không được hiện trong feed: mình chặn họ hoặc họ chặn mình */
async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const userObjectId = new Types.ObjectId(userId);
  const [iBlocked, blockedMe] = await Promise.all([
    BlockModel.find({ blockerId: userObjectId }).select("blockedId").lean(),
    BlockModel.find({ blockedId: userObjectId }).select("blockerId").lean(),
  ]);
  const set = new Set<string>();
  (iBlocked as any[]).forEach((r) => set.add(r.blockedId.toString()));
  (blockedMe as any[]).forEach((r) => set.add(r.blockerId.toString()));
  return set;
}

/** Post IDs user đã xem (viewed=true) — loại khỏi feed để không thấy lại khi refresh */
async function getViewedPostIds(userId: string): Promise<Set<string>> {
  const rows = await UserInteractionModel.find({
    userId: new Types.ObjectId(userId),
    viewed: true,
  })
    .select("postId")
    .lean();
  return new Set((rows as any[]).map((r) => r.postId.toString()));
}

function canViewPost(
  post: { userId?: Types.ObjectId; visibility?: string },
  currentUserId: string,
  social: SocialIds
): boolean {
  const authorId = post.userId?.toString();
  if (!authorId) return false;
  if (authorId === currentUserId) return true;

  const visibility = post.visibility as PostVisibility | undefined;
  switch (visibility) {
    case PostVisibility.PUBLIC:
      return true;
    case PostVisibility.PRIVATE:
      return false;
    case PostVisibility.FRIENDS:
      return social.friendIds.has(authorId);
    case PostVisibility.BESTFRIENDS:
      return social.closeFriendIds.has(authorId);
    default:
      return false;
  }
}

export type PostRelationsForFeed = {
  user: UserMinimalDto | undefined;
  media: PostMediaDto[];
  hashtags: string[];
  mentions: UserMinimalDto[];
  location: PostLocationDto | undefined;
  isLiked: boolean;
  isSaved: boolean;
};

/** Batch load relations cho nhiều post — tránh N+1 (1 query author, 1 media, 1 hashtag, 1 mention, 1 like thay vì 5 per post). */
async function loadPostRelationsForFeedBatch(
  posts: Array<{
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    locationName?: string;
    locationLatitude?: number;
    locationLongitude?: number;
  }>,
  currentUserId: string
): Promise<Map<string, PostRelationsForFeed>> {
  const result = new Map<string, PostRelationsForFeed>();
  if (posts.length === 0) return result;

  const postIds = posts.map((p) => p._id);
  const authorIds = [...new Set(posts.map((p) => p.userId.toString()))].map(
    (id) => new Types.ObjectId(id)
  );
  const currentUserObjectId = new Types.ObjectId(currentUserId);

  const [authors, mediaRows, hashtagRows, mentionRows, likeRows] =
    await Promise.all([
      UserModel.find({ _id: { $in: authorIds } }).lean(),
      PostMediaModel.find({ postId: { $in: postIds } })
        .sort({ orderIndex: 1 })
        .lean(),
      PostHashtagModel.find({ postId: { $in: postIds } }).lean(),
      PostMentionModel.find({ postId: { $in: postIds } })
        .populate("mentionedUserId")
        .lean(),
      LikeModel.find({
        postId: { $in: postIds },
        userId: currentUserObjectId,
      })
        .select("postId")
        .lean(),
    ]);

  const authorMap = new Map<string, UserMinimalDto>();
  (authors as any[]).forEach((a) => {
    if (a?._id) authorMap.set(a._id.toString(), toUserMinimal(a));
  });

  const mediaByPost = new Map<string, PostMediaDto[]>();
  (mediaRows as any[]).forEach((m) => {
    const pid = m.postId?.toString();
    if (!pid) return;
    const arr = mediaByPost.get(pid) ?? [];
    arr.push({
      id: m._id.toString(),
      mediaType: m.mediaType,
      mediaUrl: m.mediaUrl,
      thumbnailUrl: m.thumbnailUrl,
      width: m.width,
      height: m.height,
      duration: m.duration,
      fileSize: m.fileSize,
      orderIndex: m.orderIndex,
    });
    mediaByPost.set(pid, arr);
  });

  const hashtagsByPost = new Map<string, string[]>();
  (hashtagRows as any[]).forEach((h) => {
    const pid = h.postId?.toString();
    if (!pid) return;
    const arr = hashtagsByPost.get(pid) ?? [];
    arr.push(h.hashtag);
    hashtagsByPost.set(pid, arr);
  });

  const mentionsByPost = new Map<string, UserMinimalDto[]>();
  (mentionRows as any[]).forEach((m) => {
    const pid = m.postId?.toString();
    if (!pid) return;
    const arr = mentionsByPost.get(pid) ?? [];
    const u = m.mentionedUserId ? toUserMinimal(m.mentionedUserId) : null;
    if (u) arr.push(u);
    mentionsByPost.set(pid, arr);
  });

  const likedPostIds = new Set(
    (likeRows as any[]).map((r) => r.postId?.toString()).filter(Boolean)
  );

  for (const post of posts) {
    const postIdStr = post._id.toString();
    const authorIdStr = post.userId?.toString();
    const location: PostLocationDto | undefined =
      post.locationName || post.locationLatitude != null
        ? {
            name: post.locationName,
            latitude: post.locationLatitude,
            longitude: post.locationLongitude,
          }
        : undefined;

    result.set(postIdStr, {
      user: authorIdStr ? authorMap.get(authorIdStr) : undefined,
      media: mediaByPost.get(postIdStr) ?? [],
      hashtags: hashtagsByPost.get(postIdStr) ?? [],
      mentions: mentionsByPost.get(postIdStr) ?? [],
      location,
      isLiked: likedPostIds.has(postIdStr),
      isSaved: false,
    });
  }

  return result;
}

function applyExploration<T>(sorted: T[], explorationRate: number): T[] {
  if (sorted.length <= 1 || explorationRate <= 0) return sorted;

  const keepTop = Math.max(
    1,
    Math.floor(sorted.length * (1 - explorationRate))
  );
  const top = sorted.slice(0, keepTop);
  const rest = sorted.slice(keepTop);
  if (rest.length === 0) return top;

  const shuffle = <T>(arr: T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  return [...top, ...shuffle(rest)];
}

export const FeedService = {
  /**
   * Feed Bạn bè: chỉ bài từ người đang follow (bạn thường hoặc bạn thân).
   * Sắp xếp theo thời gian mới nhất, không scoring/exploration.
   */
  async getFriendsFeed(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedPostsDto> {
    const [social, blockedUserIds, viewedPostIds] = await Promise.all([
      getSocialIds(userId),
      getBlockedUserIds(userId),
      getViewedPostIds(userId),
    ]);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_POST_AGE_DAYS);

    const followingObjectIds = [...social.followingIds].map(
      (id) => new Types.ObjectId(id)
    );
    if (followingObjectIds.length === 0) {
      return {
        posts: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
      };
    }

    const rawCandidates = await PostModel.find({
      userId: { $in: followingObjectIds },
      isHidden: false,
      moderationStatus: {
        $in: [ModerationStatus.APPROVED, ModerationStatus.PENDING],
      },
      createdAt: { $gte: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(CANDIDATE_POOL_SIZE * 2)
      .lean();

    const candidates: IPost[] = (rawCandidates as IPost[]).filter((post) => {
      if (viewedPostIds.has(post._id.toString())) return false;
      const authorId = post.userId?.toString();
      if (authorId && blockedUserIds.has(authorId)) return false;
      return canViewPost(post, userId, social);
    });

    const total = candidates.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const slice = candidates.slice(start, start + limit);

    if (slice.length === 0) {
      return {
        posts: [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      };
    }

    const relationsMap = await loadPostRelationsForFeedBatch(
      slice.map((p) => ({
        _id: p._id,
        userId: p.userId,
        locationName: (p as any).locationName,
        locationLatitude: (p as any).locationLatitude,
        locationLongitude: (p as any).locationLongitude,
      })),
      userId
    );

    const posts: PostResponseDto[] = slice.map((post) => {
      const relations = relationsMap.get(post._id.toString()) ?? {
        user: undefined,
        media: [],
        hashtags: [],
        mentions: [],
        location: undefined,
        isLiked: false,
        isSaved: false,
      };
      return toPostResponse(post as any, relations);
    });

    try {
      await feedAnalyticsService.trackImpressions(
        userId,
        "friends",
        slice.map((post, index) => ({
          postId: post._id.toString(),
          position: start + index + 1,
        }))
      );
    } catch (err) {
      console.error(
        "[FeedService.getFriendsFeed] trackImpressions error:",
        err
      );
    }

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  /**
   * Feed Khám phá: đề xuất cá nhân hóa (scoring + exploration), có thể có bài ngoài vòng bạn bè.
   */
  async getPersonalizedFeed(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedPostsDto> {
    const [social, blockedUserIds, viewedPostIds] = await Promise.all([
      getSocialIds(userId),
      getBlockedUserIds(userId),
      getViewedPostIds(userId),
    ]);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_POST_AGE_DAYS);

    const rawCandidates = await PostModel.find({
      isHidden: false,
      moderationStatus: {
        $in: [ModerationStatus.APPROVED, ModerationStatus.PENDING],
      },
      createdAt: { $gte: cutoff },
    })
      .sort({ createdAt: -1 })
      .limit(CANDIDATE_POOL_SIZE * 2)
      .lean();

    const candidates: IPost[] = (rawCandidates as IPost[])
      .filter((post) => {
        if (viewedPostIds.has(post._id.toString())) return false;
        const authorId = post.userId?.toString();
        if (authorId && blockedUserIds.has(authorId)) return false;
        return canViewPost(post, userId, social);
      })
      .slice(0, CANDIDATE_POOL_SIZE);

    if (candidates.length === 0) {
      return {
        posts: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    }

    const userProfile = await UserProfileModel.findOne({
      userId: new Types.ObjectId(userId),
    }).lean();

    const scored = await scoringService.scorePosts(
      candidates,
      userId,
      userProfile as any,
      social.followingIds
    );

    const withExploration = applyExploration(scored, EXPLORATION_RATE);
    // total = kích thước pool đã lọc (tối đa CANDIDATE_POOL_SIZE), không phải tổng bài trong DB
    const total = withExploration.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const slice = withExploration.slice(start, start + limit);

    const slicePosts = slice.map((s) => s.post);
    const relationsMap = await loadPostRelationsForFeedBatch(
      slicePosts.map((p) => ({
        _id: p._id,
        userId: p.userId,
        locationName: (p as any).locationName,
        locationLatitude: (p as any).locationLatitude,
        locationLongitude: (p as any).locationLongitude,
      })),
      userId
    );

    const posts: PostResponseDto[] = slicePosts.map((post) => {
      const relations = relationsMap.get(post._id.toString()) ?? {
        user: undefined,
        media: [],
        hashtags: [],
        mentions: [],
        location: undefined,
        isLiked: false,
        isSaved: false,
      };
      return toPostResponse(post as any, relations);
    });

    try {
      await feedAnalyticsService.trackImpressions(
        userId,
        "explore",
        slice.map((row, index) => ({
          postId: row.post._id.toString(),
          position: start + index + 1,
          score: row.breakdown,
        }))
      );
    } catch (err) {
      console.error(
        "[FeedService.getPersonalizedFeed] trackImpressions error:",
        err
      );
    }

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },
};
