// src/models/comment-like.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface ICommentLike extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  commentId: Types.ObjectId;
  createdAt: Date;
}

const CommentLikeSchema = new Schema<ICommentLike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Prevent duplicate likes
CommentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true });

export const CommentLikeModel = model<ICommentLike>(
  "CommentLike",
  CommentLikeSchema
);
