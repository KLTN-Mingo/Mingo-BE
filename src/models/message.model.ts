// src/models/message.model.ts
import { Schema, model, Document, Types, models } from "mongoose";

export interface IMessage extends Document {
  _id: Types.ObjectId;
  boxId: Types.ObjectId;
  status: boolean;
  readedId: Types.ObjectId[];
  contentId: Types.ObjectId[];
  text: string[];
  flag: boolean;
  isReact: boolean;
  visibility: Map<string, boolean>;
  createBy: Types.ObjectId;
  createAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  boxId: { type: Schema.Types.ObjectId, ref: "MessageBox" },
  status: { type: Boolean, default: true },
  readedId: [{ type: Schema.Types.ObjectId, ref: "User" }],
  contentId: [{ type: Schema.Types.ObjectId, ref: "File" }],
  text: [{ type: String }],
  flag: { type: Boolean, required: true, default: true },
  isReact: { type: Boolean, default: false },
  visibility: {
    type: Map,
    of: Boolean,
    default: () => new Map(),
  },
  createBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const MessageModel =
  models.Message || model<IMessage>("Message", MessageSchema);
