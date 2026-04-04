// src/models/saved-post.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface ISavedPost extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  collectionName?: string;
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
      maxlength: 100,
      default: "default",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SavedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });
SavedPostSchema.index({ userId: 1, createdAt: -1 });

export const SavedPostModel = model<ISavedPost>("SavedPost", SavedPostSchema);
