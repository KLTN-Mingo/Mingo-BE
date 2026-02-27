// src/models/post-media.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
}

export interface IPostMedia extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId; // Người tạo media
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string; // Caption riêng cho từng media
  width?: number;
  height?: number;
  duration?: number; // For videos, in seconds
  fileSize?: number; // In bytes
  orderIndex: number;

  // Engagement counts
  likesCount: number;
  commentsCount: number;
  sharesCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const PostMediaSchema = new Schema<IPostMedia>(
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
    mediaType: {
      type: String,
      enum: Object.values(MediaType),
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    caption: {
      type: String,
      maxlength: 2000,
    },
    width: {
      type: Number,
      min: 0,
    },
    height: {
      type: Number,
      min: 0,
    },
    duration: {
      type: Number,
      min: 0,
    },
    fileSize: {
      type: Number,
      min: 0,
    },
    orderIndex: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Engagement
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
  },
  {
    timestamps: true,
  }
);

// Indexes
PostMediaSchema.index({ postId: 1, orderIndex: 1 });
PostMediaSchema.index({ userId: 1, createdAt: -1 });
PostMediaSchema.index({ likesCount: -1 });

export const PostMediaModel = model<IPostMedia>("PostMedia", PostMediaSchema);
