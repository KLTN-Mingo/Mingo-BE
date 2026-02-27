// src/dtos/notification.dto.ts

import {
  NotificationType,
  EntityType,
  INotification,
} from "../models/notification.model";
import { UserMinimalDto, toUserMinimal } from "./user.dto";

// ==========================================
// REQUEST DTOs
// ==========================================

export interface CreateNotificationDto {
  userId: string;
  actorId: string;
  notificationType: NotificationType;
  entityType?: EntityType;
  entityId?: string;
  postId?: string;
  mediaId?: string;
  commentId?: string;
  content?: string;
  thumbnailUrl?: string;
}

export interface GetNotificationsQueryDto {
  page?: number;
  limit?: number;
  type?: NotificationType;
  isRead?: boolean;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

export interface NotificationResponseDto {
  id: string;
  userId: string;
  actor?: UserMinimalDto;
  notificationType: NotificationType;
  entityType?: EntityType;
  entityId?: string;
  postId?: string;
  mediaId?: string;
  commentId?: string;
  content?: string;
  thumbnailUrl?: string;
  isRead: boolean;
  isSeen: boolean;
  createdAt: Date;
}

export interface PaginatedNotificationsDto {
  notifications: NotificationResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface NotificationCountDto {
  total: number;
  unread: number;
  unseen: number;
}

export interface NotificationGroupDto {
  type: NotificationType;
  count: number;
  latestNotification: NotificationResponseDto;
}

// ==========================================
// MAPPER FUNCTIONS
// ==========================================

export function toNotificationResponse(
  notification: INotification,
  actor?: any
): NotificationResponseDto {
  return {
    id: notification._id.toString(),
    userId: notification.userId.toString(),
    actor: actor ? toUserMinimal(actor) : undefined,
    notificationType: notification.notificationType,
    entityType: notification.entityType,
    entityId: notification.entityId?.toString(),
    postId: notification.postId?.toString(),
    mediaId: notification.mediaId?.toString(),
    commentId: notification.commentId?.toString(),
    content: notification.content,
    thumbnailUrl: notification.thumbnailUrl,
    isRead: notification.isRead,
    isSeen: notification.isSeen,
    createdAt: notification.createdAt,
  };
}

// ==========================================
// NOTIFICATION MESSAGE TEMPLATES
// ==========================================

export function getNotificationMessage(
  type: NotificationType,
  actorName?: string
): string {
  const name = actorName || "Ai đó";

  switch (type) {
    // Post
    case NotificationType.POST_LIKE:
      return `${name} đã thích bài viết của bạn`;
    case NotificationType.POST_COMMENT:
      return `${name} đã bình luận bài viết của bạn`;
    case NotificationType.POST_SHARE:
      return `${name} đã chia sẻ bài viết của bạn`;
    case NotificationType.POST_MENTION:
      return `${name} đã nhắc đến bạn trong một bài viết`;

    // Media
    case NotificationType.MEDIA_LIKE:
      return `${name} đã thích ảnh/video của bạn`;
    case NotificationType.MEDIA_COMMENT:
      return `${name} đã bình luận ảnh/video của bạn`;
    case NotificationType.MEDIA_SHARE:
      return `${name} đã chia sẻ ảnh/video của bạn`;

    // Comment
    case NotificationType.COMMENT_LIKE:
      return `${name} đã thích bình luận của bạn`;
    case NotificationType.COMMENT_REPLY:
      return `${name} đã trả lời bình luận của bạn`;
    case NotificationType.COMMENT_MENTION:
      return `${name} đã nhắc đến bạn trong một bình luận`;

    // Follow
    case NotificationType.FOLLOW_REQUEST:
      return `${name} đã gửi yêu cầu theo dõi bạn`;
    case NotificationType.FOLLOW_ACCEPTED:
      return `${name} đã chấp nhận yêu cầu theo dõi của bạn`;
    case NotificationType.FOLLOW_NEW:
      return `${name} đã bắt đầu theo dõi bạn`;

    // Close friend
    case NotificationType.CLOSE_FRIEND_REQUEST:
      return `${name} muốn trở thành bạn thân của bạn`;
    case NotificationType.CLOSE_FRIEND_ACCEPTED:
      return `${name} đã chấp nhận yêu cầu bạn thân của bạn`;

    // Message
    case NotificationType.MESSAGE_NEW:
      return `${name} đã gửi tin nhắn cho bạn`;

    // System
    case NotificationType.SYSTEM:
      return "Thông báo từ hệ thống";

    default:
      return "Bạn có thông báo mới";
  }
}
