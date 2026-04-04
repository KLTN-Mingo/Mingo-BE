// src/services/report.service.ts

import { Types } from "mongoose";
import { PostModel } from "../models/post.model";
import {
  ReportModel,
  ReportTargetType,
  type ReportReason,
  type ReportStatus,
} from "../models/report.model";
import { UserModel } from "../models/user.model";
import { NotFoundError } from "../errors";

export interface ReportRelatedRowDto {
  id: string;
  reason?: ReportReason;
  status: ReportStatus;
  createdAt: Date;
  targetId: string;
  reporter: { name?: string; email?: string };
}

export interface PaginatedReportRelatedDto {
  items: ReportRelatedRowDto[];
  pagination: { page: number; limit: number; total: number };
}

function reporterFromPopulate(reporterId: unknown): {
  name?: string;
  email?: string;
} {
  if (
    !reporterId ||
    typeof reporterId !== "object" ||
    reporterId instanceof Types.ObjectId
  ) {
    return {};
  }
  const o = reporterId as { name?: unknown; email?: unknown };
  return {
    name: typeof o.name === "string" ? o.name : undefined,
    email: typeof o.email === "string" ? o.email : undefined,
  };
}

type ReportLean = {
  _id: Types.ObjectId;
  reason?: ReportReason;
  status: ReportStatus;
  createdAt: Date;
  targetId: Types.ObjectId;
  reporterId: unknown;
};

export const ReportService = {
  async getReportsByUser(
    userId: string,
    page: number,
    limit: number
  ): Promise<PaginatedReportRelatedDto> {
    const oid = new Types.ObjectId(userId);

    const userExists = await UserModel.exists({ _id: oid });
    if (!userExists) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${userId}`);
    }

    const postIdRows = await PostModel.find({ userId: oid }).select("_id").lean();
    const postIds = postIdRows.map((p) => p._id);

    if (postIds.length === 0) {
      return {
        items: [],
        pagination: { page, limit, total: 0 },
      };
    }

    const filter = {
      targetType: ReportTargetType.POST,
      targetId: { $in: postIds },
    };

    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      ReportModel.countDocuments(filter),
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reporterId", "name email")
        .lean(),
    ]);

    const items: ReportRelatedRowDto[] = (rows as ReportLean[]).map((r) => ({
      id: r._id.toString(),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      targetId: r.targetId.toString(),
      reporter: reporterFromPopulate(r.reporterId),
    }));

    return {
      items,
      pagination: { page, limit, total },
    };
  },
};
