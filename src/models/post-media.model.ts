// src/models/post-media.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
}

export interface IPostMedia extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  mediaType: MediaType;
  mediaUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number; // For videos, in seconds
  fileSize?: number; // In bytes
  orderIndex: number;
  createdAt: Date;
}

const PostMediaSchema = new Schema<IPostMedia>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
PostMediaSchema.index({ postId: 1, orderIndex: 1 });

export const PostMediaModel = model<IPostMedia>("PostMedia", PostMediaSchema);
