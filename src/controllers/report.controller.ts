// src/controllers/report.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/async-handler";
import { sendCreated, sendPaginated, sendSuccess } from "../utils/response";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../errors";
import {
  ReportModel,
  ReportTargetType,
  ReportReason,
  ReportStatus,
} from "../models/report.model";
import { PostModel } from "../models/post.model";
import { CommentModel } from "../models/comment.model";
import { UserModel } from "../models/user.model";
import { ModerationService } from "../services/moderation/moderation.service";
import type {
  ModerationResult,
  AIScoreResult,
} from "../services/moderation/moderation.service";
import { PostMediaModel } from "../models/post-media.model"; // 👈 thêm
import { validateObjectId } from "../utils/validators";
import { ReportService } from "../services/report.service";

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

const USER_REPORT_REASONS = [
  "spam", // Spam, quảng cáo
  "harassment", // Quấy rối, bắt nạt
  "hate_speech", // Phát ngôn thù ghét
  "fake_account", // Tài khoản giả mạo
  "impersonation", // Mạo danh người khác
  "inappropriate_content", // Nội dung không phù hợp
  "nudity", // Nội dung khỏa thân
  "violence", // Bạo lực
  "scam_fraud", // Lừa đảo
  "misinformation", // Thông tin sai lệch
  "copyright", // Vi phạm bản quyền
  "underage_user", // Người dùng dưới độ tuổi quy định
  "self_harm", // Khuyến khích tự gây hại
  "illegal_activity", // Hoạt động bất hợp pháp
  "privacy_violation", // Tiết lộ thông tin cá nhân
  "other",
] as const;

type UserReportReason = (typeof USER_REPORT_REASONS)[number];

function isUserReportReason(v: string): v is UserReportReason {
  return USER_REPORT_REASONS.includes(v as UserReportReason);
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

// export const createReport = asyncHandler(
//   async (req: Request, res: Response) => {
//     const userId = getUserId(req);
//     const body = req.body as {
//       entityType?: string;
//       entityId?: string;
//       reason?: string;
//       description?: string;
//     };

//     const {
//       entityType: rawType,
//       entityId,
//       reason: rawReason,
//       description,
//     } = body;

//     if (!rawType || !isReportEntityType(rawType)) {
//       throw new ValidationError(
//         "entityType phải là 'post' hoặc 'comment'",
//         "INVALID_ENTITY_TYPE"
//       );
//     }

//     if (!entityId || !Types.ObjectId.isValid(String(entityId))) {
//       throw new ValidationError("entityId không hợp lệ", "INVALID_ENTITY_ID");
//     }

//     if (!rawReason || !isReportReason(rawReason)) {
//       throw new ValidationError(
//         `reason không hợp lệ. Cho phép: ${Object.values(ReportReason).join(", ")}`,
//         "INVALID_REPORT_REASON"
//       );
//     }

//     const reason = rawReason;
//     const targetType = toTargetType(rawType);
//     const oid = new Types.ObjectId(String(entityId));

//     let ownerUserId: string;
//     let contentText = "";
//     let existingAiScore: number | undefined;

//     if (rawType === "post") {
//       const post = await PostModel.findById(oid)
//         .select("userId contentText aiToxicScore")
//         .lean();
//       if (!post) {
//         throw new NotFoundError("Không tìm thấy bài viết");
//       }
//       ownerUserId = post.userId.toString();
//       contentText = post.contentText ?? "";
//       existingAiScore = post.aiToxicScore;
//     } else {
//       const comment = await CommentModel.findById(oid)
//         .select("userId contentText aiToxicScore")
//         .lean();
//       if (!comment) {
//         throw new NotFoundError("Không tìm thấy bình luận");
//       }
//       ownerUserId = comment.userId.toString();
//       contentText = comment.contentText ?? "";
//       existingAiScore = comment.aiToxicScore;
//     }

//     if (ownerUserId === userId) {
//       throw new ValidationError(
//         "Không thể báo cáo nội dung của chính bạn",
//         "SELF_REPORT"
//       );
//     }

//     const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
//     const duplicate = await ReportModel.findOne({
//       reporterId: userId,
//       targetType,
//       targetId: oid,
//       createdAt: { $gte: since24h },
//     }).lean();

//     if (duplicate) {
//       throw new ValidationError("Bạn đã báo cáo nội dung này rồi");
//     }

//     // Đếm số report hiện tại (trước khi tạo report mới)
//     const reportCount = await ReportModel.countDocuments({
//       targetType,
//       targetId: oid,
//     });

//     const report = await ReportModel.create({
//       reporterId: userId,
//       targetType,
//       targetId: oid,
//       reason,
//       description: description ? String(description).slice(0, 2000) : "",
//       status: ReportStatus.PENDING,
//     });

//     // Trả response ngay, không block
//     sendCreated(
//       res,
//       { id: report._id.toString(), status: report.status },
//       "Báo cáo đã được ghi nhận"
//     );

//     // Chỉ gọi AI nếu: chưa có AI scores, hoặc đạt mốc report
//     const REANALYZE_THRESHOLDS = [1, 5, 10, 20];
//     const shouldReanalyze =
//       existingAiScore == null || REANALYZE_THRESHOLDS.includes(reportCount + 1);

//     if (contentText.trim() && shouldReanalyze) {
//       void (async () => {
//         try {
//           const updatedDoc = await ModerationService.moderateAndUpdate(
//             rawType,
//             oid.toString(),
//             contentText,
//             { reportCount: reportCount + 1 }
//           );

//           const scores: AIScoreResult = {
//             toxic: updatedDoc.aiToxicScore ?? 0,
//             hateSpeech: updatedDoc.aiHateSpeechScore ?? 0,
//             spam: updatedDoc.aiSpamScore ?? 0,
//             reason: updatedDoc.hiddenReason ?? "ok",
//           };
//           const risk = Math.max(scores.toxic, scores.hateSpeech, scores.spam);
//           const moderationSnapshot: ModerationResult = {
//             status: updatedDoc.moderationStatus,
//             isHidden: updatedDoc.isHidden ?? false,
//             scores,
//             action:
//               risk >= 0.8 ? "auto_hide" : risk >= 0.5 ? "review" : "approve",
//             method: updatedDoc.aiOverallRisk != null ? "ai" : "rule",
//           };

//           await ReportModel.findByIdAndUpdate(report._id, {
//             $set: { moderationSnapshot },
//           });
//         } catch (err) {
//           console.error("[Report] moderateAndUpdate failed:", err);
//         }
//       })();
//     }

//     // Fire-and-forget: image moderation — chỉ khi report đầu tiên
//     if (rawType === "post" && reportCount === 0) {
//       void (async () => {
//         try {
//           const mediaList = await PostMediaModel.find({
//             postId: oid,
//             mediaType: { $in: ["image", "video"] },
//           }).lean();

//           for (const media of mediaList) {
//             const scanUrl =
//               media.mediaType === "image" ? media.mediaUrl : media.thumbnailUrl;
//             if (!scanUrl) continue;

//             void ModerationService.moderateImage(scanUrl, oid.toString(), {
//               reportCount: 1,
//             }).catch((err) =>
//               console.error("[Image Moderation] Report-trigger error:", err)
//             );
//           }
//         } catch (err) {
//           console.error("[Report] image moderation failed:", err);
//         }
//       })();
//     }
//   }
// );

// src/controllers/report.controller.ts (hàm createReport)

export const createReport = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const body = req.body as {
      entityType?: string;
      entityId?: string;
      reason?: string;
      description?: string;
    };

    const {
      entityType: rawType,
      entityId,
      reason: rawReason,
      description,
    } = body;

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
    let existingAiScore: number | undefined;

    if (rawType === "post") {
      const post = await PostModel.findById(oid)
        .select("userId contentText aiToxicScore")
        .lean();
      if (!post) {
        throw new NotFoundError("Không tìm thấy bài viết");
      }
      ownerUserId = post.userId.toString();
      contentText = post.contentText ?? "";
      existingAiScore = post.aiToxicScore;
    } else {
      const comment = await CommentModel.findById(oid)
        .select("userId contentText aiToxicScore")
        .lean();
      if (!comment) {
        throw new NotFoundError("Không tìm thấy bình luận");
      }
      ownerUserId = comment.userId.toString();
      contentText = comment.contentText ?? "";
      existingAiScore = comment.aiToxicScore;
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

    // Đếm số report hiện tại (trước khi tạo report mới)
    const reportCount = await ReportModel.countDocuments({
      targetType,
      targetId: oid,
    });

    const report = await ReportModel.create({
      reporterId: userId,
      targetType,
      targetId: oid,
      reason,
      description: description ? String(description).slice(0, 2000) : "",
      status: ReportStatus.PENDING,
    });

    // Trả response ngay, không block
    sendCreated(
      res,
      { id: report._id.toString(), status: report.status },
      "Báo cáo đã được ghi nhận"
    );

    const reportIdStr = report._id.toString();

    // FIX: Chỉ gọi AI text nếu content thực sự có chữ (>= 5 ký tự)
    // Tránh gọi AI với content rỗng rồi overwrite scores từ image moderation
    const REANALYZE_THRESHOLDS = [1, 5, 10, 20];
    const shouldReanalyze =
      existingAiScore == null || REANALYZE_THRESHOLDS.includes(reportCount + 1);
    const hasRealContent = contentText.trim().length >= 5;

    if (hasRealContent && shouldReanalyze) {
      void (async () => {
        try {
          const updatedDoc = await ModerationService.moderateAndUpdate(
            rawType,
            oid.toString(),
            contentText,
            { reportCount: reportCount + 1 }
          );

          const scores: AIScoreResult = {
            toxic: updatedDoc.aiToxicScore ?? 0,
            hateSpeech: updatedDoc.aiHateSpeechScore ?? 0,
            spam: updatedDoc.aiSpamScore ?? 0,
            reason: updatedDoc.hiddenReason ?? "ok",
          };
          const risk = Math.max(scores.toxic, scores.hateSpeech, scores.spam);
          const moderationSnapshot: ModerationResult = {
            status: updatedDoc.moderationStatus,
            isHidden: updatedDoc.isHidden ?? false,
            scores,
            action:
              risk >= 0.8 ? "auto_hide" : risk >= 0.5 ? "review" : "approve",
            method: updatedDoc.aiOverallRisk != null ? "ai" : "rule",
          };

          await ReportModel.findByIdAndUpdate(report._id, {
            $set: { moderationSnapshot },
          });
        } catch (err) {
          console.error("[Report] moderateAndUpdate failed:", err);
        }
      })();
    }

    // Fire-and-forget: image/video moderation — chỉ khi report đầu tiên
    if (rawType === "post" && reportCount === 0) {
      void (async () => {
        try {
          const mediaList = await PostMediaModel.find({
            postId: oid,
            mediaType: { $in: ["image", "video"] },
          }).lean();

          for (const media of mediaList) {
            if (media.mediaType === "image") {
              // FIX: truyền reportIdStr để moderateImage cập nhật đúng report
              void ModerationService.moderateImage(
                media.mediaUrl,
                oid.toString(),
                { reportCount: 1 },
                reportIdStr
              ).catch((err) =>
                console.error("[Image Moderation] Report-trigger error:", err)
              );
            } else if (media.mediaType === "video") {
              const scanUrl = media.thumbnailUrl;
              if (!scanUrl) continue;

              // FIX: truyền reportIdStr để moderateVideo cập nhật đúng report
              void ModerationService.moderateImage(
                scanUrl,
                oid.toString(),
                { reportCount: 1 },
                reportIdStr
              ).catch((err) =>
                console.error("[Video Moderation] Report-trigger error:", err)
              );
            }
          }
        } catch (err) {
          console.error("[Report] media moderation failed:", err);
        }
      })();
    }
  }
);

/**
 * @route   GET /api/reports/my
 * @query   page (default 1), limit (default 10)
 * @access  Private
 */
export const getMyReports = asyncHandler(
  async (req: Request, res: Response) => {
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
  }
);

/**
 * @route   GET /api/reports/related/:userId
 * @desc    Báo cáo liên quan bài viết của user
 * @access  Private
 */
export const getReportsByUser = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params as { userId: string };
    const { page: pageStr, limit: limitStr } = req.query as Record<
      string,
      string
    >;

    validateObjectId(userId, "User ID");

    const page = parseInt(pageStr, 10) || 1;
    const limit = parseInt(limitStr, 10) || 10;

    if (page < 1) throw new ValidationError("Số trang phải lớn hơn 0");
    if (limit < 1 || limit > 20) {
      throw new ValidationError("Limit phải từ 1 đến 20");
    }

    const { items, pagination } = await ReportService.getReportsByUser(
      userId,
      page,
      limit
    );

    sendPaginated(res, items, pagination);
  }
);

/**
 * @route   POST /api/users/:userId/report
 * @desc    User báo cáo user khác
 * @access  Private
 */
export const reportUser = asyncHandler(async (req: Request, res: Response) => {
  const reporterId = getUserId(req);
  const { userId } = req.params as { userId: string };
  const { reason, description } = req.body as {
    reason?: string;
    description?: string;
  };

  validateObjectId(userId, "User ID");

  if (userId === reporterId) {
    throw new ValidationError("Không thể tự báo cáo chính mình", "SELF_REPORT");
  }

  const targetUser = await UserModel.findById(userId).lean();
  if (!targetUser) {
    throw new NotFoundError("Không tìm thấy người dùng");
  }

  if (!reason || !isUserReportReason(reason)) {
    throw new ValidationError(
      `reason không hợp lệ. Cho phép: ${USER_REPORT_REASONS.join(", ")}`,
      "INVALID_REASON"
    );
  }

  if (description !== undefined && description.length > 500) {
    throw new ValidationError(
      "Mô tả không được vượt quá 500 ký tự",
      "DESCRIPTION_TOO_LONG"
    );
  }

  const existing = await ReportModel.findOne({
    reporterId,
    targetId: new Types.ObjectId(userId),
    targetType: ReportTargetType.USER,
  }).lean();

  if (existing) {
    throw new ConflictError("Bạn đã báo cáo người dùng này rồi");
  }

  await ReportModel.create({
    reporterId,
    targetId: new Types.ObjectId(userId),
    targetType: ReportTargetType.USER,
    reason,
    description: description ? String(description).slice(0, 500) : "",
    status: ReportStatus.PENDING,
  });

  sendCreated(res, null, "Đã gửi báo cáo thành công");
});
