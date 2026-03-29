// src/controllers/admin.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose";
import { startOfDay } from "date-fns";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "../errors";
import {
  ReportModel,
  ReportTargetType,
  ReportStatus,
} from "../models/report.model";
import { PostModel, ModerationStatus } from "../models/post.model";
import { CommentModel, CommentModerationStatus } from "../models/comment.model";
import { UserModel } from "../models/user.model";

const REPORT_ACTIONS = [
  "approved_content",
  "removed_content",
  "warned_user",
  "blocked_user",
] as const;

type ReportAdminAction = (typeof REPORT_ACTIONS)[number];

function isReportAdminAction(v: string): v is ReportAdminAction {
  return (REPORT_ACTIONS as readonly string[]).includes(v);
}

function parseAdminReportStatus(
  raw: string | undefined
): ReportStatus | undefined {
  if (!raw) return undefined;
  if (raw === "pending") return ReportStatus.PENDING;
  if (raw === "reviewed") return ReportStatus.REVIEWED;
  if (raw === "dismissed") return ReportStatus.DISMISSED;
  return undefined;
}

function parseEntityTypeFilter(
  raw: string | undefined
): ReportTargetType | undefined {
  if (!raw) return undefined;
  if (raw === "post") return ReportTargetType.POST;
  if (raw === "comment") return ReportTargetType.COMMENT;
  return undefined;
}

function mapReporter(
  reporter: {
    _id: unknown;
    name?: string;
    phoneNumber?: string;
    avatar?: string;
  } | null
): { _id: string; username: string; avatarUrl: string } | null {
  if (!reporter || !reporter._id) return null;
  return {
    _id: String(reporter._id),
    username: reporter.name ?? reporter.phoneNumber ?? "",
    avatarUrl: reporter.avatar ?? "",
  };
}

async function loadEntitiesForReports(
  reports: Array<{ targetType: ReportTargetType; targetId: { toString(): string } }>
): Promise<
  Map<
    string,
    {
      contentText?: string;
      aiToxicScore?: number;
      aiHateSpeechScore?: number;
      aiSpamScore?: number;
      aiOverallRisk?: number;
    }
  >
> {
  const postIds = reports
    .filter((r) => r.targetType === ReportTargetType.POST)
    .map((r) => r.targetId.toString());
  const commentIds = reports
    .filter((r) => r.targetType === ReportTargetType.COMMENT)
    .map((r) => r.targetId.toString());

  const map = new Map<
    string,
    {
      contentText?: string;
      aiToxicScore?: number;
      aiHateSpeechScore?: number;
      aiSpamScore?: number;
      aiOverallRisk?: number;
    }
  >();

  if (postIds.length) {
    const posts = await PostModel.find({ _id: { $in: postIds } })
      .select(
        "contentText aiToxicScore aiHateSpeechScore aiSpamScore aiOverallRisk"
      )
      .lean();
    for (const p of posts) {
      map.set(p._id.toString(), {
        contentText: p.contentText,
        aiToxicScore: p.aiToxicScore,
        aiHateSpeechScore: p.aiHateSpeechScore,
        aiSpamScore: p.aiSpamScore,
        aiOverallRisk: p.aiOverallRisk,
      });
    }
  }

  if (commentIds.length) {
    const comments = await CommentModel.find({ _id: { $in: commentIds } })
      .select("contentText")
      .lean();
    for (const c of comments) {
      map.set(c._id.toString(), { contentText: c.contentText });
    }
  }

  return map;
}

async function applyReportSideEffect(
  report: {
    targetType: ReportTargetType;
    targetId: Types.ObjectId;
  },
  action: ReportAdminAction
): Promise<void> {
  if (report.targetType === ReportTargetType.USER) {
    if (action === "blocked_user") {
      await UserModel.findByIdAndUpdate(report.targetId, { isBlocked: true });
    }
    return;
  }

  if (action === "warned_user") {
    return;
  }

  if (action === "blocked_user") {
    if (report.targetType === ReportTargetType.POST) {
      const p = await PostModel.findById(report.targetId).select("userId").lean();
      if (p?.userId) {
        await UserModel.findByIdAndUpdate(p.userId, { isBlocked: true });
      }
    } else {
      const c = await CommentModel.findById(report.targetId)
        .select("userId")
        .lean();
      if (c?.userId) {
        await UserModel.findByIdAndUpdate(c.userId, { isBlocked: true });
      }
    }
    return;
  }

  if (report.targetType === ReportTargetType.POST) {
    if (action === "removed_content") {
      await PostModel.findByIdAndUpdate(report.targetId, {
        isHidden: true,
        moderationStatus: ModerationStatus.REJECTED,
      });
    } else if (action === "approved_content") {
      await PostModel.findByIdAndUpdate(report.targetId, {
        isHidden: false,
        moderationStatus: ModerationStatus.APPROVED,
      });
    }
    return;
  }

  if (report.targetType === ReportTargetType.COMMENT) {
    if (action === "removed_content") {
      await CommentModel.findByIdAndUpdate(report.targetId, {
        isHidden: true,
        moderationStatus: CommentModerationStatus.REJECTED,
      });
    } else if (action === "approved_content") {
      await CommentModel.findByIdAndUpdate(report.targetId, {
        isHidden: false,
        moderationStatus: CommentModerationStatus.APPROVED,
      });
    }
  }
}

/**
 * @route   GET /api/admin/reports
 */
export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(q.limit ?? "20", 10) || 20)
  );
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  const st = parseAdminReportStatus(q.status);
  if (st) {
    filter.status = st;
  }
  const et = parseEntityTypeFilter(q.entityType);
  if (et) {
    filter.targetType = et;
  }

  const [rows, total] = await Promise.all([
    ReportModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "reporterId",
        select: "_id name phoneNumber avatar",
      })
      .lean(),
    ReportModel.countDocuments(filter),
  ]);

  const entityMap = await loadEntitiesForReports(
    rows as Array<{ targetType: ReportTargetType; targetId: { toString(): string } }>
  );

  const reports = rows.map((r) => {
    const rep = r.reporterId as unknown as Parameters<typeof mapReporter>[0];
    const key = r.targetId.toString();
    const entity = entityMap.get(key);
    return {
      id: r._id.toString(),
      reporterId: mapReporter(rep),
      targetType: r.targetType,
      targetId: key,
      reason: r.reason,
      description: r.description,
      status: r.status,
      resolutionNote: r.resolutionNote,
      reviewedBy: r.reviewedBy?.toString(),
      reviewedAt: r.reviewedAt,
      actionTaken: r.actionTaken,
      moderationSnapshot: r.moderationSnapshot,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      entity: entity
        ? {
            contentText: entity.contentText,
            aiScores:
              entity.aiToxicScore !== undefined ||
              entity.aiHateSpeechScore !== undefined ||
              entity.aiSpamScore !== undefined ||
              entity.aiOverallRisk !== undefined
                ? {
                    toxic: entity.aiToxicScore,
                    hateSpeech: entity.aiHateSpeechScore,
                    spam: entity.aiSpamScore,
                    overallRisk: entity.aiOverallRisk,
                  }
                : undefined,
          }
        : null,
    };
  });

  const totalPages = Math.ceil(total / limit) || 1;

  sendSuccess(res, {
    reports,
    total,
    page,
    totalPages,
  });
});

/**
 * @route   PATCH /api/admin/reports/:reportId
 */
export const handleReport = asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).user?.userId as string | undefined;
  if (!adminId) {
    throw new ForbiddenError("Cần đăng nhập");
  }

  const reportId = String(req.params.reportId);
  const body = req.body as { action?: string };

  if (!body.action || !isReportAdminAction(body.action)) {
    throw new ValidationError(
      `action không hợp lệ. Cho phép: ${REPORT_ACTIONS.join(", ")}`,
      "INVALID_REPORT_ACTION"
    );
  }

  const report = await ReportModel.findById(reportId).lean();
  if (!report) {
    throw new NotFoundError("Không tìm thấy báo cáo");
  }

  await applyReportSideEffect(
    {
      targetType: report.targetType as ReportTargetType,
      targetId: report.targetId,
    },
    body.action
  );

  const updated = await ReportModel.findByIdAndUpdate(
    reportId,
    {
      status: ReportStatus.REVIEWED,
      reviewedBy: new Types.ObjectId(adminId),
      reviewedAt: new Date(),
      actionTaken: body.action,
    },
    { new: true }
  )
    .populate({
      path: "reporterId",
      select: "_id name phoneNumber avatar",
    })
    .lean();

  if (!updated) {
    throw new NotFoundError("Không tìm thấy báo cáo");
  }

  sendSuccess(res, updated);
});

/**
 * @route   GET /api/admin/stats
 */
export const getDashboardStats = asyncHandler(
  async (_req: Request, res: Response) => {
    const startOfToday = startOfDay(new Date());

    const [
      totalUsers,
      newUsersToday,
      pendingReports,
      flaggedPosts,
      rejectedToday,
      violationAgg,
    ] = await Promise.all([
      UserModel.countDocuments({ isActive: true }),
      UserModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      ReportModel.countDocuments({ status: ReportStatus.PENDING }),
      PostModel.countDocuments({
        moderationStatus: ModerationStatus.PENDING,
        isHidden: true,
      }),
      PostModel.countDocuments({
        moderationStatus: ModerationStatus.REJECTED,
        updatedAt: { $gte: startOfToday },
      }),
      ReportModel.aggregate<{ _id: string | null; count: number }>([
        { $group: { _id: "$reason", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const violationBreakdown = violationAgg.map((row) => ({
      reason: row._id ?? "unknown",
      count: row.count,
    }));

    sendSuccess(res, {
      totalUsers,
      newUsersToday,
      pendingReports,
      flaggedPosts,
      rejectedToday,
      violationBreakdown,
    });
  }
);
