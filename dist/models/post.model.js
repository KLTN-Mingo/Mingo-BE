"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostModel = exports.ModerationStatus = exports.PostVisibility = void 0;
// src/models/post.model.ts
const mongoose_1 = require("mongoose");
var PostVisibility;
(function (PostVisibility) {
    PostVisibility["PUBLIC"] = "public";
    PostVisibility["FRIENDS"] = "friends";
    PostVisibility["PRIVATE"] = "private";
    PostVisibility["BESTFRIENDS"] = "bestfriends";
})(PostVisibility || (exports.PostVisibility = PostVisibility = {}));
var ModerationStatus;
(function (ModerationStatus) {
    ModerationStatus["PENDING"] = "pending";
    ModerationStatus["APPROVED"] = "approved";
    ModerationStatus["REJECTED"] = "rejected";
    ModerationStatus["FLAGGED"] = "flagged";
})(ModerationStatus || (exports.ModerationStatus = ModerationStatus = {}));
const PostSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    contentText: { type: String, maxlength: 10000 },
    contentRichText: { type: String, maxlength: 50000 },
    visibility: {
        type: String,
        enum: Object.values(PostVisibility),
        default: PostVisibility.PUBLIC,
    },
    likesCount: { type: Number, default: 0, min: 0 },
    commentsCount: { type: Number, default: 0, min: 0 },
    sharesCount: { type: Number, default: 0, min: 0 },
    savesCount: { type: Number, default: 0, min: 0 },
    viewsCount: { type: Number, default: 0, min: 0 },
    moderationStatus: {
        type: String,
        enum: Object.values(ModerationStatus),
        default: ModerationStatus.PENDING,
    },
    aiToxicScore: { type: Number, min: 0, max: 1 },
    aiHateSpeechScore: { type: Number, min: 0, max: 1 },
    aiSpamScore: { type: Number, min: 0, max: 1 },
    aiOverallRisk: { type: Number, min: 0, max: 1 },
    isHidden: { type: Boolean, default: false },
    hiddenReason: { type: String, maxlength: 500 },
    isEdited: { type: Boolean, default: false },
    topics: { type: [String], default: [] },
    hotScore: { type: Number, default: 0 },
    hotScoreUpdatedAt: { type: Date },
    engagementRate: { type: Number, default: 0, min: 0, max: 1 },
    locationName: { type: String, maxlength: 255 },
    locationLatitude: { type: Number, min: -90, max: 90 },
    locationLongitude: { type: Number, min: -180, max: 180 },
}, { timestamps: true });
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ moderationStatus: 1 });
PostSchema.index({ likesCount: -1 });
PostSchema.index({ hotScore: -1 });
PostSchema.index({ userId: 1, visibility: 1, createdAt: -1 });
PostSchema.index({ topics: 1 });
PostSchema.index({ contentText: "text" });
exports.PostModel = (0, mongoose_1.model)("Post", PostSchema);
