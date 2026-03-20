// src/models/user-interaction.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum InteractionSource {
  FEED         = "feed",
  EXPLORE      = "explore",
  PROFILE      = "profile",
  SEARCH       = "search",
  NOTIFICATION = "notification",
}

export enum FeedbackType {
  ORGANIC        = "organic",
  HIDE           = "hide",
  NOT_INTERESTED = "not_interested",
  SEE_MORE       = "see_more",
  REPORT         = "report",
}

export enum InteractionType {
  VIEW             = "view",
  LIKE             = "like",
  COMMENT          = "comment",
  SHARE            = "share",
  SAVE             = "save",
  FOLLOW_FROM_POST = "follow_from_post",
  HIDE             = "hide",
  NOT_INTERESTED   = "not_interested",
  SEE_MORE         = "see_more",
  REPORT           = "report",
}

export interface IUserInteraction extends Document {
  _id:      Types.ObjectId;
  userId:   Types.ObjectId;
  postId:   Types.ObjectId;

  viewed:    boolean;
  liked:     boolean;
  commented: boolean;
  shared:    boolean;
  saved:     boolean;

  weight:       number;  // Cộng dồn từ mọi lần track (like + comment + ...)
  feedbackType: FeedbackType;
  viewDuration?: number;
  scrollDepth?:  number;

  source:     InteractionSource;
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

    viewed:    { type: Boolean, default: false },
    liked:     { type: Boolean, default: false },
    commented: { type: Boolean, default: false },
    shared:    { type: Boolean, default: false },
    saved:     { type: Boolean, default: false },

    weight: { type: Number, default: 1 },
    feedbackType: {
      type:    String,
      enum:    Object.values(FeedbackType),
      default: FeedbackType.ORGANIC,
    },
    viewDuration: { type: Number, min: 0 },   
    scrollDepth: { type: Number, min: 0, max: 1 },

    source: {
      type:     String,
      enum:     Object.values(InteractionSource),
      required: true,
    },
    deviceType: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

UserInteractionSchema.index({ userId: 1, createdAt: -1 });
UserInteractionSchema.index({ userId: 1, liked: 1 });
UserInteractionSchema.index({ userId: 1, source: 1, createdAt: -1 });
UserInteractionSchema.index({ userId: 1, feedbackType: 1 });

UserInteractionSchema.index({ userId: 1, postId: 1 }, { unique: true });

UserInteractionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export const UserInteractionModel = model<IUserInteraction>(
  "UserInteraction",
  UserInteractionSchema
);