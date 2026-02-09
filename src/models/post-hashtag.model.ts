// src/models/post-hashtag.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IPostHashtag extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  hashtag: string;
  createdAt: Date;
}

const PostHashtagSchema = new Schema<IPostHashtag>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    hashtag: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 100,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
PostHashtagSchema.index({ postId: 1 });
PostHashtagSchema.index({ hashtag: 1 });
PostHashtagSchema.index({ hashtag: 1, createdAt: -1 });

// Compound index for preventing duplicates
PostHashtagSchema.index({ postId: 1, hashtag: 1 }, { unique: true });

export const PostHashtagModel = model<IPostHashtag>(
  "PostHashtag",
  PostHashtagSchema
);
