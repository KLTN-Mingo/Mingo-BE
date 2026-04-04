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
  /** Hành động admin sau khi xử lý báo cáo */
  actionTaken?: string;
  /** Snapshot kết quả moderation (rule + AI) tại thời điểm báo cáo */
  moderationSnapshot?: ModerationResult;
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
