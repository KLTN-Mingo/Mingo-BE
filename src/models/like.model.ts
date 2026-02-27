// src/models/like.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface ILike extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId?: Types.ObjectId;
  commentId?: Types.ObjectId;
  mediaId?: Types.ObjectId; // Like cho media
  createdAt: Date;
}

const LikeSchema = new Schema<ILike>(
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
      index: true,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      index: true,
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "PostMedia",
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound unique indexes to prevent duplicate likes
LikeSchema.index({ userId: 1, postId: 1 }, { unique: true, sparse: true });
LikeSchema.index({ userId: 1, commentId: 1 }, { unique: true, sparse: true });
LikeSchema.index({ userId: 1, mediaId: 1 }, { unique: true, sparse: true });

// Additional indexes for queries
LikeSchema.index({ postId: 1, createdAt: -1 });
LikeSchema.index({ commentId: 1, createdAt: -1 });
LikeSchema.index({ mediaId: 1, createdAt: -1 });
LikeSchema.index({ userId: 1, createdAt: -1 });

export const LikeModel = model<ILike>("Like", LikeSchema);
