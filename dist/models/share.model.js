"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareModel = void 0;
// src/models/share.model.ts
const mongoose_1 = require("mongoose");
const ShareSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
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
    caption: {
        type: String,
        maxlength: 2000,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Indexes
ShareSchema.index({ postId: 1, createdAt: -1 });
ShareSchema.index({ mediaId: 1, createdAt: -1 });
ShareSchema.index({ userId: 1, createdAt: -1 });
exports.ShareModel = (0, mongoose_1.model)("Share", ShareSchema);
