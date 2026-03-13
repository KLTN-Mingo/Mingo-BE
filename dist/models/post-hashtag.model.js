"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostHashtagModel = void 0;
// src/models/post-hashtag.model.ts
const mongoose_1 = require("mongoose");
const PostHashtagSchema = new mongoose_1.Schema({
    postId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true,
    },
    hashtag: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        maxlength: 100,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Indexes
PostHashtagSchema.index({ hashtag: 1 });
PostHashtagSchema.index({ hashtag: 1, createdAt: -1 });
// Compound index for preventing duplicates
PostHashtagSchema.index({ postId: 1, hashtag: 1 }, { unique: true });
exports.PostHashtagModel = (0, mongoose_1.model)("PostHashtag", PostHashtagSchema);
