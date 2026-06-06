// src/controllers/admin.controller.ts

import { Request, Response } from "express";
import { PipelineStage, Types } from "mongoose";
import { startOfDay, subDays } from "date-fns";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import { ValidationError, NotFoundError, ForbiddenError } from "../errors";
import {
  ReportModel,
  ReportTargetType,
  ReportStatus,
  ReportReason,
  ModerationAction,
  type BanPreset,
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
import {
  suggestBanPreset,
  presetToMs,
  VALID_BAN_PRESETS,
} from "../utils/suggest-ban.util";

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
  const authUser = (
    req as Request & {
      user?: { _id?: string | Types.ObjectId; userId?: string };
    }
  ).user;
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

const REPORT_STATUSES = [
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
] as const;
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
const REPORT_ACTIONS = ["resolve", "dismiss", "review"] as const;

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
        .populate<{
          userId: { name?: string; avatar?: string };
        }>("userId", "name avatar")
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
        .populate<{
          userId: { name?: string; avatar?: string };
        }>("userId", "name avatar")
        .lean();
      if (!doc) return {};
      return {
        targetPreview: (doc.contentText as string | undefined)?.slice(0, 120),
        targetUserName: doc.userId?.name,
        targetUserAvatar: doc.userId?.avatar,
      };
    }

    const doc = await UserModel.findById(targetId)
      .select("name avatar bio")
      .lean();
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

async function buildAdminReportPayload(report: {
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
  reviewedBy?: Types.ObjectId | { _id: Types.ObjectId; name?: string } | null;
  reviewedAt?: Date;
  actionTaken?: string;
  createdAt: Date;
  updatedAt: Date;
  reportCount?: number;
  moderationSnapshot?: ModerationResult;
}) {
  const isReporterPopulated = (
    value: typeof report.reporterId
  ): value is { _id: Types.ObjectId; name?: string; avatar?: string } =>
    Boolean(
      value && typeof value === "object" && "_id" in value && "name" in value
    );
  const isReviewerPopulated = (
    value: typeof report.reviewedBy
  ): value is { _id: Types.ObjectId; name?: string } =>
    Boolean(
      value && typeof value === "object" && "_id" in value && "name" in value
    );

  const reporter = isReporterPopulated(report.reporterId)
    ? report.reporterId
    : null;
  const reviewer = isReviewerPopulated(report.reviewedBy)
    ? report.reviewedBy
    : null;

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
    reportCount: 0,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    ...preview,
    aiAnalysis: buildAiAnalysisFromSnapshot(
      report.moderationSnapshot ?? undefined,
      report.updatedAt
    ),
  };
}

function mapReportActionToLogAction(action: AdminReportAction): LogAction {
  if (action === "dismiss") return LogAction.ADMIN_REPORT_DISMISS;
  return LogAction.ADMIN_REPORT_RESOLVE;
}

// ─── Moderation action helpers ───────────────────────────────────────────────

/**
 * Thực hiện hành động xử lý vi phạm trên target.
 *
 * Quy tắc:
 * - post / comment:
 *     hide         → isHidden: true, moderationStatus: VIOLATED
 *     delete       → xóa khỏi DB
 *     dismiss      → không làm gì với target
 *     warn_author  → coi như hide + cảnh cáo author
 *     ban_*        → không áp dụng cho post/comment (log warning)
 * - user:
 *     warn_author  → violationCount += 1, lastWarnedAt = now
 *     ban_temp     → isBanned: true, bannedUntil = now + days
 *     ban_permanent→ isBanned: true, bannedUntil = null
 *     hide         → coi như warn_author
 *     delete       → coi như ban_permanent
 *     dismiss      → không làm gì
 *
 * Nếu warnAuthor = true (với bất kỳ action nào trừ dismiss/dismiss):
 *     → tăng violationCount của author +1, set lastWarnedAt = now
 *
 * Trả về { suggestBan: true } nếu violationCount sau khi tăng >= 5.
 */
interface ApplyModResult {
  suggestBan: boolean;
  bannedUntil: Date | null;
  banPreset: string | null;
  suggestion: {
    preset: string | null;
    reason: string;
    autoEscalate: boolean;
  } | null;
}

/**
 * Thực hiện hành động xử lý vi phạm trên target.
 *
 * Quy tắc:
 * - post / comment:
 *     hide         → isHidden: true, moderationStatus: VIOLATED
 *     delete       → xóa khỏi DB
 *     dismiss      → không làm gì với target
 *     warn_author  → coi như hide + cảnh cáo author
 *     ban_*        → không áp dụng cho post/comment
 * - user:
 *     warn_author  → violationCount += 1, lastWarnedAt = now
 *     ban_temp     → isBlocked: true, bannedUntil = now + preset
 *     ban_permanent→ isBlocked: true, bannedUntil = null
 *     hide         → coi như warn_author
 *     delete       → coi như ban_permanent
 *     dismiss      → không làm gì
 *
 * Nếu warnAuthor = true (với bất kỳ action nào trừ dismiss):
 *     → tăng violationCount của author +1, set lastWarnedAt = now
 *
 * Trả về banPreset, bannedUntil, suggestBan, suggestion (từ suggestBanPreset).
 */
async function applyModerationAction(
  report: {
    targetType: string;
    targetId: Types.ObjectId;
    moderationSnapshot?: ModerationResult;
  },
  modAction: ModerationAction,
  warnAuthor: boolean,
  banPreset: BanPreset | undefined,
  adminOid: Types.ObjectId,
  now: Date,
  note?: string
): Promise<ApplyModResult> {
  const { targetType, targetId, moderationSnapshot } = report;
  const violationReason = note ?? "Xác nhận vi phạm qua báo cáo";
  const logNote = `[${modAction}] ${violationReason}`;
  let bannedUntil: Date | null = null;
  let banPresetResult: string | null = null;
  let suggestBan = false;
  let suggestion: ApplyModResult["suggestion"] = null;

  // ── post / comment ──────────────────────────────────────────────────────
  if (targetType === ReportTargetType.POST) {
    if (
      modAction === ModerationAction.HIDE ||
      modAction === ModerationAction.WARN_AUTHOR
    ) {
      await PostModel.findByIdAndUpdate(targetId, {
        isHidden: true,
        moderationStatus: ModerationStatus.VIOLATED,
        hiddenReason: logNote,
      });
      await LogService.create({
        actorId: adminOid,
        actorRole: LogActorRole.ADMIN,
        action: LogAction.ADMIN_POST_MOD_VIOLATE,
        severity: LogSeverity.WARNING,
        targetType: LogTargetType.POST,
        targetId,
        note: logNote,
      });
      if (warnAuthor) {
        const result = await warnPostAuthor(targetId, logNote, adminOid, now);
        suggestBan = suggestBan || result.suggestBan;
        if (result.suggestBan) {
          suggestion = {
            preset: "permanent",
            reason: "Số lần vi phạm đã đạt ngưỡng cảnh báo",
            autoEscalate: true,
          };
        }
      }
    } else if (modAction === ModerationAction.DELETE) {
      await PostModel.findByIdAndDelete(targetId);
      await LogService.create({
        actorId: adminOid,
        actorRole: LogActorRole.ADMIN,
        action: LogAction.ADMIN_POST_MOD_VIOLATE,
        severity: LogSeverity.ERROR,
        targetType: LogTargetType.POST,
        targetId,
        note: `[DELETE] ${logNote}`,
      });
      if (warnAuthor) {
        const result = await warnPostAuthor(targetId, logNote, adminOid, now);
        suggestBan = suggestBan || result.suggestBan;
      }
    }
    // dismiss → không làm gì
  } else if (targetType === ReportTargetType.COMMENT) {
    if (
      modAction === ModerationAction.HIDE ||
      modAction === ModerationAction.WARN_AUTHOR
    ) {
      await CommentModel.findByIdAndUpdate(targetId, {
        isHidden: true,
        moderationStatus: CommentModerationStatus.VIOLATED,
        hiddenReason: logNote,
      });
      await LogService.create({
        actorId: adminOid,
        actorRole: LogActorRole.ADMIN,
        action: LogAction.ADMIN_COMMENT_MOD_VIOLATE,
        severity: LogSeverity.WARNING,
        targetType: LogTargetType.COMMENT,
        targetId,
        note: logNote,
      });
      if (warnAuthor) {
        await warnCommentAuthor(targetId, logNote, adminOid, now);
      }
    } else if (modAction === ModerationAction.DELETE) {
      await CommentModel.findByIdAndDelete(targetId);
      await LogService.create({
        actorId: adminOid,
        actorRole: LogActorRole.ADMIN,
        action: LogAction.ADMIN_COMMENT_MOD_VIOLATE,
        severity: LogSeverity.ERROR,
        targetType: LogTargetType.COMMENT,
        targetId,
        note: `[DELETE] ${logNote}`,
      });
      if (warnAuthor) {
        await warnCommentAuthor(targetId, logNote, adminOid, now);
      }
    }
    // dismiss → không làm gì

    // ── user ────────────────────────────────────────────────────────────────
  } else if (targetType === ReportTargetType.USER) {
    if (
      modAction === ModerationAction.WARN_AUTHOR ||
      modAction === ModerationAction.HIDE
    ) {
      const result = await addUserViolation(
        targetId,
        logNote,
        "warn_author",
        adminOid,
        now
      );
      suggestBan = result.suggestBan;
      // Gọi suggestBanPreset với violationCount thực tế + AI scores
      const aiScores = moderationSnapshot?.scores;
      const sug = suggestBanPreset(result.violationCount, aiScores);
      if (sug.preset) {
        suggestion = {
          preset: sug.preset,
          reason: sug.reason,
          autoEscalate: sug.autoEscalate,
        };
      }
    } else if (modAction === ModerationAction.BAN_TEMP) {
      // Lấy violationCount hiện tại trước khi tăng
      const userBefore = await UserModel.findById(targetId)
        .select("violationCount")
        .lean();
      const vcBefore = userBefore?.violationCount ?? 0;

      // Tính bannedUntil từ preset
      const ms = presetToMs(banPreset ?? "7d");
      const days = ms !== null ? ms / (24 * 60 * 60 * 1000) : 7;
      bannedUntil = new Date(now);
      bannedUntil.setDate(bannedUntil.getDate() + days);
      banPresetResult = banPreset ?? "7d";

      await UserModel.findByIdAndUpdate(targetId, {
        isBlocked: true,
        isBanned: true,
        bannedUntil,
        $inc: { violationCount: 1 },
        $push: {
          violationLogs: {
            $each: [
              {
                reason: logNote,
                adminId: adminOid,
                action: ModerationAction.BAN_TEMP,
                timestamp: now,
              },
            ],
            $position: 0,
            $slice: 50,
          },
        },
      });
      await LogService.create({
        actorId: adminOid,
        actorRole: LogActorRole.ADMIN,
        action: LogAction.ADMIN_USER_WARN,
        severity: LogSeverity.WARNING,
        targetType: LogTargetType.USER,
        targetId,
        note: `[BAN_TEMP ${banPreset ?? "7d"}] ${logNote}`,
        metadata: {
          banUntil: bannedUntil.toISOString(),
          banPreset: banPresetResult,
        },
      });
      // Gợi ý preset tiếp theo dựa trên violationCount sau khi tăng
      const aiScores = moderationSnapshot?.scores;
      const sug = suggestBanPreset(vcBefore + 1, aiScores);
      if (sug.preset) {
        suggestion = {
          preset: sug.preset,
          reason: sug.reason,
          autoEscalate: sug.autoEscalate,
        };
      }
    } else if (modAction === ModerationAction.BAN_PERMANENT) {
      bannedUntil = null;
      banPresetResult = "permanent";
      await UserModel.findByIdAndUpdate(targetId, {
        isBlocked: true,
        isBanned: true,
        bannedUntil: null,
        $inc: { violationCount: 1 },
        $push: {
          violationLogs: {
            $each: [
              {
                reason: logNote,
                adminId: adminOid,
                action: ModerationAction.BAN_PERMANENT,
                timestamp: now,
              },
            ],
            $position: 0,
            $slice: 50,
          },
        },
      });
      await LogService.create({
        actorId: adminOid,
        actorRole: LogActorRole.ADMIN,
        action: LogAction.ADMIN_USER_WARN,
        severity: LogSeverity.ERROR,
        targetType: LogTargetType.USER,
        targetId,
        note: `[BAN_PERMANENT] ${logNote}`,
      });
    }
    // dismiss → không làm gì
  }

  return { suggestBan, bannedUntil, banPreset: banPresetResult, suggestion };
}

/** Tăng violationCount + lastWarnedAt của author bài viết */
async function warnPostAuthor(
  postId: Types.ObjectId,
  reason: string,
  adminOid: Types.ObjectId,
  now: Date
): Promise<{ suggestBan: boolean }> {
  const post = await PostModel.findById(postId).select("userId").lean();
  if (!post?.userId) return { suggestBan: false };
  return await addUserViolation(
    post.userId as Types.ObjectId,
    reason,
    "warn_author",
    adminOid,
    now
  );
}

/** Tăng violationCount + lastWarnedAt của author bình luận */
async function warnCommentAuthor(
  commentId: Types.ObjectId,
  reason: string,
  adminOid: Types.ObjectId,
  now: Date
) {
  const comment = await CommentModel.findById(commentId)
    .select("userId")
    .lean();
  if (!comment?.userId) return;
  await addUserViolation(
    comment.userId as Types.ObjectId,
    reason,
    "warn_author",
    adminOid,
    now
  );
}

/**
 * Tăng violationCount, set lastWarnedAt, ghi violationLog của user.
 * Trả về { suggestBan, violationCount }.
 */
async function addUserViolation(
  userId: Types.ObjectId,
  reason: string,
  action: string,
  adminOid: Types.ObjectId,
  now: Date
): Promise<{ suggestBan: boolean; violationCount: number }> {
  const user = await UserModel.findByIdAndUpdate(
    userId,
    {
      $inc: { violationCount: 1 },
      $set: { lastWarnedAt: now },
      $push: {
        violationLogs: {
          $each: [
            {
              reason,
              adminId: adminOid,
              action,
              timestamp: now,
            },
          ],
          $position: 0,
          $slice: 50,
        },
      },
    },
    { new: true }
  );
  const violationCount = user?.violationCount ?? 0;
  await LogService.create({
    actorId: adminOid,
    actorRole: LogActorRole.ADMIN,
    action: LogAction.ADMIN_USER_WARN,
    severity: LogSeverity.WARNING,
    targetType: LogTargetType.USER,
    targetId: userId,
    note: reason,
    metadata: { violationCount },
  });
  return { suggestBan: violationCount >= 5, violationCount };
}

/**
 * Transform ModerationResult (moderationSnapshot) → aiAnalysis format cho frontend.
 */
function buildAiAnalysisFromSnapshot(
  snap: ModerationResult | null | undefined,
  calledAt?: Date
):
  | {
      calledAt: string;
      model: string;
      toxicityScore: number;
      confidenceScore: number;
      categories: string[];
      decision: string;
      reasoning: string;
      actionTaken: string;
      scores?: {
        toxic: number;
        hateSpeech: number;
        spam: number;
        reason: string;
      };
    }
  | undefined {
  if (!snap?.scores) return undefined;
  const { toxic, hateSpeech, spam, reason } = snap.scores;
  const max = Math.max(toxic, hateSpeech, spam);
  const decision =
    max >= 0.8
      ? "auto_hide"
      : max >= 0.6 && (toxic >= 0.6 || hateSpeech >= 0.6)
        ? "escalate"
        : max <= 0.2
          ? "auto_pass"
          : "needs_human";
  const actionTaken =
    decision === "auto_hide"
      ? "hidden"
      : decision === "auto_pass"
        ? "passed"
        : decision === "escalate"
          ? "flagged"
          : "none";
  const categories: string[] = [];
  if (toxic > 0.5) categories.push("toxic");
  if (hateSpeech > 0.5) categories.push("hate_speech");
  if (spam > 0.5) categories.push("spam");
  const confidenceScore = max > 0 ? Math.min(1, max + 0.15) : 0.5;
  return {
    calledAt: calledAt ? calledAt.toISOString() : new Date().toISOString(),
    model: snap.method === "ai" ? "gemini-3-flash" : "rule-based",
    toxicityScore: toxic,
    confidenceScore,
    categories,
    decision,
    reasoning:
      reason && reason !== "ok"
        ? reason
        : `Phát hiện: toxic=${Math.round(toxic * 100)}%, hate=${Math.round(hateSpeech * 100)}%, spam=${Math.round(spam * 100)}%`,
    actionTaken,
    scores: { toxic, hateSpeech, spam, reason },
  };
}

/**
 * @route   GET /api/admin/reports
 */
// export const getReports = asyncHandler(async (req: Request, res: Response) => {
//   const { page, limit, skip } = parsePagination(req, {
//     defaultLimit: 10,
//     maxLimit: 50,
//   });
//   const q = req.query as Record<string, string | undefined>;

//   const filter: Record<string, unknown> = {};
//   if (isReportStatus(q.status)) filter.status = q.status;
//   if (isReportTargetType(q.targetType)) filter.targetType = q.targetType;
//   if (isReportReason(q.reason)) filter.reason = q.reason;

//   const keyword = q.keyword?.trim();
//   if (keyword) {
//     const safe = escapeRegex(keyword);
//     filter.$or = [
//       { description: { $regex: safe, $options: "i" } },
//       { actionTaken: { $regex: safe, $options: "i" } },
//       { "reporterId.name": { $regex: safe, $options: "i" } },
//     ];
//   }

//   // reportCount là computed field không tồn tại trong DB — BE sort theo createdAt (report mới nhất)
//   // FE sẽ re-sort lại kết quả theo reportCount sau khi nhận data
//   const allowedSortKeys = ["createdAt", "updatedAt", "status"];
//   const sortKey = allowedSortKeys.includes(q.sortKey ?? "")
//     ? (q.sortKey as string)
//     : "createdAt";
//   const sortDir = q.sortDir === "asc" ? 1 : -1;

//   const [rows, pendingCount, reviewingCount, resolvedCount, dismissedCount] =
//     await Promise.all([
//       ReportModel.find(filter)
//         .sort({ [sortKey]: sortDir })
//         .skip(skip)
//         .limit(limit)
//         .populate({ path: "reporterId", select: "_id name avatar" })
//         .populate({ path: "reviewedBy", select: "_id name" })
//         .lean(),
//       ReportModel.countDocuments({ ...filter, status: "pending" }),
//       ReportModel.countDocuments({ ...filter, status: "reviewing" }),
//       ReportModel.countDocuments({ ...filter, status: "resolved" }),
//       ReportModel.countDocuments({ ...filter, status: "dismissed" }),
//     ]);

//   const targetIds = rows.map((r) => r.targetId);

//   const priorityCounts = await ReportModel.aggregate([
//     { $match: { targetId: { $in: targetIds } } },
//     { $group: { _id: "$targetId", count: { $sum: 1 } } },
//   ]);

//   const priorityMap = new Map(
//     priorityCounts.map((p) => [p._id.toString(), p.count])
//   );

//   const reports = (
//     await Promise.all(rows.map((row) => buildAdminReportPayload(row as never)))
//   )
//     .map((report) => ({
//       ...report,
//       reportCount: priorityMap.get(report.targetId) ?? 1,
//     }))
//     .filter((report) => {
//       if (!keyword) return true;
//       const kw = keyword.toLowerCase();
//       return (
//         report.reporterName.toLowerCase().includes(kw) ||
//         report.targetPreview?.toLowerCase().includes(kw) ||
//         report.description.toLowerCase().includes(kw) ||
//         report.actionTaken?.toLowerCase().includes(kw)
//       );
//     });

//   // Tổng = tổng các status → đảm bảo total = pending + resolved + dismissed
//   const total = pendingCount + resolvedCount + dismissedCount;

//   sendSuccess(res, {
//     reports,
//     total,
//     page,
//     totalPages: Math.ceil(total / limit) || 1,
//     pendingCount,
//     reviewingCount,
//     resolvedCount,
//     dismissedCount,
//   });
// });

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = parsePagination(req, {
    defaultLimit: 10,
    maxLimit: 50,
  });
  const q = req.query as Record<string, string | undefined>;

  const filter: Record<string, unknown> = {};
  if (isReportStatus(q.status)) filter.status = q.status;
  if (isReportTargetType(q.targetType)) filter.targetType = q.targetType;
  if (isReportReason(q.reason)) filter.reason = q.reason;

  const keyword = q.keyword?.trim().toLowerCase();
  if (keyword) {
    // Tìm reporterId có name match keyword trước
    const matchedUsers = await UserModel.find({
      name: { $regex: keyword, $options: "i" },
    })
      .select("_id")
      .lean();
    filter.reporterId = { $in: matchedUsers.map((u) => u._id) };
  }

  const allowedSortKeys = ["createdAt", "updatedAt", "status"];
  const sortKey = allowedSortKeys.includes(q.sortKey ?? "")
    ? (q.sortKey as string)
    : "createdAt";
  const sortDir = q.sortDir === "asc" ? 1 : -1;

  const skip = (page - 1) * limit;

  const [
    rows,
    total,
    pendingCount,
    reviewingCount,
    resolvedCount,
    dismissedCount,
  ] = await Promise.all([
    ReportModel.find(filter)
      .sort({ [sortKey]: sortDir })
      .skip(skip)
      .limit(limit)
      .populate({ path: "reporterId", select: "_id name avatar" })
      .populate({ path: "reviewedBy", select: "_id name" })
      .lean(),
    ReportModel.countDocuments(filter),
    ReportModel.countDocuments({ status: "pending" }),
    ReportModel.countDocuments({ status: "reviewing" }),
    ReportModel.countDocuments({ status: "resolved" }),
    ReportModel.countDocuments({ status: "dismissed" }),
  ]);

  const targetIds = rows.map((r) => r.targetId);

  const priorityCounts = await ReportModel.aggregate([
    { $match: { targetId: { $in: targetIds } } },
    { $group: { _id: "$targetId", count: { $sum: 1 } } },
  ]);

  const priorityMap = new Map(
    priorityCounts.map((p) => [p._id.toString(), p.count])
  );

  const reports = (
    await Promise.all(rows.map((row) => buildAdminReportPayload(row as never)))
  ).map((report) => ({
    ...report,
    reportCount: priorityMap.get(report.targetId) ?? 1,
  }));

  sendSuccess(res, {
    reports,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
    pendingCount,
    reviewingCount,
    resolvedCount,
    dismissedCount,
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

    const [detail, relatedRows, logs, reportCount, targetDoc] =
      await Promise.all([
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
        ReportModel.countDocuments({
          targetType: report.targetType,
          targetId: report.targetId,
        }),
        // Lấy AI scores từ Post/Comment để fallback
        report.targetType === ReportTargetType.POST
          ? PostModel.findById(report.targetId)
              .select(
                "aiToxicScore aiHateSpeechScore aiSpamScore aiOverallRisk hiddenReason moderationStatus isHidden"
              )
              .lean()
          : report.targetType === ReportTargetType.COMMENT
            ? CommentModel.findById(report.targetId)
                .select(
                  "aiToxicScore aiHateSpeechScore aiSpamScore hiddenReason moderationStatus isHidden"
                )
                .lean()
            : Promise.resolve(null),
      ]);

    // Build aiAnalysis: ưu tiên moderationSnapshot của report,
    // fallback sang AI scores từ Post/Comment
    let aiAnalysis = (detail as any).aiAnalysis ?? null;

    if (!aiAnalysis && targetDoc) {
      const td = targetDoc as any;
      const hasScores =
        td.aiToxicScore != null ||
        td.aiHateSpeechScore != null ||
        td.aiSpamScore != null;

      if (hasScores) {
        const toxic = td.aiToxicScore ?? 0;
        const hateSpeech = td.aiHateSpeechScore ?? 0;
        const spam = td.aiSpamScore ?? 0;
        const risk = Math.max(toxic, hateSpeech, spam);

        aiAnalysis = {
          calledAt: report.createdAt,
          model: "gemini (cached)",
          toxicityScore: toxic,
          confidenceScore: risk,
          categories: [],
          decision:
            risk >= 0.8
              ? "auto_hide"
              : risk >= 0.5
                ? "escalate"
                : risk >= 0.3
                  ? "needs_human"
                  : "auto_pass",
          reasoning: td.hiddenReason ?? "",
          actionTaken: td.isHidden ? "hidden" : "none",
          scores: {
            toxic,
            hateSpeech,
            spam,
            reason: td.hiddenReason ?? "ok",
          },
        };
      }
    }

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
          [LogAction.ADMIN_REPORT_DISMISS]:
            "Báo cáo bị bỏ qua do không vi phạm",
        };
        return {
          _id: log._id.toString(),
          action: actionMap[log.action as LogAction] ?? log.action,
          adminName:
            log.actorRole === LogActorRole.SYSTEM
              ? "System"
              : (actor?.name ?? "Admin"),
          note: log.note,
          createdAt: log.createdAt,
        };
      }),
    ];

    const relatedReports = (
      await Promise.all(
        relatedRows.map((row) => buildAdminReportPayload(row as never))
      )
    ).map((r) => ({ ...r, reportCount }));

    sendSuccess(res, {
      ...detail,
      aiAnalysis,
      reportCount,
      activity,
      relatedReports,
    });
  }
);

/**
 * @route   PATCH /api/admin/reports/:reportId
 *
 * Body:
 * {
 *   "action":  "resolve" | "dismiss" | "review",
 *   "note":    string,
 *   // — chỉ khi action = "resolve" — //
 *   "modAction":  "hide" | "delete" | "warn_author" | "ban_temp" | "ban_permanent" | "dismiss",
 *   "warnAuthor": boolean,
 *   "banPreset": "1d" | "3d" | "7d" | "30d" (bắt buộc khi modAction = "ban_temp"),
 * }
 */
export const handleReport = asyncHandler(
  async (req: Request, res: Response) => {
    const { reportId } = req.params as { reportId: string };
    validateObjectId(reportId, "Report ID");

    const body = req.body as {
      action?: string;
      note?: string;
      modAction?: string;
      warnAuthor?: boolean;
      banPreset?: string;
    };

    // ── Validate admin action (resolve / dismiss / review) ──────────────
    if (!isReportAction(body.action)) {
      throw new ValidationError(
        `action không hợp lệ. Cho phép: ${REPORT_ACTIONS.join(", ")}`,
        "INVALID_REPORT_ACTION"
      );
    }

    const report = await ReportModel.findById(reportId)
      .select("_id status reporterId targetType targetId moderationSnapshot")
      .lean();
    if (!report) {
      throw new NotFoundError(`Không tìm thấy báo cáo với ID: ${reportId}`);
    }

    const note =
      typeof body.note === "string" ? body.note.slice(0, 500) : undefined;
    const warnAuthor = body.warnAuthor === true;

    // ── banPreset validation ─────────────────────────────────────────────
    // Bắt buộc khi action = "resolve" && modAction = "ban_temp"
    let banPreset: BanPreset | undefined;
    if (
      body.action === "resolve" &&
      body.modAction === ModerationAction.BAN_TEMP
    ) {
      if (
        !body.banPreset ||
        !VALID_BAN_PRESETS.includes(body.banPreset as BanPreset)
      ) {
        throw new ValidationError(
          `banPreset không hợp lệ. Cho phép: ${VALID_BAN_PRESETS.join(", ")}`,
          "INVALID_BAN_PRESET"
        );
      }
      banPreset = body.banPreset as BanPreset;
    }

    const adminId = getAdminActorId(req);
    const adminOid = new Types.ObjectId(adminId);
    const now = new Date();

    // ── MODERATION ACTION validation ───────────────────────────────────
    const VALID_MOD_ACTIONS: string[] = Object.values(ModerationAction);
    const modAction = (body.modAction ??
      ModerationAction.DISMISS) as ModerationAction;

    if (!VALID_MOD_ACTIONS.includes(modAction)) {
      throw new ValidationError(
        `modAction không hợp lệ. Cho phép: ${VALID_MOD_ACTIONS.join(", ")}`,
        "INVALID_MODERATION_ACTION"
      );
    }

    // ──────────────────────────────────────────────────────────────────
    // RESOLVE: xử lý target theo modAction + auto-resolve cùng target
    // ──────────────────────────────────────────────────────────────────
    let modResult: ApplyModResult = {
      suggestBan: false,
      bannedUntil: null,
      banPreset: null,
      suggestion: null,
    };
    if (body.action === "resolve") {
      modResult = await applyModerationAction(
        report,
        modAction,
        warnAuthor,
        banPreset,
        adminOid,
        now,
        note
      );

      // Auto-resolve các report khác cùng target đang pending/reviewing
      const related = await ReportModel.find({
        _id: { $ne: report._id },
        targetType: report.targetType,
        targetId: report.targetId,
        status: { $in: [ReportStatus.PENDING, ReportStatus.REVIEWING] },
      })
        .select("_id")
        .lean();

      if (related.length > 0) {
        await ReportModel.updateMany(
          { _id: { $in: related.map((r) => r._id) } },
          {
            $set: {
              status: ReportStatus.RESOLVED,
              resolutionNote: "Tự động đóng do vi phạm đã được xác nhận",
              actionTaken: ModerationAction.AUTO_RESOLVED,
              reviewedBy: adminOid,
              reviewedAt: now,
            },
          }
        );
      }
    }

    // ── Cập nhật report hiện tại ─────────────────────────────────────
    const payloadMap: Record<string, Record<string, unknown>> = {
      review: { status: ReportStatus.REVIEWING },
      resolve: {
        status: ReportStatus.RESOLVED,
        resolutionNote: note,
        actionTaken: modAction,
        warnAuthor,
        banPreset: banPreset ?? null,
        reviewedBy: adminOid,
        reviewedAt: now,
      },
      dismiss: {
        status: ReportStatus.DISMISSED,
        resolutionNote: note,
        actionTaken: ModerationAction.DISMISS,
        reviewedBy: adminOid,
        reviewedAt: now,
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
      severity:
        body.action === "resolve" ? LogSeverity.WARNING : LogSeverity.INFO,
      targetType: LogTargetType.REPORT,
      targetId: reportId,
      affectedUserId: report.reporterId,
      before: { status: report.status, actionTaken: report.actionTaken },
      after: { status: updated.status, actionTaken: updated.actionTaken },
      note,
    });

    const payload = await buildAdminReportPayload(updated as never);
    sendSuccess(
      res,
      {
        ...payload,
        suggestBan: modResult.suggestBan,
        bannedUntil: modResult.bannedUntil,
        banPreset: modResult.banPreset,
        suggestion: modResult.suggestion,
      },
      body.action === "resolve"
        ? "Đã xử lý và đóng báo cáo"
        : body.action === "dismiss"
          ? "Đã bỏ qua báo cáo"
          : "Đã chuyển sang xem xét"
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
      totalComments,
      newCommentsToday,
      flaggedPosts,
      pendingReports,
      pendingLast24h,
      activeUsers,
      blockedUsers,
    ] = await Promise.all([
      UserModel.countDocuments({}),
      UserModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      PostModel.countDocuments({}),
      PostModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      CommentModel.countDocuments({}),
      CommentModel.countDocuments({ createdAt: { $gte: startOfToday } }),
      // "reported" = posts có báo cáo đang mở (pending)
      ReportModel.distinct("targetId", {
        targetType: ReportTargetType.POST,
        status: ReportStatus.PENDING,
      }).then((ids) => PostModel.countDocuments({ _id: { $in: ids } })),
      ReportModel.countDocuments({ status: ReportStatus.PENDING }),
      ReportModel.find({
        status: ReportStatus.PENDING,
        createdAt: { $gte: since24h },
      })
        .select("reason moderationSnapshot")
        .lean(),
      UserModel.countDocuments({ isActive: true, isBlocked: false }),
      UserModel.countDocuments({ isBlocked: true }),
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
      totalComments,
      newCommentsToday,
      flaggedPosts,
      pendingReports,
      urgentReports,
      usersStats: { totalUsers, activeUsers, blockedUsers, newUsersToday },
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

    // Compute reportCount per targetId + gather targetIds for aiScore lookup
    const targetIds = rows.map((r) => r.targetId);

    const [priorityCounts, aiScoreRows] = await Promise.all([
      ReportModel.aggregate([
        { $match: { targetId: { $in: targetIds } } },
        { $group: { _id: "$targetId", count: { $sum: 1 } } },
      ]),
      ReportModel.aggregate([
        { $match: { _id: { $in: rows.map((r) => r._id) } } },
        {
          $project: {
            _id: 1,
            aiScore: {
              $max: [
                { $ifNull: ["$moderationSnapshot.scores.toxic", 0] },
                { $ifNull: ["$moderationSnapshot.scores.hateSpeech", 0] },
                { $ifNull: ["$moderationSnapshot.scores.spam", 0] },
              ],
            },
          },
        },
      ]),
    ]);

    const countMap = new Map(
      priorityCounts.map((p) => [p._id.toString(), p.count])
    );
    const scoreMap = new Map(
      aiScoreRows.map((s) => [s._id.toString(), s.aiScore])
    );

    const reports = await Promise.all(
      rows.map(async (row) => {
        const payload = await buildAdminReportPayload(row as never);
        return {
          ...payload,
          reportCount: countMap.get(row.targetId.toString()) ?? 1,
          aiScore: scoreMap.get(row._id.toString()) ?? 0,
        };
      })
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
 *
 * Body:
 * {
 *   "note":       string,
 *   "modAction":  "hide" | "delete" | "warn_author" | "ban_temp" | "ban_permanent" | "dismiss",
 *   "warnAuthor": boolean,
 *   "banPreset":  "1d" | "3d" | "7d" | "30d" (bắt buộc khi modAction = "ban_temp"),
 * }
 */
export const resolveAdminReport = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    validateObjectId(id, "Report ID");

    const body = req.body as {
      note?: string;
      modAction?: string;
      warnAuthor?: boolean;
      banPreset?: string;
    };
    const note =
      typeof body.note === "string" ? body.note.slice(0, 500) : undefined;
    const warnAuthor = body.warnAuthor === true;

    // ── banPreset validation (bắt buộc khi ban_temp) ──────────────────
    let banPreset: BanPreset | undefined;
    if (body.modAction === ModerationAction.BAN_TEMP) {
      if (
        !body.banPreset ||
        !VALID_BAN_PRESETS.includes(body.banPreset as BanPreset)
      ) {
        throw new ValidationError(
          `banPreset không hợp lệ. Cho phép: ${VALID_BAN_PRESETS.join(", ")}`,
          "INVALID_BAN_PRESET"
        );
      }
      banPreset = body.banPreset as BanPreset;
    }

    const adminId = getAdminActorId(req);
    const adminOid = new Types.ObjectId(adminId);
    const now = new Date();

    const VALID_MOD_ACTIONS: string[] = Object.values(ModerationAction);
    const modAction = (body.modAction ??
      ModerationAction.DISMISS) as ModerationAction;
    if (!VALID_MOD_ACTIONS.includes(modAction)) {
      throw new ValidationError(
        `modAction không hợp lệ. Cho phép: ${VALID_MOD_ACTIONS.join(", ")}`,
        "INVALID_MODERATION_ACTION"
      );
    }

    const report = await ReportModel.findById(id)
      .select("_id status reporterId targetType targetId moderationSnapshot")
      .lean();
    if (!report) {
      throw new NotFoundError(`Không tìm thấy báo cáo với ID: ${id}`);
    }

    // Áp dụng hành động xử lý lên target
    const modResult = await applyModerationAction(
      report,
      modAction,
      warnAuthor,
      banPreset,
      adminOid,
      now,
      note
    );

    // Auto-resolve các report cùng target
    const related = await ReportModel.find({
      _id: { $ne: report._id },
      targetType: report.targetType,
      targetId: report.targetId,
      status: { $in: [ReportStatus.PENDING, ReportStatus.REVIEWING] },
    })
      .select("_id")
      .lean();

    if (related.length > 0) {
      await ReportModel.updateMany(
        { _id: { $in: related.map((r) => r._id) } },
        {
          $set: {
            status: ReportStatus.RESOLVED,
            resolutionNote: "Tự động đóng do vi phạm đã được xác nhận",
            actionTaken: ModerationAction.AUTO_RESOLVED,
            reviewedBy: adminOid,
            reviewedAt: now,
          },
        }
      );
    }

    const updated = await ReportModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status: ReportStatus.RESOLVED,
          resolutionNote: note,
          actionTaken: modAction,
          warnAuthor,
          banPreset: banPreset ?? null,
          reviewedBy: adminOid,
          reviewedAt: now,
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
      after: { status: ReportStatus.RESOLVED, actionTaken: modAction },
      note,
    });

    const payload = await buildAdminReportPayload(updated as never);
    sendSuccess(
      res,
      {
        ...payload,
        suggestBan: modResult.suggestBan,
        bannedUntil: modResult.bannedUntil,
        banPreset: modResult.banPreset,
        suggestion: modResult.suggestion,
      },
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
    const body = req.body as { banPreset?: string; reason?: string };
    validateObjectId(id, "User ID");

    const before = await UserModel.findById(id)
      .select("isBlocked isActive isBanned bannedUntil role")
      .lean();
    if (!before) {
      throw new NotFoundError(`Không tìm thấy user với ID: ${id}`);
    }

    const VALID_PRESETS = ["1d", "3d", "7d", "30d", "permanent"];
    const banPreset = body.banPreset ?? "permanent";
    if (!VALID_PRESETS.includes(banPreset)) {
      throw new ValidationError(
        `banPreset không hợp lệ. Cho phép: ${VALID_PRESETS.join(", ")}`,
        "INVALID_BAN_PRESET"
      );
    }

    const reason =
      body.reason !== undefined
        ? typeof body.reason === "string"
          ? body.reason.slice(0, 500)
          : ""
        : undefined;

    const now = new Date();
    const PRESET_DAYS: Record<string, number> = {
      "1d": 1,
      "3d": 3,
      "7d": 7,
      "30d": 30,
    };
    const bannedUntil =
      banPreset === "permanent"
        ? null
        : new Date(
            Date.now() + (PRESET_DAYS[banPreset] ?? 7) * 24 * 60 * 60 * 1000
          );

    const adminOid = getAdminActorId(req);
    const logAction = banPreset === "permanent" ? "ban_permanent" : "ban_temp";

    const user = await UserModel.findByIdAndUpdate(
      id,
      {
        $set: {
          isBlocked: true,
          isBanned: true,
          bannedUntil,
        },
        $inc: { violationCount: 1 },
        $push: {
          violationLogs: {
            $each: [
              {
                reason: reason ?? "[MANUAL_BLOCK] Bị chặn bởi admin",
                adminId: adminOid,
                action: logAction,
                timestamp: now,
              },
            ],
            $position: 0,
            $slice: 50,
          },
        },
      },
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
      before: { isBlocked: before.isBlocked, isBanned: before.isBanned },
      after: {
        isBlocked: user.isBlocked,
        isBanned: user.isBanned,
        bannedUntil: user.bannedUntil,
      },
      note: reason,
      metadata: {
        banPreset,
        bannedUntil: bannedUntil?.toISOString() ?? null,
        reason,
      },
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
      { $set: { isBlocked: false, isBanned: false, bannedUntil: null } },
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
      before: {
        isBlocked: before.isBlocked,
        isBanned: before.isBanned,
        bannedUntil: before.bannedUntil,
      },
      after: {
        isBlocked: user.isBlocked,
        isBanned: user.isBanned,
        bannedUntil: user.bannedUntil,
      },
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

const COMMENT_ACTIONS = [
  "hide",
  "unhide",
  "approve",
  "reject",
  "delete",
] as const;
type CommentAdminAction = (typeof COMMENT_ACTIONS)[number];

function isCommentAdminAction(v: string): v is CommentAdminAction {
  return (COMMENT_ACTIONS as readonly string[]).includes(v);
}

function parseCommentModerationStatus(
  raw: string | undefined
): CommentModerationStatus | undefined {
  if (!raw) return undefined;
  if (
    Object.values(CommentModerationStatus).includes(
      raw as CommentModerationStatus
    )
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

    // Map FE status (hidden, reported) sang BE logic
    if (q.status === "hidden") {
      // FE "hidden" = rejected + violated
      filter.moderationStatus = { $in: ["rejected", "violated"] };
    } else if (q.status === "reported") {
      // FE "reported" = comments có báo cáo đang mở (pending)
      const openReportTargetIds = await ReportModel.distinct("targetId", {
        targetType: ReportTargetType.COMMENT,
        status: ReportStatus.PENDING,
      });
      filter._id = { $in: openReportTargetIds };
    } else {
      const status = parseCommentModerationStatus(q.status);
      if (status === "rejected") {
        filter.moderationStatus = { $in: ["rejected", "violated"] };
      } else if (status === "flagged") {
        const openReportTargetIds = await ReportModel.distinct("targetId", {
          targetType: ReportTargetType.COMMENT,
          status: ReportStatus.PENDING,
        });
        filter._id = { $in: openReportTargetIds };
      } else if (status) {
        filter.moderationStatus = status;
      }
    }

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
    const keywordRegex = keyword
      ? { $regex: escapeRegex(keyword), $options: "i" }
      : null;
    const keywordMatch: PipelineStage.Match["$match"] | null = keywordRegex
      ? {
          $or: [{ contentText: keywordRegex }, { "user.name": keywordRegex }],
        }
      : null;

    const aggregationPipeline: PipelineStage[] = [
      { $match: filter as PipelineStage.Match["$match"] },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
      ...(keywordMatch ? [{ $match: keywordMatch }] : []),
      {
        $facet: {
          comments: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "posts",
                localField: "postId",
                foreignField: "_id",
                as: "post",
              },
            },
            {
              $unwind: {
                path: "$post",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                contentText: 1,
                moderationStatus: 1,
                isHidden: 1,
                isEdited: 1,
                likesCount: 1,
                repliesCount: 1,
                parentCommentId: 1,
                originalCommentId: 1,
                createdAt: 1,
                updatedAt: 1,
                userId: {
                  _id: "$user._id",
                  name: "$user.name",
                  avatar: "$user.avatar",
                  email: "$user.email",
                },
                postId: {
                  _id: "$post._id",
                  contentText: "$post.contentText",
                },
              },
            },
          ],
          totalCount: [{ $count: "total" }],
        },
      },
    ];

    const [aggregationResult] =
      await CommentModel.aggregate(aggregationPipeline);
    const comments = (aggregationResult?.comments ?? []) as Array<{
      _id: Types.ObjectId;
      contentText: string;
      moderationStatus: CommentModerationStatus;
      isHidden: boolean;
      isEdited: boolean;
      likesCount: number;
      repliesCount: number;
      parentCommentId?: Types.ObjectId | null;
      originalCommentId?: Types.ObjectId | null;
      createdAt: Date;
      updatedAt: Date;
      userId?: {
        _id?: Types.ObjectId;
        name?: string;
        avatar?: string;
        email?: string;
      } | null;
      postId?: {
        _id?: Types.ObjectId;
        contentText?: string;
      } | null;
    }>;
    const total =
      (aggregationResult?.totalCount?.[0]?.total as number | undefined) ?? 0;

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
            : (actor?.name ?? "Admin"),
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
    if (status === "rejected") {
      // FE "hidden" = rejected + violated (cả từ báo cáo lẫn thao tác trực tiếp)
      filter.moderationStatus = { $in: ["rejected", "violated"] };
    } else if (status === "flagged") {
      // FE "reported" = posts có báo cáo đang mở (pending), bất kể moderationStatus gì
      const openReportTargetIds = await ReportModel.distinct("targetId", {
        targetType: ReportTargetType.POST,
        status: ReportStatus.PENDING,
      });
      filter._id = { $in: openReportTargetIds };
    } else if (status) {
      filter.moderationStatus = status;
    }

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
