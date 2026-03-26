"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedAnalyticsService = exports.FeedAnalyticsService = void 0;
const mongoose_1 = require("mongoose");
const feed_impression_model_1 = require("../models/feed-impression.model");
const user_interaction_model_1 = require("../models/user-interaction.model");
class FeedAnalyticsService {
    async trackImpressions(userId, tab, items) {
        if (items.length === 0)
            return "";
        const requestId = new mongoose_1.Types.ObjectId().toString();
        const source = tab === "friends" ? user_interaction_model_1.InteractionSource.FEED : user_interaction_model_1.InteractionSource.EXPLORE;
        const docs = items
            .filter((item) => mongoose_1.Types.ObjectId.isValid(item.postId))
            .map((item) => ({
            userId: new mongoose_1.Types.ObjectId(userId),
            postId: new mongoose_1.Types.ObjectId(item.postId),
            requestId,
            tab,
            source,
            position: item.position,
            score: item.score?.final,
            scoreContent: item.score?.content,
            scorePopularity: item.score?.popularity,
            scoreSocial: item.score?.social,
        }));
        if (docs.length === 0)
            return requestId;
        await feed_impression_model_1.FeedImpressionModel.insertMany(docs, { ordered: false });
        return requestId;
    }
    async getMetrics(days, tab) {
        const safeDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 7;
        const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
        const impressionMatch = { createdAt: { $gte: since } };
        if (tab)
            impressionMatch.tab = tab;
        const impressionSources = tab === "friends"
            ? [user_interaction_model_1.InteractionSource.FEED]
            : tab === "explore"
                ? [user_interaction_model_1.InteractionSource.EXPLORE]
                : [user_interaction_model_1.InteractionSource.FEED, user_interaction_model_1.InteractionSource.EXPLORE];
        const interactionMatch = {
            createdAt: { $gte: since },
            source: { $in: impressionSources },
        };
        const [impressions, views, likes, comments, shares, saves, hides, notInterested] = await Promise.all([
            feed_impression_model_1.FeedImpressionModel.countDocuments(impressionMatch),
            user_interaction_model_1.UserInteractionModel.countDocuments({ ...interactionMatch, viewed: true }),
            user_interaction_model_1.UserInteractionModel.countDocuments({ ...interactionMatch, liked: true }),
            user_interaction_model_1.UserInteractionModel.countDocuments({ ...interactionMatch, commented: true }),
            user_interaction_model_1.UserInteractionModel.countDocuments({ ...interactionMatch, shared: true }),
            user_interaction_model_1.UserInteractionModel.countDocuments({ ...interactionMatch, saved: true }),
            user_interaction_model_1.UserInteractionModel.countDocuments({ ...interactionMatch, feedbackType: "hide" }),
            user_interaction_model_1.UserInteractionModel.countDocuments({
                ...interactionMatch,
                feedbackType: "not_interested",
            }),
        ]);
        const ctr = impressions > 0 ? views / impressions : 0;
        const engagementActions = likes + comments + shares + saves;
        const engagementRate = impressions > 0 ? engagementActions / impressions : 0;
        const negativeFeedbackRate = impressions > 0 ? (hides + notInterested) / impressions : 0;
        return {
            windowDays: safeDays,
            tab,
            impressions,
            views,
            likes,
            comments,
            shares,
            saves,
            hides,
            notInterested,
            ctr,
            engagementRate,
            negativeFeedbackRate,
        };
    }
}
exports.FeedAnalyticsService = FeedAnalyticsService;
exports.feedAnalyticsService = new FeedAnalyticsService();
