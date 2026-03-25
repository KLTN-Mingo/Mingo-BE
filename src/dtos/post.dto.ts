// src/dtos/post.dto.ts

import { PostVisibility, ModerationStatus, IPost } from "../models/post.model";
import { UserMinimalDto } from "./user.dto";

// ==========================================
// REQUEST DTOs
// ==========================================

export class CreatePostDto {
  contentText?: string;
  visibility?: PostVisibility;
  mediaFiles?: MediaFileDto[];
  hashtags?: string[];
  mentions?: string[]; // User IDs
  locationName?: string;
  locationLatitude?: number;
  locationLongitude?: number;
}

export class UpdatePostDto {
  contentText?: string;
  visibility?: PostVisibility;
}

export class MediaFileDto {
  mediaType!: "image" | "video";
  mediaUrl!: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  orderIndex?: number;
}

export class GetPostsQueryDto {
  userId?: string;
  page?: number;
  limit?: number;
  visibility?: PostVisibility;
}

/** Tab trang chủ: friends = bài bạn bè/bạn thân, explore = khám phá đề xuất cá nhân hóa */
export type FeedTab = "friends" | "explore";

export class GetFeedDto {
  page?: number;
  limit?: number;
  /** friends | explore. Mặc định: explore */
  tab?: FeedTab;
}

export class SearchPostsDto {
  query?: string;
  hashtag?: string;
  page?: number;
  limit?: number;
}

export class LikePostDto {
  postId!: string;
}

export class SharePostDto {
  postId!: string;
  sharedTo!: "feed" | "message" | "external";
  caption?: string;
}

export class SavePostDto {
  postId!: string;
  collectionName?: string;
}

export class GetSavedPostsDto {
  collectionName?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

export class PostMediaDto {
  id!: string;
  mediaType!: "image" | "video";
  mediaUrl!: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  orderIndex!: number;
}

export class PostLocationDto {
  name?: string;
  latitude?: number;
  longitude?: number;
}

export class AIScoreDto {
  toxic?: number; // map ← IPost.aiToxicScore
  hateSpeech?: number; // map ← IPost.aiHateSpeechScore
  spam?: number; // map ← IPost.aiSpamScore
  overallRisk?: number; // map ← IPost.aiOverallRisk
}

export class PaginationDto {
  page!: number;
  limit!: number;
  total!: number;
  totalPages!: number;
  hasMore!: boolean;
}

export class PostResponseDto {
  id!: string;
  userId!: string;
  user?: UserMinimalDto;

  contentText?: string;
  visibility!: PostVisibility;

  // Media & metadata
  media?: PostMediaDto[];
  hashtags?: string[];
  mentions?: UserMinimalDto[];
  location?: PostLocationDto;

  // Engagement counts — sync với IPost
  likesCount!: number;
  commentsCount!: number;
  sharesCount!: number;
  savesCount!: number;
  viewsCount!: number;

  // Trạng thái tương tác của current user (tính toán ngoài model)
  isLiked?: boolean;
  isSaved?: boolean;

  // Moderation — sync với IPost
  moderationStatus!: ModerationStatus;
  isHidden!: boolean;

  isEdited!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PostDetailDto extends PostResponseDto {
  // Gom 4 field aiXxxScore riêng lẻ của IPost thành 1 object
  aiScores?: AIScoreDto;
  hiddenReason?: string;
  topComments?: CommentSummaryDto[];
}

export class PaginatedPostsDto {
  posts!: PostResponseDto[];
  pagination!: PaginationDto;
}

export class PostLikersDto {
  users!: UserMinimalDto[];
  pagination!: Pick<PaginationDto, "page" | "limit" | "total">;
}

export class ShareResponseDto {
  id!: string;
  userId!: string;
  postId!: string;
  sharedTo!: "feed" | "message" | "external";
  caption?: string;
  createdAt!: Date;
}

export class SavedPostsResponseDto {
  posts!: PostResponseDto[];
  collections!: string[];
  pagination!: Pick<PaginationDto, "page" | "limit" | "total">;
}

// ==========================================
// COMMENT SUMMARY (tránh circular import với comment.dto)
// ==========================================

export class CommentSummaryDto {
  id!: string;
  userId!: string;
  user?: UserMinimalDto;
  contentText!: string;
  likesCount!: number;
  repliesCount!: number;
  isLiked?: boolean;
  createdAt!: Date;
}

// ==========================================
// MAPPER FUNCTIONS
// ==========================================

type PostResponseOptions = {
  user?: UserMinimalDto;
  media?: PostMediaDto[];
  hashtags?: string[];
  mentions?: UserMinimalDto[];
  location?: PostLocationDto;
  isLiked?: boolean;
  isSaved?: boolean;
};

type PostDetailOptions = PostResponseOptions & {
  topComments?: CommentSummaryDto[];
};

/**
 * Map IPost document → PostResponseDto
 */
export function toPostResponse(
  post: IPost,
  options: PostResponseOptions = {}
): PostResponseDto {
  return {
    id: post._id.toString(),
    userId: post.userId.toString(),
    user: options.user,

    contentText: post.contentText,
    visibility: post.visibility,

    media: options.media ?? [],
    hashtags: options.hashtags ?? [],
    mentions: options.mentions ?? [],
    location: options.location,

    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    sharesCount: post.sharesCount,
    savesCount: post.savesCount,
    viewsCount: post.viewsCount,

    isLiked: options.isLiked ?? false,
    isSaved: options.isSaved ?? false,

    moderationStatus: post.moderationStatus,
    isHidden: post.isHidden,
    isEdited: post.isEdited,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

/**
 * Map IPost document → PostDetailDto
 * Bao gồm AI scores gom từ 4 field riêng lẻ, hiddenReason, topComments
 */
export function toPostDetail(
  post: IPost,
  options: PostDetailOptions = {}
): PostDetailDto {
  return {
    ...toPostResponse(post, options),
    aiScores: {
      toxic: post.aiToxicScore,
      hateSpeech: post.aiHateSpeechScore,
      spam: post.aiSpamScore,
      overallRisk: post.aiOverallRisk,
    },
    hiddenReason: post.hiddenReason,
    topComments: options.topComments ?? [],
  };
}
