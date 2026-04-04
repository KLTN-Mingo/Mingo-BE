"use strict";
// src/services/moderation/moderation.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationService = exports.REVIEW = exports.AUTO_HIDE = void 0;
const mongoose_1 = require("mongoose");
const post_model_1 = require("../../models/post.model");
const comment_model_1 = require("../../models/comment.model");
const errors_1 = require("../../errors");
const rule_based_service_1 = require("./rule-based.service");
const ai_api_service_1 = require("./ai-api.service");
exports.AUTO_HIDE = 0.8;
exports.REVIEW = 0.5;
function maxScore(s) {
    return Math.max(s.toxic, s.hateSpeech, s.spam);
}
function scoresFromRule(rule) {
    const t = rule.violationType;
    const base = rule.score;
    return {
        toxic: t === "profanity" || t === "too_short" ? base : t === "hate_speech" ? base * 0.9 : base * 0.4,
        hateSpeech: t === "hate_speech" ? base : 0,
        spam: t === "spam" || t === "spam_soft" ? base : t === "profanity" ? 0 : base * 0.3,
        reason: rule.reason ?? "rule",
    };
}
function decideFromAiScores(scores) {
    const m = maxScore(scores);
    if (m >= exports.AUTO_HIDE) {
        return {
            status: post_model_1.ModerationStatus.REJECTED,
            isHidden: true,
            action: "auto_hide",
        };
    }
    if (m >= exports.REVIEW) {
        return {
            status: post_model_1.ModerationStatus.FLAGGED,
            isHidden: false,
            action: "review",
        };
    }
    return {
        status: post_model_1.ModerationStatus.APPROVED,
        isHidden: false,
        action: "approve",
    };
}
function shouldCallAI(rule, context) {
    if (rule.needsAICheck)
        return true;
    if ((context.reportCount ?? 0) > 0)
        return true;
    if (context.isNewAccount === true)
        return true;
    if (Math.random() < 0.05)
        return true;
    return false;
}
function toCommentModerationStatus(s) {
    const map = {
        [post_model_1.ModerationStatus.PENDING]: comment_model_1.CommentModerationStatus.PENDING,
        [post_model_1.ModerationStatus.APPROVED]: comment_model_1.CommentModerationStatus.APPROVED,
        [post_model_1.ModerationStatus.REJECTED]: comment_model_1.CommentModerationStatus.REJECTED,
        [post_model_1.ModerationStatus.FLAGGED]: comment_model_1.CommentModerationStatus.FLAGGED,
    };
    return map[s];
}
exports.ModerationService = {
    async moderateContent(text, context) {
        const ctx = context ?? {};
        const rule = rule_based_service_1.RuleBasedService.checkContent(text);
        if (rule.isClearViolation) {
            const scores = scoresFromRule(rule);
            return {
                status: post_model_1.ModerationStatus.REJECTED,
                isHidden: true,
                scores,
                action: "block_rule",
                method: "rule",
            };
        }
        if (shouldCallAI(rule, ctx)) {
            const aiScores = await ai_api_service_1.AIApiService.analyzeContent(text);
            const decided = decideFromAiScores(aiScores);
            return {
                ...decided,
                scores: aiScores,
                method: "ai",
            };
        }
        const scores = {
            toxic: rule.score * 0.35,
            hateSpeech: 0,
            spam: rule.score * 0.65,
            reason: rule.reason ?? "rule_ok",
        };
        return {
            status: post_model_1.ModerationStatus.APPROVED,
            isHidden: false,
            scores,
            action: "approve",
            method: "rule",
        };
    },
    async moderateAndUpdate(entityType, entityId, text, context) {
        if (!mongoose_1.Types.ObjectId.isValid(entityId)) {
            throw new errors_1.NotFoundError("Không tìm thấy nội dung");
        }
        const result = await exports.ModerationService.moderateContent(text, context);
        const risk = maxScore(result.scores);
        if (entityType === "post") {
            const baseUpdate = {
                moderationStatus: result.status,
                isHidden: result.isHidden,
                aiToxicScore: result.scores.toxic,
                aiHateSpeechScore: result.scores.hateSpeech,
                aiSpamScore: result.scores.spam,
                aiOverallRisk: risk,
            };
            if (result.isHidden || result.status === post_model_1.ModerationStatus.REJECTED) {
                baseUpdate.hiddenReason = result.scores.reason.slice(0, 500);
            }
            const updated = await post_model_1.PostModel.findByIdAndUpdate(entityId, baseUpdate, { new: true }).lean();
            if (!updated) {
                throw new errors_1.NotFoundError("Không tìm thấy bài viết");
            }
            return;
        }
        const updated = await comment_model_1.CommentModel.findByIdAndUpdate(entityId, {
            moderationStatus: toCommentModerationStatus(result.status),
            isHidden: result.isHidden,
        }, { new: true }).lean();
        if (!updated) {
            throw new errors_1.NotFoundError("Không tìm thấy bình luận");
        }
    },
};
