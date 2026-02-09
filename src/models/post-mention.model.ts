// src/models/post-mention.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IPostMention extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  mentionedUserId: Types.ObjectId;
  createdAt: Date;
}

const PostMentionSchema = new Schema<IPostMention>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    mentionedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
PostMentionSchema.index({ postId: 1 });
PostMentionSchema.index({ mentionedUserId: 1, createdAt: -1 });

// Prevent duplicate mentions
PostMentionSchema.index({ postId: 1, mentionedUserId: 1 }, { unique: true });

export const PostMentionModel = model<IPostMention>(
  "PostMention",
  PostMentionSchema
);
