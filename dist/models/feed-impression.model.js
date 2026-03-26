"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedImpressionModel = void 0;
const mongoose_1 = require("mongoose");
const FeedImpressionSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    postId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true,
    },
    requestId: {
        type: String,
        required: true,
        index: true,
    },
    tab: {
        type: String,
        enum: ["friends", "explore"],
        required: true,
        index: true,
    },
    source: {
        type: String,
        required: true,
        index: true,
    },
    position: {
        type: Number,
        required: true,
        min: 1,
    },
    score: { type: Number },
    scoreContent: { type: Number },
    scorePopularity: { type: Number },
    scoreSocial: { type: Number },
}, { timestamps: { createdAt: true, updatedAt: false } });
FeedImpressionSchema.index({ userId: 1, createdAt: -1 });
FeedImpressionSchema.index({ tab: 1, createdAt: -1 });
FeedImpressionSchema.index({ postId: 1, createdAt: -1 });
FeedImpressionSchema.index({ userId: 1, postId: 1, requestId: 1 }, { unique: true });
// Keep analytics data for 90 days to limit collection growth.
FeedImpressionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
exports.FeedImpressionModel = (0, mongoose_1.model)("FeedImpression", FeedImpressionSchema);
