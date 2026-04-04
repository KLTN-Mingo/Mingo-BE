"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTokenPair = createTokenPair;
exports.refreshTokens = refreshTokens;
exports.revokeTokenFamily = revokeTokenFamily;
exports.revokeAllUserTokens = revokeAllUserTokens;
// src/lib/auth/token-service.ts
const refresh_token_model_1 = require("../../models/refresh-token.model");
const jwt_1 = require("./jwt");
const crypto_1 = __importDefault(require("crypto"));
async function createTokenPair(userId) {
    const family = crypto_1.default.randomUUID();
    const accessToken = (0, jwt_1.generateAccessToken)({ userId });
    const refreshToken = (0, jwt_1.generateRefreshToken)({ userId, family });
    await refresh_token_model_1.RefreshTokenModel.create({
        userId,
        family,
        tokenHash: (0, jwt_1.hashToken)(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return { accessToken, refreshToken };
}
async function refreshTokens(refreshToken) {
    const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
    const tokenHash = (0, jwt_1.hashToken)(refreshToken);
    const storedToken = await refresh_token_model_1.RefreshTokenModel.findOne({ tokenHash });
    if (!storedToken || storedToken.isUsed || storedToken.isRevoked) {
        await revokeTokenFamily(payload.family);
        throw new Error("Refresh token reuse detected");
    }
    storedToken.isUsed = true;
    await storedToken.save();
    const newAccessToken = (0, jwt_1.generateAccessToken)({ userId: payload.userId });
    const newRefreshToken = (0, jwt_1.generateRefreshToken)({
        userId: payload.userId,
        family: payload.family,
    });
    await refresh_token_model_1.RefreshTokenModel.create({
        userId: payload.userId,
        family: payload.family,
        tokenHash: (0, jwt_1.hashToken)(newRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    };
}
async function revokeTokenFamily(family) {
    await refresh_token_model_1.RefreshTokenModel.updateMany({ family }, { isRevoked: true });
}
async function revokeAllUserTokens(userId) {
    await refresh_token_model_1.RefreshTokenModel.updateMany({ userId }, { isRevoked: true });
}
