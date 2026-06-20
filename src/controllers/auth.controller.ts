// src/controllers/auth.controller.ts
import crypto from "crypto";
import { Request, Response } from "express";
import {
  createTokenPair,
  refreshTokens,
  revokeAllUserTokens,
  revokeTokenFamily,
} from "../lib/auth/token-service";
import {
  setRefreshTokenCookie,
  clearAllAuthCookies,
  getRefreshTokenFromCookie,
} from "../lib/auth/cookies";
import {
  generateTwoFactorPendingToken,
  verifyTwoFactorPendingToken,
  verifyRefreshToken,
} from "../lib/auth/jwt";
import { UserModel, checkAndUnbanUser } from "../models/user.model";
import bcrypt from "bcrypt";
import { asyncHandler } from "../utils/async-handler";
import {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from "../errors";
import { sendSuccess, sendCreated } from "../utils/response";
import { toAuthUser, type RegisterDto, type LoginDto } from "../dtos/auth.dto";
import { authenticator } from "otplib";
import { OAuth2Client } from "google-auth-library";

function randomEmailOnlyPhone(): string {
  return `e_${crypto.randomBytes(12).toString("hex")}`;
}

function verifyLoginTwoFactorCode(code: string, secret: string): boolean {
  const loginAuthenticator = authenticator.create({
    ...authenticator.allOptions(),
    window: 1,
  });

  return loginAuthenticator.check(code, secret);
}

/**
 * @route   POST /api/auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, email, password, name } = req.body as RegisterDto;

  if (!password) {
    throw new ValidationError("Thiếu mật khẩu");
  }
  if (password.length < 6) {
    throw new ValidationError("Mật khẩu phải có ít nhất 6 ký tự");
  }

  const phone = phoneNumber?.trim();
  const em = email?.trim().toLowerCase();

  if (!phone && !em) {
    throw new ValidationError("Cần số điện thoại hoặc email");
  }

  let finalPhone: string;
  if (phone) {
    const existedPhone = await UserModel.findOne({ phoneNumber: phone });
    if (existedPhone) {
      throw new ConflictError("Số điện thoại đã được đăng ký");
    }
    finalPhone = phone;
  } else {
    let candidate = randomEmailOnlyPhone();
    for (let i = 0; i < 12; i++) {
      const dup = await UserModel.findOne({ phoneNumber: candidate });
      if (!dup) break;
      candidate = randomEmailOnlyPhone();
    }
    finalPhone = candidate;
  }

  if (em) {
    const existedEmail = await UserModel.findOne({ email: em });
    if (existedEmail) {
      throw new ConflictError("Email đã được đăng ký");
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await UserModel.create({
    phoneNumber: finalPhone,
    email: em || undefined,
    passwordHash,
    name,
  });

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
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, email, password } = req.body as LoginDto;

  if (!password) {
    throw new ValidationError("Thiếu mật khẩu");
  }

  const phone = phoneNumber?.trim();
  const em = email?.trim().toLowerCase();

  if (!phone && !em) {
    throw new ValidationError("Cần số điện thoại hoặc email");
  }

  const user = em
    ? await UserModel.findOne({ email: em })
    : await UserModel.findOne({ phoneNumber: phone });

  if (!user) {
    throw new UnauthorizedError("Sai số điện thoại/email hoặc mật khẩu");
  }

  // Tự động unban nếu hết hạn khóa tạm
  const wasUnbanned = await checkAndUnbanUser(user._id);
  // Reload để lấy trạng thái mới nhất sau unban
  if (wasUnbanned) {
    const refreshed = await UserModel.findById(user._id);
    if (refreshed) Object.assign(user, refreshed.toObject());
  }

  if (user.isBlocked) {
    throw new UnauthorizedError("Tài khoản đã bị khóa");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    throw new UnauthorizedError("Sai số điện thoại/email hoặc mật khẩu");
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const pendingToken = generateTwoFactorPendingToken(user._id.toString());
    return sendSuccess(
      res,
      { requiresTwoFactor: true, pendingToken },
      "Cần xác thực hai yếu tố"
    );
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
 * @route   POST /api/auth/google
 * @body    { idToken: string }
 */
export const googleLogin = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken?.trim()) {
    throw new ValidationError("idToken là bắt buộc");
  }

  const raw = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!raw) {
    throw new ValidationError("Chưa cấu hình GOOGLE_CLIENT_ID trên server");
  }
  const audiences = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const client = new OAuth2Client();
  let payload: Record<string, unknown> | undefined;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: audiences.length ? audiences : undefined,
    });
    payload = ticket.getPayload() as Record<string, unknown> | undefined;
  } catch {
    throw new UnauthorizedError("Google idToken không hợp lệ");
  }

  if (!payload) {
    throw new UnauthorizedError("Google idToken không hợp lệ");
  }

  const sub = payload.sub as string | undefined;
  if (!sub) {
    throw new UnauthorizedError("Google idToken không hợp lệ");
  }

  const googleId = sub;
  const gEmail =
    typeof payload.email === "string" ? payload.email.toLowerCase() : undefined;

  let user = await UserModel.findOne({
    $or: [{ googleId }, ...(gEmail ? [{ email: gEmail }] : [])],
  });

  if (!user) {
    const randomPass = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPass, 10);
    const phone = `g_${googleId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
    let finalPhone = phone;
    for (let i = 0; i < 5; i++) {
      const dup = await UserModel.findOne({ phoneNumber: finalPhone });
      if (!dup) break;
      finalPhone = `g_${googleId.slice(0, 10)}_${crypto.randomBytes(4).toString("hex")}`;
    }

    user = await UserModel.create({
      phoneNumber: finalPhone,
      email: gEmail || undefined,
      passwordHash,
      googleId,
      name: typeof payload.name === "string" ? payload.name : undefined,
      verified: true,
    });
  } else {
    if (!user.googleId) {
      user.googleId = googleId;
    }
    if (gEmail && !user.email) {
      user.email = gEmail;
    }
    await user.save();
  }

  // Tự động unban nếu hết hạn khóa tạm
  const wasUnbanned = await checkAndUnbanUser(user._id);
  // Reload để lấy trạng thái mới nhất sau unban
  if (wasUnbanned) {
    const refreshed = await UserModel.findById(user._id);
    if (refreshed) Object.assign(user, refreshed.toObject());
  }

  if (user.isBlocked) {
    throw new UnauthorizedError("Tài khoản đã bị khóa");
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const pendingToken = generateTwoFactorPendingToken(user._id.toString());
    return sendSuccess(
      res,
      { requiresTwoFactor: true, pendingToken },
      "Cần xác thực hai yếu tố"
    );
  }

  const { accessToken, refreshToken } = await createTokenPair(
    user._id.toString()
  );
  setRefreshTokenCookie(res, refreshToken);
  sendSuccess(
    res,
    { accessToken, user: toAuthUser(user) },
    "Đăng nhập Google thành công"
  );
});

/**
 * @route   POST /api/auth/2fa/setup
 */
export const setupTwoFactor = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy người dùng");
    if (user.twoFactorEnabled) {
      throw new ValidationError("2FA đã được bật");
    }

    const secret = authenticator.generateSecret();
    const label = user.email || user.phoneNumber || user._id.toString();
    const otpauthUrl = authenticator.keyuri(label, "Mingo", secret);

    sendSuccess(
      res,
      { secret, otpauthUrl },
      "Quét QR trong app Authenticator rồi gọi POST /api/auth/2fa/enable"
    );
  }
);

/**
 * @route   POST /api/auth/2fa/enable
 * @body    { secret: string, code: string }
 */
export const enableTwoFactor = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const { secret, code } = req.body as { secret?: string; code?: string };

    if (!secret || !code) {
      throw new ValidationError("secret và code là bắt buộc");
    }

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy người dùng");
    if (user.twoFactorEnabled) {
      throw new ValidationError("2FA đã được bật");
    }

    const ok = authenticator.check(code, secret);
    if (!ok) {
      throw new ValidationError("Mã 2FA không đúng");
    }

    user.twoFactorSecret = secret;
    user.twoFactorEnabled = true;
    await user.save();

    sendSuccess(res, { twoFactorEnabled: true }, "Đã bật 2FA");
  }
);

/**
 * @route   POST /api/auth/2fa/disable
 * @body    { code: string, password: string }
 */
export const disableTwoFactor = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const { code, password } = req.body as { code?: string; password?: string };

    if (!code || !password) {
      throw new ValidationError("code và password là bắt buộc");
    }

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy người dùng");
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new ValidationError("2FA chưa được bật");
    }

    const passOk = await bcrypt.compare(password, user.passwordHash);
    if (!passOk) {
      throw new UnauthorizedError("Mật khẩu không đúng");
    }

    const totpOk = authenticator.check(code, user.twoFactorSecret);
    if (!totpOk) {
      throw new ValidationError("Mã 2FA không đúng");
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    sendSuccess(res, { twoFactorEnabled: false }, "Đã tắt 2FA");
  }
);

/**
 * @route   POST /api/auth/2fa/complete-login
 * @body    { pendingToken: string, code: string }
 */
export const completeTwoFactorLogin = asyncHandler(
  async (req: Request, res: Response) => {
    const { pendingToken, code } = req.body as {
      pendingToken?: string;
      code?: string;
    };

    if (!pendingToken || !code) {
      throw new ValidationError("pendingToken và code là bắt buộc");
    }

    let userId: string;
    try {
      userId = verifyTwoFactorPendingToken(pendingToken);
    } catch {
      throw new UnauthorizedError(
        "Phiên 2FA không hợp lệ hoặc đã hết hạn. Đăng nhập lại."
      );
    }

    const user = await UserModel.findById(userId);
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedError("2FA không áp dụng cho tài khoản này");
    }

    const ok = verifyLoginTwoFactorCode(code, user.twoFactorSecret);
    if (!ok) {
      throw new UnauthorizedError("Mã 2FA không đúng");
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
  }
);

/**
 * @route   POST /api/auth/refresh-token
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
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { allDevices } = req.body;
  const token = getRefreshTokenFromCookie(req);
  let userId: string | undefined;
  let family: string | undefined;

  if (token) {
    try {
      const payload = verifyRefreshToken(token) as {
        userId?: string;
        family?: string;
      };
      userId = payload.userId;
      family = payload.family;
    } catch {
      // Token hỏng/hết hạn vẫn cho logout để FE luôn clear cookie.
    }
  }

  if (allDevices && userId) {
    await revokeAllUserTokens(userId);
  } else if (family) {
    await revokeTokenFamily(family);
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
