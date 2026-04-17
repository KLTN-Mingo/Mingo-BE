// src/services/log.service.ts
import { Types } from "mongoose";
import {
  LogModel,
  LogAction,
  LogActorRole,
  LogSeverity,
  LogTargetType,
  type ILog,
} from "../models/log.model";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CreateLogInput {
  actorId?: Types.ObjectId | string;
  actorRole: LogActorRole;
  action: LogAction;
  severity?: LogSeverity;
  targetType?: LogTargetType;
  targetId?: Types.ObjectId | string;
  affectedUserId?: Types.ObjectId | string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  note?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

interface QueryLogFilter {
  actorId?: string;
  actorRole?: LogActorRole;
  action?: LogAction;
  severity?: LogSeverity;
  targetType?: LogTargetType;
  targetId?: string;
  affectedUserId?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

export class LogService {
  /**
   * Tạo một log entry.
   * Dùng fire-and-forget trong hầu hết trường hợp (không await để không block request).
   */
  static async create(input: CreateLogInput): Promise<void> {
    try {
      await LogModel.create(input);
    } catch (err) {
      // Log lỗi ra console nhưng KHÔNG throw — không để lỗi log làm chết request chính
      console.error("[LogService] Failed to write log:", err);
    }
  }

  // ─── Shortcut helpers ────────────────────────────────────────────────────

  /** Log hành động admin (block user, resolve report, hide post…) */
  static adminAction(
    adminId: Types.ObjectId | string,
    action: LogAction,
    opts: Omit<CreateLogInput, "actorId" | "actorRole" | "action">
  ) {
    return LogService.create({
      actorId: adminId,
      actorRole: LogActorRole.ADMIN,
      action,
      severity: opts.severity ?? LogSeverity.WARNING,
      ...opts,
    });
  }

  /** Log hành động người dùng (login, post, comment, like…) */
  static userAction(
    userId: Types.ObjectId | string,
    action: LogAction,
    opts: Omit<CreateLogInput, "actorId" | "actorRole" | "action">
  ) {
    return LogService.create({
      actorId: userId,
      actorRole: LogActorRole.USER,
      action,
      severity: opts.severity ?? LogSeverity.INFO,
      ...opts,
    });
  }

  /** Log hành động hệ thống (auto-flag, auto-block…) */
  static systemAction(
    action: LogAction,
    opts: Omit<CreateLogInput, "actorId" | "actorRole" | "action">
  ) {
    return LogService.create({
      actorRole: LogActorRole.SYSTEM,
      action,
      severity: opts.severity ?? LogSeverity.WARNING,
      ...opts,
    });
  }

  // ─── Query helpers ───────────────────────────────────────────────────────

  /** Query log với filter + phân trang */
  static async query(filter: QueryLogFilter) {
    const {
      actorId,
      actorRole,
      action,
      severity,
      targetType,
      targetId,
      affectedUserId,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    } = filter;

    const query: Record<string, unknown> = {};

    if (actorId) query.actorId = new Types.ObjectId(actorId);
    if (actorRole) query.actorRole = actorRole;
    if (action) query.action = action;
    if (severity) query.severity = severity;
    if (targetType) query.targetType = targetType;
    if (targetId) query.targetId = new Types.ObjectId(targetId);
    if (affectedUserId)
      query.affectedUserId = new Types.ObjectId(affectedUserId);

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate)
        (query.createdAt as Record<string, unknown>)["$gte"] = fromDate;
      if (toDate) (query.createdAt as Record<string, unknown>)["$lte"] = toDate;
    }

    const [data, total] = await Promise.all([
      LogModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("actorId", "name email phoneNumber role")
        .populate("affectedUserId", "name email phoneNumber")
        .lean(),
      LogModel.countDocuments(query),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Lấy toàn bộ lịch sử tác động lên một user */
  static getUserHistory(userId: string, page = 1, limit = 20) {
    return LogService.query({ affectedUserId: userId, page, limit });
  }

  /** Lấy toàn bộ lịch sử của một entity (post, comment, report…) */
  static getEntityHistory(
    targetType: LogTargetType,
    targetId: string,
    page = 1,
    limit = 20
  ) {
    return LogService.query({ targetType, targetId, page, limit });
  }

  /** Lấy toàn bộ hành động của một admin */
  static getAdminHistory(adminId: string, page = 1, limit = 20) {
    return LogService.query({
      actorId: adminId,
      actorRole: LogActorRole.ADMIN,
      page,
      limit,
    });
  }

  /** Lấy log critical/warning gần nhất cho dashboard */
  static getAlerts(limit = 50) {
    return LogModel.find({
      severity: { $in: [LogSeverity.CRITICAL, LogSeverity.WARNING] },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actorId", "name email role")
      .populate("affectedUserId", "name email")
      .lean();
  }
}

// ─────────────────────────────────────────────
// Usage examples (xoá khi production)
// ─────────────────────────────────────────────

/*
// 1. Admin block user
LogService.adminAction(adminId, LogAction.ADMIN_USER_BLOCK, {
  targetType: LogTargetType.USER,
  targetId: targetUserId,
  affectedUserId: targetUserId,
  before: { isBlocked: false },
  after:  { isBlocked: true },
  note:   "Vi phạm điều khoản lần 3",
  severity: LogSeverity.CRITICAL,
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
});

// 2. Admin approve post
LogService.adminAction(adminId, LogAction.ADMIN_POST_MOD_APPROVE, {
  targetType: LogTargetType.POST,
  targetId: postId,
  affectedUserId: post.userId,
  before: { moderationStatus: "pending" },
  after:  { moderationStatus: "approved" },
});

// 3. Admin resolve report
LogService.adminAction(adminId, LogAction.ADMIN_REPORT_RESOLVE, {
  targetType: LogTargetType.REPORT,
  targetId: reportId,
  affectedUserId: report.reporterId,
  before: { status: "reviewing" },
  after:  { status: "resolved" },
  note:   "Đã xoá post vi phạm",
  metadata: { actionTaken: "delete_post", relatedPostId: report.targetId },
});

// 4. Admin đổi role
LogService.adminAction(adminId, LogAction.ADMIN_USER_ROLE_CHANGE, {
  targetType: LogTargetType.USER,
  targetId: targetUserId,
  affectedUserId: targetUserId,
  before: { role: "user" },
  after:  { role: "admin" },
  severity: LogSeverity.CRITICAL,
});

// 5. User đăng bài
LogService.userAction(userId, LogAction.USER_POST_CREATE, {
  targetType: LogTargetType.POST,
  targetId: newPost._id,
  ipAddress: req.ip,
});

// 6. User login thất bại
LogService.userAction(userId, LogAction.USER_LOGIN_FAILED, {
  targetType: LogTargetType.AUTH,
  severity: LogSeverity.WARNING,
  metadata: { reason: "wrong_password", attempt: 3 },
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
});

// 7. System tự động flag post
LogService.systemAction(LogAction.SYSTEM_POST_AUTO_FLAGGED, {
  targetType: LogTargetType.POST,
  targetId: postId,
  affectedUserId: post.userId,
  severity: LogSeverity.WARNING,
  metadata: { aiOverallRisk: 0.92, aiToxicScore: 0.88 },
});

// 8. Query log cho dashboard
const logs = await LogService.query({
  severity: LogSeverity.CRITICAL,
  fromDate: new Date("2025-01-01"),
  page: 1,
  limit: 20,
});

// 9. Xem lịch sử user bị tác động
const userHistory = await LogService.getUserHistory(userId);

// 10. Xem lịch sử post bị xử lý
const postHistory = await LogService.getEntityHistory(LogTargetType.POST, postId);
*/
