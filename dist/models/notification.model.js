"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModel = exports.EntityType = exports.NotificationType = void 0;
// src/models/notification.model.ts
const mongoose_1 = require("mongoose");
var NotificationType;
(function (NotificationType) {
    // Post notifications
    NotificationType["POST_LIKE"] = "post_like";
    NotificationType["POST_COMMENT"] = "post_comment";
    NotificationType["POST_SHARE"] = "post_share";
    NotificationType["POST_MENTION"] = "post_mention";
    // Media notifications
    NotificationType["MEDIA_LIKE"] = "media_like";
    NotificationType["MEDIA_COMMENT"] = "media_comment";
    NotificationType["MEDIA_SHARE"] = "media_share";
    // Comment notifications
    NotificationType["COMMENT_LIKE"] = "comment_like";
    NotificationType["COMMENT_REPLY"] = "comment_reply";
    NotificationType["COMMENT_MENTION"] = "comment_mention";
    // Follow notifications
    NotificationType["FOLLOW_REQUEST"] = "follow_request";
    NotificationType["FOLLOW_ACCEPTED"] = "follow_accepted";
    NotificationType["FOLLOW_NEW"] = "follow_new";
    // Close friend notifications
    NotificationType["CLOSE_FRIEND_REQUEST"] = "close_friend_request";
    NotificationType["CLOSE_FRIEND_ACCEPTED"] = "close_friend_accepted";
    // Message notifications
    NotificationType["MESSAGE_NEW"] = "message_new";
    // System notifications
    NotificationType["SYSTEM"] = "system";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var EntityType;
(function (EntityType) {
    EntityType["POST"] = "post";
    EntityType["MEDIA"] = "media";
    EntityType["COMMENT"] = "comment";
    EntityType["USER"] = "user";
    EntityType["MESSAGE"] = "message";
    EntityType["FOLLOW"] = "follow";
})(EntityType || (exports.EntityType = EntityType = {}));
const NotificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    actorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    notificationType: {
        type: String,
        enum: Object.values(NotificationType),
        required: true,
        index: true,
    },
    entityType: {
        type: String,
        enum: Object.values(EntityType),
    },
    entityId: {
        type: mongoose_1.Schema.Types.ObjectId,
    },
    postId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Post",
        index: true,
    },
    mediaId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "PostMedia",
        index: true,
    },
    commentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Comment",
        index: true,
    },
    content: {
        type: String,
        maxlength: 500,
    },
    thumbnailUrl: {
        type: String,
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true,
    },
    isSeen: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Indexes
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, notificationType: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isSeen: 1 });
exports.NotificationModel = (0, mongoose_1.model)("Notification", NotificationSchema);
