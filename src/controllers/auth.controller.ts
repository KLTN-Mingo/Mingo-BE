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
import {
  ValidationError,
  UnauthorizedError,
  ConflictError,
} from "../errors/app-error";

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, password, name } = req.body;

  // 1️⃣ Validate - Sử dụng throw thay vì return res.status()
  if (!phoneNumber || !password) {
    throw new ValidationError("Thiếu số điện thoại hoặc mật khẩu");
  }

  if (password.length < 6) {
    throw new ValidationError("Mật khẩu phải có ít nhất 6 ký tự");
  }

  // 2️⃣ Check user tồn tại
  const existedUser = await UserModel.findOne({ phoneNumber });
  if (existedUser) {
    throw new ConflictError("Số điện thoại đã được đăng ký");
  }

  // 3️⃣ Hash mật khẩu
  const passwordHash = await bcrypt.hash(password, 10);

  // 4️⃣ Tạo user
  const user = await UserModel.create({
    phoneNumber,
    passwordHash,
    name,
  });

  // 5️⃣ Auto login sau đăng ký
  const { accessToken, refreshToken } = await createTokenPair(
    user._id.toString()
  );

  setRefreshTokenCookie(res, refreshToken);

  // Response với format chuẩn
  res.status(201).json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
      },
    },
    message: "Đăng ký thành công",
  });
});

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, password } = req.body;

  // 1️⃣ Validate - Throw error thay vì return
  if (!phoneNumber || !password) {
    throw new ValidationError("Thiếu số điện thoại hoặc mật khẩu");
  }

  // 2️⃣ Tìm user
  const user = await UserModel.findOne({ phoneNumber });

  // ❗ Không tiết lộ lỗi cụ thể - Dùng message chung
  if (!user) {
    throw new UnauthorizedError("Sai số điện thoại hoặc mật khẩu");
  }

  // 3️⃣ So sánh mật khẩu
  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    throw new UnauthorizedError("Sai số điện thoại hoặc mật khẩu");
  }

  // 4️⃣ Tạo token
  const { accessToken, refreshToken } = await createTokenPair(
    user._id.toString()
  );

  // 5️⃣ Set cookie
  setRefreshTokenCookie(res, refreshToken);

  // Response với format chuẩn
  res.json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        name: user.name,
      },
    },
    message: "Đăng nhập thành công",
  });
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

  // refreshTokens sẽ tự throw error nếu token invalid
  const result = await refreshTokens(token);

  setRefreshTokenCookie(res, result.refreshToken);

  res.json({
    success: true,
    data: {
      accessToken: result.accessToken,
    },
    message: "Làm mới token thành công",
  });
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

  res.status(200).json({
    success: true,
    message: allDevices
      ? "Đăng xuất khỏi tất cả thiết bị thành công"
      : "Đăng xuất thành công",
  });
});
