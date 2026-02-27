// src/services/media.service.ts

import { Types } from "mongoose";
import { PostMediaModel } from "../models/post-media.model";
import { PostModel } from "../models/post.model";
import { CommentModel } from "../models/comment.model";
import { LikeModel } from "../models/like.model";
import { ShareModel } from "../models/share.model";
import { UserModel } from "../models/user.model";
import { NotFoundError, ForbiddenError, ValidationError } from "../errors";
import { toUserMinimal } from "../dtos/user.dto";
import {
  CreateMediaDto,
  UpdateMediaDto,
  MediaResponseDto,
  MediaDetailDto,
  PaginatedMediaDto,
  toMediaResponse,
  toMediaDetail,
} from "../dtos/media.dto";

// Helper: validate ObjectId
function assertObjectId(id: string, label: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${label} không hợp lệ`);
  }
}

export const MediaService = {
  // ══════════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════════

  // Tạo media cho post
  async createMedia(
    postId: string,
    userId: string,
    dto: CreateMediaDto
  ): Promise<MediaResponseDto> {
    assertObjectId(postId, "ID bài viết");

    const post = await PostModel.findById(postId);
    if (!post) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    }

    // Chỉ chủ post mới được thêm media
    if (post.userId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền thêm media cho bài viết này");
    }

    const media = await PostMediaModel.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      mediaType: dto.mediaType,
      mediaUrl: dto.mediaUrl,
      thumbnailUrl: dto.thumbnailUrl,
      caption: dto.caption,
      width: dto.width,
      height: dto.height,
      duration: dto.duration,
      fileSize: dto.fileSize,
      orderIndex: dto.orderIndex || 0,
    });

    return toMediaResponse(media);
  },

  // Lấy media theo ID
  async getMediaById(
    mediaId: string,
    currentUserId?: string
  ): Promise<MediaDetailDto> {
    assertObjectId(mediaId, "ID media");

    const media = await PostMediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }

    const [user, likeRow] = await Promise.all([
      UserModel.findById(media.userId).lean(),
      currentUserId
        ? LikeModel.findOne({
            mediaId: media._id,
            userId: new Types.ObjectId(currentUserId),
          }).lean()
        : Promise.resolve(null),
    ]);

    return toMediaDetail(media, user, !!likeRow);
  },

  // Lấy tất cả media của post
  async getPostMedia(
    postId: string,
    currentUserId?: string
  ): Promise<MediaDetailDto[]> {
    assertObjectId(postId, "ID bài viết");

    const mediaList = await PostMediaModel.find({ postId: new Types.ObjectId(postId) })
      .sort({ orderIndex: 1 })
      .lean();

    if (mediaList.length === 0) return [];

    // Get like status for all media
    const mediaIds = mediaList.map((m) => m._id);
    const userLikes = currentUserId
      ? await LikeModel.find({
          mediaId: { $in: mediaIds },
          userId: new Types.ObjectId(currentUserId),
        }).lean()
      : [];

    const likedSet = new Set(userLikes.map((l) => l.mediaId?.toString()));

    // Get user info
    const userIds = [...new Set(mediaList.map((m) => m.userId.toString()))];
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    return mediaList.map((media) => {
      const user = userMap.get(media.userId.toString());
      const isLiked = likedSet.has(media._id.toString());
      return toMediaDetail(media as any, user, isLiked);
    });
  },

  // Cập nhật media
  async updateMedia(
    mediaId: string,
    userId: string,
    dto: UpdateMediaDto
  ): Promise<MediaResponseDto> {
    assertObjectId(mediaId, "ID media");

    const media = await PostMediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }

    if (media.userId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền sửa media này");
    }

    if (dto.caption !== undefined) media.caption = dto.caption;
    if (dto.orderIndex !== undefined) media.orderIndex = dto.orderIndex;

    await media.save();

    return toMediaResponse(media);
  },

  // Xóa media
  async deleteMedia(mediaId: string, userId: string): Promise<void> {
    assertObjectId(mediaId, "ID media");

    const media = await PostMediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }

    if (media.userId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền xóa media này");
    }

    // Xóa tất cả likes, comments, shares của media
    await Promise.all([
      LikeModel.deleteMany({ mediaId: media._id }),
      CommentModel.deleteMany({ mediaId: media._id }),
      ShareModel.deleteMany({ mediaId: media._id }),
      media.deleteOne(),
    ]);
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // LIKE / UNLIKE
  // ══════════════════════════════════════════════════════════════════════════════

  async likeMedia(mediaId: string, userId: string): Promise<void> {
    assertObjectId(mediaId, "ID media");

    const media = await PostMediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }

    const existing = await LikeModel.findOne({
      mediaId: new Types.ObjectId(mediaId),
      userId: new Types.ObjectId(userId),
    });

    if (existing) return; // Idempotent

    await LikeModel.create({
      mediaId: new Types.ObjectId(mediaId),
      userId: new Types.ObjectId(userId),
    });

    await PostMediaModel.findByIdAndUpdate(mediaId, {
      $inc: { likesCount: 1 },
    });
  },

  async unlikeMedia(mediaId: string, userId: string): Promise<void> {
    assertObjectId(mediaId, "ID media");

    const media = await PostMediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }

    const deleted = await LikeModel.findOneAndDelete({
      mediaId: new Types.ObjectId(mediaId),
      userId: new Types.ObjectId(userId),
    });

    if (deleted) {
      await PostMediaModel.findByIdAndUpdate(mediaId, {
        $inc: { likesCount: -1 },
      });
    }
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // COMMENTS
  // ══════════════════════════════════════════════════════════════════════════════

  // Lấy comments của media
  async getMediaComments(
    mediaId: string,
    page: number = 1,
    limit: number = 20,
    currentUserId?: string
  ) {
    assertObjectId(mediaId, "ID media");

    const media = await PostMediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }

    const query = {
      mediaId: new Types.ObjectId(mediaId),
      parentCommentId: null, // Only top-level comments
    };

    const [comments, total] = await Promise.all([
      CommentModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommentModel.countDocuments(query),
    ]);

    // Get user info and like status
    const userIds = [...new Set(comments.map((c) => c.userId.toString()))];
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const commentIds = comments.map((c) => c._id);
    const userLikes = currentUserId
      ? await LikeModel.find({
          commentId: { $in: commentIds },
          userId: new Types.ObjectId(currentUserId),
        }).lean()
      : [];
    const likedSet = new Set(userLikes.map((l) => l.commentId?.toString()));

    const totalPages = Math.ceil(total / limit);

    return {
      comments: comments.map((comment) => ({
        id: comment._id.toString(),
        mediaId: comment.mediaId?.toString(),
        userId: comment.userId.toString(),
        user: userMap.get(comment.userId.toString())
          ? toUserMinimal(userMap.get(comment.userId.toString())!)
          : undefined,
        contentText: comment.contentText,
        likesCount: comment.likesCount,
        repliesCount: comment.repliesCount,
        isLiked: likedSet.has(comment._id.toString()),
        isEdited: comment.isEdited,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
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

  // Tạo comment cho media
  async createMediaComment(
    mediaId: string,
    userId: string,
    contentText: string
  ) {
    assertObjectId(mediaId, "ID media");

    const media = await PostMediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }

    const comment = await CommentModel.create({
      mediaId: new Types.ObjectId(mediaId),
      userId: new Types.ObjectId(userId),
      contentText,
    });

    await PostMediaModel.findByIdAndUpdate(mediaId, {
      $inc: { commentsCount: 1 },
    });

    const user = await UserModel.findById(userId).lean();

    return {
      id: comment._id.toString(),
      mediaId: comment.mediaId?.toString(),
      userId: comment.userId.toString(),
      user: user ? toUserMinimal(user) : undefined,
      contentText: comment.contentText,
      likesCount: comment.likesCount,
      repliesCount: comment.repliesCount,
      isLiked: false,
      isEdited: comment.isEdited,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  },

  // Tạo reply cho comment trên media
  async createMediaCommentReply(
    mediaId: string,
    userId: string,
    parentCommentId: string,
    originalCommentId: string,
    contentText: string
  ) {
    assertObjectId(mediaId, "ID media");
    assertObjectId(parentCommentId, "ID comment cha");
    assertObjectId(originalCommentId, "ID comment gốc");

    const [media, parentComment, originalComment] = await Promise.all([
      PostMediaModel.findById(mediaId),
      CommentModel.findById(parentCommentId),
      CommentModel.findById(originalCommentId),
    ]);

    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }
    if (!parentComment) {
      throw new NotFoundError("Không tìm thấy comment cha");
    }
    if (!originalComment) {
      throw new NotFoundError("Không tìm thấy comment gốc");
    }

    const reply = await CommentModel.create({
      mediaId: new Types.ObjectId(mediaId),
      userId: new Types.ObjectId(userId),
      parentCommentId: new Types.ObjectId(parentCommentId),
      originalCommentId: new Types.ObjectId(originalCommentId),
      contentText,
    });

    // Tăng repliesCount của originalComment và commentsCount của media
    await Promise.all([
      CommentModel.findByIdAndUpdate(originalCommentId, {
        $inc: { repliesCount: 1 },
      }),
      PostMediaModel.findByIdAndUpdate(mediaId, {
        $inc: { commentsCount: 1 },
      }),
    ]);

    const user = await UserModel.findById(userId).lean();

    return {
      id: reply._id.toString(),
      mediaId: reply.mediaId?.toString(),
      parentCommentId: reply.parentCommentId?.toString(),
      originalCommentId: reply.originalCommentId?.toString(),
      userId: reply.userId.toString(),
      user: user ? toUserMinimal(user) : undefined,
      contentText: reply.contentText,
      likesCount: reply.likesCount,
      repliesCount: reply.repliesCount,
      isLiked: false,
      isEdited: reply.isEdited,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
    };
  },

  // Lấy replies của comment trên media
  async getMediaCommentReplies(
    commentId: string,
    page: number = 1,
    limit: number = 20,
    currentUserId?: string
  ) {
    assertObjectId(commentId, "ID comment");

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundError(`Không tìm thấy comment với ID: ${commentId}`);
    }

    const query = {
      originalCommentId: new Types.ObjectId(commentId),
    };

    const [replies, total] = await Promise.all([
      CommentModel.find(query)
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommentModel.countDocuments(query),
    ]);

    // Get user info and like status
    const userIds = [...new Set(replies.map((r) => r.userId.toString()))];
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const replyIds = replies.map((r) => r._id);
    const userLikes = currentUserId
      ? await LikeModel.find({
          commentId: { $in: replyIds },
          userId: new Types.ObjectId(currentUserId),
        }).lean()
      : [];
    const likedSet = new Set(userLikes.map((l) => l.commentId?.toString()));

    const totalPages = Math.ceil(total / limit);

    return {
      replies: replies.map((reply) => ({
        id: reply._id.toString(),
        mediaId: reply.mediaId?.toString(),
        parentCommentId: reply.parentCommentId?.toString(),
        originalCommentId: reply.originalCommentId?.toString(),
        userId: reply.userId.toString(),
        user: userMap.get(reply.userId.toString())
          ? toUserMinimal(userMap.get(reply.userId.toString())!)
          : undefined,
        contentText: reply.contentText,
        likesCount: reply.likesCount,
        repliesCount: reply.repliesCount,
        isLiked: likedSet.has(reply._id.toString()),
        isEdited: reply.isEdited,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
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

  // ══════════════════════════════════════════════════════════════════════════════
  // SHARE
  // ══════════════════════════════════════════════════════════════════════════════

  async shareMedia(
    mediaId: string,
    userId: string,
    caption?: string
  ): Promise<void> {
    assertObjectId(mediaId, "ID media");

    const media = await PostMediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
    }

    await ShareModel.create({
      mediaId: new Types.ObjectId(mediaId),
      userId: new Types.ObjectId(userId),
      caption,
    });

    await PostMediaModel.findByIdAndUpdate(mediaId, {
      $inc: { sharesCount: 1 },
    });
  },

  // Lấy danh sách người đã share media
  async getMediaShares(mediaId: string, page: number = 1, limit: number = 20) {
    assertObjectId(mediaId, "ID media");

    const query = { mediaId: new Types.ObjectId(mediaId) };

    const [shares, total] = await Promise.all([
      ShareModel.find(query)
        .populate("userId", "name avatar verified")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ShareModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      shares: shares.map((share) => ({
        id: share._id.toString(),
        user: share.userId ? toUserMinimal(share.userId as any) : undefined,
        caption: share.caption,
        sharedAt: share.createdAt,
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

  // Lấy danh sách người đã like media
  async getMediaLikes(mediaId: string, page: number = 1, limit: number = 20) {
    assertObjectId(mediaId, "ID media");

    const query = { mediaId: new Types.ObjectId(mediaId) };

    const [likes, total] = await Promise.all([
      LikeModel.find(query)
        .populate("userId", "name avatar verified")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LikeModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      likes: likes.map((like) => ({
        id: like._id.toString(),
        user: like.userId ? toUserMinimal(like.userId as any) : undefined,
        likedAt: like.createdAt,
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
};
