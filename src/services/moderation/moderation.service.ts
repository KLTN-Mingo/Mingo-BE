// src/services/moderation/moderation.service.ts

import { Types } from "mongoose";
import { ModerationStatus, PostModel } from "../../models/post.model";
import {
  CommentModel,
  CommentModerationStatus,
} from "../../models/comment.model";
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

/** Tính điểm rủi ro cao nhất từ kết quả AI */
function maxScore(s: AIScoreResult): number {
  return Math.max(s.toxic, s.hateSpeech, s.spam);
}

/** Chuyển đổi kết quả từ Rule-based sang định dạng điểm AI để đồng bộ logic */
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

/** Quyết định trạng thái dựa trên điểm số */
function decideFromAiScores(
  scores: AIScoreResult
): Pick<ModerationResult, "status" | "isHidden" | "action"> {
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

/** Kiểm tra xem nội dung này có cần gọi AI quét sâu hơn không */
function shouldCallAI(
  rule: RuleCheckResult,
  context: ModerationContext
): boolean {
  if (rule.needsAICheck) return true;
  if ((context.reportCount ?? 0) > 0) return true;
  if (context.isNewAccount === true) return true;
  // Tỷ lệ kiểm tra ngẫu nhiên 5% để đảm bảo chất lượng
  if (Math.random() < 0.05) return true;
  return false;
}

/** Map trạng thái Post sang trạng thái Comment */
function toCommentModerationStatus(
  s: ModerationStatus
): CommentModerationStatus {
  const map: Record<ModerationStatus, CommentModerationStatus> = {
    [ModerationStatus.PENDING]: CommentModerationStatus.PENDING,
    [ModerationStatus.APPROVED]: CommentModerationStatus.APPROVED,
    [ModerationStatus.REJECTED]: CommentModerationStatus.REJECTED,
    [ModerationStatus.FLAGGED]: CommentModerationStatus.FLAGGED,
  };
  return map[s];
}

export const ModerationService = {
  /**
   * Logic lõi để phân tích nội dung
   */
  // async moderateContent(
  //   text: string,
  //   context?: ModerationContext
  // ): Promise<ModerationResult> {
  //   const ctx: ModerationContext = context ?? {};
  //   const rule = RuleBasedService.checkContent(text);

  //   // 1. Nếu Rule-based xác định vi phạm rõ ràng -> Chặn luôn không cần AI
  //   if (rule.isClearViolation) {
  //     const scores = scoresFromRule(rule);
  //     return {
  //       status: ModerationStatus.REJECTED,
  //       isHidden: true,
  //       scores,
  //       action: "block_rule",
  //       method: "rule",
  //     };
  //   }

  //   // 2. Kiểm tra xem có cần AI can thiệp không (ambiguous hoặc context đặc biệt)
  //   if (shouldCallAI(rule, ctx)) {
  //     const aiScores = await AIApiService.analyzeContent(text);
  //     const decided = decideFromAiScores(aiScores);
  //     return {
  //       ...decided,
  //       scores: aiScores,
  //       method: "ai",
  //     };
  //   }

  //   // 3. Mặc định duyệt nếu vượt qua các bước trên
  //   const scores: AIScoreResult = {
  //     toxic: rule.score * 0.35,
  //     hateSpeech: 0,
  //     spam: rule.score * 0.65,
  //     reason: rule.reason ?? "rule_ok",
  //   };

  //   return {
  //     status: ModerationStatus.APPROVED,
  //     isHidden: false,
  //     scores,
  //     action: "approve",
  //     method: "rule",
  //   };
  // },
  // src/services/moderation/moderation.service.ts

  async moderateContent(
    text: string,
    context?: ModerationContext
  ): Promise<ModerationResult> {
    const ctx: ModerationContext = context ?? {};
    const rule = RuleBasedService.checkContent(text);

    // TẦNG 1: Rule-based bắt được vi phạm (Chặn ngay - Cực nhanh)
    if (rule.isClearViolation) {
      return {
        status: ModerationStatus.REJECTED,
        isHidden: true,
        scores: scoresFromRule(rule),
        action: "block_rule",
        method: "rule",
      };
    }

    // TẦNG 2: Nếu rơi vào vùng nghi vấn hoặc acc mới -> Mới gọi AI (Chậm)
    if (shouldCallAI(rule, ctx)) {
      const aiScores = await AIApiService.analyzeContent(text);
      const decided = decideFromAiScores(aiScores);
      return { ...decided, scores: aiScores, method: "ai" };
    }

    // TẦNG 3: Rule-based thấy sạch và không cần AI (Duyệt ngay - Cực nhanh)
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
   * Thực hiện kiểm duyệt và CẬP NHẬT ngay vào Database.
   * Trả về dữ liệu đã cập nhật để Controller có thể phản hồi cho Client ngay.
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
      const baseUpdate: Record<string, unknown> = {
        moderationStatus: result.status,
        isHidden: result.isHidden,
        aiToxicScore: result.scores.toxic,
        aiHateSpeechScore: result.scores.hateSpeech,
        aiSpamScore: result.scores.spam,
        aiOverallRisk: risk,
      };

      if (result.isHidden || result.status === ModerationStatus.REJECTED) {
        baseUpdate.hiddenReason = result.scores.reason.slice(0, 500);
      }

      // Sửa lỗi deprecated: dùng returnDocument: 'after'
      const updated = await PostModel.findByIdAndUpdate(entityId, baseUpdate, {
        returnDocument: "after",
      }).lean();

      if (!updated) throw new NotFoundError("Không tìm thấy bài viết");
      return updated;
    }

    // Xử lý cho Comment
    const updated = await CommentModel.findByIdAndUpdate(
      entityId,
      {
        moderationStatus: toCommentModerationStatus(result.status),
        isHidden: result.isHidden,
      },
      { returnDocument: "after" }
    ).lean();

    if (!updated) throw new NotFoundError("Không tìm thấy bình luận");
    return updated;
  },

  /**
   * Kiểm duyệt hình ảnh
   */
  async moderateImage(
    imageUrl: string,
    postId: string,
    context?: ModerationContext
  ): Promise<void> {
    try {
      const shouldScan =
        (context?.reportCount ?? 0) > 0 ||
        context?.isNewAccount === true ||
        Math.random() < 0.05;

      if (!shouldScan) {
        await PostModel.findByIdAndUpdate(
          postId,
          { moderationStatus: ModerationStatus.APPROVED },
          { returnDocument: "after" }
        );
        return;
      }

      const scores = await AIApiService.analyzeImage(imageUrl);
      const risk = Math.max(scores.toxic, scores.hateSpeech, scores.spam);
      const { status, isHidden } = decideFromAiScores(scores);

      await PostModel.findByIdAndUpdate(
        postId,
        {
          aiToxicScore: scores.toxic,
          aiHateSpeechScore: scores.hateSpeech,
          aiSpamScore: scores.spam,
          aiOverallRisk: risk,
          moderationStatus: status,
          isHidden,
          ...(isHidden && { hiddenReason: scores.reason.slice(0, 500) }),
        },
        { returnDocument: "after" }
      );
    } catch (error) {
      console.error("🖼️ [Image Moderation Error]:", error);
    }
  },
};
