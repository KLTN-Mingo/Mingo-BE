// src/models/message-file.model.ts
import { Schema, model, Document, Types, models } from "mongoose";

export interface IMessageFile extends Document {
  _id: Types.ObjectId;
  fileName: string;
  url: string;
  publicId: string;
  bytes: string;
  width: string;
  height: string;
  format: string;
  type: "Image" | "Video" | "Audio" | "Other";
   duration?: number;
  createBy: Types.ObjectId;
  createAt: Date;
}

const MessageFileSchema = new Schema<IMessageFile>({
  fileName: { type: String, required: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  bytes: { type: String, required: true },
  width: { type: String, default: "0" },
  height: { type: String, default: "0" },
  format: { type: String, default: "unknown" },
  type: {
    type: String,
    enum: ["Image", "Video", "Audio", "Other"],
    required: true,
  },
  duration: { type: Number, default: 0 },
  createBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createAt: { type: Date, default: Date.now },
});

// Register as "File" to match the legacy ref used in Message.contentId
export const MessageFileModel =
  models.File || model<IMessageFile>("File", MessageFileSchema);
