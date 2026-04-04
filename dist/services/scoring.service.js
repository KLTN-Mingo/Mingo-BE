"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringService = exports.ScoringService = void 0;
// src/services/scoring.service.ts
const mongoose_1 = require("mongoose");
const follow_model_1 = require("../models/follow.model");
const feed_constants_1 = require("../constants/feed.constants");
/** Mongoose Map khi .lean() trở thành plain object — không có .get */
function scoreFromMapOrRecord(scores, key) {
    if (scores == null)
        return 0;
    if (scores instanceof Map)
        return scores.get(key) ?? 0;
    const v = scores[key];
    return typeof v === "number" ? v : 0;
}
class ScoringService {
    // ─── Entry point: chấm điểm nhiều posts song song ────────────────────────
    async scorePosts(posts, userId, userProfile, followingIds) {
        const isNewUser = this.isColdStart(userProfile);
        const weights = isNewUser ? feed_constants_1.SCORE_WEIGHTS.cold_start : feed_constants_1.SCORE_WEIGHTS.normal;
        const following = followingIds ?? await this.getFollowingIds(userId);
        const results = await Promise.all(posts.map((post) => this.scoreOne(post, userProfile, following, weights)));
        return results.sort((a, b) => b.score - a.score);
    }
    // ─── Score 1 post ─────────────────────────────────────────────────────────
    scoreOne(post, userProfile, followingIds, weights) {
        const cs = this.contentScore(post, userProfile);
        const ps = this.popularityScore(post);
        const ss = this.socialScore(post, followingIds);
        const final = weights.content * cs +
            weights.popularity * ps +
            weights.social * ss;
        return {
            post,
            score: final,
            breakdown: { content: cs, popularity: ps, social: ss, final },
        };
    }
    // ─── Score 1: Content-based ───────────────────────────────────────────────
    // Đo độ khớp Post.topics vs UserProfile.topicScores + authorScores
    contentScore(post, userProfile) {
        if (!userProfile)
            return 0;
        let score = 0;
        // Topic matching
        // Post.topics dạng "Công nghệ - Technology"
        // UserProfile.topicScores key đã sanitize dấu chấm → gạch dưới
        const topics = post.topics ?? [];
        for (const topic of topics) {
            const key = topic.replace(/\./g, "_");
            score += scoreFromMapOrRecord(userProfile.topicScores, key);
        }
        // Author affinity — hay xem bài tác giả này thì boost
        const authorId = post.userId?.toString();
        if (authorId) {
            score += scoreFromMapOrRecord(userProfile.authorScores, authorId) * 1.2;
        }
        return Math.max(0, Math.min(score, 100));
    }
    // ─── Score 2: Popularity ──────────────────────────────────────────────────
    // Dùng Post.hotScore đã cache; fallback tính tạm nếu chưa có cron
    popularityScore(post) {
        if (post.hotScore > 0) {
            return Math.min(post.hotScore, 100);
        }
        const engagements = (post.likesCount ?? 0) * 3 +
            (post.commentsCount ?? 0) * 4 +
            (post.sharesCount ?? 0) * 5 +
            (post.savesCount ?? 0) * 4 +
            (post.viewsCount ?? 0) * 0.1;
        const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3600000;
        const raw = engagements / Math.pow(ageHours + 2, feed_constants_1.POPULARITY_GRAVITY);
        return Math.min(raw * 2, 100);
    }
    // ─── Score 3: Social graph ────────────────────────────────────────────────
    // Bài từ người đang follow → điểm tối đa
    socialScore(post, followingIds) {
        return followingIds.has(post.userId?.toString()) ? 100 : 0;
    }
    // ─── Helpers ──────────────────────────────────────────────────────────────
    isColdStart(userProfile) {
        return !userProfile ||
            (userProfile.interactionCount ?? 0) < feed_constants_1.COLD_START_THRESHOLD;
    }
    async getFollowingIds(userId) {
        const follows = await follow_model_1.FollowModel
            .find({
            followerId: new mongoose_1.Types.ObjectId(userId),
            followStatus: "accepted",
        })
            .select("followingId")
            .lean();
        return new Set(follows.map((f) => f.followingId.toString()));
    }
}
exports.ScoringService = ScoringService;
exports.scoringService = new ScoringService();
