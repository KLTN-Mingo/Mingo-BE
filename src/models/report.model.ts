// src/models/report.model.ts
import { Schema, model, Document, Types } from "mongoose";
import type { ModerationResult } from "../services/moderation/moderation.service";

export enum ReportTargetType {
  POST = "post",
  COMMENT = "comment",
  USER = "user",
}

export enum ReportReason {
  SPAM = "spam",
  HARASSMENT = "harassment",
  HATE_SPEECH = "hate_speech",
  INAPPROPRIATE = "inappropriate",
  SCAM = "scam",
  COPYRIGHT = "copyright",
  VIOLENCE = "violence",
  MISINFORMATION = "misinformation",
  OTHER = "other",
}

export enum ReportStatus {
  PENDING = "pending",
  REVIEWING = "reviewing",
  RESOLVED = "resolved",
  DISMISSED = "dismissed",
  REVIEWED = "reviewed",
}

/**
 * Hành động xử lý vi phạm trên target (áp dụng khi resolve report).
 * - hide              : ẩn nội dung (post/comment/user)
 * - delete            : xóa nội dung (post/comment)
 * - warn_author       : cảnh cáo tác giả (user)
 * - ban_temp          : khóa tạm thời (user)
 * - ban_permanent     : khóa vĩnh viễn (user)
 * - dismiss           : không xử lý, đóng report
 * - auto_resolved     : tự động đóng do vi phạm đã được xác nhận ở report khác
 */
export enum ModerationAction {
  HIDE            = "hide",
  DELETE          = "delete",
  WARN_AUTHOR     = "warn_author",
  BAN_TEMP        = "ban_temp",
  BAN_PERMANENT   = "ban_permanent",
  DISMISS         = "dismiss",
  AUTO_RESOLVED   = "auto_resolved",
}

/** Preset thời gian khóa tài khoản tạm */
export type BanPreset = "1d" | "3d" | "7d" | "30d";

export interface IReport extends Document {
  _id: Types.ObjectId;
  reporterId: Types.ObjectId;
  targetType: ReportTargetType;
  targetId: Types.ObjectId;
  reason?: ReportReason;
  description: string;
  status: ReportStatus;
  resolutionNote?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  actionTaken?: ModerationAction | string; // enum ModerationAction hoặc giá trị tự do từ legacy
  warnAuthor?: boolean; // có cảnh cáo tác giả kèm theo action chính hay không
  banPreset?: BanPreset; // preset thời gian khóa tạm, chỉ dùng khi actionTaken = ban_temp
  moderationSnapshot?: ModerationResult; // AI/rule moderation result, set when report goes to "reviewing"
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: Object.values(ReportTargetType),
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: Object.values(ReportReason),
      maxlength: 120,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 2000,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
      index: true,
    },
    resolutionNote: {
      type: String,
      maxlength: 1000,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    actionTaken: {
      type: String,
      maxlength: 64,
      trim: true,
    },
    warnAuthor: {
      type: Boolean,
      default: false,
    },
    banPreset: {
      type: String,
      enum: ["1d", "3d", "7d", "30d"],
    },
    moderationSnapshot: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

ReportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 });
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ status: 1, reason: 1, createdAt: -1 });
ReportSchema.index({ reason: 1, createdAt: -1 });

export const ReportModel = model<IReport>("Report", ReportSchema);
