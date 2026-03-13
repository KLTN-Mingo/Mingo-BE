"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenModel = void 0;
// src/models/refresh-token.model.ts
const mongoose_1 = require("mongoose");
const RefreshTokenSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    isUsed: { type: Boolean, default: false },
    isRevoked: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
// TTL index → auto delete expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.RefreshTokenModel = (0, mongoose_1.model)("RefreshToken", RefreshTokenSchema);
