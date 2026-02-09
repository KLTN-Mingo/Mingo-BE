// src/models/like.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface ILike extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
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
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound unique index to prevent duplicate likes
LikeSchema.index({ userId: 1, postId: 1 }, { unique: true });

// Additional indexes for queries
LikeSchema.index({ postId: 1, createdAt: -1 });
LikeSchema.index({ userId: 1, createdAt: -1 });

export const LikeModel = model<ILike>("Like", LikeSchema);
