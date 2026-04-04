// src/controllers/report.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/async-handler";
import { sendCreated, sendSuccess } from "../utils/response";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} from "../errors";
import {
  ReportModel,
  ReportTargetType,
  ReportReason,
  ReportStatus,
} from "../models/report.model";
import { PostModel } from "../models/post.model";
import { CommentModel } from "../models/comment.model";
import { ModerationService } from "../services/moderation/moderation.service";

// ─── Helper ───────────────────────────────────────────────────────────────────

function getUserId(req: Request): string {
  const userId = (req as any).user?.userId as string | undefined;
  if (!userId) {
    throw new ForbiddenError("Cần đăng nhập");
  }
  return userId;
}

function isReportEntityType(v: string): v is "post" | "comment" {
  return v === "post" || v === "comment";
}

function isReportReason(v: string): v is ReportReason {
  return Object.values(ReportReason).includes(v as ReportReason);
}

function toTargetType(entityType: "post" | "comment"): ReportTargetType {
  return entityType === "post"
    ? ReportTargetType.POST
    : ReportTargetType.COMMENT;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @route   POST /api/reports
 * @body    { entityType, entityId, reason, description? }
 * @access  Private
 */
export const createReport = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const body = req.body as {
      entityType?: string;
      entityId?: string;
      reason?: string;
      description?: string;
    };

    const { entityType: rawType, entityId, reason: rawReason, description } =
      body;

    if (!rawType || !isReportEntityType(rawType)) {
      throw new ValidationError(
        "entityType phải là 'post' hoặc 'comment'",
        "INVALID_ENTITY_TYPE"
      );
    }

    if (!entityId || !Types.ObjectId.isValid(String(entityId))) {
      throw new ValidationError("entityId không hợp lệ", "INVALID_ENTITY_ID");
    }

    if (!rawReason || !isReportReason(rawReason)) {
      throw new ValidationError(
        `reason không hợp lệ. Cho phép: ${Object.values(ReportReason).join(", ")}`,
        "INVALID_REPORT_REASON"
      );
    }

    const reason = rawReason;
    const targetType = toTargetType(rawType);
    const oid = new Types.ObjectId(String(entityId));

    let ownerUserId: string;
    let contentText = "";

    if (rawType === "post") {
      const post = await PostModel.findById(oid)
        .select("userId contentText")
        .lean();
      if (!post) {
        throw new NotFoundError("Không tìm thấy bài viết");
      }
      ownerUserId = post.userId.toString();
      contentText = post.contentText ?? "";
    } else {
      const comment = await CommentModel.findById(oid)
        .select("userId contentText")
        .lean();
      if (!comment) {
        throw new NotFoundError("Không tìm thấy bình luận");
      }
      ownerUserId = comment.userId.toString();
      contentText = comment.contentText ?? "";
    }

    if (ownerUserId === userId) {
      throw new ValidationError(
        "Không thể báo cáo nội dung của chính bạn",
        "SELF_REPORT"
      );
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicate = await ReportModel.findOne({
      reporterId: userId,
      targetType,
      targetId: oid,
      createdAt: { $gte: since24h },
    }).lean();

    if (duplicate) {
      throw new ValidationError("Bạn đã báo cáo nội dung này rồi");
    }

    const report = await ReportModel.create({
      reporterId: userId,
      targetType,
      targetId: oid,
      reason,
      description: description ? String(description).slice(0, 2000) : "",
      status: ReportStatus.PENDING,
    });

    const reportCount = await ReportModel.countDocuments({
      targetType,
      targetId: oid,
    });

    if (contentText.trim()) {
      void ModerationService.moderateAndUpdate(
        rawType,
        oid.toString(),
        contentText,
        { reportCount }
      ).catch((err) =>
        console.error("[Moderation] Report-trigger error:", err)
      );
    }

    sendCreated(
      res,
      { id: report._id.toString(), status: report.status },
      "Báo cáo đã được ghi nhận"
    );
  }
);

/**
 * @route   GET /api/reports/my
 * @query   page (default 1), limit (default 10)
 * @access  Private
 */
export const getMyReports = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(q.limit ?? "10", 10) || 10)
  );
  const skip = (page - 1) * limit;

  const filter = { reporterId: userId };

  const [rows, total] = await Promise.all([
    ReportModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ReportModel.countDocuments(filter),
  ]);

  const items = rows.map((r) => ({
    id: r._id.toString(),
    targetType: r.targetType,
    targetId: r.targetId.toString(),
    reason: r.reason,
    description: r.description,
    status: r.status,
    createdAt: r.createdAt,
  }));

  const totalPages = Math.ceil(total / limit);

  sendSuccess(res, {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  });
});
