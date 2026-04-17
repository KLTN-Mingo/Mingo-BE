// src/controllers/admin.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose";
import { startOfDay, subDays } from "date-fns";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import { ValidationError, NotFoundError, ForbiddenError } from "../errors";
import {
  ReportModel,
  ReportTargetType,
  ReportStatus,
  ReportReason,
} from "../models/report.model";
import { PostModel, ModerationStatus } from "../models/post.model";
import { CommentModel, CommentModerationStatus } from "../models/comment.model";
import { UserModel } from "../models/user.model";
import { PostMediaModel } from "../models/post-media.model";
import {
  LogModel,
  LogAction,
  LogActorRole,
  LogSeverity,
  LogTargetType,
} from "../models/log.model";
import { LogService } from "../services/log.service";
import { validateObjectId } from "../utils/validators";
import type { ModerationResult } from "../services/moderation/moderation.service";

const AI_CALL_COST_USD = 0.0006;
const VIOLATION_SCORE_THRESHOLD = 0.35;
const URGENT_AI_THRESHOLD = 0.7;
const FALSE_POSITIVE_AI_THRESHOLD = 0.5;

const URGENT_REASONS: ReadonlySet<ReportReason> = new Set([
  ReportReason.HATE_SPEECH,
  ReportReason.VIOLENCE,
  ReportReason.HARASSMENT,
  ReportReason.SCAM,
]);

export type ModerationBadge = "Toxic" | "Hate" | "Spam";

const RESOLVE_ACTIONS = ["hide", "dismiss"] as const;
type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

function isResolveAction(v: string): v is ResolveAction {
  return (RESOLVE_ACTIONS as readonly string[]).includes(v);
}

function getAdminUserId(req: Request): string {
  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;
  if (!userId) {
    throw new ForbiddenError("Cần đăng nhập");
  }
  return userId;
}

function getAdminActorId(req: Request): string {
  const authUser = (req as Request & {
    user?: { _id?: string | Types.ObjectId; userId?: string };
  }).user;
  const actorId = authUser?._id ?? authUser?.userId;
  if (!actorId) {
    throw new ForbiddenError("Cần đăng nhập");
  }
  return String(actorId);
}

function getRequestLogContext(req: Request): {
  ipAddress?: string;
  userAgent?: string;
  note?: string;
} {
  const reqBody = req.body as { reason?: unknown; note?: unknown } | undefined;
  const noteFromBody =
    typeof reqBody?.reason === "string"
      ? reqBody.reason
      : typeof reqBody?.note === "string"
      ? reqBody.note
      : undefined;
  const userAgent = req.headers["user-agent"];
  return {
    ipAddress: req.ip,
    userAgent: typeof userAgent === "string" ? userAgent : undefined,
    note: noteFromBody?.slice(0, 1000),
  };
}

function fireAndForgetAdminLog(
  req: Request,
  action: LogAction,
  opts: {
    severity?: LogSeverity;
    targetType?: LogTargetType;
    targetId?: Types.ObjectId | string;
    affectedUserId?: Types.ObjectId | string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    note?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  try {
    const adminId = getAdminActorId(req);
    const requestContext = getRequestLogContext(req);
    void LogService.adminAction(adminId, action, {
      ...opts,
      severity: opts.severity ?? LogSeverity.WARNING,
      metadata: {
        actorRole: LogActorRole.ADMIN,
        ...(opts.metadata ?? {}),
      },
      note: opts.note ?? requestContext.note,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
    }).catch(() => undefined);
  } catch {
    // Bỏ qua lỗi lấy context admin để không ảnh hưởng luồng chính
  }
}

function parsePagination(
  req: Request,
  opts: { defaultLimit: number; maxLimit: number }
): { page: number; limit: number; skip: number } {
  const q = req.query as Record<string, string | undefined>;
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(
    opts.maxLimit,
    Math.max(
      1,
      parseInt(q.limit ?? String(opts.defaultLimit), 10) || opts.defaultLimit
    )
  );
  if (!Number.isFinite(page) || !Number.isFinite(limit)) {
    throw new ValidationError(
      "page hoặc limit không hợp lệ",
      "INVALID_PAGINATION"
    );
  }
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseQueryBoolean(
  raw: string | undefined,
  fieldName: string
): boolean | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ValidationError(
    `${fieldName} phải là true hoặc false`,
    "INVALID_QUERY"
  );
}

const ADMIN_USER_PROJECTION = "-passwordHash -twoFactorSecret" as const;

function maxAiFromSnapshot(snap: ModerationResult | null | undefined): number {
  if (!snap?.scores) return 0;
  const { toxic, hateSpeech, spam } = snap.scores;
  return Math.max(toxic ?? 0, hateSpeech ?? 0, spam ?? 0);
}

function scoresFromSnapshot(snap: ModerationResult | null | undefined): {
  toxic: number;
  hate: number;
  spam: number;
} {
  if (!snap?.scores) return { toxic: 0, hate: 0, spam: 0 };
  return {
    toxic: snap.scores.toxic ?? 0,
    hate: snap.scores.hateSpeech ?? 0,
    spam: snap.scores.spam ?? 0,
  };
}

function badgeFromAiScores(
  toxic: number,
  hate: number,
  spam: number
): ModerationBadge {
  if (toxic === 0 && hate === 0 && spam === 0) return "Spam";
  if (toxic >= hate && toxic >= spam) return "Toxic";
  if (hate >= spam) return "Hate";
  return "Spam";
}

const REPORT_STATUSES = ["pending", "reviewing", "resolved", "dismissed"] as const;
const REPORT_TARGET_TYPES = ["post", "comment", "user"] as const;
const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate_speech",
  "inappropriate",
  "scam",
  "copyright",
  "violence",
  "misinformation",
  "other",
] as const;
const REPORT_ACTIONS = ["review", "resolve", "dismiss"] as const;

type AdminReportStatus = (typeof REPORT_STATUSES)[number];
type AdminReportTargetType = (typeof REPORT_TARGET_TYPES)[number];
type AdminReportReason = (typeof REPORT_REASONS)[number];
type AdminReportAction = (typeof REPORT_ACTIONS)[number];

const isReportStatus = (v?: string): v is AdminReportStatus =>
  REPORT_STATUSES.includes(v as AdminReportStatus);
const isReportTargetType = (v?: string): v is AdminReportTargetType =>
  REPORT_TARGET_TYPES.includes(v as AdminReportTargetType);
const isReportReason = (v?: string): v is AdminReportReason =>
  REPORT_REASONS.includes(v as AdminReportReason);
const isReportAction = (v?: string): v is AdminReportAction =>
  REPORT_ACTIONS.includes(v as AdminReportAction);

async function resolveTargetPreview(
  targetType: AdminReportTargetType,
  targetId: Types.ObjectId
): Promise<{
  targetPreview?: string;
  targetUserName?: string;
  targetUserAvatar?: string;
}> {
  try {
    if (targetType === "post") {
      const doc = await PostModel.findById(targetId)
        .select("contentText userId")
        .populate<{ userId: { name?: string; avatar?: string } }>(
          "userId",
          "name avatar"
        )
        .lean();
      if (!doc) return {};
      return {
        targetPreview: (doc.contentText as string | undefined)?.slice(0, 120),
        targetUserName: doc.userId?.name,
        targetUserAvatar: doc.userId?.avatar,
      };
    }

    if (targetType === "comment") {
      const doc = await CommentModel.findById(targetId)
        .select("contentText userId")
        .populate<{ userId: { name?: string; avatar?: string } }>(
          "userId",
          "name avatar"
        )
        .lean();
      if (!doc) return {};
      return {
        targetPreview: (doc.contentText as string | undefined)?.slice(0, 120),
        targetUserName: doc.userId?.name,
        targetUserAvatar: doc.userId?.avatar,
      };
    }

    const doc = await UserModel.findById(targetId).select("name avatar bio").lean();
    if (!doc) return {};
    return {
      targetPreview: (doc.bio as string | undefined)?.slice(0, 120),
      targetUserName: doc.name as string | undefined,
      targetUserAvatar: doc.avatar as string | undefined,
    };
  } catch {
    return {};
  }
}

async function buildAdminReportPayload(
  report: {
    _id: Types.ObjectId;
    reporterId?:
      | Types.ObjectId
      | { _id: Types.ObjectId; name?: string; avatar?: string }
      | null;
    targetType: ReportTargetType | string;
    targetId: Types.ObjectId;
    reason?: ReportReason | string;
    description?: string;
    status: ReportStatus | string;
    resolutionNote?: string;
    reviewedBy?:
      | Types.ObjectId
      | { _id: Types.ObjectId; name?: string }
      | null;
    reviewedAt?: Date;
    actionTaken?: string;
    createdAt: Date;
    updatedAt: Date;
    priorityScore?: number;
  }
) {
  const isReporterPopulated = (
    value: typeof report.reporterId
  ): value is { _id: Types.ObjectId; name?: string; avatar?: string } =>
    Boolean(value && typeof value === "object" && "_id" in value && "name" in value);
  const isReviewerPopulated = (
    value: typeof report.reviewedBy
  ): value is { _id: Types.ObjectId; name?: string } =>
    Boolean(value && typeof value === "object" && "_id" in value && "name" in value);

  const reporter = isReporterPopulated(report.reporterId) ? report.reporterId : null;
  const reviewer = isReviewerPopulated(report.reviewedBy) ? report.reviewedBy : null;

  const preview = await resolveTargetPreview(
    report.targetType as AdminReportTargetType,
    report.targetId
  );

  return {
    _id: report._id.toString(),
    reporterId: reporter?._id?.toString() ?? String(report.reporterId ?? ""),
    reporterName: reporter?.name ?? "",
    reporterAvatar: reporter?.avatar ?? "",
    targetType: report.targetType,
    targetId: report.targetId.toString(),
    reason: report.reason,
    description: report.description ?? "",
    status:
      report.status === ReportStatus.REVIEWED ? "resolved" : report.status,
    resolutionNote: report.resolutionNote,
    reviewedBy:
      reviewer?._id?.toString() ??
      (report.reviewedBy instanceof Types.ObjectId
        ? report.reviewedBy.toString()
        : undefined),
    reviewedByName: reviewer?.name,
    reviewedAt: report.reviewedAt,
    actionTaken: report.actionTaken,
    priorityScore: report.priorityScore ?? 0,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    ...preview,
  };
}

function mapReportActionToLogAction(action: AdminReportAction): LogAction {
  if (action === "review") return LogAction.ADMIN_REPORT_START_REVIEW;
  if (action === "dismiss") return LogAction.ADMIN_REPORT_DISMISS;
  return LogAction.ADMIN_REPORT_RESOLVE;
}

/**
 * @route   GET /api/admin/reports
 */
export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req, {
    defaultLimit: 10,
    maxLimit: 50,
  });
  const q = req.query as Record<string, string | undefined>;

  const filter: Record<string, unknown> = {};
  if (isReportStatus(q.status)) filter.status = q.status;
  if (isReportTargetType(q.targetType)) filter.targetType = q.targetType;
  if (isReportReason(q.reason)) filter.reason = q.reason;

  const keyword = q.keyword?.trim();
  if (keyword) {
    const safe = escapeRegex(keyword);
    filter.$or = [
      { description: { $regex: safe, $options: "i" } },
      { actionTaken: { $regex: safe, $options: "i" } },
    ];
  }

  const [rows, total] = await Promise.all([
    ReportModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: "reporterId", select: "_id name avatar" })
      .populate({ path: "reviewedBy", select: "_id name" })
      .lean(),
    ReportModel.countDocuments(filter),
  ]);

  const reports = (
    await Promise.all(rows.map((row) => buildAdminReportPayload(row as never)))
  ).filter((report) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return (
      report.reporterName.toLowerCase().includes(kw) ||
      report.targetPreview?.toLowerCase().includes(kw) ||
      report.description.toLowerCase().includes(kw)
    );
  });

  sendSuccess(res, {
    reports,
    total: keyword ? reports.length : total,
    page,
    totalPages: Math.ceil((keyword ? reports.length : total) / limit) || 1,
  });
});

export const getAdminReportById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Report ID");

    const report = await ReportModel.findById(id)
      .populate({ path: "reporterId", select: "_id name avatar" })
      .populate({ path: "reviewedBy", select: "_id name" })
      .lean();
    if (!report) {
      throw new NotFoundError(`Không tìm thấy báo cáo với ID: ${id}`);
    }

    const [detail, relatedRows, logs] = await Promise.all([
      buildAdminReportPayload(report as never),
      ReportModel.find({
        targetType: report.targetType,
        targetId: report.targetId,
        _id: { $ne: report._id },
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate({ path: "reporterId", select: "_id name avatar" })
        .populate({ path: "reviewedBy", select: "_id name" })
        .lean(),
      LogModel.find({
        targetType: LogTargetType.REPORT,
        targetId: report._id,
      })
        .sort({ createdAt: 1 })
        .populate({ path: "actorId", select: "_id name avatar" })
        .select("action actorId actorRole note createdAt")
        .lean(),
    ]);

    const activity = [
      {
        _id: `${id}_created`,
        action: "Báo cáo được tạo",
        adminName: "System",
        note: undefined,
        createdAt: report.createdAt,
      },
      ...logs.map((log) => {
        const actor = log.actorId as { name?: string } | null | undefined;
        const actionMap: Partial<Record<LogAction, string>> = {
          [LogAction.ADMIN_REPORT_START_REVIEW]:
            "Admin chuyển trạng thái sang đang xem xét",
          [LogAction.ADMIN_REPORT_RESOLVE]: "Admin xử lý và đóng báo cáo",
          [LogAction.ADMIN_REPORT_DISMISS]: "Báo cáo bị bỏ qua do không vi phạm",
        };
        return {
          _id: log._id.toString(),
          action: actionMap[log.action as LogAction] ?? log.action,
          adminName:
            log.actorRole === LogActorRole.SYSTEM
              ? "System"
              : actor?.name ?? "Admin",
          note: log.note,
          createdAt: log.createdAt,
        };
      }),
    ];

    const relatedReports = await Promise.all(
      relatedRows.map((row) => buildAdminReportPayload(row as never))
    );

    sendSuccess(res, {
      ...detail,
      activity,
      relatedReports,
    });
  }
);

/**
 * @route   PATCH /api/admin/reports/:reportId
 */
export const handleReport = asyncHandler(
  async (req: Request, res: Response) => {
    const { reportId } = req.params as { reportId: string };
    validateObjectId(reportId, "Report ID");

    const body = req.body as {
      action?: string;
      note?: string;
      actionTaken?: string;
    };
    if (!isReportAction(body.action)) {
      throw new ValidationError(
        `action không hợp lệ. Cho phép: ${REPORT_ACTIONS.join(", ")}`,
        "INVALID_REPORT_ACTION"
      );
    }

    const report = await ReportModel.findById(reportId)
      .select("_id status reporterId targetType targetId actionTaken")
      .lean();
    if (!report) {
      throw new NotFoundError(`Không tìm thấy báo cáo với ID: ${reportId}`);
    }

    const note =
      typeof body.note === "string" ? body.note.slice(0, 500) : undefined;
    const actionTaken =
      typeof body.actionTaken === "string"
        ? body.actionTaken.slice(0, 200)
        : undefined;
    const adminId =
      ((req as Request & { user?: { _id?: string; userId?: string } }).user?._id ??
        (req as Request & { user?: { _id?: string; userId?: string } }).user
          ?.userId) ||
      undefined;

    const payloadMap: Record<AdminReportAction, Record<string, unknown>> = {
      review: { status: ReportStatus.REVIEWING },
      resolve: {
        status: ReportStatus.RESOLVED,
        resolutionNote: note,
        actionTaken,
        reviewedBy: adminId ? new Types.ObjectId(adminId) : undefined,
        reviewedAt: new Date(),
      },
      dismiss: {
        status: ReportStatus.DISMISSED,
        resolutionNote: note,
        actionTaken,
        reviewedBy: adminId ? new Types.ObjectId(adminId) : undefined,
        reviewedAt: new Date(),
      },
    };

    const updated = await ReportModel.findByIdAndUpdate(
      reportId,
      { $set: payloadMap[body.action] },
      { new: true }
    )
      .populate({ path: "reporterId", select: "_id name avatar" })
      .populate({ path: "reviewedBy", select: "_id name" })
      .lean();

    if (!updated) {
      throw new NotFoundError(`Không tìm thấy báo cáo với ID: ${reportId}`);
    }

    fireAndForgetAdminLog(req, mapReportActionToLogAction(body.action), {
      severity: body.action === "resolve" ? LogSeverity.WARNING : LogSeverity.INFO,
      targetType: LogTargetType.REPORT,
      targetId: reportId,
      affectedUserId: report.reporterId,
      before: { status: report.status, actionTaken: report.actionTaken },
      after: { status: updated.status, actionTaken: updated.actionTaken },
      note,
    });

    sendSuccess(
      res,
      await buildAdminReportPayload(updated as never),
      body.action === "review"
        ? "Đã chuyển báo cáo sang đang xem xét"
        : body.action === "resolve"
        ? "Đã xử lý và đóng báo cáo"
        : "Đã bỏ qua báo cáo"
    );
  }
);

/**
 * @route   GET /api/admin/dashboard/stats
 * @route   GET /api/admin/stats  (alias)
 */
export const getAdminDashboardStats = asyncHandler(
  async (_req: Request, res: Response) => {
    const startOfToday = startOfDay(new Date());
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersToday,
      totalPosts,
      newPostsToday,
      flaggedPosts,
      pendingReports,
      pendingLast24h,
    ] = await Promise.all([
      UserModel.countDocuments({ isActive: true }),
      UserModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      PostModel.countDocuments({}),
      PostModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      PostModel.countDocuments({ moderationStatus: ModerationStatus.FLAGGED }),
      ReportModel.countDocuments({ status: ReportStatus.PENDING }),
      ReportModel.find({
        status: ReportStatus.PENDING,
        createdAt: { $gte: since24h },
      })
        .select("reason moderationSnapshot")
        .lean(),
    ]);

    const urgentReports = pendingLast24h.filter(
      (r) =>
        (r.reason != null && URGENT_REASONS.has(r.reason as ReportReason)) ||
        maxAiFromSnapshot(
          r.moderationSnapshot as ModerationResult | undefined
        ) >= URGENT_AI_THRESHOLD
    ).length;

    sendSuccess(res, {
      totalUsers,
      newUsersToday,
      totalPosts,
      newPostsToday,
      flaggedPosts,
      pendingReports,
      urgentReports,
    });
  }
);

/** @deprecated Dùng GET /api/admin/dashboard/stats — cùng handler */
export const getDashboardStats = getAdminDashboardStats;

/**
 * @route GET /api/admin/reports/pending
 */
export const getPendingReportsAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 50,
    });
    const filter = { status: ReportStatus.PENDING };

    const [rows, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "reporterId", select: "_id name avatar" })
        .populate({ path: "reviewedBy", select: "_id name" })
        .lean(),
      ReportModel.countDocuments(filter),
    ]);

    const reports = await Promise.all(
      rows.map((row) => buildAdminReportPayload(row as never))
    );

    sendSuccess(res, {
      reports,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  }
);

/**
 * @route GET /api/admin/violations/daily
 */
export const getViolationsDaily = asyncHandler(
  async (_req: Request, res: Response) => {
    const startOfToday = startOfDay(new Date());

    type ViolationRow = {
      _id: null;
      toxicCount: number;
      toxicMax: number;
      hateCount: number;
      hateMax: number;
      spamCount: number;
      spamMax: number;
    };

    const [agg, misCount] = await Promise.all([
      PostModel.aggregate<ViolationRow>([
        { $match: { createdAt: { $gte: startOfToday } } },
        {
          $group: {
            _id: null,
            toxicCount: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      { $ifNull: ["$aiToxicScore", 0] },
                      VIOLATION_SCORE_THRESHOLD,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            toxicMax: { $max: { $ifNull: ["$aiToxicScore", 0] } },
            hateCount: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      { $ifNull: ["$aiHateSpeechScore", 0] },
                      VIOLATION_SCORE_THRESHOLD,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            hateMax: { $max: { $ifNull: ["$aiHateSpeechScore", 0] } },
            spamCount: {
              $sum: {
                $cond: [
                  {
                    $gte: [
                      { $ifNull: ["$aiSpamScore", 0] },
                      VIOLATION_SCORE_THRESHOLD,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            spamMax: { $max: { $ifNull: ["$aiSpamScore", 0] } },
          },
        },
      ]),
      ReportModel.countDocuments({
        reason: ReportReason.MISINFORMATION,
        createdAt: { $gte: startOfToday },
      }),
    ]);

    const row = agg[0];
    const toxicCount = row?.toxicCount ?? 0;
    const hateCount = row?.hateCount ?? 0;
    const spamCount = row?.spamCount ?? 0;

    sendSuccess(res, {
      toxic: {
        count: toxicCount,
        max: row?.toxicMax ?? 0,
      },
      hateSpeech: {
        count: hateCount,
        max: row?.hateMax ?? 0,
      },
      spam: {
        count: spamCount,
        max: row?.spamMax ?? 0,
      },
      misinformation: {
        count: misCount,
        max: misCount,
      },
    });
  }
);

/**
 * @route GET /api/admin/ai/performance
 */
export const getAiPerformance = asyncHandler(
  async (_req: Request, res: Response) => {
    const startOfToday = startOfDay(new Date());
    const sevenAgo = subDays(new Date(), 7);

    const [
      postsToday,
      mediaToday,
      decidedWithSnapshot,
      fpAgg,
      dismissedWithSnap,
    ] = await Promise.all([
      PostModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      PostMediaModel.countDocuments({
        createdAt: { $gte: startOfToday },
        mediaType: { $in: ["image", "video"] },
      }),
      ReportModel.countDocuments({
        reviewedAt: { $gte: sevenAgo },
        status: {
          $in: [
            ReportStatus.REVIEWED,
            ReportStatus.RESOLVED,
            ReportStatus.DISMISSED,
          ],
        },
        moderationSnapshot: { $exists: true, $ne: null },
      }),
      ReportModel.aggregate<{ c?: number }>([
        {
          $match: {
            status: ReportStatus.DISMISSED,
            reviewedAt: { $gte: sevenAgo },
            moderationSnapshot: { $exists: true, $ne: null },
          },
        },
        {
          $project: {
            m: {
              $max: [
                { $ifNull: ["$moderationSnapshot.scores.toxic", 0] },
                { $ifNull: ["$moderationSnapshot.scores.hateSpeech", 0] },
                { $ifNull: ["$moderationSnapshot.scores.spam", 0] },
              ],
            },
          },
        },
        { $match: { m: { $gte: FALSE_POSITIVE_AI_THRESHOLD } } },
        { $count: "c" },
      ]),
      ReportModel.countDocuments({
        status: ReportStatus.DISMISSED,
        reviewedAt: { $gte: sevenAgo },
        moderationSnapshot: { $exists: true, $ne: null },
      }),
    ]);

    const falsePositiveCount = fpAgg[0]?.c ?? 0;
    const falsePositiveRate =
      dismissedWithSnap > 0 ? falsePositiveCount / dismissedWithSnap : 0;

    const accuracyLast7Days =
      decidedWithSnapshot > 0
        ? Math.min(
            1,
            Math.max(
              0,
              (decidedWithSnapshot - falsePositiveCount) / decidedWithSnapshot
            )
          )
        : 1;

    const apiCallsToday = postsToday + mediaToday;
    const estimatedCostUsd = apiCallsToday * AI_CALL_COST_USD;

    sendSuccess(res, {
      accuracyLast7Days,
      falsePositiveRate,
      apiCallsToday,
      estimatedCostUsd,
    });
  }
);

/**
 * @route PUT /api/admin/reports/:id/resolve
 */
export const resolveAdminReport = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Report ID");

    const body = req.body as { note?: string; actionTaken?: string };
    const note =
      typeof body.note === "string" ? body.note.slice(0, 500) : undefined;
    const actionTaken =
      typeof body.actionTaken === "string"
        ? body.actionTaken.slice(0, 200)
        : undefined;
    const adminId =
      ((req as Request & { user?: { _id?: string; userId?: string } }).user?._id ??
        (req as Request & { user?: { _id?: string; userId?: string } }).user
          ?.userId) ||
      undefined;

    const report = await ReportModel.findById(id)
      .select("_id status reporterId")
      .lean();
    if (!report) {
      throw new NotFoundError(`Không tìm thấy báo cáo với ID: ${id}`);
    }

    const updated = await ReportModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: ReportStatus.RESOLVED,
          resolutionNote: note,
          actionTaken,
          reviewedBy: adminId ? new Types.ObjectId(adminId) : undefined,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    )
      .populate({ path: "reporterId", select: "_id name avatar" })
      .populate({ path: "reviewedBy", select: "_id name" })
      .lean();

    if (!updated) {
      throw new NotFoundError(`Không tìm thấy báo cáo với ID: ${id}`);
    }

    fireAndForgetAdminLog(req, LogAction.ADMIN_REPORT_RESOLVE, {
      severity: LogSeverity.WARNING,
      targetType: LogTargetType.REPORT,
      targetId: id,
      affectedUserId: report.reporterId,
      before: { status: report.status },
      after: { status: ReportStatus.RESOLVED },
      note,
    });

    sendSuccess(
      res,
      await buildAdminReportPayload(updated as never),
      "Đã xử lý và đóng báo cáo"
    );
  }
);

export const getAdminUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const q = req.query as Record<string, string | undefined>;
    const keyword = q.keyword?.trim();
    const isBlocked = parseQueryBoolean(q.isBlocked, "isBlocked");
    const isActive = parseQueryBoolean(q.isActive, "isActive");

    const filter: Record<string, unknown> = {};
    if (isBlocked !== undefined) filter.isBlocked = isBlocked;
    if (isActive !== undefined) filter.isActive = isActive;
    if (keyword) {
      const safe = escapeRegex(keyword);
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { phoneNumber: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .select(ADMIN_USER_PROJECTION)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 0;

    sendSuccess(res, {
      users,
      total,
      page,
      totalPages,
    });
  }
);

export const getAdminUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

    const user = await UserModel.findById(id)
      .select(ADMIN_USER_PROJECTION)
      .lean();

    if (!user) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    sendSuccess(res, user);
  }
);

export const patchAdminUserBlock = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

    const before = await UserModel.findById(id)
      .select("isBlocked isActive role")
      .lean();
    if (!before) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    const user = await UserModel.findByIdAndUpdate(
      id,
      { $set: { isBlocked: true } },
      { new: true }
    )
      .select(ADMIN_USER_PROJECTION)
      .lean();

    if (!user) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    fireAndForgetAdminLog(req, LogAction.ADMIN_USER_BLOCK, {
      severity: LogSeverity.CRITICAL,
      targetType: LogTargetType.USER,
      targetId: id,
      affectedUserId: id,
      before: { isBlocked: before.isBlocked, isActive: before.isActive },
      after: { isBlocked: user.isBlocked, isActive: user.isActive },
    });

    sendSuccess(res, user, "Đã chặn người dùng");
  }
);

export const patchAdminUserUnblock = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

    const before = await UserModel.findById(id)
      .select("isBlocked isActive role")
      .lean();
    if (!before) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    const user = await UserModel.findByIdAndUpdate(
      id,
      { $set: { isBlocked: false } },
      { new: true }
    )
      .select(ADMIN_USER_PROJECTION)
      .lean();

    if (!user) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    fireAndForgetAdminLog(req, LogAction.ADMIN_USER_UNBLOCK, {
      severity: LogSeverity.WARNING,
      targetType: LogTargetType.USER,
      targetId: id,
      affectedUserId: id,
      before: { isBlocked: before.isBlocked, isActive: before.isActive },
      after: { isBlocked: user.isBlocked, isActive: user.isActive },
    });

    sendSuccess(res, user, "Đã bỏ chặn người dùng");
  }
);

export const patchAdminUserToggleActive = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

    const current = await UserModel.findById(id)
      .select("isActive isBlocked")
      .lean();
    if (!current) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    const user = await UserModel.findByIdAndUpdate(
      id,
      { $set: { isActive: !current.isActive } },
      { new: true }
    )
      .select(ADMIN_USER_PROJECTION)
      .lean();

    if (!user) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    fireAndForgetAdminLog(
      req,
      current.isActive
        ? LogAction.ADMIN_USER_DEACTIVATE
        : LogAction.ADMIN_USER_ACTIVATE,
      {
        severity: LogSeverity.WARNING,
        targetType: LogTargetType.USER,
        targetId: id,
        affectedUserId: id,
        before: { isActive: current.isActive, isBlocked: current.isBlocked },
        after: { isActive: user.isActive, isBlocked: user.isBlocked },
      }
    );

    sendSuccess(res, user, "Đã cập nhật trạng thái hoạt động");
  }
);

export const deleteAdminUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

    const before = await UserModel.findById(id)
      .select("isBlocked isActive")
      .lean();
    if (!before) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    const user = await UserModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false, isBlocked: true } },
      { new: true }
    )
      .select(ADMIN_USER_PROJECTION)
      .lean();

    if (!user) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    fireAndForgetAdminLog(req, LogAction.ADMIN_USER_DELETE, {
      severity: LogSeverity.CRITICAL,
      targetType: LogTargetType.USER,
      targetId: id,
      affectedUserId: id,
      before: { isActive: before.isActive, isBlocked: before.isBlocked },
      after: { isActive: user.isActive, isBlocked: user.isBlocked },
    });

    sendSuccess(res, user, "Đã xóa mềm người dùng");
  }
);

export const getAdminUsersStats = asyncHandler(
  async (_req: Request, res: Response) => {
    const todayStart = startOfDay(new Date());

    const [totalUsers, activeUsers, blockedUsers, newUsersToday] =
      await Promise.all([
        UserModel.countDocuments({}),
        UserModel.countDocuments({ isActive: true, isBlocked: false }),
        UserModel.countDocuments({ isBlocked: true }),
        UserModel.countDocuments({ createdAt: { $gte: todayStart } }),
      ]);

    sendSuccess(res, {
      totalUsers,
      activeUsers,
      blockedUsers,
      newUsersToday,
    });
  }
);

export const getAdminUserPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");
    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 50,
    });

    const [posts, total] = await Promise.all([
      PostModel.find({ userId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("contentText createdAt moderationStatus aiOverallRisk")
        .lean(),
      PostModel.countDocuments({ userId: id }),
    ]);

    sendSuccess(res, {
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  }
);

export const getAdminUserReports = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");
    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 50,
    });

    // Báo cáo mà user này BỊ tố (targetId = id) hoặc user này TỐ (reporterId = id)
    const filter = {
      $or: [{ targetId: id }, { reporterId: id }],
    };

    const [reports, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("reason status targetType createdAt actionTaken")
        .lean(),
      ReportModel.countDocuments(filter),
    ]);

    sendSuccess(res, {
      reports,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  }
);

/**
 * @route   GET /api/admin/users/:id/stats
 * Trả về thống kê riêng của 1 user: posts, friends/followers, reports nhận & gửi
 */
export const getAdminUserStats = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

    const user = await UserModel.findById(id)
      .select("postsCount followersCount followingCount")
      .lean();

    if (!user) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    const userId = new Types.ObjectId(id);

    const [totalReportsReceived, totalReportsMade] = await Promise.all([
      // Số báo cáo mà user này BỊ người khác tố
      ReportModel.countDocuments({ targetId: userId }),
      // Số báo cáo mà user này ĐÃ TỐ người khác
      ReportModel.countDocuments({ reporterId: userId }),
    ]);

    sendSuccess(res, {
      totalPosts: user.postsCount ?? 0,
      // Dùng followersCount làm "friends" — đổi thành FollowModel nếu có
      totalFriends: user.followersCount ?? 0,
      totalReportsReceived,
      totalReportsMade,
    });
  }
);

// ─────────────────────────────────────────────────────────────
//  COMMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────

const COMMENT_ACTIONS = ["hide", "unhide", "approve", "reject", "delete"] as const;
type CommentAdminAction = (typeof COMMENT_ACTIONS)[number];

function isCommentAdminAction(v: string): v is CommentAdminAction {
  return (COMMENT_ACTIONS as readonly string[]).includes(v);
}

function parseCommentModerationStatus(
  raw: string | undefined
): CommentModerationStatus | undefined {
  if (!raw) return undefined;
  if (
    Object.values(CommentModerationStatus).includes(raw as CommentModerationStatus)
  ) {
    return raw as CommentModerationStatus;
  }
  return undefined;
}

/**
 * @route   GET /api/admin/comments
 * @query   page        - Trang hiện tại (default: 1)
 * @query   limit       - Số bản ghi / trang (default: 10, max: 50)
 * @query   keyword     - Tìm theo nội dung bình luận
 * @query   status      - pending | approved | rejected | flagged
 * @query   postId      - Lọc theo bài viết
 * @query   isHidden    - true | false
 * @query   replyOnly   - true = chỉ reply | false = chỉ top-level | bỏ qua = tất cả
 */
export const getAdminComments = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 50,
    });

    const q = req.query as Record<string, string | undefined>;
    const filter: Record<string, unknown> = {};

    const status = parseCommentModerationStatus(q.status);
    if (status) filter.moderationStatus = status;

    const isHidden = parseQueryBoolean(q.isHidden, "isHidden");
    if (isHidden !== undefined) filter.isHidden = isHidden;

    const postId = q.postId?.trim();
    if (postId) {
      validateObjectId(postId, "Post ID");
      filter.postId = new Types.ObjectId(postId);
    }

    const replyOnly = parseQueryBoolean(q.replyOnly, "replyOnly");
    if (replyOnly === true) filter.parentCommentId = { $ne: null };
    else if (replyOnly === false) filter.parentCommentId = null;

    const keyword = q.keyword?.trim();
    if (keyword) {
      const safe = escapeRegex(keyword);
      filter.contentText = { $regex: safe, $options: "i" };
    }

    const [comments, total] = await Promise.all([
      CommentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "userId", select: "_id name avatar email" })
        .populate({ path: "postId", select: "_id contentText" })
        .select(
          "contentText moderationStatus isHidden isEdited " +
            "likesCount repliesCount parentCommentId originalCommentId " +
            "createdAt updatedAt userId postId"
        )
        .lean(),
      CommentModel.countDocuments(filter),
    ]);

    const flaggedIds = comments
      .filter((c) => c.moderationStatus === CommentModerationStatus.FLAGGED)
      .map((c) => c._id);

    const reportCounts =
      flaggedIds.length > 0
        ? await ReportModel.aggregate([
            {
              $match: {
                targetType: ReportTargetType.COMMENT,
                targetId: { $in: flaggedIds },
              },
            },
            { $group: { _id: "$targetId", count: { $sum: 1 } } },
          ])
        : [];

    const reportCountMap = new Map<string, number>(
      reportCounts.map((r) => [r._id.toString(), r.count as number])
    );

    const result = comments.map((c) => ({
      ...c,
      reportsCount: reportCountMap.get(c._id.toString()) ?? 0,
    }));

    const totalPages = Math.ceil(total / limit) || 1;
    sendSuccess(res, { comments: result, total, page, totalPages });
  }
);

/**
 * @route   GET /api/admin/comments/:id
 * @desc    Chi tiết bình luận — user, post gốc, comment cha (nếu reply),
 *          tổng số báo cáo.
 */
export const getAdminCommentById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Comment ID");

    const comment = await CommentModel.findById(id)
      .populate({
        path: "userId",
        select: "_id name avatar email phoneNumber isBlocked isActive",
      })
      .populate({
        path: "postId",
        select: "_id contentText moderationStatus isHidden",
      })
      .populate({
        path: "parentCommentId",
        select: "_id contentText userId createdAt",
        populate: { path: "userId", select: "_id name avatar" },
      })
      .lean();

    if (!comment) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${id}`);
    }

    const totalReports = await ReportModel.countDocuments({
      targetType: ReportTargetType.COMMENT,
      targetId: new Types.ObjectId(id),
    });

    sendSuccess(res, { ...comment, totalReports });
  }
);

/**
 * @route   PATCH /api/admin/comments/:id
 * @body    { action: "hide"|"unhide"|"approve"|"reject"|"delete", reason?: string }
 */
export const patchAdminComment = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Comment ID");

    const body = req.body as { action?: string; reason?: string };
    if (!body.action || !isCommentAdminAction(body.action)) {
      throw new ValidationError(
        `action không hợp lệ. Cho phép: ${COMMENT_ACTIONS.join(", ")}`,
        "INVALID_COMMENT_ACTION"
      );
    }

    const comment = await CommentModel.findById(id)
      .select("_id userId moderationStatus isHidden hiddenReason")
      .lean();
    if (!comment) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${id}`);
    }

    const reason =
      typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;

    type UpdatePayload = {
      moderationStatus: CommentModerationStatus;
      isHidden: boolean;
      hiddenReason?: string | undefined;
    };

    const payloadMap: Record<CommentAdminAction, UpdatePayload> = {
      hide: {
        isHidden: true,
        moderationStatus: CommentModerationStatus.REJECTED,
        ...(reason ? { hiddenReason: reason } : {}),
      },
      unhide: {
        isHidden: false,
        moderationStatus: CommentModerationStatus.APPROVED,
        hiddenReason: undefined,
      },
      approve: {
        isHidden: false,
        moderationStatus: CommentModerationStatus.APPROVED,
      },
      reject: {
        isHidden: false,
        moderationStatus: CommentModerationStatus.REJECTED,
      },
      delete: {
        isHidden: true,
        moderationStatus: CommentModerationStatus.REJECTED,
        hiddenReason: reason ?? "admin_deleted",
      },
    };

    const updated = await CommentModel.findByIdAndUpdate(
      id,
      { $set: payloadMap[body.action] },
      { new: true }
    )
      .select("_id moderationStatus isHidden hiddenReason updatedAt")
      .lean();

    if (!updated) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${id}`);
    }

    const logActionMap: Record<CommentAdminAction, LogAction> = {
      hide: LogAction.ADMIN_COMMENT_HIDE,
      unhide: LogAction.ADMIN_COMMENT_UNHIDE,
      approve: LogAction.ADMIN_COMMENT_MOD_APPROVE,
      reject: LogAction.ADMIN_COMMENT_MOD_REJECT,
      delete: LogAction.ADMIN_COMMENT_DELETE,
    };

    fireAndForgetAdminLog(req, logActionMap[body.action], {
      severity:
        body.action === "delete" ? LogSeverity.CRITICAL : LogSeverity.WARNING,
      targetType: LogTargetType.COMMENT,
      targetId: id,
      affectedUserId: comment.userId as Types.ObjectId,
      before: {
        isHidden: comment.isHidden,
        moderationStatus: comment.moderationStatus,
      },
      after: {
        isHidden: updated.isHidden,
        moderationStatus: updated.moderationStatus,
      },
      note: reason,
    });

    const msgMap: Record<CommentAdminAction, string> = {
      hide: "Đã ẩn bình luận",
      unhide: "Đã hiển thị bình luận",
      approve: "Đã duyệt bình luận",
      reject: "Đã từ chối bình luận",
      delete: "Đã xóa bình luận",
    };

    sendSuccess(res, updated, msgMap[body.action]);
  }
);

/**
 * @route   GET /api/admin/comments/:id/reports
 * @query   page, limit
 */
export const getAdminCommentReports = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Comment ID");

    const exists = await CommentModel.exists({ _id: id });
    if (!exists) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${id}`);
    }

    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 50,
    });

    const filter = {
      targetType: ReportTargetType.COMMENT,
      targetId: new Types.ObjectId(id),
    };

    const [reports, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "reporterId",
          select: "_id name avatar phoneNumber",
        })
        .select(
          "reason description status actionTaken " +
            "reviewedAt resolutionNote createdAt reporterId"
        )
        .lean(),
      ReportModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    sendSuccess(res, { reports, total, page, totalPages });
  }
);

/**
 * @route   GET /api/admin/comments/:id/activity
 * @desc    Lịch sử kiểm duyệt của bình luận, lấy từ LogModel.
 */
export const getAdminCommentActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Comment ID");

    const comment = await CommentModel.findById(id)
      .select("createdAt moderationStatus isHidden userId")
      .lean();

    if (!comment) {
      throw new NotFoundError(`Không tìm thấy bình luận với ID: ${id}`);
    }

    const logs = await LogModel.find({
      targetType: LogTargetType.COMMENT,
      targetId: new Types.ObjectId(id),
    })
      .sort({ createdAt: 1 })
      .populate({ path: "actorId", select: "_id name avatar" })
      .select("action actorId actorRole severity before after note createdAt")
      .lean();

    const actionLabelMap: Partial<Record<LogAction, string>> = {
      [LogAction.ADMIN_COMMENT_HIDE]: "Đã ẩn bình luận",
      [LogAction.ADMIN_COMMENT_UNHIDE]: "Đã hiển thị bình luận",
      [LogAction.ADMIN_COMMENT_DELETE]: "Đã xóa bình luận",
      [LogAction.ADMIN_COMMENT_MOD_APPROVE]: "Đã duyệt bình luận",
      [LogAction.ADMIN_COMMENT_MOD_REJECT]: "Đã từ chối bình luận",
      [LogAction.SYSTEM_COMMENT_AUTO_FLAGGED]: "Hệ thống tự động gắn cờ",
    };

    type ActivityItem = {
      _id: string;
      action: string;
      adminName: string;
      adminAvatar?: string;
      actorRole: string;
      severity?: string;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      note?: string;
      createdAt: Date;
    };

    const activity: ActivityItem[] = [];

    activity.push({
      _id: `${id}_created`,
      action: "Bình luận được đăng",
      adminName: "System",
      actorRole: LogActorRole.USER,
      createdAt: comment.createdAt,
    });

    for (const log of logs) {
      const actor = log.actorId as
        | { _id: unknown; name?: string; avatar?: string }
        | null
        | undefined;

      activity.push({
        _id: log._id.toString(),
        action: actionLabelMap[log.action as LogAction] ?? log.action,
        adminName:
          log.actorRole === LogActorRole.SYSTEM
            ? "Hệ thống"
            : actor?.name ?? "Admin",
        adminAvatar: actor?.avatar,
        actorRole: log.actorRole,
        severity: log.severity,
        before: log.before as Record<string, unknown> | undefined,
        after: log.after as Record<string, unknown> | undefined,
        note: log.note,
        createdAt: log.createdAt as Date,
      });
    }

    sendSuccess(res, { activity, total: activity.length });
  }
);

// ─────────────────────────────────────────────────────────────
//  POST MANAGEMENT
// ─────────────────────────────────────────────────────────────

const POST_ACTIONS = ["hide", "unhide", "delete"] as const;
type PostAdminAction = (typeof POST_ACTIONS)[number];

function isPostAdminAction(v: string): v is PostAdminAction {
  return (POST_ACTIONS as readonly string[]).includes(v);
}

function parseModerationStatus(
  raw: string | undefined
): ModerationStatus | undefined {
  if (!raw) return undefined;
  if (Object.values(ModerationStatus).includes(raw as ModerationStatus)) {
    return raw as ModerationStatus;
  }
  return undefined;
}

/**
 * @route   GET /api/admin/posts
 * Query: page, limit, keyword, status (pending|approved|rejected|flagged), isHidden
 */
export const getAdminPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 50,
    });
    const q = req.query as Record<string, string | undefined>;

    const filter: Record<string, unknown> = {};

    // Lọc theo moderationStatus
    const status = parseModerationStatus(q.status);
    if (status) filter.moderationStatus = status;

    // Lọc theo isHidden
    const isHidden = parseQueryBoolean(q.isHidden, "isHidden");
    if (isHidden !== undefined) filter.isHidden = isHidden;

    // Tìm kiếm theo nội dung hoặc userId
    const keyword = q.keyword?.trim();
    if (keyword) {
      const safe = escapeRegex(keyword);
      filter.$or = [{ contentText: { $regex: safe, $options: "i" } }];
    }

    const [posts, total] = await Promise.all([
      PostModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "userId",
          select: "_id name avatar email phoneNumber",
        })
        .select(
          "contentText moderationStatus isHidden isEdited likesCount commentsCount sharesCount aiOverallRisk aiToxicScore aiHateSpeechScore aiSpamScore visibility createdAt updatedAt userId"
        )
        .lean(),
      PostModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    sendSuccess(res, { posts, total, page, totalPages });
  }
);

/**
 * @route   GET /api/admin/posts/:id
 */
export const getAdminPostById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Post ID");

    const post = await PostModel.findById(id)
      .populate({
        path: "userId",
        select: "_id name avatar email phoneNumber isBlocked isActive",
      })
      .lean();

    if (!post) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${id}`);
    }

    // Lấy media của post nếu có PostMediaModel
    let mediaUrls: string[] = [];
    try {
      const { PostMediaModel } = await import("../models/post-media.model");
      const medias = await PostMediaModel.find({ postId: id })
        .select("mediaUrl mediaType")
        .lean();
      mediaUrls = medias.map((m) => m.mediaUrl).filter(Boolean);
    } catch {
      // PostMediaModel không tồn tại hoặc lỗi — bỏ qua
    }

    // Đếm tổng báo cáo của post này
    const totalReports = await ReportModel.countDocuments({
      targetType: ReportTargetType.POST,
      targetId: id,
    });

    sendSuccess(res, { ...post, mediaUrls, totalReports });
  }
);

/**
 * @route   PATCH /api/admin/posts/:id
 * Body: { action: "hide" | "unhide" | "delete" }
 */
export const patchAdminPost = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Post ID");

    const body = req.body as { action?: string; reason?: string };

    if (!body.action || !isPostAdminAction(body.action)) {
      throw new ValidationError(
        `action không hợp lệ. Cho phép: ${POST_ACTIONS.join(", ")}`,
        "INVALID_POST_ACTION"
      );
    }

    const post = await PostModel.findById(id).lean();
    if (!post) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${id}`);
    }

    const reason =
      typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;

    let updatePayload: Record<string, unknown> = {};

    if (body.action === "hide") {
      updatePayload = {
        isHidden: true,
        moderationStatus: ModerationStatus.REJECTED,
        ...(reason ? { hiddenReason: reason } : {}),
      };
    } else if (body.action === "unhide") {
      updatePayload = {
        isHidden: false,
        moderationStatus: ModerationStatus.APPROVED,
        hiddenReason: undefined,
      };
    } else {
      // "delete" → soft delete: ẩn + rejected
      updatePayload = {
        isHidden: true,
        moderationStatus: ModerationStatus.REJECTED,
        hiddenReason: reason ?? "admin_deleted",
      };
    }

    const updated = await PostModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true }
    )
      .select("_id moderationStatus isHidden hiddenReason updatedAt")
      .lean();

    if (!updated) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${id}`);
    }

    const msgMap: Record<PostAdminAction, string> = {
      hide: "Đã ẩn bài viết",
      unhide: "Đã hiển thị bài viết",
      delete: "Đã xóa bài viết",
    };

    const actionMap: Record<PostAdminAction, LogAction> = {
      hide: LogAction.ADMIN_POST_HIDE,
      unhide: LogAction.ADMIN_POST_UNHIDE,
      delete: LogAction.ADMIN_POST_DELETE,
    };

    fireAndForgetAdminLog(req, actionMap[body.action], {
      severity:
        body.action === "delete" ? LogSeverity.CRITICAL : LogSeverity.WARNING,
      targetType: LogTargetType.POST,
      targetId: id,
      affectedUserId: post.userId,
      before: {
        isHidden: post.isHidden,
        moderationStatus: post.moderationStatus,
        hiddenReason: post.hiddenReason,
      },
      after: {
        isHidden: updated.isHidden,
        moderationStatus: updated.moderationStatus,
        hiddenReason: updated.hiddenReason,
      },
      note: reason,
    });

    sendSuccess(res, updated, msgMap[body.action]);
  }
);

/**
 * @route   GET /api/admin/posts/:id/comments
 * Query: page, limit
 */
export const getAdminPostComments = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Post ID");

    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 50,
    });

    // Chỉ lấy top-level comments (parentCommentId = null)
    const filter = { postId: id, parentCommentId: null };

    const [comments, total] = await Promise.all([
      CommentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "userId",
          select: "_id name avatar",
        })
        .select(
          "contentText isHidden moderationStatus likesCount repliesCount isEdited createdAt userId"
        )
        .lean(),
      CommentModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    sendSuccess(res, { comments, total, page, totalPages });
  }
);

/**
 * @route   GET /api/admin/posts/:id/reports
 * Query: page, limit
 */
export const getAdminPostReports = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Post ID");

    const { page, limit, skip } = parsePagination(req, {
      defaultLimit: 10,
      maxLimit: 50,
    });

    const filter = {
      targetType: ReportTargetType.POST,
      targetId: new Types.ObjectId(id),
    };

    const [reports, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "reporterId",
          select: "_id name avatar phoneNumber",
        })
        .select(
          "reason description status actionTaken reviewedAt resolutionNote createdAt reporterId"
        )
        .lean(),
      ReportModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    sendSuccess(res, { reports, total, page, totalPages });
  }
);

/**
 * @route   GET /api/admin/posts/:id/activity
 * Tổng hợp lịch sử hoạt động của bài viết từ ReportModel
 * (Nếu sau này có AuditLogModel riêng thì thay thế)
 */
export const getAdminPostActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Post ID");

    const post = await PostModel.findById(id)
      .select(
        "createdAt updatedAt moderationStatus isHidden hiddenReason userId"
      )
      .lean();

    if (!post) {
      throw new NotFoundError(`Không tìm thấy bài viết với ID: ${id}`);
    }

    // Lấy tất cả reports đã được xử lý của post này
    const resolvedReports = await ReportModel.find({
      targetType: ReportTargetType.POST,
      targetId: new Types.ObjectId(id),
      status: { $ne: ReportStatus.PENDING },
    })
      .sort({ reviewedAt: -1 })
      .populate({
        path: "reviewedBy",
        select: "_id name",
      })
      .select(
        "actionTaken status resolutionNote reviewedAt createdAt reason reviewedBy"
      )
      .lean();

    // Tổng hợp thành activity log
    const logs: Array<{
      _id: string;
      action: string;
      adminName: string;
      createdAt: Date | string;
      note?: string;
    }> = [];

    // Event 1: Bài viết được tạo
    logs.push({
      _id: `${id}_created`,
      action: "Bài viết được đăng",
      adminName: "System",
      createdAt: post.createdAt,
    });

    // Events từ reports đã xử lý
    for (const r of resolvedReports) {
      const reviewer = r.reviewedBy as
        | { _id: unknown; name?: string }
        | null
        | undefined;
      const adminName = reviewer?.name ?? "Admin";

      const actionLabel: Record<string, string> = {
        approved_content: "Duyệt bài viết",
        removed_content: "Ẩn bài viết",
        warned_user: "Cảnh báo tác giả",
        blocked_user: "Chặn tác giả",
        hide: "Ẩn bài viết",
        dismiss: "Bỏ qua báo cáo",
      };

      logs.push({
        _id: r._id.toString(),
        action:
          actionLabel[r.actionTaken ?? ""] ??
          `Xử lý báo cáo (${r.actionTaken ?? r.status})`,
        adminName,
        createdAt: r.reviewedAt ?? r.createdAt,
        note: r.resolutionNote || undefined,
      });
    }

    // Nếu bài đang bị ẩn mà không có resolved report nào → log thêm
    if (post.isHidden && resolvedReports.length === 0 && post.hiddenReason) {
      logs.push({
        _id: `${id}_hidden`,
        action: "Bài viết bị ẩn",
        adminName: "Admin",
        createdAt: post.updatedAt,
        note: post.hiddenReason,
      });
    }

    // Sắp xếp theo thời gian tăng dần
    logs.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sendSuccess(res, { logs, total: logs.length });
  }
);
