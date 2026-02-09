// src/models/notification.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum NotificationType {
  LIKE = "like",
  COMMENT = "comment",
  FOLLOW = "follow",
  MENTION = "mention",
  MESSAGE = "message",
  SHARE = "share",
  BESTFRIEND_ADD = "bestfriend_add",
}

export enum EntityType {
  POST = "post",
  COMMENT = "comment",
  USER = "user",
  MESSAGE = "message",
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  notificationType: NotificationType;
  actorId: Types.ObjectId;

  entityType?: EntityType;
  entityId?: Types.ObjectId;

  content?: string;
  thumbnailUrl?: string;

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
    notificationType: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    entityType: {
      type: String,
      enum: Object.values(EntityType),
    },
    entityId: {
      type: Schema.Types.ObjectId,
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
NotificationSchema.index({ userId: 1, notificationType: 1, isRead: 1 });

export const NotificationModel = model<INotification>(
  "Notification",
  NotificationSchema
);
