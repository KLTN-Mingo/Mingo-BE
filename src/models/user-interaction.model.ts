// src/models/user-interaction.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum InteractionSource {
  FEED = "feed",
  EXPLORE = "explore",
  PROFILE = "profile",
  SEARCH = "search",
  NOTIFICATION = "notification",
}

export interface IUserInteraction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;

  // Interaction Types
  viewed: boolean;
  viewDuration?: number; // seconds
  liked: boolean;
  commented: boolean;
  shared: boolean;
  saved: boolean;

  source: InteractionSource;
  deviceType?: string;

  createdAt: Date;
}

const UserInteractionSchema = new Schema<IUserInteraction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },

    // Interaction Types
    viewed: {
      type: Boolean,
      default: false,
    },
    viewDuration: {
      type: Number,
      min: 0,
    },
    liked: {
      type: Boolean,
      default: false,
    },
    commented: {
      type: Boolean,
      default: false,
    },
    shared: {
      type: Boolean,
      default: false,
    },
    saved: {
      type: Boolean,
      default: false,
    },

    source: {
      type: String,
      enum: Object.values(InteractionSource),
      required: true,
    },
    deviceType: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
UserInteractionSchema.index({ userId: 1, createdAt: -1 });
UserInteractionSchema.index({ postId: 1 });
UserInteractionSchema.index({ userId: 1, liked: 1 });
UserInteractionSchema.index({ userId: 1, source: 1, createdAt: -1 });

// TTL index - delete interactions older than 90 days
UserInteractionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export const UserInteractionModel = model<IUserInteraction>(
  "UserInteraction",
  UserInteractionSchema
);
