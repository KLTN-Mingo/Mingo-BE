"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInteractionModel = exports.InteractionType = exports.FeedbackType = exports.InteractionSource = void 0;
// src/models/user-interaction.model.ts
const mongoose_1 = require("mongoose");
var InteractionSource;
(function (InteractionSource) {
    InteractionSource["FEED"] = "feed";
    InteractionSource["EXPLORE"] = "explore";
    InteractionSource["PROFILE"] = "profile";
    InteractionSource["SEARCH"] = "search";
    InteractionSource["NOTIFICATION"] = "notification";
})(InteractionSource || (exports.InteractionSource = InteractionSource = {}));
var FeedbackType;
(function (FeedbackType) {
    FeedbackType["ORGANIC"] = "organic";
    FeedbackType["HIDE"] = "hide";
    FeedbackType["NOT_INTERESTED"] = "not_interested";
    FeedbackType["SEE_MORE"] = "see_more";
    FeedbackType["REPORT"] = "report";
})(FeedbackType || (exports.FeedbackType = FeedbackType = {}));
var InteractionType;
(function (InteractionType) {
    InteractionType["VIEW"] = "view";
    InteractionType["LIKE"] = "like";
    InteractionType["COMMENT"] = "comment";
    InteractionType["SHARE"] = "share";
    InteractionType["SAVE"] = "save";
    InteractionType["FOLLOW_FROM_POST"] = "follow_from_post";
    InteractionType["HIDE"] = "hide";
    InteractionType["NOT_INTERESTED"] = "not_interested";
    InteractionType["SEE_MORE"] = "see_more";
    InteractionType["REPORT"] = "report";
})(InteractionType || (exports.InteractionType = InteractionType = {}));
const UserInteractionSchema = new mongoose_1.Schema({
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
    viewed: { type: Boolean, default: false },
    liked: { type: Boolean, default: false },
    commented: { type: Boolean, default: false },
    shared: { type: Boolean, default: false },
    saved: { type: Boolean, default: false },
    weight: { type: Number, default: 1 },
    feedbackType: {
        type: String,
        enum: Object.values(FeedbackType),
        default: FeedbackType.ORGANIC,
    },
    viewDuration: { type: Number, min: 0 },
    scrollDepth: { type: Number, min: 0, max: 1 },
    source: {
        type: String,
        enum: Object.values(InteractionSource),
        required: true,
    },
    deviceType: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });
UserInteractionSchema.index({ userId: 1, createdAt: -1 });
UserInteractionSchema.index({ userId: 1, liked: 1 });
UserInteractionSchema.index({ userId: 1, source: 1, createdAt: -1 });
UserInteractionSchema.index({ userId: 1, feedbackType: 1 });
UserInteractionSchema.index({ userId: 1, postId: 1 }, { unique: true });
UserInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
exports.UserInteractionModel = (0, mongoose_1.model)("UserInteraction", UserInteractionSchema);
