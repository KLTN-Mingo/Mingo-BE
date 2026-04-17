// src/models/log.model.ts
import { Schema, model, Document, Types } from "mongoose";

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

/**
 * Tất cả các hành động được ghi log trong hệ thống.
 * Prefix "ADMIN_" = do admin thực hiện trên dashboard.
 * Prefix "USER_"  = do user thực hiện trên ứng dụng.
 * Prefix "SYSTEM_"= do hệ thống tự động thực hiện.
 */
export enum LogAction {
  // ── Auth ────────────────────────────────────
  USER_LOGIN = "user_login",
  USER_LOGOUT = "user_logout",
  USER_LOGIN_FAILED = "user_login_failed",
  USER_REGISTER = "user_register",
  USER_PASSWORD_CHANGE = "user_password_change",
  USER_2FA_ENABLED = "user_2fa_enabled",
  USER_2FA_DISABLED = "user_2fa_disabled",
  USER_GOOGLE_LOGIN = "user_google_login",

  // ── Admin › User management ─────────────────
  ADMIN_USER_BLOCK = "admin_user_block",
  ADMIN_USER_UNBLOCK = "admin_user_unblock",
  ADMIN_USER_ACTIVATE = "admin_user_activate",
  ADMIN_USER_DEACTIVATE = "admin_user_deactivate",
  ADMIN_USER_ROLE_CHANGE = "admin_user_role_change",
  ADMIN_USER_VERIFY = "admin_user_verify",
  ADMIN_USER_DELETE = "admin_user_delete",
  ADMIN_USER_PROFILE_UPDATE = "admin_user_profile_update",

  // ── Admin › Post management ─────────────────
  ADMIN_POST_HIDE = "admin_post_hide",
  ADMIN_POST_UNHIDE = "admin_post_unhide",
  ADMIN_POST_DELETE = "admin_post_delete",
  ADMIN_POST_MOD_APPROVE = "admin_post_mod_approve",
  ADMIN_POST_MOD_REJECT = "admin_post_mod_reject",
  ADMIN_POST_MOD_FLAG = "admin_post_mod_flag",

  // ── Admin › Comment management ──────────────
  ADMIN_COMMENT_HIDE = "admin_comment_hide",
  ADMIN_COMMENT_UNHIDE = "admin_comment_unhide",
  ADMIN_COMMENT_DELETE = "admin_comment_delete",
  ADMIN_COMMENT_MOD_APPROVE = "admin_comment_mod_approve",
  ADMIN_COMMENT_MOD_REJECT = "admin_comment_mod_reject",

  // ── Admin › Report management ───────────────
  ADMIN_REPORT_START_REVIEW = "admin_report_start_review",
  ADMIN_REPORT_RESOLVE = "admin_report_resolve",
  ADMIN_REPORT_DISMISS = "admin_report_dismiss",

  // ── User › Post ─────────────────────────────
  USER_POST_CREATE = "user_post_create",
  USER_POST_EDIT = "user_post_edit",
  USER_POST_DELETE = "user_post_delete",

  // ── User › Comment ──────────────────────────
  USER_COMMENT_CREATE = "user_comment_create",
  USER_COMMENT_EDIT = "user_comment_edit",
  USER_COMMENT_DELETE = "user_comment_delete",

  // ── User › Interaction ──────────────────────
  USER_LIKE = "user_like",
  USER_UNLIKE = "user_unlike",
  USER_SHARE = "user_share",

  // ── User › Social ───────────────────────────
  USER_FOLLOW = "user_follow",
  USER_UNFOLLOW = "user_unfollow",
  USER_FOLLOW_ACCEPT = "user_follow_accept",
  USER_FOLLOW_REJECT = "user_follow_reject",
  USER_CLOSE_FRIEND_REQUEST = "user_close_friend_request",
  USER_CLOSE_FRIEND_ACCEPT = "user_close_friend_accept",
  USER_BLOCK = "user_block",
  USER_UNBLOCK = "user_unblock",

  // ── User › Report ───────────────────────────
  USER_REPORT_CREATE = "user_report_create",

  // ── User › Profile ──────────────────────────
  USER_PROFILE_UPDATE = "user_profile_update",

  // ── System (tự động) ────────────────────────
  SYSTEM_POST_AUTO_FLAGGED = "system_post_auto_flagged",
  SYSTEM_COMMENT_AUTO_FLAGGED = "system_comment_auto_flagged",
  SYSTEM_USER_AUTO_BLOCKED = "system_user_auto_blocked",
}

/** Entity bị tác động bởi hành động */
export enum LogTargetType {
  USER = "user",
  POST = "post",
  COMMENT = "comment",
  REPORT = "report",
  LIKE = "like",
  FOLLOW = "follow",
  BLOCK = "block",
  SHARE = "share",
  AUTH = "auth", // Không có targetId cụ thể
}

/** Ai thực hiện hành động */
export enum LogActorRole {
  USER = "user",
  ADMIN = "admin",
  SYSTEM = "system",
}

/**
 * Mức độ quan trọng của log.
 * INFO     – hoạt động bình thường
 * WARNING  – đáng chú ý nhưng không nguy hiểm
 * ERROR    – lỗi nghiệp vụ (ví dụ: login thất bại nhiều lần)
 * CRITICAL – hành động nhạy cảm / vi phạm nghiêm trọng
 */
export enum LogSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

// ─────────────────────────────────────────────
// INTERFACE
// ─────────────────────────────────────────────

export interface ILog extends Document {
  _id: Types.ObjectId;

  // ── Ai thực hiện ──────────────────────────
  /** ID của người/hệ thống thực hiện hành động */
  actorId?: Types.ObjectId;
  /** Vai trò của người thực hiện tại thời điểm log */
  actorRole: LogActorRole;

  // ── Hành động ─────────────────────────────
  action: LogAction;
  severity: LogSeverity;

  // ── Đối tượng bị tác động ─────────────────
  targetType?: LogTargetType;
  /** ID của entity bị tác động (postId, commentId, userId, reportId…) */
  targetId?: Types.ObjectId;
  /**
   * Khi targetType = USER, lưu thêm userId của user bị tác động
   * để dễ filter "toàn bộ log liên quan đến user X".
   */
  affectedUserId?: Types.ObjectId;

  // ── Trạng thái trước / sau ────────────────
  /**
   * Snapshot nhỏ gọn của entity TRƯỚC khi thay đổi.
   * Ví dụ: { isBlocked: false, moderationStatus: "pending" }
   */
  before?: Record<string, unknown>;
  /**
   * Snapshot nhỏ gọn của entity SAU khi thay đổi.
   * Ví dụ: { isBlocked: true, moderationStatus: "rejected" }
   */
  after?: Record<string, unknown>;

  // ── Ghi chú / Lý do ───────────────────────
  /** Lý do / ghi chú do admin nhập khi thực hiện hành động */
  note?: string;

  // ── Thông tin kỹ thuật ────────────────────
  ipAddress?: string;
  userAgent?: string;

  // ── Metadata bổ sung (tuỳ action) ─────────
  /**
   * Dữ liệu phụ tuỳ theo từng loại action.
   * Ví dụ với ADMIN_USER_ROLE_CHANGE: { fromRole: "user", toRole: "admin" }
   * Ví dụ với USER_SHARE: { sharedTo: "feed" }
   * Ví dụ với USER_REPORT_CREATE: { reason: "spam" }
   */
  metadata?: Record<string, unknown>;

  createdAt: Date;
}

// ─────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────

const LogSchema = new Schema<ILog>(
  {
    // Actor
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      // Null khi actorRole = "system"
    },
    actorRole: {
      type: String,
      enum: Object.values(LogActorRole),
      required: true,
      index: true,
    },

    // Action
    action: {
      type: String,
      enum: Object.values(LogAction),
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(LogSeverity),
      required: true,
      default: LogSeverity.INFO,
      index: true,
    },

    // Target
    targetType: {
      type: String,
      enum: Object.values(LogTargetType),
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    affectedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // State diff
    before: {
      type: Schema.Types.Mixed,
    },
    after: {
      type: Schema.Types.Mixed,
    },

    // Note
    note: {
      type: String,
      maxlength: 1000,
      trim: true,
    },

    // Request info
    ipAddress: {
      type: String,
      maxlength: 45, // IPv6 max length
      trim: true,
    },
    userAgent: {
      type: String,
      maxlength: 512,
      trim: true,
    },

    // Extra data
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    // Log chỉ có createdAt, không cần updatedAt
    timestamps: { createdAt: true, updatedAt: false },
    // Log không bao giờ bị update sau khi tạo
    strict: true,
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────

// Dashboard admin: xem toàn bộ log mới nhất
LogSchema.index({ createdAt: -1 });

// Lọc theo severity (warning / critical trước)
LogSchema.index({ severity: 1, createdAt: -1 });

// Xem lịch sử hành động của một admin/user cụ thể
LogSchema.index({ actorId: 1, createdAt: -1 });

// Xem toàn bộ log ảnh hưởng đến một user
LogSchema.index({ affectedUserId: 1, createdAt: -1 });

// Xem lịch sử của một entity (ví dụ: post X đã bị tác động gì)
LogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

// Lọc theo loại hành động + thời gian (thống kê, audit)
LogSchema.index({ action: 1, createdAt: -1 });

// Lọc hành động admin theo actorRole
LogSchema.index({ actorRole: 1, action: 1, createdAt: -1 });

// Tìm kiếm log report theo targetId (report cụ thể)
LogSchema.index({ targetType: 1, targetId: 1, action: 1 });

// TTL index: tự động xoá log USER thông thường sau 90 ngày
// (chỉ áp dụng nếu bạn muốn — bỏ comment để bật)
// LogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────

export const LogModel = model<ILog>("Log", LogSchema);
