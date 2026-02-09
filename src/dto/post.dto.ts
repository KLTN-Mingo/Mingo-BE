// src/dtos/post.dto.ts
import { PostVisibility, ModerationStatus } from "../models/post.model";
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
}

export class GetPostsDto {
  userId?: string;
  page?: number;
  limit?: number;
  visibility?: PostVisibility;
}

export class GetFeedDto {
  page?: number;
  limit?: number;
}

export class SearchPostsDto {
  query!: string;
  page?: number;
  limit?: number;
  hashtag?: string;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

export class PostResponseDto {
  id!: string;
  userId!: string;
  user?: UserMinimalDto;
  contentText?: string;
  visibility!: PostVisibility;

  // Media
  media?: PostMediaDto[];
  hashtags?: string[];
  mentions?: UserMinimalDto[];

  // Location
  location?: {
    name?: string;
    latitude?: number;
    longitude?: number;
  };

  // Engagement
  likesCount!: number;
  commentsCount!: number;
  sharesCount!: number;
  savesCount!: number;
  viewsCount!: number;

  // User interaction status
  isLiked?: boolean;
  isSaved?: boolean;

  // Moderation
  moderationStatus!: ModerationStatus;
  isHidden!: boolean;

  isEdited!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PostMediaDto {
  id!: string;
  mediaType!: "image" | "video";
  mediaUrl!: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  orderIndex!: number;
}

export class PostDetailDto extends PostResponseDto {
  aiScores?: {
    toxic?: number;
    hateSpeech?: number;
    spam?: number;
    overallRisk?: number;
  };
  topComments?: CommentResponseDto[];
}

export class PaginatedPostsDto {
  posts!: PostResponseDto[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ==========================================
// LIKE DTOs
// ==========================================

export class LikePostDto {
  postId!: string;
}

export class GetPostLikesDto {
  postId!: string;
  page?: number;
  limit?: number;
}

export class PostLikersDto {
  users!: UserMinimalDto[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
  };
}

// ==========================================
// SHARE DTOs
// ==========================================

export class SharePostDto {
  postId!: string;
  sharedTo!: "feed" | "message" | "external";
  caption?: string;
}

export class ShareResponseDto {
  id!: string;
  userId!: string;
  postId!: string;
  sharedTo!: string;
  caption?: string;
  createdAt!: Date;
}

// ==========================================
// SAVED POST DTOs
// ==========================================

export class SavePostDto {
  postId!: string;
  collectionName?: string;
}

export class GetSavedPostsDto {
  collectionName?: string;
  page?: number;
  limit?: number;
}

export class SavedPostsResponseDto {
  posts!: PostResponseDto[];
  collections!: string[];
  pagination!: {
    page: number;
    limit: number;
    total: number;
  };
}

// Import for type reference (avoid circular dependency)
interface CommentResponseDto {
  id: string;
  userId: string;
  user?: UserMinimalDto;
  contentText: string;
  likesCount: number;
  repliesCount: number;
  isLiked?: boolean;
  createdAt: Date;
}
