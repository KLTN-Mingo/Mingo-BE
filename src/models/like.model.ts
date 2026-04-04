// src/models/like.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface ILike extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId?: Types.ObjectId;
  commentId?: Types.ObjectId;
  mediaId?: Types.ObjectId;
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
    },
    commentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "PostMedia",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Partial unique indexes - chỉ áp dụng khi field tồn tại
LikeSchema.index(
  { userId: 1, postId: 1 },
  { unique: true, partialFilterExpression: { postId: { $exists: true, $ne: null } } }
);
LikeSchema.index(
  { userId: 1, commentId: 1 },
  { unique: true, partialFilterExpression: { commentId: { $exists: true, $ne: null } } }
);
LikeSchema.index(
  { userId: 1, mediaId: 1 },
  { unique: true, partialFilterExpression: { mediaId: { $exists: true, $ne: null } } }
);

// Additional indexes for queries
LikeSchema.index({ postId: 1, createdAt: -1 });
LikeSchema.index({ commentId: 1, createdAt: -1 });
LikeSchema.index({ mediaId: 1, createdAt: -1 });
LikeSchema.index({ userId: 1, createdAt: -1 });

export const LikeModel = model<ILike>("Like", LikeSchema);
