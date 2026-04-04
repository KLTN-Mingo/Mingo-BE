// src/models/share.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IShare extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // Người share
  postId?: Types.ObjectId; // Share post
  mediaId?: Types.ObjectId; // Share media
  caption?: string; // Caption khi share
  /** feed | message | external — chủ yếu cho share post */
  sharedTo?: "feed" | "message" | "external";
  createdAt: Date;
}

const ShareSchema = new Schema<IShare>(
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
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "PostMedia",
      index: true,
    },
    caption: {
      type: String,
      maxlength: 2000,
    },
    sharedTo: {
      type: String,
      enum: ["feed", "message", "external"],
      default: "feed",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
ShareSchema.index({ postId: 1, createdAt: -1 });
ShareSchema.index({ mediaId: 1, createdAt: -1 });
ShareSchema.index({ userId: 1, createdAt: -1 });

export const ShareModel = model<IShare>("Share", ShareSchema);
