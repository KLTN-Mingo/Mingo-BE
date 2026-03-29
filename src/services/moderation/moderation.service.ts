// src/services/moderation/moderation.service.ts

import { Types } from "mongoose";
import {
  ModerationStatus,
  PostModel,
} from "../../models/post.model";
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

function maxScore(s: AIScoreResult): number {
  return Math.max(s.toxic, s.hateSpeech, s.spam);
}

function scoresFromRule(rule: RuleCheckResult): AIScoreResult {
  const t = rule.violationType;
  const base = rule.score;
  return {
    toxic: t === "profanity" || t === "too_short" ? base : t === "hate_speech" ? base * 0.9 : base * 0.4,
    hateSpeech: t === "hate_speech" ? base : 0,
    spam: t === "spam" || t === "spam_soft" ? base : t === "profanity" ? 0 : base * 0.3,
    reason: rule.reason ?? "rule",
  };
}

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
  };
  return map[s];
}

export const ModerationService = {
  async moderateContent(
    text: string,
    context?: ModerationContext
  ): Promise<ModerationResult> {
    const ctx: ModerationContext = context ?? {};
    const rule = RuleBasedService.checkContent(text);

    if (rule.isClearViolation) {
      const scores = scoresFromRule(rule);
      return {
        status: ModerationStatus.REJECTED,
        isHidden: true,
        scores,
        action: "block_rule",
        method: "rule",
      };
    }

    if (shouldCallAI(rule, ctx)) {
      const aiScores = await AIApiService.analyzeContent(text);
      const decided = decideFromAiScores(aiScores);
      return {
        ...decided,
        scores: aiScores,
        method: "ai",
      };
    }

    const scores: AIScoreResult = {
      toxic: rule.score * 0.35,
      hateSpeech: 0,
      spam: rule.score * 0.65,
      reason: rule.reason ?? "rule_ok",
    };

    return {
      status: ModerationStatus.APPROVED,
      isHidden: false,
      scores,
      action: "approve",
      method: "rule",
    };
  },

  async moderateAndUpdate(
    entityType: "post" | "comment",
    entityId: string,
    text: string,
    context?: ModerationContext
  ): Promise<void> {
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

      const updated = await PostModel.findByIdAndUpdate(
        entityId,
        baseUpdate,
        { new: true }
      ).lean();

      if (!updated) {
        throw new NotFoundError("Không tìm thấy bài viết");
      }
      return;
    }

    const updated = await CommentModel.findByIdAndUpdate(
      entityId,
      {
        moderationStatus: toCommentModerationStatus(result.status),
        isHidden: result.isHidden,
      },
      { new: true }
    ).lean();

    if (!updated) {
      throw new NotFoundError("Không tìm thấy bình luận");
    }
  },
};
