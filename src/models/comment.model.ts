// src/models/comment.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum CommentModerationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  FLAGGED = "flagged",
}

export interface IComment extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  parentCommentId?: Types.ObjectId;
  contentText: string;

  // Moderation
  moderationStatus: CommentModerationStatus;
  isHidden: boolean;

  // Engagement
  likesCount: number;
  repliesCount: number;

  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    contentText: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    // Moderation
    moderationStatus: {
      type: String,
      enum: Object.values(CommentModerationStatus),
      default: CommentModerationStatus.APPROVED,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },

    // Engagement
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    repliesCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Indexes
CommentSchema.index({ postId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1, createdAt: -1 });
CommentSchema.index({ parentCommentId: 1, createdAt: -1 });
CommentSchema.index({ postId: 1, parentCommentId: 1 });

export const CommentModel = model<IComment>("Comment", CommentSchema);
