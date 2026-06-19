// src/services/moderation/moderation.service.ts

import { Types } from "mongoose";
import { ModerationStatus, PostModel } from "../../models/post.model";
import {
  CommentModel,
  CommentModerationStatus,
} from "../../models/comment.model";
import { ReportModel } from "../../models/report.model";
import { NotFoundError } from "../../errors";
import { RuleBasedService } from "./rule-based.service";
import type { RuleCheckResult } from "./rule-based.service";
import { AIApiService, type AIScoreResult } from "./ai-api.service";

export type { AIScoreResult } from "./ai-api.service";

export interface ModerationContext {
  reportCount?: number;
  isNewAccount?: boolean;
}

export interface ModerationResult {
  status: ModerationStatus;
  isHidden: boolean;
  scores: AIScoreResult;
  action: string;
  method: string;
}

export const AUTO_HIDE = 0.8;
export const REVIEW = 0.5;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function maxScore(s: AIScoreResult): number {
  return Math.max(s.toxic, s.hateSpeech, s.spam);
}

function scoresFromRule(rule: RuleCheckResult): AIScoreResult {
  const t = rule.violationType;
  const base = rule.score;
  return {
    toxic:
      t === "profanity" || t === "too_short"
        ? base
        : t === "hate_speech"
          ? base * 0.9
          : base * 0.4,
    hateSpeech: t === "hate_speech" ? base : 0,
    spam:
      t === "spam" || t === "spam_soft"
        ? base
        : t === "profanity"
          ? 0
          : base * 0.3,
    reason: rule.reason ?? "rule",
  };
}

function decideFromAiScores(
  scores: AIScoreResult
): Pick<ModerationResult, "status" | "isHidden" | "action"> {
  if (scores.needsManualReview) {
    return {
      status: ModerationStatus.FLAGGED,
      isHidden: false,
      action: "manual_review_ai_failed",
    };
  }

  const m = maxScore(scores);
  if (m >= AUTO_HIDE) {
    return {
      status: ModerationStatus.REJECTED,
      isHidden: true,
      action: "auto_hide",
    };
  }
  if (m >= REVIEW) {
    return {
      status: ModerationStatus.FLAGGED,
      isHidden: false,
      action: "review",
    };
  }
  return {
    status: ModerationStatus.APPROVED,
    isHidden: false,
    action: "approve",
  };
}

function shouldCallAI(
  rule: RuleCheckResult,
  context: ModerationContext
): boolean {
  if (rule.needsAICheck) return true;
  if ((context.reportCount ?? 0) > 0) return true;
  if (context.isNewAccount === true) return true;
  if (Math.random() < 0.05) return true;
  return false;
}

function toCommentModerationStatus(
  s: ModerationStatus
): CommentModerationStatus {
  const map: Record<ModerationStatus, CommentModerationStatus> = {
    [ModerationStatus.PENDING]: CommentModerationStatus.PENDING,
    [ModerationStatus.APPROVED]: CommentModerationStatus.APPROVED,
    [ModerationStatus.REJECTED]: CommentModerationStatus.REJECTED,
    [ModerationStatus.FLAGGED]: CommentModerationStatus.FLAGGED,
    [ModerationStatus.VIOLATED]: CommentModerationStatus.VIOLATED,
  };
  return map[s];
}

async function updateReportSnapshot(
  postId: string,
  reportId: string | undefined,
  scores: AIScoreResult,
  status: ModerationStatus,
  isHidden: boolean,
  action: string
): Promise<void> {
  const reportFilter = reportId
    ? { _id: reportId }
    : { targetId: postId, targetType: "post" };
  const sortOpt = reportId ? undefined : { createdAt: -1 as const };

  await ReportModel.findOneAndUpdate(
    reportFilter,
    {
      $set: {
        moderationSnapshot: {
          status,
          isHidden,
          scores,
          action,
          method: "ai",
        },
      },
    },
    sortOpt ? { sort: sortOpt } : {}
  );
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

export const ModerationService = {
  /**
   * TẦNG 1 → 2 → 3: Rule-based → AI → Approve
   */
  async moderateContent(
    text: string,
    context?: ModerationContext
  ): Promise<ModerationResult> {
    const ctx: ModerationContext = context ?? {};
    const rule = RuleBasedService.checkContent(text);

    // TẦNG 1: Rule-based bắt vi phạm rõ ràng → chặn ngay
    if (rule.isClearViolation) {
      return {
        status: ModerationStatus.REJECTED,
        isHidden: true,
        scores: scoresFromRule(rule),
        action: "block_rule",
        method: "rule",
      };
    }

    // TẦNG 2: Vùng nghi vấn hoặc acc mới → gọi AI
    if (shouldCallAI(rule, ctx)) {
      const aiScores = await AIApiService.analyzeContent(text);

      const combinedScores: AIScoreResult = {
        toxic: Math.max(aiScores.toxic, rule.score * 0.35),
        hateSpeech: Math.max(
          aiScores.hateSpeech,
          rule.score > 0 ? rule.score * 0.3 : 0
        ),
        spam: Math.max(aiScores.spam, rule.score),
        reason: aiScores.reason || rule.reason || "combined",
      };

      const decided = decideFromAiScores(combinedScores);
      return { ...decided, scores: combinedScores, method: "ai" };
    }

    // TẦNG 3: Sạch → duyệt ngay
    return {
      status: ModerationStatus.APPROVED,
      isHidden: false,
      scores: {
        toxic: rule.score * 0.3,
        hateSpeech: 0,
        spam: rule.score * 0.7,
        reason: "fast_approve",
      },
      action: "approve",
      method: "rule",
    };
  },

  /**
   * Kiểm duyệt text và cập nhật DB
   */
  async moderateAndUpdate(
    entityType: "post" | "comment",
    entityId: string,
    text: string,
    context?: ModerationContext
  ): Promise<any> {
    if (!Types.ObjectId.isValid(entityId)) {
      throw new NotFoundError("Không tìm thấy nội dung");
    }

    const result = await ModerationService.moderateContent(text, context);
    const risk = maxScore(result.scores);

    if (entityType === "post") {
      const update: Record<string, unknown> = {
        $max: {
          aiToxicScore: result.scores.toxic,
          aiHateSpeechScore: result.scores.hateSpeech,
          aiSpamScore: result.scores.spam,
          aiOverallRisk: risk,
        },
        $set: {
          moderationStatus: result.status,
          isHidden: result.isHidden,
        },
      };

      if (result.isHidden || result.status === ModerationStatus.REJECTED) {
        (update.$set as Record<string, unknown>).hiddenReason =
          result.scores.reason.slice(0, 500);
      }

      const updated = await PostModel.findByIdAndUpdate(entityId, update, {
        returnDocument: "after",
      }).lean();

      if (!updated) throw new NotFoundError("Không tìm thấy bài viết");
      return updated;
    }

    // Comment
    const update: Record<string, unknown> = {
      moderationStatus: toCommentModerationStatus(result.status),
      isHidden: result.isHidden,
      aiToxicScore: result.scores.toxic,
      aiHateSpeechScore: result.scores.hateSpeech,
      aiSpamScore: result.scores.spam,
    };
    if (result.isHidden || result.status === ModerationStatus.REJECTED) {
      update.hiddenReason = result.scores.reason.slice(0, 500);
    }

    const updated = await CommentModel.findByIdAndUpdate(entityId, update, {
      returnDocument: "after",
    }).lean();

    if (!updated) throw new NotFoundError("Không tìm thấy bình luận");
    return updated;
  },

  /**
   * Kiểm duyệt NHIỀU ảnh trong 1 request Gemini duy nhất.
   * Dùng thay cho nhiều lần gọi moderateImage() khi post có nhiều ảnh.
   * - Không có race condition vì chỉ có 1 lần write DB
   * - violatingIndex cho biết ảnh nào vi phạm (index trong mảng imageUrls gốc)
   */
  async moderateImages(
    imageUrls: string[],
    postId: string,
    context?: ModerationContext,
    reportId?: string
  ): Promise<void> {
    try {
      if (!imageUrls.length) return;

      console.log(
        `🖼️ [Image Moderation Batch] Start: ${imageUrls.length} images for post ${postId}`
      );

      const shouldScan =
        (context?.reportCount ?? 0) > 0 ||
        context?.isNewAccount === true ||
        Math.random() < 0.05;

      if (!shouldScan) {
        console.log("⏭️ [Image Moderation Batch] Skipped (not in scan window)");
        await PostModel.findByIdAndUpdate(postId, {
          $set: { moderationStatus: ModerationStatus.APPROVED },
        });
        return;
      }

      console.log("🔍 [Image Moderation Batch] Scanning...");
      const scores = await AIApiService.analyzeImages(imageUrls);
      const risk = maxScore(scores);
      const { status, isHidden, action } = decideFromAiScores(scores);

      if (
        scores.violatingIndex !== null &&
        scores.violatingIndex !== undefined
      ) {
        console.log(
          `🚨 [Image Moderation Batch] Violating image index: ${scores.violatingIndex} (${imageUrls[scores.violatingIndex]})`
        );
      }

      console.log(
        `✅ [Image Moderation Batch] Done. Status: ${status}, Risk: ${risk.toFixed(2)}, Hidden: ${isHidden}`
      );

      await PostModel.findByIdAndUpdate(postId, {
        $max: {
          aiToxicScore: scores.toxic,
          aiHateSpeechScore: scores.hateSpeech,
          aiSpamScore: scores.spam,
          aiOverallRisk: risk,
        },
        $set: {
          moderationStatus: status,
          isHidden,
          ...(isHidden && { hiddenReason: scores.reason.slice(0, 500) }),
        },
      });

      if (isHidden || risk >= REVIEW) {
        await updateReportSnapshot(
          postId,
          reportId,
          scores,
          status,
          isHidden,
          action
        );
      }
    } catch (error) {
      console.error("🖼️ [Image Moderation Batch Error]:", error);
    }
  },

  /**
   * Kiểm duyệt ảnh đơn lẻ (dùng khi chỉ có 1 ảnh hoặc animated GIF).
   * Nếu post có nhiều ảnh, dùng moderateImages() thay thế.
   */
  async moderateImage(
    imageUrl: string,
    postId: string,
    context?: ModerationContext,
    reportId?: string
  ): Promise<void> {
    try {
      console.log("🖼️ [Image Moderation] Start:", imageUrl);

      const shouldScan =
        (context?.reportCount ?? 0) > 0 ||
        context?.isNewAccount === true ||
        Math.random() < 0.05;

      if (!shouldScan) {
        console.log("⏭️ [Image Moderation] Skipped (not in scan window)");
        await PostModel.findByIdAndUpdate(postId, {
          $set: { moderationStatus: ModerationStatus.APPROVED },
        });
        return;
      }

      console.log("🔍 [Image Moderation] Scanning...");
      const scores = await AIApiService.analyzeImage(imageUrl);
      const risk = maxScore(scores);
      const { status, isHidden, action } = decideFromAiScores(scores);

      console.log(
        `✅ [Image Moderation] Done. Status: ${status}, Risk: ${risk.toFixed(2)}, Hidden: ${isHidden}`
      );

      await PostModel.findByIdAndUpdate(postId, {
        $max: {
          aiToxicScore: scores.toxic,
          aiHateSpeechScore: scores.hateSpeech,
          aiSpamScore: scores.spam,
          aiOverallRisk: risk,
        },
        $set: {
          moderationStatus: status,
          isHidden,
          ...(isHidden && { hiddenReason: scores.reason.slice(0, 500) }),
        },
      });

      if (isHidden || risk >= REVIEW) {
        await updateReportSnapshot(
          postId,
          reportId,
          scores,
          status,
          isHidden,
          action
        );
      }
    } catch (error) {
      console.error("🖼️ [Image Moderation Error]:", error);
    }
  },

  /**
   * Kiểm duyệt video bất đồng bộ và cập nhật DB.
   * Video lớn sẽ bị skip (> 50MB) — xử lý trong AIApiService.
   */
  async moderateVideo(
    videoUrl: string,
    postId: string,
    context?: ModerationContext,
    reportId?: string
  ): Promise<void> {
    try {
      const shouldScan =
        (context?.reportCount ?? 0) > 0 ||
        context?.isNewAccount === true ||
        Math.random() < 0.1;

      if (!shouldScan) {
        console.log("⏭️ [Video Moderation] Skipped (not in scan window)");
        await PostModel.findByIdAndUpdate(postId, {
          $set: { moderationStatus: ModerationStatus.APPROVED },
        });
        return;
      }

      console.log("🎬 [Video Moderation] Scanning:", videoUrl);
      const scores = await AIApiService.analyzeVideo(videoUrl);
      const risk = maxScore(scores);
      const { status, isHidden, action } = decideFromAiScores(scores);

      await PostModel.findByIdAndUpdate(postId, {
        $max: {
          aiToxicScore: scores.toxic,
          aiHateSpeechScore: scores.hateSpeech,
          aiSpamScore: scores.spam,
          aiOverallRisk: risk,
        },
        $set: {
          moderationStatus: status,
          isHidden,
          ...(isHidden && { hiddenReason: scores.reason.slice(0, 500) }),
        },
      });

      if (isHidden || risk >= REVIEW) {
        await updateReportSnapshot(
          postId,
          reportId,
          scores,
          status,
          isHidden,
          action
        );
      }

      console.log("✅ [Video Moderation] Done. Status:", status);
    } catch (error) {
      console.error("🎬 [Video Moderation Error]:", error);
    }
  },
};
