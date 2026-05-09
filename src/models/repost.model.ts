import { Document, Schema, Types, model } from "mongoose";

export interface IRepost extends Document {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  postId: Types.ObjectId;
  comment?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RepostSchema = new Schema<IRepost>(
  {
    authorId: {
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
    comment: {
      type: String,
      maxlength: 2000,
      default: "",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

RepostSchema.index({ authorId: 1, postId: 1, isDeleted: 1 }, { unique: true });
RepostSchema.index({ postId: 1, createdAt: -1 });

export const RepostModel = model<IRepost>("Repost", RepostSchema);
