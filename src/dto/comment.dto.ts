// src/dtos/comment.dto.ts
import { UserMinimalDto } from "./user.dto";
import { CommentModerationStatus } from "../models/comment.model";

// ==========================================
// REQUEST DTOs
// ==========================================

export class CreateCommentDto {
  postId!: string;
  contentText!: string;
  parentCommentId?: string; // For replies
  mentions?: string[]; // User IDs
}

export class UpdateCommentDto {
  contentText!: string;
}

export class GetCommentsDto {
  postId!: string;
  parentCommentId?: string; // null for root comments
  page?: number;
  limit?: number;
  sortBy?: "newest" | "oldest" | "popular";
}

export class LikeCommentDto {
  commentId!: string;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

export class CommentResponseDto {
  id!: string;
  postId!: string;
  userId!: string;
  user?: UserMinimalDto;
  parentCommentId?: string;
  contentText!: string;

  // Engagement
  likesCount!: number;
  repliesCount!: number;

  // User interaction
  isLiked?: boolean;

  // Moderation
  moderationStatus!: CommentModerationStatus;
  isHidden!: boolean;

  isEdited!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  // Nested replies (optional)
  replies?: CommentResponseDto[];
}

export class CommentDetailDto extends CommentResponseDto {
  mentions?: UserMinimalDto[];
  post?: {
    id: string;
    contentText?: string;
    userId: string;
  };
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

export class CommentThreadDto {
  rootComment!: CommentResponseDto;
  replies!: CommentResponseDto[];
  totalReplies!: number;
}

export class CommentLikersDto {
  users!: UserMinimalDto[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
  };
}
