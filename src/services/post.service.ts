// src/services/post.service.ts

import { differenceInHours } from "date-fns";
import { Types } from "mongoose";
import {
  PostModel,
  PostVisibility,
  ModerationStatus,
} from "../models/post.model";
import { NotFoundError, ForbiddenError } from "../errors";
import {
  CreatePostDto,
  UpdatePostDto,
  PostResponseDto,
  PostDetailDto,
  PaginatedPostsDto,
  toPostResponse,
  toPostDetail,
  PostMediaDto,
  PostLocationDto,
  CommentSummaryDto,
} from "../dtos/post.dto";
import { toUserMinimal, UserMinimalDto } from "../dtos/user.dto";
import { PostMediaModel } from "../models/post-media.model";
import { PostHashtagModel } from "../models/post-hashtag.model";
import { PostMentionModel } from "../models/post-mention.model";
import { LikeModel } from "../models/like.model";
import { CommentModel } from "../models/comment.model";
import { UserModel } from "../models/user.model";
import { SavedPostModel } from "../models/saved-post.model";
import { ShareModel } from "../models/share.model";
import { topicExtractorService } from "./topic-extractor.service";
import { ModerationService } from "./moderation/moderation.service";

// ─── Helper: load related data cho một post ───────────────────────────────────

async function loadPostRelations(
  postId: Types.ObjectId,
  currentUserId?: string
): Promise<{
  user: UserMinimalDto | undefined;
  media: PostMediaDto[];
  hashtags: string[];
  mentions: UserMinimalDto[];
  location: PostLocationDto | undefined;
  isLiked: boolean;
  isSaved: boolean;
}> {
  const post = await PostModel.findById(postId).lean();
  if (!post)
    throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);

  const [author, mediaRows, hashtagRows, mentionRows, likeRow, savedRow] =
    await Promise.all([
      UserModel.findById(post.userId).lean(),
      PostMediaModel.find({ postId }).sort({ orderIndex: 1 }).lean(),
      PostHashtagModel.find({ postId }).lean(),
      PostMentionModel.find({ postId }).populate("mentionedUserId").lean(),
      currentUserId
        ? LikeModel.findOne({ postId, userId: currentUserId }).lean()
        : Promise.resolve(null),
      currentUserId
        ? SavedPostModel.findOne({
            postId,
            userId: new Types.ObjectId(currentUserId),
          }).lean()
        : Promise.resolve(null),
    ]);

  const media: PostMediaDto[] = (mediaRows as any[]).map((m) => ({
    id: m._id.toString(),
    mediaType: m.mediaType,
    mediaUrl: m.mediaUrl,
    thumbnailUrl: m.thumbnailUrl,
    width: m.width,
    height: m.height,
    duration: m.duration,
    fileSize: m.fileSize,
    orderIndex: m.orderIndex,
  }));

  const hashtags: string[] = (hashtagRows as any[]).map((h) => h.hashtag);

  const mentions: UserMinimalDto[] = (mentionRows as any[])
    .map((m) => (m.mentionedUserId ? toUserMinimal(m.mentionedUserId) : null))
    .filter(Boolean) as UserMinimalDto[];

  const location: PostLocationDto | undefined =
    (post as any).locationName || (post as any).locationLatitude
      ? {
          name: (post as any).locationName,
          latitude: (post as any).locationLatitude,
          longitude: (post as any).locationLongitude,
        }
      : undefined;

  return {
    user: author ? toUserMinimal(author as any) : undefined,
    media,
    hashtags,
    mentions,
    location,
    isLiked: !!likeRow,
    isSaved: false, // TODO: tích hợp SavedPostModel khi có
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const PostService = {
  // ── Get all posts ──────────────────────────────────────────────────────────
  async getAllPosts(currentUserId?: string): Promise<PostResponseDto[]> {
    const posts = await PostModel.find({ isHidden: false })
      .sort({ createdAt: -1 })
      .lean();

    return Promise.all(
      posts.map(async (post) => {
        const relations = await loadPostRelations(post._id, currentUserId);
        return toPostResponse(post as any, relations);
      })
    );
  },

  // ── Get feed ───────────────────────────────────────────────────────────────
  async getFeedPosts(
    userId: string,
    page: number,
    limit: number,
    tab: "friends" | "explore" = "explore"
  ): Promise<PaginatedPostsDto> {
    const { FeedService } = await import("./feed.service");
    if (tab === "friends") {
      return FeedService.getFriendsFeed(userId, page, limit);
    }
    return FeedService.getPersonalizedFeed(userId, page, limit);
  },

  // ── Get single post ────────────────────────────────────────────────────────
  async getPostById(
    postId: string,
    currentUserId?: string
  ): Promise<PostDetailDto> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    const post = await PostModel.findById(postId).lean();
    if (!post) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    const [relations, topCommentRows] = await Promise.all([
      loadPostRelations(post._id, currentUserId),
      CommentModel.find({
        postId: post._id,
        isHidden: false,
        parentCommentId: null,
      })
        .sort({ likesCount: -1 })
        .limit(3)
        .populate("userId", "name avatar verified")
        .lean(),
    ]);

    const topComments: CommentSummaryDto[] = (topCommentRows as any[]).map(
      (c) => ({
        id: c._id.toString(),
        userId: c.userId?._id?.toString() ?? "",
        user: c.userId ? toUserMinimal(c.userId) : undefined,
        contentText: c.contentText,
        likesCount: c.likesCount ?? 0,
        repliesCount: c.repliesCount ?? 0,
        createdAt: c.createdAt,
      })
    );

    return toPostDetail(post as any, { ...relations, topComments });
  },

  // ── Trending posts ─────────────────────────────────────────────────────────
  async getTrendingPosts(currentUserId?: string): Promise<PostResponseDto[]> {
    const posts = await PostModel.find({
      isHidden: false,
      moderationStatus: ModerationStatus.APPROVED,
    }).lean();

    const now = new Date();

    const top10 = posts
      .map((post) => {
        const hoursAgo = Math.max(
          differenceInHours(now, new Date(post.createdAt)),
          1
        );
        const score =
          Math.log10(post.likesCount + 1) +
          Math.log10(post.commentsCount + 1) * 1.2 +
          Math.log10(post.sharesCount + 1) * 1.5 -
          hoursAgo * 0.1;
        return { post, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((s) => s.post);

    return Promise.all(
      top10.map(async (post) => {
        const relations = await loadPostRelations(post._id, currentUserId);
        return toPostResponse(post as any, relations);
      })
    );
  },

  // ── Create post ────────────────────────────────────────────────────────────
  async createPost(userId: string, dto: CreatePostDto): Promise<PostDetailDto> {
    const mediaTypes = dto.mediaFiles?.map((m) => m.mediaType) ?? [];
    const topics = topicExtractorService.extract({
      contentText: dto.contentText,
      hashtags:    dto.hashtags ?? [],
      mediaTypes,
    });
    const post = await PostModel.create({
      userId: new Types.ObjectId(userId),
      contentText: dto.contentText,
      contentRichText: dto.contentRichText,
      visibility: dto.visibility ?? PostVisibility.PUBLIC,
      moderationStatus: ModerationStatus.PENDING,
      locationName: dto.locationName,
      locationLatitude: dto.locationLatitude,
      locationLongitude: dto.locationLongitude,
      topics,
    });

    if (dto.mediaFiles?.length) {
      await PostMediaModel.insertMany(
        dto.mediaFiles.map((m, i) => ({
          postId: post._id,
          userId: new Types.ObjectId(userId),
          mediaType: m.mediaType,
          mediaUrl: m.mediaUrl,
          thumbnailUrl: m.thumbnailUrl,
          width: m.width,
          height: m.height,
          duration: m.duration,
          fileSize: m.fileSize,
          orderIndex: m.orderIndex ?? i,
        }))
      );
    }

    if (dto.hashtags?.length) {
      await PostHashtagModel.insertMany(
        dto.hashtags.map((tag) => ({ postId: post._id, hashtag: tag }))
      );
    }

    if (dto.mentions?.length) {
      await PostMentionModel.insertMany(
        dto.mentions.map((mentionedId) => ({
          postId: post._id,
          mentionedUserId: new Types.ObjectId(mentionedId),
        }))
      );
    }

    await UserModel.findByIdAndUpdate(userId, { $inc: { postsCount: 1 } });

    // Fire-and-forget: không block response
    if (dto.contentText?.trim()) {
      try {
        const user = await UserModel.findById(userId)
          .select("createdAt")
          .lean();
        const accountAgeDays = user
          ? (Date.now() - new Date(user.createdAt).getTime()) / 86400000
          : 999;

        void ModerationService.moderateAndUpdate(
          "post",
          post._id.toString(),
          dto.contentText,
          {
            isNewAccount: accountAgeDays < 7,
            reportCount: 0,
          }
        ).catch((err) =>
          console.error("[Moderation] Post error:", err)
        );
      } catch (err) {
        console.error("[Moderation] Post error:", err);
      }
    }

    return this.getPostById(post._id.toString(), userId);
  },

  // ── Update post ────────────────────────────────────────────────────────────
  async updatePost(
    postId: string,
    userId: string,
    dto: UpdatePostDto
  ): Promise<PostDetailDto> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    if (post.userId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền chỉnh sửa bài viết này");
    }

    if (dto.contentText !== undefined) {
      post.contentText = dto.contentText;

      const currentHashtags = await PostHashtagModel
        .find({ postId: post._id })
        .distinct("hashtag");

      post.topics = topicExtractorService.extract({
        contentText: dto.contentText,
        hashtags:    currentHashtags,
      });
    }
    if (dto.contentRichText !== undefined) {
      (post as any).contentRichText = dto.contentRichText;
    }
    if (dto.visibility !== undefined) post.visibility = dto.visibility;
    post.isEdited = true;

    await post.save();

    return this.getPostById(postId, userId);
  },

  // ── Delete post ────────────────────────────────────────────────────────────
  async deletePost(
    postId: string,
    userId: string,
    isAdmin = false
  ): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    const post = await PostModel.findById(postId);
    if (!post) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    if (!isAdmin && post.userId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền xóa bài viết này");
    }

    const oid = post._id;
    const commentIds = await CommentModel.find({ postId: oid }).distinct("_id");

    await Promise.all([
      LikeModel.deleteMany({ postId: oid }),
      LikeModel.deleteMany({ commentId: { $in: commentIds } }),
      CommentModel.deleteMany({ postId: oid }),
      PostMediaModel.deleteMany({ postId: oid }),
      PostHashtagModel.deleteMany({ postId: oid }),
      PostMentionModel.deleteMany({ postId: oid }),
      SavedPostModel.deleteMany({ postId: oid }),
      ShareModel.deleteMany({ postId: oid }),
    ]);

    await post.deleteOne();
    await UserModel.findByIdAndUpdate(post.userId, {
      $inc: { postsCount: -1 },
    });
  },

  // ── Like post ──────────────────────────────────────────────────────────────
  async likePost(postId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    const post = await PostModel.findById(postId);
    if (!post)
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);

    const existing = await LikeModel.findOne({ postId, userId });
    if (existing) return; // idempotent

    await LikeModel.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
    });
    await PostModel.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } });
  },

  // ── Unlike post ────────────────────────────────────────────────────────────
  async unlikePost(postId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    const post = await PostModel.findById(postId);
    if (!post)
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);

    const deleted = await LikeModel.findOneAndDelete({ postId, userId });
    if (!deleted) return; // idempotent

    await PostModel.findByIdAndUpdate(postId, {
      $inc: { likesCount: -1 },
    });
  },

  // ── Count posts ────────────────────────────────────────────────────────────
  async countPosts(): Promise<number> {
    return PostModel.countDocuments();
  },

  async countPostsToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return PostModel.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
  },

  async savePost(
    postId: string,
    userId: string,
    collectionName = "default"
  ): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }
    const post = await PostModel.findById(postId);
    if (!post)
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);

    const uid = new Types.ObjectId(userId);
    const pid = new Types.ObjectId(postId);
    const existing = await SavedPostModel.findOne({ userId: uid, postId: pid });
    if (existing) return;

    await SavedPostModel.create({
      userId: uid,
      postId: pid,
      collectionName: collectionName.slice(0, 100),
    });
    await PostModel.findByIdAndUpdate(postId, { $inc: { savesCount: 1 } });
  },

  async unsavePost(postId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }
    const uid = new Types.ObjectId(userId);
    const pid = new Types.ObjectId(postId);
    const deleted = await SavedPostModel.findOneAndDelete({
      userId: uid,
      postId: pid,
    });
    if (!deleted) return;
    await PostModel.findByIdAndUpdate(postId, {
      $inc: { savesCount: -1 },
    });
  },

  async getSavedPosts(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedPostsDto> {
    const uid = new Types.ObjectId(userId);
    const total = await SavedPostModel.countDocuments({ userId: uid });
    const rows = await SavedPostModel.find({ userId: uid })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("postId")
      .lean();

    const posts: PostResponseDto[] = [];
    for (const row of rows as any[]) {
      const pid = row.postId?.toString();
      if (!pid) continue;
      try {
        const dto = await this.getPostById(pid, userId);
        posts.push({
          id: dto.id,
          userId: dto.userId,
          user: dto.user,
          contentText: dto.contentText,
          contentRichText: dto.contentRichText,
          visibility: dto.visibility,
          media: dto.media,
          hashtags: dto.hashtags,
          mentions: dto.mentions,
          location: dto.location,
          likesCount: dto.likesCount,
          commentsCount: dto.commentsCount,
          sharesCount: dto.sharesCount,
          savesCount: dto.savesCount,
          viewsCount: dto.viewsCount,
          isLiked: dto.isLiked,
          isSaved: true,
          moderationStatus: dto.moderationStatus,
          isHidden: dto.isHidden,
          isEdited: dto.isEdited,
          createdAt: dto.createdAt,
          updatedAt: dto.updatedAt,
        });
      } catch {
        /* bài đã xóa — bỏ qua */
      }
    }

    const totalPages = Math.ceil(total / limit) || 0;
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

  async sharePost(
    postId: string,
    userId: string,
    sharedTo: "feed" | "message" | "external",
    caption?: string
  ): Promise<void> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }
    const post = await PostModel.findById(postId);
    if (!post)
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);

    await ShareModel.create({
      userId: new Types.ObjectId(userId),
      postId: new Types.ObjectId(postId),
      sharedTo,
      caption: caption?.slice(0, 2000),
    });
    await PostModel.findByIdAndUpdate(postId, { $inc: { sharesCount: 1 } });
  },
};
