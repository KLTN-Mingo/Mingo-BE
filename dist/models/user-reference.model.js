"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInteractionModel = exports.InteractionSource = void 0;
// src/models/user-interaction.model.ts
const mongoose_1 = require("mongoose");
var InteractionSource;
(function (InteractionSource) {
    InteractionSource["FEED"] = "feed";
    InteractionSource["EXPLORE"] = "explore";
    InteractionSource["PROFILE"] = "profile";
    InteractionSource["SEARCH"] = "search";
    InteractionSource["NOTIFICATION"] = "notification";
})(InteractionSource || (exports.InteractionSource = InteractionSource = {}));
const UserInteractionSchema = new mongoose_1.Schema({
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
    // Interaction Types
    viewed: {
        type: Boolean,
        default: false,
    },
    viewDuration: {
        type: Number,
        min: 0,
    },
    liked: {
        type: Boolean,
        default: false,
    },
    commented: {
        type: Boolean,
        default: false,
    },
    shared: {
        type: Boolean,
        default: false,
    },
    saved: {
        type: Boolean,
        default: false,
    },
    source: {
        type: String,
        enum: Object.values(InteractionSource),
        required: true,
    },
    deviceType: {
        type: String,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Indexes
UserInteractionSchema.index({ userId: 1, createdAt: -1 });
UserInteractionSchema.index({ userId: 1, liked: 1 });
UserInteractionSchema.index({ userId: 1, source: 1, createdAt: -1 });
// TTL index - delete interactions older than 90 days
UserInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
exports.UserInteractionModel = (0, mongoose_1.model)("UserInteraction", UserInteractionSchema);
