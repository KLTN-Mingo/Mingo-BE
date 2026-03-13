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
const jwt_1 = require("../lib/auth/jwt");
const crypto_1 = __importDefault(require("crypto"));
const app_error_1 = require("../errors/app-error");
const refresh_token_model_1 = require("../models/refresh-token.model");
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
/**
 * Làm mới token pair sử dụng refresh token
 * Implement Refresh Token Rotation để bảo mật
 */
async function refreshTokens(refreshToken) {
    // Verify refresh token
    let payload;
    try {
        payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
    }
    catch (error) {
        throw new app_error_1.TokenError("Refresh token không hợp lệ hoặc đã hết hạn");
    }
    const tokenHash = (0, jwt_1.hashToken)(refreshToken);
    // Tìm token trong database
    const storedToken = await refresh_token_model_1.RefreshTokenModel.findOne({ tokenHash });
    if (!storedToken) {
        throw new app_error_1.UnauthorizedError("Refresh token không tồn tại");
    }
    // Kiểm tra token đã bị revoke chưa
    if (storedToken.isRevoked) {
        throw new app_error_1.UnauthorizedError("Refresh token đã bị thu hồi");
    }
    // ⚠️ QUAN TRỌNG: Phát hiện token reuse - có thể bị tấn công
    if (storedToken.isUsed) {
        // Thu hồi toàn bộ token family để bảo vệ tài khoản
        await revokeTokenFamily(payload.family);
        throw new app_error_1.TokenReuseError("Phát hiện sử dụng lại refresh token - đã thu hồi toàn bộ phiên đăng nhập");
    }
    // Đánh dấu token cũ đã được sử dụng
    storedToken.isUsed = true;
    await storedToken.save();
    // Tạo token mới cùng family
    const newAccessToken = (0, jwt_1.generateAccessToken)({ userId: payload.userId });
    const newRefreshToken = (0, jwt_1.generateRefreshToken)({
        userId: payload.userId,
        family: payload.family,
    });
    // Lưu refresh token mới
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
/**
 * Thu hồi toàn bộ token trong một family
 * Dùng khi phát hiện token reuse
 */
async function revokeTokenFamily(family) {
    await refresh_token_model_1.RefreshTokenModel.updateMany({ family }, { isRevoked: true });
}
/**
 * Thu hồi toàn bộ token của user
 * Dùng khi đăng xuất khỏi tất cả thiết bị
 */
async function revokeAllUserTokens(userId) {
    await refresh_token_model_1.RefreshTokenModel.updateMany({ userId }, { isRevoked: true });
}
