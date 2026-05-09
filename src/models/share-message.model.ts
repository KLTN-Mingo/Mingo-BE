import { Document, Schema, Types, model } from "mongoose";

export interface IShareMessage extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShareMessageSchema = new Schema<IShareMessage>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: {
      type: String,
      maxlength: 2000,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

ShareMessageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
ShareMessageSchema.index({ recipientId: 1, createdAt: -1 });

export const ShareMessageModel = model<IShareMessage>(
  "ShareMessage",
  ShareMessageSchema
);
