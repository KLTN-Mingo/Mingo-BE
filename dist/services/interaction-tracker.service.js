"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionTrackerService = exports.InteractionTrackerService = void 0;
// src/services/interaction-tracker.service.ts
const mongoose_1 = require("mongoose");
const user_interaction_model_1 = require("../models/user-interaction.model");
const user_profile_model_1 = require("../models/user-profile.model");
const post_model_1 = require("../models/post.model");
const post_hashtag_model_1 = require("../models/post-hashtag.model");
const interaction_constants_1 = require("../constants/interaction.constants");
class InteractionTrackerService {
    // ─── Public ──────────────────────────────────────────────────────────────
    async track(payload) {
        const { userId, postId, type, viewDuration, scrollDepth, source, deviceType } = payload;
        // Bỏ qua view quá ngắn
        if (type === user_interaction_model_1.InteractionType.VIEW) {
            if ((viewDuration ?? 0) < interaction_constants_1.MIN_VIEW_DURATION_SECONDS)
                return;
        }
        const weight = interaction_constants_1.INTERACTION_WEIGHTS[type] ?? 1;
        const feedbackType = this.resolveFeedbackType(type);
        // Map type → boolean fields để cập nhật đúng field
        const booleanUpdate = this.resolveBooleanFields(type);
        // Upsert: mỗi cặp (userId, postId) chỉ có 1 document.
        // $set: cập nhật boolean (liked/commented/...) + metadata — không ghi đè lẫn nhau.
        // $inc: cộng dồn weight — like (3) + comment (4) = 7.
        await user_interaction_model_1.UserInteractionModel.findOneAndUpdate({
            userId: new mongoose_1.Types.ObjectId(userId),
            postId: new mongoose_1.Types.ObjectId(postId),
        }, {
            $set: {
                feedbackType,
                source,
                ...(viewDuration !== undefined && { viewDuration }),
                ...(scrollDepth !== undefined && { scrollDepth }),
                ...(deviceType !== undefined && { deviceType }),
                ...booleanUpdate,
            },
            $inc: { weight },
        }, { upsert: true, new: true });
        // Cập nhật UserProfile async — không block response
        this.updateUserProfile(userId, postId, type, weight).catch((err) => console.error("[InteractionTrackerService] updateUserProfile error:", err));
    }
    // ─── Private: cập nhật UserProfile ───────────────────────────────────────
    async updateUserProfile(userId, postId, type, weight) {
        const post = await post_model_1.PostModel
            .findById(postId)
            .select("topics userId")
            .lean();
        if (!post)
            return;
        const decay = interaction_constants_1.INTERACTION_DECAY[type] ?? 1.0;
        const delta = weight * decay;
        const incUpdate = {};
        // topicScores — từ Post.topics (đã có sẵn trong schema mới)
        const topics = post.topics ?? [];
        for (const topic of topics) {
            const key = `topicScores.${this.sanitizeKey(topic)}`;
            incUpdate[key] = delta;
        }
        // authorScores — UserProfile có authorScores, dùng luôn
        const authorId = post.userId?.toString();
        if (authorId) {
            incUpdate[`authorScores.${authorId}`] = delta * 0.7;
        }
        // hashtagScores — từ PostHashtag (post không có field hashtags, nằm collection riêng)
        const postHashtags = await post_hashtag_model_1.PostHashtagModel.find({ postId: new mongoose_1.Types.ObjectId(postId) })
            .select("hashtag")
            .lean();
        for (const { hashtag } of postHashtags) {
            const key = `hashtagScores.${this.sanitizeKey(hashtag)}`;
            incUpdate[key] = delta * 0.9;
        }
        await user_profile_model_1.UserProfileModel.findOneAndUpdate({ userId: new mongoose_1.Types.ObjectId(userId) }, {
            $inc: {
                ...incUpdate,
                interactionCount: 1,
            },
            $set: {
                updatedAt: new Date(),
                lastCalculatedAt: new Date(),
            },
        }, { upsert: true, new: true });
    }
    // ─── Helpers ─────────────────────────────────────────────────────────────
    // Map InteractionType → FeedbackType
    resolveFeedbackType(type) {
        const map = {
            [user_interaction_model_1.InteractionType.HIDE]: user_interaction_model_1.FeedbackType.HIDE,
            [user_interaction_model_1.InteractionType.NOT_INTERESTED]: user_interaction_model_1.FeedbackType.NOT_INTERESTED,
            [user_interaction_model_1.InteractionType.SEE_MORE]: user_interaction_model_1.FeedbackType.SEE_MORE,
            [user_interaction_model_1.InteractionType.REPORT]: user_interaction_model_1.FeedbackType.REPORT,
        };
        return map[type] ?? user_interaction_model_1.FeedbackType.ORGANIC;
    }
    // Map InteractionType → boolean fields trong schema
    resolveBooleanFields(type) {
        const map = {
            [user_interaction_model_1.InteractionType.VIEW]: { viewed: true },
            [user_interaction_model_1.InteractionType.LIKE]: { liked: true },
            [user_interaction_model_1.InteractionType.COMMENT]: { commented: true },
            [user_interaction_model_1.InteractionType.SHARE]: { shared: true },
            [user_interaction_model_1.InteractionType.SAVE]: { saved: true },
        };
        return map[type] ?? {};
    }
    // Sanitize key cho MongoDB Map field — không cho phép . trong key
    sanitizeKey(key) {
        return key.replace(/\./g, "_").replace(/\$/g, "_").trim();
    }
}
exports.InteractionTrackerService = InteractionTrackerService;
exports.interactionTrackerService = new InteractionTrackerService();
