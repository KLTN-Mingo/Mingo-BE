"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LikeModel = void 0;
// src/models/like.model.ts
const mongoose_1 = require("mongoose");
const LikeSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    postId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Post",
    },
    commentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Comment",
    },
    mediaId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "PostMedia",
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Partial unique indexes - chỉ áp dụng khi field tồn tại
LikeSchema.index({ userId: 1, postId: 1 }, { unique: true, partialFilterExpression: { postId: { $exists: true, $ne: null } } });
LikeSchema.index({ userId: 1, commentId: 1 }, { unique: true, partialFilterExpression: { commentId: { $exists: true, $ne: null } } });
LikeSchema.index({ userId: 1, mediaId: 1 }, { unique: true, partialFilterExpression: { mediaId: { $exists: true, $ne: null } } });
// Additional indexes for queries
LikeSchema.index({ postId: 1, createdAt: -1 });
LikeSchema.index({ commentId: 1, createdAt: -1 });
LikeSchema.index({ mediaId: 1, createdAt: -1 });
LikeSchema.index({ userId: 1, createdAt: -1 });
exports.LikeModel = (0, mongoose_1.model)("Like", LikeSchema);
