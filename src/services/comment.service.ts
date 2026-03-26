// src/services/comment.service.ts

import { Types } from "mongoose";
import { CommentModel } from "../models/comment.model";
import { PostModel } from "../models/post.model";
import { UserModel } from "../models/user.model";
import { LikeModel } from "../models/like.model";
import { NotFoundError, ForbiddenError } from "../errors";
import { toUserMinimal } from "../dtos/user.dto";
import {
  CreateCommentDto,
  CreateReplyDto,
  UpdateCommentDto,
  CommentResponseDto,
  CommentDetailDto,
  PaginatedCommentsDto,
  toCommentResponse,
  toCommentDetail,
} from "../dtos/comment.dto";

// ─── Helper ───────────────────────────────────────────────────────────────────

function assertObjectId(id: string, label = "ID") {
  if (!Types.ObjectId.isValid(id)) {
    throw new NotFoundError(`Không tìm thấy ${label} với ID: ${id}`);
  }
}

async function populateCommentUser(
  comment: InstanceType<typeof CommentModel>,
  currentUserId?: string
) {
  const [author, likeRow] = await Promise.all([
    UserModel.findById(comment.userId).lean(),
    currentUserId
      ? LikeModel.findOne({
          commentId: comment._id,
          userId: currentUserId,
        }).lean()
      : Promise.resolve(null),
  ]);

  return {
    user: author ? toUserMinimal(author as any) : undefined,
    isLiked: !!likeRow,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const CommentService = {
  // ── Lấy comments cấp 1 của một post (có phân trang) ──────────────────────
  async getPostComments(
    postId: string,
    page: number,
    limit: number,
    currentUserId?: string
  ): Promise<PaginatedCommentsDto> {
    assertObjectId(postId, "bài viết");

    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      CommentModel.find({
        postId: new Types.ObjectId(postId),
        parentCommentId: null, // chỉ lấy top-level
        isHidden: false,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommentModel.countDocuments({
        postId: new Types.ObjectId(postId),
        parentCommentId: null,
        isHidden: false,
      }),
    ]);

    const commentDtos = await Promise.all(
      comments.map(async (c) => {
        const { user, isLiked } = await populateCommentUser(
          c as any,
          currentUserId
        );

        // Lấy 2 replies đầu làm preview
        const topReplyRows = await CommentModel.find({
          originalCommentId: c._id,
          isHidden: false,
        })
          .sort({ createdAt: 1 })
          .limit(2)
          .lean();

        const topReplies = await Promise.all(
          topReplyRows.map(async (r) => {
            const opts = await populateCommentUser(r as any, currentUserId);
            return toCommentResponse(r as any, opts);
          })
        );

        return toCommentDetail(c as any, { user, isLiked, topReplies });
      })
    );

    const totalPages = Math.ceil(total / limit);

    return {
      comments: commentDtos,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // ── Lấy replies của một comment (có phân trang) ───────────────────────────
  async getCommentReplies(
    originalCommentId: string,
    page: number,
    limit: number,
    currentUserId?: string
  ): Promise<PaginatedCommentsDto> {
    assertObjectId(originalCommentId, "bình luận");

    const skip = (page - 1) * limit;
    const oid = new Types.ObjectId(originalCommentId);

    const [replies, total] = await Promise.all([
      CommentModel.find({ originalCommentId: oid, isHidden: false })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommentModel.countDocuments({ originalCommentId: oid, isHidden: false }),
    ]);

    const replyDtos = await Promise.all(
      replies.map(async (r) => {
        const opts = await populateCommentUser(r as any, currentUserId);
        return toCommentResponse(r as any, opts);
      })
    );

    const totalPages = Math.ceil(total / limit);

    return {
      comments: replyDtos,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // ── Lấy chi tiết một comment ──────────────────────────────────────────────
  async getCommentById(
    commentId: string,
    currentUserId?: string
  ): Promise<CommentDetailDto> {
    assertObjectId(commentId, "bình luận");

    const comment = await CommentModel.findById(commentId).lean();
    if (!comment) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
    }

    const [{ user, isLiked }, topReplyRows] = await Promise.all([
      populateCommentUser(comment as any, currentUserId),
      CommentModel.find({
        originalCommentId: comment._id,
        isHidden: false,
      })
        .sort({ createdAt: 1 })
        .limit(3)
        .lean(),
    ]);

    const topReplies = await Promise.all(
      topReplyRows.map(async (r) => {
        const opts = await populateCommentUser(r as any, currentUserId);
        return toCommentResponse(r as any, opts);
      })
    );

    return toCommentDetail(comment as any, { user, isLiked, topReplies });
  },

  // ── Tạo comment cấp 1 ────────────────────────────────────────────────────
  async createComment(
    postId: string,
    userId: string,
    dto: CreateCommentDto
  ): Promise<CommentDetailDto> {
    assertObjectId(postId, "bài viết");

    const post = await PostModel.findById(postId);
    if (!post)
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);

    const comment = await CommentModel.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      contentText: dto.contentText,
    });

    // Tăng commentsCount của post
    await PostModel.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });

    return this.getCommentById(comment._id.toString(), userId);
  },

  // ── Tạo reply ─────────────────────────────────────────────────────────────
  async createReply(
    postId: string,
    userId: string,
    dto: CreateReplyDto
  ): Promise<CommentResponseDto> {
    assertObjectId(postId, "bài viết");
    assertObjectId(dto.parentCommentId, "bình luận cha");
    assertObjectId(dto.originalCommentId, "bình luận gốc");

    const [post, parentComment, originalComment] = await Promise.all([
      PostModel.findById(postId).lean(),
      CommentModel.findById(dto.parentCommentId).lean(),
      CommentModel.findById(dto.originalCommentId).lean(),
    ]);

    if (!post)
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    if (!parentComment) throw new NotFoundError("Không tìm thấy bình luận cha");
    if (!originalComment)
      throw new NotFoundError("Không tìm thấy bình luận gốc");

    const reply = await CommentModel.create({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      contentText: dto.contentText,
      parentCommentId: dto.parentCommentId
        ? new Types.ObjectId(dto.parentCommentId)
        : undefined,
      originalCommentId: dto.originalCommentId
        ? new Types.ObjectId(dto.originalCommentId)
        : undefined,
    });

    // Tăng repliesCount của originalComment và commentsCount của post
    await Promise.all([
      CommentModel.findByIdAndUpdate(dto.originalCommentId, {
        $inc: { repliesCount: 1 },
      }),
      PostModel.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } }),
    ]);

    const { user, isLiked } = await populateCommentUser(reply, userId);
    return toCommentResponse(reply, { user, isLiked });
  },

  // ── Cập nhật comment ─────────────────────────────────────────────────────
  async updateComment(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto
  ): Promise<CommentResponseDto> {
    assertObjectId(commentId, "bình luận");

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
    }

    if (comment.userId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền chỉnh sửa bình luận này");
    }

    comment.contentText = dto.contentText;
    comment.isEdited = true;
    await comment.save();

    const { user, isLiked } = await populateCommentUser(comment, userId);
    return toCommentResponse(comment, { user, isLiked });
  },

  // ── Xóa comment cấp 1 (cascade xóa toàn bộ replies trong thread) ─────────
  async deleteComment(
    commentId: string,
    userId: string,
    isAdmin = false
  ): Promise<void> {
    assertObjectId(commentId, "bình luận");

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
    }

    if (!isAdmin && comment.userId.toString() !== userId) {
      throw new ForbiddenError("Bạn không có quyền xóa bình luận này");
    }

    const isTopLevel = !comment.parentCommentId;

    if (isTopLevel) {
      // Xóa toàn bộ replies trong thread
      const replyIds = await CommentModel.find({
        originalCommentId: comment._id,
      }).distinct("_id");

      await Promise.all([
        LikeModel.deleteMany({
          commentId: { $in: [comment._id, ...replyIds] },
        }),
        CommentModel.deleteMany({ originalCommentId: comment._id }),
      ]);

      const totalDeleted = 1 + replyIds.length;
      await PostModel.findByIdAndUpdate(comment.postId, {
        $inc: { commentsCount: -totalDeleted },
      });
    } else {
      // Xóa reply đơn lẻ
      await LikeModel.deleteMany({ commentId: comment._id });

      // Giảm repliesCount của originalComment
      await CommentModel.findByIdAndUpdate(comment.originalCommentId, {
        $inc: { repliesCount: -1 },
      });
      await PostModel.findByIdAndUpdate(comment.postId, {
        $inc: { commentsCount: -1 },
      });
    }

    await comment.deleteOne();
  },

  // ── Like comment ──────────────────────────────────────────────────────────
  async likeComment(commentId: string, userId: string): Promise<void> {
    assertObjectId(commentId, "bình luận");

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
    }

    const existing = await LikeModel.findOne({ commentId, userId });
    if (existing) return; // idempotent

    await LikeModel.create({
      commentId: new Types.ObjectId(commentId),
      userId: new Types.ObjectId(userId),
    });
    await CommentModel.findByIdAndUpdate(commentId, {
      $inc: { likesCount: 1 },
    });
  },

  // ── Unlike comment ────────────────────────────────────────────────────────
  async unlikeComment(commentId: string, userId: string): Promise<void> {
    assertObjectId(commentId, "bình luận");

    const comment = await CommentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
    }

    const deleted = await LikeModel.findOneAndDelete({ commentId, userId });
    if (!deleted) return; // idempotent

    await CommentModel.findByIdAndUpdate(commentId, {
      $inc: { likesCount: -1 },
    });
  },
};
