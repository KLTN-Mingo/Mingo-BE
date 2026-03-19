"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostMediaModel = exports.MediaType = void 0;
// src/models/post-media.model.ts
const mongoose_1 = require("mongoose");
var MediaType;
(function (MediaType) {
    MediaType["IMAGE"] = "image";
    MediaType["VIDEO"] = "video";
})(MediaType || (exports.MediaType = MediaType = {}));
const PostMediaSchema = new mongoose_1.Schema({
    postId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    mediaType: {
        type: String,
        enum: Object.values(MediaType),
        required: true,
    },
    mediaUrl: {
        type: String,
        required: true,
    },
    thumbnailUrl: {
        type: String,
    },
    caption: {
        type: String,
        maxlength: 2000,
    },
    width: {
        type: Number,
        min: 0,
    },
    height: {
        type: Number,
        min: 0,
    },
    duration: {
        type: Number,
        min: 0,
    },
    fileSize: {
        type: Number,
        min: 0,
    },
    orderIndex: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Engagement
    likesCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    commentsCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    sharesCount: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
});
// Indexes
PostMediaSchema.index({ postId: 1, orderIndex: 1 });
PostMediaSchema.index({ userId: 1, createdAt: -1 });
PostMediaSchema.index({ likesCount: -1 });
exports.PostMediaModel = (0, mongoose_1.model)("PostMedia", PostMediaSchema);
