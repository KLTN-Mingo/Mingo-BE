// src/models/post.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum PostVisibility {
  PUBLIC = "public",
  FRIENDS = "friends",
  PRIVATE = "private",
  BESTFRIENDS = "bestfriends",
}

export enum ModerationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  FLAGGED = "flagged",
}

export interface IAIScore {
  toxic?: number;
  hateSpeech?: number;
  spam?: number;
  overallRisk?: number;
}

export interface IPost extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  contentText?: string;
  visibility: PostVisibility;

  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  viewsCount: number;

  moderationStatus: ModerationStatus;
  aiToxicScore?: number;
  aiHateSpeechScore?: number;
  aiSpamScore?: number;
  aiOverallRisk?: number;
  isHidden: boolean;
  hiddenReason?: string;

  isEdited: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contentText: {
      type: String,
      maxlength: 10000,
    },
    visibility: {
      type: String,
      enum: Object.values(PostVisibility),
      default: PostVisibility.PUBLIC,
    },

    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    savesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    moderationStatus: {
      type: String,
      enum: Object.values(ModerationStatus),
      default: ModerationStatus.PENDING,
      index: true,
    },
    aiToxicScore: {
      type: Number,
      min: 0,
      max: 1,
    },
    aiHateSpeechScore: {
      type: Number,
      min: 0,
      max: 1,
    },
    aiSpamScore: {
      type: Number,
      min: 0,
      max: 1,
    },
    aiOverallRisk: {
      type: Number,
      min: 0,
      max: 1,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    hiddenReason: {
      type: String,
      maxlength: 500,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ moderationStatus: 1 });
PostSchema.index({ likesCount: -1 });
PostSchema.index({ userId: 1, visibility: 1, createdAt: -1 });

PostSchema.index({ contentText: "text" });

export const PostModel = model<IPost>("Post", PostSchema);
