// src/dtos/comment.dto.ts

import { CommentModerationStatus, IComment } from "../models/comment.model";
import { UserMinimalDto } from "./user.dto";

// ==========================================
// REQUEST DTOs
// ==========================================

export class CreateCommentDto {
  contentText!: string;
}

export class CreateReplyDto {
  contentText!: string;
  /** ID của comment cha trực tiếp */
  parentCommentId!: string;
  /**
   * ID của comment gốc cấp 1 trong thread.
   * Nếu reply thẳng vào comment cấp 1 thì = parentCommentId.
   * Nếu reply vào reply thì giữ nguyên originalCommentId của comment cha.
   */
  originalCommentId!: string;
}

export class UpdateCommentDto {
  contentText!: string;
}

export class GetCommentsQueryDto {
  page?: number;
  limit?: number;
}

export class GetRepliesQueryDto {
  page?: number;
  limit?: number;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

export class CommentAuthorDto {
  id!: string;
  name?: string;
  avatar?: string;
  verified!: boolean;
}

export class CommentResponseDto {
  id!: string;
  postId!: string;
  userId!: string;
  user?: UserMinimalDto;

  contentText!: string;

  // Thread info
  parentCommentId?: string | null;
  originalCommentId?: string | null;
  isReply!: boolean; // true nếu parentCommentId !== null

  // Engagement
  likesCount!: number;
  repliesCount!: number;
  isLiked?: boolean;

  // Moderation
  moderationStatus!: CommentModerationStatus;
  isHidden!: boolean;

  isEdited!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class CommentDetailDto extends CommentResponseDto {
  /** Top 3 replies preview */
  topReplies?: CommentResponseDto[];
}

export class PaginatedCommentsDto {
  comments!: CommentResponseDto[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ==========================================
// MAPPER
// ==========================================

import { toUserMinimal } from "./user.dto";

type CommentResponseOptions = {
  user?: UserMinimalDto;
  isLiked?: boolean;
  topReplies?: CommentResponseDto[];
};

export function toCommentResponse(
  comment: IComment,
  options: CommentResponseOptions = {}
): CommentResponseDto {
  return {
    id: comment._id.toString(),
    postId: comment.postId.toString(),
    userId: comment.userId.toString(),
    user: options.user,

    contentText: comment.contentText,

    parentCommentId: comment.parentCommentId?.toString() ?? null,
    originalCommentId: comment.originalCommentId?.toString() ?? null,
    isReply: !!comment.parentCommentId,

    likesCount: comment.likesCount,
    repliesCount: comment.repliesCount,
    isLiked: options.isLiked ?? false,

    moderationStatus: comment.moderationStatus,
    isHidden: comment.isHidden,

    isEdited: comment.isEdited,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

export function toCommentDetail(
  comment: IComment,
  options: CommentResponseOptions = {}
): CommentDetailDto {
  return {
    ...toCommentResponse(comment, options),
    topReplies: options.topReplies ?? [],
  };
}
