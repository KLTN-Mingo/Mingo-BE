"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentLikeModel = void 0;
// src/models/comment-like.model.ts
const mongoose_1 = require("mongoose");
const CommentLikeSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    commentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Comment",
        required: true,
        index: true,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Prevent duplicate likes
CommentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true });
exports.CommentLikeModel = (0, mongoose_1.model)("CommentLike", CommentLikeSchema);
