// src/models/follow.model.ts
import { Schema, model, Document, Types } from "mongoose";

// Trạng thái follow request
export enum FollowStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

// Trạng thái close friend request
export enum CloseFriendStatus {
  NONE = "none", // Chưa có request
  PENDING = "pending", // Đang chờ xác nhận
  ACCEPTED = "accepted", // Đã là bạn thân
  REJECTED = "rejected", // Bị từ chối
}

export interface IFollow extends Document {
  _id: Types.ObjectId;
  followerId: Types.ObjectId; // Người gửi follow
  followingId: Types.ObjectId; // Người được follow
  followStatus: FollowStatus; // Trạng thái follow
  closeFriendStatus: CloseFriendStatus; // Trạng thái bạn thân
  closeFriendRequestedBy?: Types.ObjectId; // Ai gửi request bạn thân
  closeFriendRequestedAt?: Date; // Thời điểm request bạn thân
  createdAt: Date;
  updatedAt: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    followerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    followingId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    followStatus: {
      type: String,
      enum: Object.values(FollowStatus),
      default: FollowStatus.PENDING,
      index: true,
    },
    closeFriendStatus: {
      type: String,
      enum: Object.values(CloseFriendStatus),
      default: CloseFriendStatus.NONE,
      index: true,
    },
    closeFriendRequestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    closeFriendRequestedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate follows
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Indexes for queries
FollowSchema.index({ followerId: 1, followStatus: 1, createdAt: -1 });
FollowSchema.index({ followingId: 1, followStatus: 1, createdAt: -1 });
FollowSchema.index({ followerId: 1, closeFriendStatus: 1 });
FollowSchema.index({ followingId: 1, closeFriendStatus: 1 });

export const FollowModel = model<IFollow>("Follow", FollowSchema);
