// src/lib/auth/token-service.ts
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "../lib/auth/jwt";
import crypto from "crypto";
import {
  TokenError,
  TokenReuseError,
  UnauthorizedError,
} from "../errors/app-error";
import { RefreshTokenModel } from "../models/refresh-token.model";

export async function createTokenPair(userId: string) {
  const family = crypto.randomUUID();

  const accessToken = generateAccessToken({ userId });
  const refreshToken = generateRefreshToken({ userId, family });

  await RefreshTokenModel.create({
    userId,
    family,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken };
}

/**
 * Làm mới token pair sử dụng refresh token
 * Implement Refresh Token Rotation để bảo mật
 */
export async function refreshTokens(refreshToken: string) {
  // Verify refresh token
  let payload: any;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new TokenError("Refresh token không hợp lệ hoặc đã hết hạn");
  }

  const tokenHash = hashToken(refreshToken);

  // Tìm token trong database
  const storedToken = await RefreshTokenModel.findOne({ tokenHash });

  if (!storedToken) {
    throw new UnauthorizedError("Refresh token không tồn tại");
  }

  // Kiểm tra token đã bị revoke chưa
  if (storedToken.isRevoked) {
    throw new UnauthorizedError("Refresh token đã bị thu hồi");
  }

  // ⚠️ QUAN TRỌNG: Phát hiện token reuse - có thể bị tấn công
  if (storedToken.isUsed) {
    // Thu hồi toàn bộ token family để bảo vệ tài khoản
    await revokeTokenFamily(payload.family);
    throw new TokenReuseError(
      "Phát hiện sử dụng lại refresh token - đã thu hồi toàn bộ phiên đăng nhập"
    );
  }

  // Đánh dấu token cũ đã được sử dụng
  storedToken.isUsed = true;
  await storedToken.save();

  // Tạo token mới cùng family
  const newAccessToken = generateAccessToken({ userId: payload.userId });
  const newRefreshToken = generateRefreshToken({
    userId: payload.userId,
    family: payload.family,
  });

  // Lưu refresh token mới
  await RefreshTokenModel.create({
    userId: payload.userId,
    family: payload.family,
    tokenHash: hashToken(newRefreshToken),
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
export async function revokeTokenFamily(family: string) {
  await RefreshTokenModel.updateMany({ family }, { isRevoked: true });
}

/**
 * Thu hồi toàn bộ token của user
 * Dùng khi đăng xuất khỏi tất cả thiết bị
 */
export async function revokeAllUserTokens(userId: string) {
  await RefreshTokenModel.updateMany({ userId }, { isRevoked: true });
}
