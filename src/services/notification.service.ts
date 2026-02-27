// src/services/notification.service.ts

import { Types } from "mongoose";
import {
  NotificationModel,
  NotificationType,
  EntityType,
} from "../models/notification.model";
import { UserModel } from "../models/user.model";
import { NotFoundError, ValidationError } from "../errors";
import { toUserMinimal } from "../dtos/user.dto";
import {
  CreateNotificationDto,
  NotificationResponseDto,
  PaginatedNotificationsDto,
  NotificationCountDto,
  toNotificationResponse,
  getNotificationMessage,
} from "../dtos/notification.dto";

// Helper: validate ObjectId
function assertObjectId(id: string, label: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${label} không hợp lệ`);
  }
}

export const NotificationService = {
  // ══════════════════════════════════════════════════════════════════════════════
  // CREATE NOTIFICATION
  // ══════════════════════════════════════════════════════════════════════════════

  async createNotification(
    dto: CreateNotificationDto
  ): Promise<NotificationResponseDto> {
    // Don't create notification if actor is the same as user
    if (dto.userId === dto.actorId) {
      return null as any;
    }

    const notification = await NotificationModel.create({
      userId: new Types.ObjectId(dto.userId),
      actorId: new Types.ObjectId(dto.actorId),
      notificationType: dto.notificationType,
      entityType: dto.entityType,
      entityId: dto.entityId ? new Types.ObjectId(dto.entityId) : undefined,
      postId: dto.postId ? new Types.ObjectId(dto.postId) : undefined,
      mediaId: dto.mediaId ? new Types.ObjectId(dto.mediaId) : undefined,
      commentId: dto.commentId ? new Types.ObjectId(dto.commentId) : undefined,
      content: dto.content,
      thumbnailUrl: dto.thumbnailUrl,
    });

    const actor = await UserModel.findById(dto.actorId).lean();

    return toNotificationResponse(notification, actor);
  },

  // Helper methods for specific notification types
  async notifyPostLike(
    postOwnerId: string,
    actorId: string,
    postId: string,
    thumbnailUrl?: string
  ) {
    return this.createNotification({
      userId: postOwnerId,
      actorId,
      notificationType: NotificationType.POST_LIKE,
      entityType: EntityType.POST,
      entityId: postId,
      postId,
      thumbnailUrl,
    });
  },

  async notifyPostComment(
    postOwnerId: string,
    actorId: string,
    postId: string,
    commentId: string,
    content?: string,
    thumbnailUrl?: string
  ) {
    return this.createNotification({
      userId: postOwnerId,
      actorId,
      notificationType: NotificationType.POST_COMMENT,
      entityType: EntityType.COMMENT,
      entityId: commentId,
      postId,
      commentId,
      content,
      thumbnailUrl,
    });
  },

  async notifyPostShare(
    postOwnerId: string,
    actorId: string,
    postId: string,
    thumbnailUrl?: string
  ) {
    return this.createNotification({
      userId: postOwnerId,
      actorId,
      notificationType: NotificationType.POST_SHARE,
      entityType: EntityType.POST,
      entityId: postId,
      postId,
      thumbnailUrl,
    });
  },

  async notifyMediaLike(
    mediaOwnerId: string,
    actorId: string,
    mediaId: string,
    postId?: string,
    thumbnailUrl?: string
  ) {
    return this.createNotification({
      userId: mediaOwnerId,
      actorId,
      notificationType: NotificationType.MEDIA_LIKE,
      entityType: EntityType.MEDIA,
      entityId: mediaId,
      mediaId,
      postId,
      thumbnailUrl,
    });
  },

  async notifyMediaComment(
    mediaOwnerId: string,
    actorId: string,
    mediaId: string,
    commentId: string,
    content?: string,
    thumbnailUrl?: string
  ) {
    return this.createNotification({
      userId: mediaOwnerId,
      actorId,
      notificationType: NotificationType.MEDIA_COMMENT,
      entityType: EntityType.COMMENT,
      entityId: commentId,
      mediaId,
      commentId,
      content,
      thumbnailUrl,
    });
  },

  async notifyCommentLike(
    commentOwnerId: string,
    actorId: string,
    commentId: string,
    postId?: string,
    mediaId?: string
  ) {
    return this.createNotification({
      userId: commentOwnerId,
      actorId,
      notificationType: NotificationType.COMMENT_LIKE,
      entityType: EntityType.COMMENT,
      entityId: commentId,
      commentId,
      postId,
      mediaId,
    });
  },

  async notifyCommentReply(
    commentOwnerId: string,
    actorId: string,
    parentCommentId: string,
    replyCommentId: string,
    content?: string,
    postId?: string,
    mediaId?: string
  ) {
    return this.createNotification({
      userId: commentOwnerId,
      actorId,
      notificationType: NotificationType.COMMENT_REPLY,
      entityType: EntityType.COMMENT,
      entityId: replyCommentId,
      commentId: parentCommentId,
      content,
      postId,
      mediaId,
    });
  },

  async notifyFollowRequest(targetUserId: string, actorId: string) {
    return this.createNotification({
      userId: targetUserId,
      actorId,
      notificationType: NotificationType.FOLLOW_REQUEST,
      entityType: EntityType.USER,
      entityId: actorId,
    });
  },

  async notifyFollowAccepted(requesterId: string, accepterId: string) {
    return this.createNotification({
      userId: requesterId,
      actorId: accepterId,
      notificationType: NotificationType.FOLLOW_ACCEPTED,
      entityType: EntityType.USER,
      entityId: accepterId,
    });
  },

  async notifyNewFollower(targetUserId: string, followerId: string) {
    return this.createNotification({
      userId: targetUserId,
      actorId: followerId,
      notificationType: NotificationType.FOLLOW_NEW,
      entityType: EntityType.USER,
      entityId: followerId,
    });
  },

  async notifyCloseFriendRequest(targetUserId: string, actorId: string) {
    return this.createNotification({
      userId: targetUserId,
      actorId,
      notificationType: NotificationType.CLOSE_FRIEND_REQUEST,
      entityType: EntityType.USER,
      entityId: actorId,
    });
  },

  async notifyCloseFriendAccepted(requesterId: string, accepterId: string) {
    return this.createNotification({
      userId: requesterId,
      actorId: accepterId,
      notificationType: NotificationType.CLOSE_FRIEND_ACCEPTED,
      entityType: EntityType.USER,
      entityId: accepterId,
    });
  },

  async notifyMention(
    mentionedUserId: string,
    actorId: string,
    type: "post" | "comment",
    entityId: string,
    postId?: string,
    mediaId?: string,
    content?: string
  ) {
    const notificationType =
      type === "post"
        ? NotificationType.POST_MENTION
        : NotificationType.COMMENT_MENTION;

    return this.createNotification({
      userId: mentionedUserId,
      actorId,
      notificationType,
      entityType: type === "post" ? EntityType.POST : EntityType.COMMENT,
      entityId,
      postId,
      mediaId,
      content,
    });
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // GET NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════════

  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: NotificationType,
    isRead?: boolean
  ): Promise<PaginatedNotificationsDto> {
    assertObjectId(userId, "ID người dùng");

    const query: any = { userId: new Types.ObjectId(userId) };

    if (type) {
      query.notificationType = type;
    }

    if (isRead !== undefined) {
      query.isRead = isRead;
    }

    const [notifications, total] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(query),
    ]);

    // Get actor info
    const actorIds = [
      ...new Set(notifications.map((n) => n.actorId.toString())),
    ];
    const actors = await UserModel.find({ _id: { $in: actorIds } }).lean();
    const actorMap = new Map(actors.map((a) => [a._id.toString(), a]));

    const totalPages = Math.ceil(total / limit);

    return {
      notifications: notifications.map((notification) => {
        const actor = actorMap.get(notification.actorId.toString());
        return toNotificationResponse(notification as any, actor);
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  },

  // Lấy notification count
  async getNotificationCount(userId: string): Promise<NotificationCountDto> {
    assertObjectId(userId, "ID người dùng");

    const userObjectId = new Types.ObjectId(userId);

    const [total, unread, unseen] = await Promise.all([
      NotificationModel.countDocuments({ userId: userObjectId }),
      NotificationModel.countDocuments({ userId: userObjectId, isRead: false }),
      NotificationModel.countDocuments({ userId: userObjectId, isSeen: false }),
    ]);

    return { total, unread, unseen };
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // UPDATE NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════════

  // Đánh dấu notification đã đọc
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    assertObjectId(notificationId, "ID thông báo");

    const notification = await NotificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundError("Không tìm thấy thông báo");
    }

    notification.isRead = true;
    notification.isSeen = true;
    await notification.save();
  },

  // Đánh dấu tất cả đã đọc
  async markAllAsRead(userId: string): Promise<number> {
    assertObjectId(userId, "ID người dùng");

    const result = await NotificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true, isSeen: true } }
    );

    return result.modifiedCount;
  },

  // Đánh dấu tất cả đã xem (seen)
  async markAllAsSeen(userId: string): Promise<number> {
    assertObjectId(userId, "ID người dùng");

    const result = await NotificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isSeen: false },
      { $set: { isSeen: true } }
    );

    return result.modifiedCount;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // DELETE NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════════

  // Xóa một notification
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    assertObjectId(notificationId, "ID thông báo");

    const notification = await NotificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundError("Không tìm thấy thông báo");
    }

    await notification.deleteOne();
  },

  // Xóa tất cả notifications đã đọc
  async deleteAllRead(userId: string): Promise<number> {
    assertObjectId(userId, "ID người dùng");

    const result = await NotificationModel.deleteMany({
      userId: new Types.ObjectId(userId),
      isRead: true,
    });

    return result.deletedCount;
  },

  // Xóa tất cả notifications
  async deleteAll(userId: string): Promise<number> {
    assertObjectId(userId, "ID người dùng");

    const result = await NotificationModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });

    return result.deletedCount;
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // BATCH DELETE (cleanup old notifications)
  // ══════════════════════════════════════════════════════════════════════════════

  // Xóa notifications cũ hơn X ngày
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await NotificationModel.deleteMany({
      createdAt: { $lt: cutoffDate },
      isRead: true,
    });

    return result.deletedCount;
  },
};
