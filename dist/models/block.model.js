"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockModel = void 0;
// src/models/block.model.ts
const mongoose_1 = require("mongoose");
const BlockSchema = new mongoose_1.Schema({
    blockerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    blockedId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    reason: {
        type: String,
        maxlength: 500,
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// Compound unique index to prevent duplicate blocks
BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
exports.BlockModel = (0, mongoose_1.model)("Block", BlockSchema);
