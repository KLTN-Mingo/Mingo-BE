"use strict";
// src/dtos/notification.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNotificationResponse = toNotificationResponse;
exports.getNotificationMessage = getNotificationMessage;
const notification_model_1 = require("../models/notification.model");
const user_dto_1 = require("./user.dto");
// ==========================================
// MAPPER FUNCTIONS
// ==========================================
function toNotificationResponse(notification, actor) {
    return {
        id: notification._id.toString(),
        userId: notification.userId.toString(),
        actor: actor ? (0, user_dto_1.toUserMinimal)(actor) : undefined,
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
function getNotificationMessage(type, actorName) {
    const name = actorName || "Ai đó";
    switch (type) {
        // Post
        case notification_model_1.NotificationType.POST_LIKE:
            return `${name} đã thích bài viết của bạn`;
        case notification_model_1.NotificationType.POST_COMMENT:
            return `${name} đã bình luận bài viết của bạn`;
        case notification_model_1.NotificationType.POST_SHARE:
            return `${name} đã chia sẻ bài viết của bạn`;
        case notification_model_1.NotificationType.POST_MENTION:
            return `${name} đã nhắc đến bạn trong một bài viết`;
        // Media
        case notification_model_1.NotificationType.MEDIA_LIKE:
            return `${name} đã thích ảnh/video của bạn`;
        case notification_model_1.NotificationType.MEDIA_COMMENT:
            return `${name} đã bình luận ảnh/video của bạn`;
        case notification_model_1.NotificationType.MEDIA_SHARE:
            return `${name} đã chia sẻ ảnh/video của bạn`;
        // Comment
        case notification_model_1.NotificationType.COMMENT_LIKE:
            return `${name} đã thích bình luận của bạn`;
        case notification_model_1.NotificationType.COMMENT_REPLY:
            return `${name} đã trả lời bình luận của bạn`;
        case notification_model_1.NotificationType.COMMENT_MENTION:
            return `${name} đã nhắc đến bạn trong một bình luận`;
        // Follow
        case notification_model_1.NotificationType.FOLLOW_REQUEST:
            return `${name} đã gửi yêu cầu theo dõi bạn`;
        case notification_model_1.NotificationType.FOLLOW_ACCEPTED:
            return `${name} đã chấp nhận yêu cầu theo dõi của bạn`;
        case notification_model_1.NotificationType.FOLLOW_NEW:
            return `${name} đã bắt đầu theo dõi bạn`;
        // Close friend
        case notification_model_1.NotificationType.CLOSE_FRIEND_REQUEST:
            return `${name} muốn trở thành bạn thân của bạn`;
        case notification_model_1.NotificationType.CLOSE_FRIEND_ACCEPTED:
            return `${name} đã chấp nhận yêu cầu bạn thân của bạn`;
        // Message
        case notification_model_1.NotificationType.MESSAGE_NEW:
            return `${name} đã gửi tin nhắn cho bạn`;
        // System
        case notification_model_1.NotificationType.SYSTEM:
            return "Thông báo từ hệ thống";
        default:
            return "Bạn có thông báo mới";
    }
}
