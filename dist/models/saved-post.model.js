"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedPostModel = void 0;
// src/models/saved-post.model.ts
const mongoose_1 = require("mongoose");
const SavedPostSchema = new mongoose_1.Schema({
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
    collectionName: {
        type: String,
        maxlength: 100,
        default: "default",
    },
}, { timestamps: { createdAt: true, updatedAt: false } });
SavedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });
SavedPostSchema.index({ userId: 1, createdAt: -1 });
exports.SavedPostModel = (0, mongoose_1.model)("SavedPost", SavedPostSchema);
