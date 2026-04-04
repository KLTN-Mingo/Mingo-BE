"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileModel = void 0;
// src/models/user-profile.model.ts
const mongoose_1 = require("mongoose");
const UserProfileSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true,
    },
    topicScores: {
        type: Map,
        of: Number,
        default: new Map(),
    },
    hashtagScores: {
        type: Map,
        of: Number,
        default: new Map(),
    },
    authorScores: {
        type: Map,
        of: Number,
        default: new Map(),
    },
    interactionCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    avgSessionDuration: {
        type: Number,
        min: 0,
    },
    preferredContentType: {
        type: String,
        enum: ["image", "video", "text"],
    },
    lastCalculatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});
UserProfileSchema.index({ userId: 1 });
UserProfileSchema.index({ lastCalculatedAt: 1 });
exports.UserProfileModel = (0, mongoose_1.model)("UserProfile", UserProfileSchema);
