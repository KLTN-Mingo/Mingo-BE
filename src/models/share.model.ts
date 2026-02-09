// src/models/share.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum ShareDestination {
  FEED = "feed",
  MESSAGE = "message",
  EXTERNAL = "external",
}

export interface IShare extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  sharedTo: ShareDestination;
  caption?: string;
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
      required: true,
      index: true,
    },
    sharedTo: {
      type: String,
      enum: Object.values(ShareDestination),
      required: true,
    },
    caption: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
ShareSchema.index({ postId: 1 });
ShareSchema.index({ userId: 1, createdAt: -1 });

export const ShareModel = model<IShare>("Share", ShareSchema);

// ==========================================
// SAVED POST MODEL
// ==========================================

export interface ISavedPost extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  collectionName: string;
  createdAt: Date;
}

const SavedPostSchema = new Schema<ISavedPost>(
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
    collectionName: {
      type: String,
      default: "default",
      maxlength: 100,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Prevent duplicate saves
SavedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });
SavedPostSchema.index({ userId: 1, collectionName: 1 });

export const SavedPostModel = model<ISavedPost>("SavedPost", SavedPostSchema);
