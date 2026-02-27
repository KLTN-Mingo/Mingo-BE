// src/models/notification.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum NotificationType {
  // Post notifications
  POST_LIKE = "post_like",
  POST_COMMENT = "post_comment",
  POST_SHARE = "post_share",
  POST_MENTION = "post_mention",

  // Media notifications
  MEDIA_LIKE = "media_like",
  MEDIA_COMMENT = "media_comment",
  MEDIA_SHARE = "media_share",

  // Comment notifications
  COMMENT_LIKE = "comment_like",
  COMMENT_REPLY = "comment_reply",
  COMMENT_MENTION = "comment_mention",

  // Follow notifications
  FOLLOW_REQUEST = "follow_request",
  FOLLOW_ACCEPTED = "follow_accepted",
  FOLLOW_NEW = "follow_new", // When someone follows you (auto-accept)

  // Close friend notifications
  CLOSE_FRIEND_REQUEST = "close_friend_request",
  CLOSE_FRIEND_ACCEPTED = "close_friend_accepted",

  // Message notifications
  MESSAGE_NEW = "message_new",

  // System notifications
  SYSTEM = "system",
}

export enum EntityType {
  POST = "post",
  MEDIA = "media",
  COMMENT = "comment",
  USER = "user",
  MESSAGE = "message",
  FOLLOW = "follow",
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // Người nhận notification
  actorId: Types.ObjectId; // Người thực hiện hành động
  notificationType: NotificationType;

  // Entity references
  entityType?: EntityType;
  entityId?: Types.ObjectId;

  // Additional context
  postId?: Types.ObjectId; // Post liên quan
  mediaId?: Types.ObjectId; // Media liên quan
  commentId?: Types.ObjectId; // Comment liên quan

  // Content
  content?: string; // Nội dung tùy chỉnh
  thumbnailUrl?: string; // Ảnh thumbnail

  // Status
  isRead: boolean;
  isSeen: boolean;

  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
    },

    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      index: true,
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "PostMedia",
      index: true,
    },
    commentId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, notificationType: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isSeen: 1 });

export const NotificationModel = model<INotification>(
  "Notification",
  NotificationSchema
);
