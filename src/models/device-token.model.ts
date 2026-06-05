// src/models/device-token.model.ts
import { Schema, model, Document, Types } from "mongoose";

export enum DevicePlatform {
  IOS = "ios",
  ANDROID = "android",
  WEB = "web",
}

export interface IDeviceToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** FCM registration token (raw, vì FCM yêu cầu lưu nguyên) */
  token: string;
  platform: DevicePlatform;
  /** Tên thiết bị/app version (debug). */
  deviceLabel?: string;
  appVersion?: string;
  isActive: boolean;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      enum: Object.values(DevicePlatform),
      required: true,
    },
    deviceLabel: { type: String, maxlength: 200 },
    appVersion: { type: String, maxlength: 50 },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

DeviceTokenSchema.index({ userId: 1, isActive: 1 });

export const DeviceTokenModel = model<IDeviceToken>(
  "DeviceToken",
  DeviceTokenSchema
);
