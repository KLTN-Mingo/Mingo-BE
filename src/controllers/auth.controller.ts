// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import {
  createTokenPair,
  refreshTokens,
  revokeAllUserTokens,
} from "../lib/auth/token-service";
import {
  setRefreshTokenCookie,
  clearAllAuthCookies,
  getRefreshTokenFromCookie,
} from "../lib/auth/cookies";
import { UserModel } from "../models/user.model";
import bcrypt from "bcrypt";
import { asyncHandler } from "../utils/async-handler";
import { ValidationError, UnauthorizedError, ConflictError } from "../errors";
import { sendSuccess, sendCreated } from "../utils/response";
import { toAuthUser, type RegisterDto, type LoginDto } from "../dtos/auth.dto";

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, password, name } = req.body as RegisterDto;

  if (!phoneNumber || !password) {
    throw new ValidationError("Thiếu số điện thoại hoặc mật khẩu");
  }

  if (password.length < 6) {
    throw new ValidationError("Mật khẩu phải có ít nhất 6 ký tự");
  }

  const existedUser = await UserModel.findOne({ phoneNumber });
  if (existedUser) {
    throw new ConflictError("Số điện thoại đã được đăng ký");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await UserModel.create({ phoneNumber, passwordHash, name });

  const { accessToken, refreshToken } = await createTokenPair(
    user._id.toString()
  );

  setRefreshTokenCookie(res, refreshToken);

  sendCreated(
    res,
    { accessToken, user: toAuthUser(user) },
    "Đăng ký thành công"
  );
});

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, password } = req.body as LoginDto;

  if (!phoneNumber || !password) {
    throw new ValidationError("Thiếu số điện thoại hoặc mật khẩu");
  }

  const user = await UserModel.findOne({ phoneNumber });

  // Không tiết lộ lỗi cụ thể - dùng message chung
  if (!user) {
    throw new UnauthorizedError("Sai số điện thoại hoặc mật khẩu");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    throw new UnauthorizedError("Sai số điện thoại hoặc mật khẩu");
  }

  const { accessToken, refreshToken } = await createTokenPair(
    user._id.toString()
  );

  setRefreshTokenCookie(res, refreshToken);

  sendSuccess(
    res,
    { accessToken, user: toAuthUser(user) },
    "Đăng nhập thành công"
  );
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Làm mới access token
 * @access  Public (cần refresh token trong cookie)
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = getRefreshTokenFromCookie(req);

  if (!token) {
    throw new UnauthorizedError("Không tìm thấy refresh token");
  }

  const result = await refreshTokens(token);

  setRefreshTokenCookie(res, result.refreshToken);

  sendSuccess(
    res,
    { accessToken: result.accessToken },
    "Làm mới token thành công"
  );
});

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất
 * @access  Private
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { allDevices } = req.body;
  const userId = (req as any).user?.userId;

  if (allDevices && userId) {
    await revokeAllUserTokens(userId);
  }

  clearAllAuthCookies(res);

  sendSuccess(
    res,
    null,
    allDevices
      ? "Đăng xuất khỏi tất cả thiết bị thành công"
      : "Đăng xuất thành công"
  );
});
