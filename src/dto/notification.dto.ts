// src/dtos/notification.dto.ts
import { NotificationType, EntityType } from "../models/notification.model";
import { UserMinimalDto } from "./user.dto";

// ==========================================
// REQUEST DTOs
// ==========================================

export class GetNotificationsDto {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  types?: NotificationType[];
}

export class MarkNotificationAsReadDto {
  notificationId!: string;
}

export class MarkAllAsReadDto {
  types?: NotificationType[]; // If provided, mark only specific types
}

export class DeleteNotificationDto {
  notificationId!: string;
}

export class GetNotificationSettingsDto {
  // Used to fetch user's notification preferences
}

export class UpdateNotificationSettingsDto {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  likeNotification?: boolean;
  commentNotification?: boolean;
  followNotification?: boolean;
  messageNotification?: boolean;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

export class NotificationResponseDto {
  id!: string;
  notificationType!: NotificationType;
  actor!: UserMinimalDto;

  entityType?: EntityType;
  entityId?: string;

  content?: string;
  thumbnailUrl?: string;

  isRead!: boolean;
  isSeen!: boolean;

  createdAt!: Date;
}

export class NotificationDetailDto extends NotificationResponseDto {
  entity?: NotificationEntityDto;
}

export class NotificationEntityDto {
  id!: string;
  type!: EntityType;
  preview?: string; // Preview text for post/comment
  imageUrl?: string; // Preview image
}

export class PaginatedNotificationsDto {
  notifications!: NotificationResponseDto[];
  unreadCount!: number;
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export class NotificationStatsDto {
  totalUnread!: number;
  unreadByType!: {
    like: number;
    comment: number;
    follow: number;
    mention: number;
    message: number;
    share: number;
    bestfriend_add: number;
  };
}

export class NotificationSettingsDto {
  pushEnabled!: boolean;
  emailEnabled!: boolean;
  likeNotification!: boolean;
  commentNotification!: boolean;
  followNotification!: boolean;
  messageNotification!: boolean;
}

// ==========================================
// WEBSOCKET EVENT DTOs
// ==========================================

export class NewNotificationEventDto {
  notification!: NotificationResponseDto;
}

export class NotificationReadEventDto {
  notificationId!: string;
  isRead!: boolean;
}

export class NotificationCountEventDto {
  unreadCount!: number;
}
