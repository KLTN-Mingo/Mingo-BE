"use strict";
// src/services/notification.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const mongoose_1 = require("mongoose");
const notification_model_1 = require("../models/notification.model");
const user_model_1 = require("../models/user.model");
const errors_1 = require("../errors");
const notification_dto_1 = require("../dtos/notification.dto");
// Helper: validate ObjectId
function assertObjectId(id, label) {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new errors_1.ValidationError(`${label} không hợp lệ`);
    }
}
exports.NotificationService = {
    // ══════════════════════════════════════════════════════════════════════════════
    // CREATE NOTIFICATION
    // ══════════════════════════════════════════════════════════════════════════════
    async createNotification(dto) {
        // Don't create notification if actor is the same as user
        if (dto.userId === dto.actorId) {
            return null;
        }
        const notification = await notification_model_1.NotificationModel.create({
            userId: new mongoose_1.Types.ObjectId(dto.userId),
            actorId: new mongoose_1.Types.ObjectId(dto.actorId),
            notificationType: dto.notificationType,
            entityType: dto.entityType,
            entityId: dto.entityId ? new mongoose_1.Types.ObjectId(dto.entityId) : undefined,
            postId: dto.postId ? new mongoose_1.Types.ObjectId(dto.postId) : undefined,
            mediaId: dto.mediaId ? new mongoose_1.Types.ObjectId(dto.mediaId) : undefined,
            commentId: dto.commentId ? new mongoose_1.Types.ObjectId(dto.commentId) : undefined,
            content: dto.content,
            thumbnailUrl: dto.thumbnailUrl,
        });
        const actor = await user_model_1.UserModel.findById(dto.actorId).lean();
        return (0, notification_dto_1.toNotificationResponse)(notification, actor);
    },
    // Helper methods for specific notification types
    async notifyPostLike(postOwnerId, actorId, postId, thumbnailUrl) {
        return this.createNotification({
            userId: postOwnerId,
            actorId,
            notificationType: notification_model_1.NotificationType.POST_LIKE,
            entityType: notification_model_1.EntityType.POST,
            entityId: postId,
            postId,
            thumbnailUrl,
        });
    },
    async notifyPostComment(postOwnerId, actorId, postId, commentId, content, thumbnailUrl) {
        return this.createNotification({
            userId: postOwnerId,
            actorId,
            notificationType: notification_model_1.NotificationType.POST_COMMENT,
            entityType: notification_model_1.EntityType.COMMENT,
            entityId: commentId,
            postId,
            commentId,
            content,
            thumbnailUrl,
        });
    },
    async notifyPostShare(postOwnerId, actorId, postId, thumbnailUrl) {
        return this.createNotification({
            userId: postOwnerId,
            actorId,
            notificationType: notification_model_1.NotificationType.POST_SHARE,
            entityType: notification_model_1.EntityType.POST,
            entityId: postId,
            postId,
            thumbnailUrl,
        });
    },
    async notifyMediaLike(mediaOwnerId, actorId, mediaId, postId, thumbnailUrl) {
        return this.createNotification({
            userId: mediaOwnerId,
            actorId,
            notificationType: notification_model_1.NotificationType.MEDIA_LIKE,
            entityType: notification_model_1.EntityType.MEDIA,
            entityId: mediaId,
            mediaId,
            postId,
            thumbnailUrl,
        });
    },
    async notifyMediaComment(mediaOwnerId, actorId, mediaId, commentId, content, thumbnailUrl) {
        return this.createNotification({
            userId: mediaOwnerId,
            actorId,
            notificationType: notification_model_1.NotificationType.MEDIA_COMMENT,
            entityType: notification_model_1.EntityType.COMMENT,
            entityId: commentId,
            mediaId,
            commentId,
            content,
            thumbnailUrl,
        });
    },
    async notifyCommentLike(commentOwnerId, actorId, commentId, postId, mediaId) {
        return this.createNotification({
            userId: commentOwnerId,
            actorId,
            notificationType: notification_model_1.NotificationType.COMMENT_LIKE,
            entityType: notification_model_1.EntityType.COMMENT,
            entityId: commentId,
            commentId,
            postId,
            mediaId,
        });
    },
    async notifyCommentReply(commentOwnerId, actorId, parentCommentId, replyCommentId, content, postId, mediaId) {
        return this.createNotification({
            userId: commentOwnerId,
            actorId,
            notificationType: notification_model_1.NotificationType.COMMENT_REPLY,
            entityType: notification_model_1.EntityType.COMMENT,
            entityId: replyCommentId,
            commentId: parentCommentId,
            content,
            postId,
            mediaId,
        });
    },
    async notifyFollowRequest(targetUserId, actorId) {
        return this.createNotification({
            userId: targetUserId,
            actorId,
            notificationType: notification_model_1.NotificationType.FOLLOW_REQUEST,
            entityType: notification_model_1.EntityType.USER,
            entityId: actorId,
        });
    },
    async notifyFollowAccepted(requesterId, accepterId) {
        return this.createNotification({
            userId: requesterId,
            actorId: accepterId,
            notificationType: notification_model_1.NotificationType.FOLLOW_ACCEPTED,
            entityType: notification_model_1.EntityType.USER,
            entityId: accepterId,
        });
    },
    async notifyNewFollower(targetUserId, followerId) {
        return this.createNotification({
            userId: targetUserId,
            actorId: followerId,
            notificationType: notification_model_1.NotificationType.FOLLOW_NEW,
            entityType: notification_model_1.EntityType.USER,
            entityId: followerId,
        });
    },
    async notifyCloseFriendRequest(targetUserId, actorId) {
        return this.createNotification({
            userId: targetUserId,
            actorId,
            notificationType: notification_model_1.NotificationType.CLOSE_FRIEND_REQUEST,
            entityType: notification_model_1.EntityType.USER,
            entityId: actorId,
        });
    },
    async notifyCloseFriendAccepted(requesterId, accepterId) {
        return this.createNotification({
            userId: requesterId,
            actorId: accepterId,
            notificationType: notification_model_1.NotificationType.CLOSE_FRIEND_ACCEPTED,
            entityType: notification_model_1.EntityType.USER,
            entityId: accepterId,
        });
    },
    async notifyMention(mentionedUserId, actorId, type, entityId, postId, mediaId, content) {
        const notificationType = type === "post"
            ? notification_model_1.NotificationType.POST_MENTION
            : notification_model_1.NotificationType.COMMENT_MENTION;
        return this.createNotification({
            userId: mentionedUserId,
            actorId,
            notificationType,
            entityType: type === "post" ? notification_model_1.EntityType.POST : notification_model_1.EntityType.COMMENT,
            entityId,
            postId,
            mediaId,
            content,
        });
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // GET NOTIFICATIONS
    // ══════════════════════════════════════════════════════════════════════════════
    async getNotifications(userId, page = 1, limit = 20, type, isRead) {
        assertObjectId(userId, "ID người dùng");
        const query = { userId: new mongoose_1.Types.ObjectId(userId) };
        if (type) {
            query.notificationType = type;
        }
        if (isRead !== undefined) {
            query.isRead = isRead;
        }
        const [notifications, total] = await Promise.all([
            notification_model_1.NotificationModel.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            notification_model_1.NotificationModel.countDocuments(query),
        ]);
        // Get actor info
        const actorIds = [
            ...new Set(notifications.map((n) => n.actorId.toString())),
        ];
        const actors = await user_model_1.UserModel.find({ _id: { $in: actorIds } }).lean();
        const actorMap = new Map(actors.map((a) => [a._id.toString(), a]));
        const totalPages = Math.ceil(total / limit);
        return {
            notifications: notifications.map((notification) => {
                const actor = actorMap.get(notification.actorId.toString());
                return (0, notification_dto_1.toNotificationResponse)(notification, actor);
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
    async getNotificationCount(userId) {
        assertObjectId(userId, "ID người dùng");
        const userObjectId = new mongoose_1.Types.ObjectId(userId);
        const [total, unread, unseen] = await Promise.all([
            notification_model_1.NotificationModel.countDocuments({ userId: userObjectId }),
            notification_model_1.NotificationModel.countDocuments({ userId: userObjectId, isRead: false }),
            notification_model_1.NotificationModel.countDocuments({ userId: userObjectId, isSeen: false }),
        ]);
        return { total, unread, unseen };
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // UPDATE NOTIFICATIONS
    // ══════════════════════════════════════════════════════════════════════════════
    // Đánh dấu notification đã đọc
    async markAsRead(notificationId, userId) {
        assertObjectId(notificationId, "ID thông báo");
        const notification = await notification_model_1.NotificationModel.findOne({
            _id: new mongoose_1.Types.ObjectId(notificationId),
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        if (!notification) {
            throw new errors_1.NotFoundError("Không tìm thấy thông báo");
        }
        notification.isRead = true;
        notification.isSeen = true;
        await notification.save();
    },
    // Đánh dấu tất cả đã đọc
    async markAllAsRead(userId) {
        assertObjectId(userId, "ID người dùng");
        const result = await notification_model_1.NotificationModel.updateMany({ userId: new mongoose_1.Types.ObjectId(userId), isRead: false }, { $set: { isRead: true, isSeen: true } });
        return result.modifiedCount;
    },
    // Đánh dấu tất cả đã xem (seen)
    async markAllAsSeen(userId) {
        assertObjectId(userId, "ID người dùng");
        const result = await notification_model_1.NotificationModel.updateMany({ userId: new mongoose_1.Types.ObjectId(userId), isSeen: false }, { $set: { isSeen: true } });
        return result.modifiedCount;
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // DELETE NOTIFICATIONS
    // ══════════════════════════════════════════════════════════════════════════════
    // Xóa một notification
    async deleteNotification(notificationId, userId) {
        assertObjectId(notificationId, "ID thông báo");
        const notification = await notification_model_1.NotificationModel.findOne({
            _id: new mongoose_1.Types.ObjectId(notificationId),
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        if (!notification) {
            throw new errors_1.NotFoundError("Không tìm thấy thông báo");
        }
        await notification.deleteOne();
    },
    // Xóa tất cả notifications đã đọc
    async deleteAllRead(userId) {
        assertObjectId(userId, "ID người dùng");
        const result = await notification_model_1.NotificationModel.deleteMany({
            userId: new mongoose_1.Types.ObjectId(userId),
            isRead: true,
        });
        return result.deletedCount;
    },
    // Xóa tất cả notifications
    async deleteAll(userId) {
        assertObjectId(userId, "ID người dùng");
        const result = await notification_model_1.NotificationModel.deleteMany({
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        return result.deletedCount;
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // BATCH DELETE (cleanup old notifications)
    // ══════════════════════════════════════════════════════════════════════════════
    // Xóa notifications cũ hơn X ngày
    async cleanupOldNotifications(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await notification_model_1.NotificationModel.deleteMany({
            createdAt: { $lt: cutoffDate },
            isRead: true,
        });
        return result.deletedCount;
    },
};
