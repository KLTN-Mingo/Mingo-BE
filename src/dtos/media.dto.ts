// src/dtos/media.dto.ts

import { MediaType, IPostMedia } from "../models/post-media.model";
import { UserMinimalDto, toUserMinimal } from "./user.dto";

// ==========================================
// REQUEST DTOs
// ==========================================

export interface CreateMediaDto {
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  orderIndex?: number;
}

export interface UpdateMediaDto {
  caption?: string;
  orderIndex?: number;
}

export interface CreateMediaCommentDto {
  contentText: string;
}

export interface CreateMediaReplyDto {
  contentText: string;
  parentCommentId: string;
  originalCommentId: string;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

export interface MediaResponseDto {
  id: string;
  postId: string;
  userId: string;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  orderIndex: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaDetailDto extends MediaResponseDto {
  user?: UserMinimalDto;
  isLiked: boolean;
}

export interface PaginatedMediaDto {
  media: MediaDetailDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ==========================================
// MAPPER FUNCTIONS
// ==========================================

export function toMediaResponse(media: IPostMedia): MediaResponseDto {
  return {
    id: media._id.toString(),
    postId: media.postId.toString(),
    userId: media.userId.toString(),
    mediaType: media.mediaType,
    mediaUrl: media.mediaUrl,
    thumbnailUrl: media.thumbnailUrl,
    caption: media.caption,
    width: media.width,
    height: media.height,
    duration: media.duration,
    fileSize: media.fileSize,
    orderIndex: media.orderIndex,
    likesCount: media.likesCount,
    commentsCount: media.commentsCount,
    sharesCount: media.sharesCount,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

export function toMediaDetail(
  media: IPostMedia,
  user?: any,
  isLiked: boolean = false
): MediaDetailDto {
  return {
    ...toMediaResponse(media),
    user: user ? toUserMinimal(user) : undefined,
    isLiked,
  };
}
