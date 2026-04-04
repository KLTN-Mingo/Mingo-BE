"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostMentionModel = void 0;
// src/models/post-mention.model.ts
const mongoose_1 = require("mongoose");
const PostMentionSchema = new mongoose_1.Schema({
    postId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true,
    },
    mentionedUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Indexes
PostMentionSchema.index({ mentionedUserId: 1, createdAt: -1 });
// Prevent duplicate mentions
PostMentionSchema.index({ postId: 1, mentionedUserId: 1 }, { unique: true });
exports.PostMentionModel = (0, mongoose_1.model)("PostMention", PostMentionSchema);
