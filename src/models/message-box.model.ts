// src/models/message-box.model.ts
import { Schema, model, Document, Types, models } from "mongoose";

export interface IMessageBox extends Document {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverIds: Types.ObjectId[];
  messageIds: Types.ObjectId[];
  groupName: string;
  groupAva: string;
  groupAvaPublicId?: string;
  flag: boolean;
  pin: boolean;
  status: boolean;
  createBy: Types.ObjectId;
  createAt: Date;
  updatedAt: Date;
}

const MessageBoxSchema = new Schema<IMessageBox>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    receiverIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    messageIds: [{ type: Schema.Types.ObjectId, ref: "Message" }],
    groupName: { type: String, default: "" },
    groupAva: { type: String, default: "" },
    groupAvaPublicId: { type: String },
    flag: { type: Boolean, default: true },
    pin: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
    createBy: { type: Schema.Types.ObjectId, ref: "User" },
    createAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const MessageBoxModel =
  models.MessageBox || model<IMessageBox>("MessageBox", MessageBoxSchema);
