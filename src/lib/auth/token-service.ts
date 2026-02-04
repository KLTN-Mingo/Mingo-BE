// src/lib/auth/token-service.ts
import { RefreshTokenModel } from "../../models/refresh-token.model";
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "./jwt";
import crypto from "crypto";

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

export async function refreshTokens(refreshToken: string) {
  const payload: any = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const storedToken = await RefreshTokenModel.findOne({ tokenHash });

  if (!storedToken || storedToken.isUsed || storedToken.isRevoked) {
    await revokeTokenFamily(payload.family);
    throw new Error("Refresh token reuse detected");
  }

  storedToken.isUsed = true;
  await storedToken.save();

  const newAccessToken = generateAccessToken({ userId: payload.userId });
  const newRefreshToken = generateRefreshToken({
    userId: payload.userId,
    family: payload.family,
  });

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

export async function revokeTokenFamily(family: string) {
  await RefreshTokenModel.updateMany({ family }, { isRevoked: true });
}

export async function revokeAllUserTokens(userId: string) {
  await RefreshTokenModel.updateMany({ userId }, { isRevoked: true });
}
