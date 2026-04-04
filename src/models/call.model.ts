// src/models/call.model.ts
import { Schema, model, Document, Types, models } from "mongoose";

export interface ICall extends Document {
  _id: Types.ObjectId;
  callerId: Types.ObjectId;
  receiverId: Types.ObjectId;
  callType: "video" | "voice";
  startTime: Date;
  endTime?: Date;
  status: "completed" | "missed" | "rejected" | "ongoing";
  duration: number;
  createBy: Types.ObjectId;
  createAt: Date;
}

const CallSchema = new Schema<ICall>(
  {
    callerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    callType: { type: String, enum: ["video", "voice"], required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    status: {
      type: String,
      enum: ["completed", "missed", "rejected", "ongoing"],
      default: "ongoing",
    },
    duration: { type: Number, default: 0 },
    createBy: { type: Schema.Types.ObjectId, ref: "User" },
    createAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const CallModel = models.Call || model<ICall>("Call", CallSchema);
