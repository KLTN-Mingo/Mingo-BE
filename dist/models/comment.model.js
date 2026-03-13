"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentModel = exports.CommentModerationStatus = void 0;
// src/models/comment.model.ts
const mongoose_1 = require("mongoose");
var CommentModerationStatus;
(function (CommentModerationStatus) {
    CommentModerationStatus["PENDING"] = "pending";
    CommentModerationStatus["APPROVED"] = "approved";
    CommentModerationStatus["REJECTED"] = "rejected";
    CommentModerationStatus["FLAGGED"] = "flagged";
})(CommentModerationStatus || (exports.CommentModerationStatus = CommentModerationStatus = {}));
const CommentSchema = new mongoose_1.Schema({
    postId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Post",
        index: true,
    },
    mediaId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "PostMedia",
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    parentCommentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
        index: true,
    },
    /**
     * originalCommentId: luôn trỏ về comment cấp 1 trong thread.
     * - Comment cấp 1 (top-level): null
     * - Reply trực tiếp vào comment cấp 1: = parentCommentId
     * - Reply của reply (cấp 3+): = comment cấp 1 (không thay đổi)
     * Dùng để group toàn bộ thread replies về cùng một comment gốc.
     */
    originalCommentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
        index: true,
    },
    contentText: {
        type: String,
        required: true,
        maxlength: 2000,
    },
    // Moderation
    moderationStatus: {
        type: String,
        enum: Object.values(CommentModerationStatus),
        default: CommentModerationStatus.APPROVED,
    },
    isHidden: {
        type: Boolean,
        default: false,
    },
    // Engagement
    likesCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    repliesCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    isEdited: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
CommentSchema.index({ postId: 1, createdAt: -1 });
CommentSchema.index({ mediaId: 1, createdAt: -1 });
CommentSchema.index({ userId: 1, createdAt: -1 });
CommentSchema.index({ parentCommentId: 1, createdAt: -1 });
CommentSchema.index({ originalCommentId: 1, createdAt: -1 });
CommentSchema.index({ postId: 1, parentCommentId: 1 });
CommentSchema.index({ mediaId: 1, parentCommentId: 1 });
exports.CommentModel = (0, mongoose_1.model)("Comment", CommentSchema);
