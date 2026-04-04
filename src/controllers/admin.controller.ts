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
  reports: Array<{
    targetType: ReportTargetType;
    targetId: { toString(): string };
  }>
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
      const p = await PostModel.findById(report.targetId)
        .select("userId")
        .lean();
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
  const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
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
    rows as Array<{
      targetType: ReportTargetType;
      targetId: { toString(): string };
    }>
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
export const handleReport = asyncHandler(
  async (req: Request, res: Response) => {
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
        .lean(),
      ReportModel.countDocuments(filter),
    ]);

    const postIds = rows
      .filter((r) => r.targetType === ReportTargetType.POST)
      .map((r) => r.targetId.toString());
    const commentIds = rows
      .filter((r) => r.targetType === ReportTargetType.COMMENT)
      .map((r) => r.targetId.toString());
    const userIds = rows
      .filter((r) => r.targetType === ReportTargetType.USER)
      .map((r) => r.targetId.toString());

    const uniquePost = [...new Set(postIds)];
    const uniqueComment = [...new Set(commentIds)];
    const uniqueUser = [...new Set(userIds)];

    const uniqueOrPairs = [
      ...new Map(
        rows.map((r) => [
          `${r.targetType}:${r.targetId.toString()}`,
          { targetType: r.targetType, targetId: r.targetId },
        ])
      ).values(),
    ];
    const reportCounts =
      uniqueOrPairs.length === 0
        ? []
        : await ReportModel.aggregate<{
            _id: { targetType: string; targetId: Types.ObjectId };
            c: number;
          }>([
            {
              $match: {
                $or: uniqueOrPairs.map((p) => ({
                  targetType: p.targetType,
                  targetId: p.targetId,
                })),
              },
            },
            {
              $group: {
                _id: { targetType: "$targetType", targetId: "$targetId" },
                c: { $sum: 1 },
              },
            },
          ]);
    const countMap = new Map<string, number>();
    for (const row of reportCounts) {
      countMap.set(
        `${row._id.targetType}:${row._id.targetId.toString()}`,
        row.c
      );
    }

    const [posts, comments, users] = await Promise.all([
      uniquePost.length
        ? PostModel.find({ _id: { $in: uniquePost } })
            .select(
              "contentText aiToxicScore aiHateSpeechScore aiSpamScore aiOverallRisk"
            )
            .lean()
        : [],
      uniqueComment.length
        ? CommentModel.find({ _id: { $in: uniqueComment } })
            .select("contentText")
            .lean()
        : [],
      uniqueUser.length
        ? UserModel.find({ _id: { $in: uniqueUser } })
            .select("name phoneNumber")
            .lean()
        : [],
    ]);

    const postMap = new Map(posts.map((p) => [p._id.toString(), p]));
    const commentMap = new Map(comments.map((c) => [c._id.toString(), c]));
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const items = rows.map((r) => {
      const key = `${r.targetType}:${r.targetId.toString()}`;
      const snapScores = scoresFromSnapshot(
        r.moderationSnapshot as ModerationResult | undefined
      );
      let toxic = snapScores.toxic;
      let hate = snapScores.hate;
      let spam = snapScores.spam;
      let overall = 0;

      let name = "";
      if (r.targetType === ReportTargetType.POST) {
        const p = postMap.get(r.targetId.toString());
        name = (p?.contentText ?? "").trim().slice(0, 120) || "Bài viết";
        if (p) {
          toxic = Math.max(toxic, p.aiToxicScore ?? 0);
          hate = Math.max(hate, p.aiHateSpeechScore ?? 0);
          spam = Math.max(spam, p.aiSpamScore ?? 0);
          overall = p.aiOverallRisk ?? Math.max(toxic, hate, spam);
        }
      } else if (r.targetType === ReportTargetType.COMMENT) {
        const c = commentMap.get(r.targetId.toString());
        name = (c?.contentText ?? "").trim().slice(0, 120) || "Bình luận";
      } else {
        const u = userMap.get(r.targetId.toString());
        name = u?.name?.trim() || u?.phoneNumber || "Người dùng";
      }

      if (!overall) {
        overall = Math.max(toxic, hate, spam);
      }

      const badge = badgeFromAiScores(toxic, hate, spam);
      const reportCountForTarget = countMap.get(key) ?? 1;

      return {
        id: r._id.toString(),
        badge,
        name,
        meta: {
          score: overall,
          reportCount: reportCountForTarget,
          reason: r.reason ?? null,
        },
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

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
    const adminId = getAdminUserId(req);
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError("id báo cáo không hợp lệ", "INVALID_REPORT_ID");
    }

    const body = req.body as { action?: string; note?: string };
    if (!body.action || !isResolveAction(body.action)) {
      throw new ValidationError(
        `action phải là: ${RESOLVE_ACTIONS.join(", ")}`,
        "INVALID_RESOLVE_ACTION"
      );
    }

    const note = typeof body.note === "string" ? body.note.slice(0, 1000) : "";

    const report = await ReportModel.findById(id).lean();
    if (!report) {
      throw new NotFoundError("Không tìm thấy báo cáo");
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new ValidationError(
        "Chỉ có thể xử lý báo cáo đang ở trạng thái chờ (pending)",
        "REPORT_NOT_PENDING"
      );
    }

    if (body.action === "hide") {
      if (report.targetType === ReportTargetType.POST) {
        await PostModel.findByIdAndUpdate(report.targetId, {
          isHidden: true,
          hiddenReason: note || "admin_hide_report",
          moderationStatus: ModerationStatus.REJECTED,
        });
      } else if (report.targetType === ReportTargetType.COMMENT) {
        await CommentModel.findByIdAndUpdate(report.targetId, {
          isHidden: true,
          moderationStatus: CommentModerationStatus.REJECTED,
        });
      }
    }

    const updated = await ReportModel.findByIdAndUpdate(
      id,
      {
        status: ReportStatus.RESOLVED,
        resolutionNote: note || undefined,
        reviewedBy: new Types.ObjectId(adminId),
        reviewedAt: new Date(),
        actionTaken: body.action,
      },
      { new: true }
    ).lean();

    if (!updated) {
      throw new NotFoundError("Không tìm thấy báo cáo");
    }

    sendSuccess(res, {
      id: updated._id.toString(),
      status: updated.status,
      actionTaken: updated.actionTaken,
      resolutionNote: updated.resolutionNote,
      reviewedAt: updated.reviewedAt,
    });
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

    sendSuccess(res, user, "Đã chặn người dùng");
  }
);

export const patchAdminUserUnblock = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

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

    sendSuccess(res, user, "Đã bỏ chặn người dùng");
  }
);

export const patchAdminUserToggleActive = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

    const current = await UserModel.findById(id).select("isActive").lean();
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

    sendSuccess(res, user, "Đã cập nhật trạng thái hoạt động");
  }
);

export const deleteAdminUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "User ID");

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
