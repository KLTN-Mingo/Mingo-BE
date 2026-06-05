// src/controllers/verification.controller.ts
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "../errors";
import { UserModel } from "../models/user.model";
import {
  VerificationChannel,
  VerificationPurpose,
} from "../models/verification-token.model";
import {
  VerificationService,
  VerificationConfig,
} from "../services/verification.service";
import {
  sendMail,
  buildVerifyEmailContent,
  buildResetPasswordEmailContent,
} from "../lib/mailer";
import { sendSms, buildOtpSmsBody } from "../lib/sms";
import { revokeAllUserTokens } from "../lib/auth/token-service";

function getAuthUserId(req: Request): string {
  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;
  if (!userId) {
    throw new UnauthorizedError("Cần đăng nhập");
  }
  return userId;
}

function buildClientUrl(path: string, params: Record<string, string>): string {
  const base = (process.env.CLIENT_URL || "http://localhost:3001").replace(
    /\/$/,
    ""
  );
  const qs = new URLSearchParams(params).toString();
  return `${base}${path}?${qs}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/auth/email/send-verification
 * Yêu cầu đăng nhập. Gửi link + OTP verify đến email hiện tại của user.
 */
export const sendEmailVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthUserId(req);
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy người dùng");
    if (!user.email) {
      throw new ValidationError(
        "Tài khoản chưa có email. Vui lòng cập nhật email trước."
      );
    }
    if (user.verified) {
      throw new ValidationError("Email đã được xác thực", "EMAIL_ALREADY_VERIFIED");
    }

    const issued = await VerificationService.issue({
      userId: user._id,
      identifier: user.email,
      channel: VerificationChannel.EMAIL,
      purpose: VerificationPurpose.EMAIL_VERIFY,
    });

    const verifyUrl = buildClientUrl("/auth/verify-email", {
      token: issued.rawToken,
      email: user.email,
    });

    const expiresInMinutes = VerificationConfig.DEFAULT_VERIFY_LINK_EXPIRES_MIN;
    const { text, html } = buildVerifyEmailContent({
      name: user.name,
      verifyUrl,
      otp: issued.otp,
      expiresInMinutes,
    });

    await sendMail({
      to: user.email,
      subject: "Xác thực email Mingo",
      text,
      html,
    });

    sendSuccess(
      res,
      { expiresInMinutes },
      "Đã gửi email xác thực. Vui lòng kiểm tra hộp thư."
    );
  }
);

/**
 * @route POST /api/auth/email/verify
 * Body: { email, code }   (code = link token hoặc OTP)
 * Public — vì FE thường gọi trên trang /verify-email từ link.
 */
export const verifyEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, code } = req.body as { email?: string; code?: string };
    if (!email || !code) {
      throw new ValidationError("email và code là bắt buộc");
    }

    const result = await VerificationService.verify({
      identifier: email,
      purpose: VerificationPurpose.EMAIL_VERIFY,
      code,
    });

    // Cập nhật trạng thái verified của user
    if (result.userId) {
      await UserModel.findByIdAndUpdate(result.userId, { verified: true });
    } else {
      // Trường hợp record cũ không có userId — fallback theo email.
      await UserModel.findOneAndUpdate(
        { email: result.identifier },
        { verified: true }
      );
    }

    sendSuccess(res, { verified: true }, "Xác thực email thành công");
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PHONE OTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/auth/phone/send-otp
 * Yêu cầu đăng nhập. Gửi OTP qua SMS đến phoneNumber của user (nếu là số thật).
 */
export const sendPhoneOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthUserId(req);
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy người dùng");

    // Chặn gửi tới phone "ảo" (e_xxx, g_xxx) sinh khi user đăng ký bằng email/Google.
    if (
      !user.phoneNumber ||
      user.phoneNumber.startsWith("e_") ||
      user.phoneNumber.startsWith("g_")
    ) {
      throw new ValidationError(
        "Tài khoản chưa có số điện thoại hợp lệ",
        "PHONE_INVALID"
      );
    }

    const issued = await VerificationService.issue({
      userId: user._id,
      identifier: user.phoneNumber,
      channel: VerificationChannel.SMS,
      purpose: VerificationPurpose.PHONE_VERIFY,
      expiresInMinutes: VerificationConfig.DEFAULT_OTP_EXPIRES_MIN,
    });

    const otp = issued.otp ?? issued.rawToken;
    await sendSms({
      to: user.phoneNumber,
      body: buildOtpSmsBody(otp, VerificationConfig.DEFAULT_OTP_EXPIRES_MIN),
    });

    sendSuccess(
      res,
      { expiresInMinutes: VerificationConfig.DEFAULT_OTP_EXPIRES_MIN },
      "Đã gửi OTP qua SMS"
    );
  }
);

/**
 * @route POST /api/auth/phone/verify-otp
 * Body: { phoneNumber, code }
 * Public — vì FE flow nhập OTP có thể chưa login (đăng ký).
 */
export const verifyPhoneOtp = asyncHandler(
  async (req: Request, res: Response) => {
    const { phoneNumber, code } = req.body as {
      phoneNumber?: string;
      code?: string;
    };
    if (!phoneNumber || !code) {
      throw new ValidationError("phoneNumber và code là bắt buộc");
    }

    const result = await VerificationService.verify({
      identifier: phoneNumber,
      purpose: VerificationPurpose.PHONE_VERIFY,
      code,
    });

    if (result.userId) {
      await UserModel.findByIdAndUpdate(result.userId, { verified: true });
    }

    sendSuccess(res, { verified: true }, "Xác thực số điện thoại thành công");
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FORGOT / RESET PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route POST /api/auth/forgot-password
 * Body: { email?: string, phoneNumber?: string }
 *
 * Luôn trả về 200 với message generic để tránh user enumeration.
 */
export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body as {
      email?: string;
      phoneNumber?: string;
    };

    const em = email?.trim().toLowerCase();
    const phone = phoneNumber?.trim();

    if (!em && !phone) {
      throw new ValidationError("Cần email hoặc số điện thoại");
    }

    const user = em
      ? await UserModel.findOne({ email: em })
      : await UserModel.findOne({ phoneNumber: phone });

    // Nếu không có user — vẫn trả 200 để tránh đoán user.
    if (!user) {
      sendSuccess(
        res,
        { sent: true },
        "Nếu thông tin tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu."
      );
      return;
    }

    // Ưu tiên email nếu user có email; fallback phone qua SMS.
    if (user.email) {
      const issued = await VerificationService.issue({
        userId: user._id,
        identifier: user.email,
        channel: VerificationChannel.EMAIL,
        purpose: VerificationPurpose.PASSWORD_RESET,
      });

      const resetUrl = buildClientUrl("/auth/reset-password", {
        token: issued.rawToken,
        email: user.email,
      });

      const { text, html } = buildResetPasswordEmailContent({
        name: user.name,
        resetUrl,
        otp: issued.otp,
        expiresInMinutes: VerificationConfig.DEFAULT_RESET_LINK_EXPIRES_MIN,
      });

      await sendMail({
        to: user.email,
        subject: "Đặt lại mật khẩu Mingo",
        text,
        html,
      });
    } else if (
      user.phoneNumber &&
      !user.phoneNumber.startsWith("e_") &&
      !user.phoneNumber.startsWith("g_")
    ) {
      const issued = await VerificationService.issue({
        userId: user._id,
        identifier: user.phoneNumber,
        channel: VerificationChannel.SMS,
        purpose: VerificationPurpose.PASSWORD_RESET,
        expiresInMinutes: VerificationConfig.DEFAULT_OTP_EXPIRES_MIN,
      });

      await sendSms({
        to: user.phoneNumber,
        body: buildOtpSmsBody(
          issued.otp ?? issued.rawToken,
          VerificationConfig.DEFAULT_OTP_EXPIRES_MIN
        ),
      });
    }

    sendSuccess(
      res,
      { sent: true },
      "Nếu thông tin tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu."
    );
  }
);

/**
 * @route POST /api/auth/reset-password
 * Body: { email?: string, phoneNumber?: string, code: string, newPassword: string }
 */
export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, phoneNumber, code, newPassword } = req.body as {
      email?: string;
      phoneNumber?: string;
      code?: string;
      newPassword?: string;
    };

    if (!code) throw new ValidationError("Thiếu mã xác thực");
    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError("Mật khẩu mới phải có ít nhất 6 ký tự");
    }

    const identifier = email
      ? email.trim().toLowerCase()
      : phoneNumber?.trim();
    if (!identifier) {
      throw new ValidationError("Cần email hoặc số điện thoại");
    }

    const result = await VerificationService.verify({
      identifier,
      purpose: VerificationPurpose.PASSWORD_RESET,
      code,
    });

    // Tìm user — ưu tiên userId trong record, fallback theo identifier.
    const user = result.userId
      ? await UserModel.findById(result.userId)
      : email
        ? await UserModel.findOne({ email: identifier })
        : await UserModel.findOne({ phoneNumber: identifier });

    if (!user) {
      throw new NotFoundError("Không tìm thấy người dùng");
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Đặt lại mật khẩu => revoke toàn bộ refresh token đang sống để force re-login.
    await revokeAllUserTokens(user._id.toString());

    sendSuccess(res, { reset: true }, "Đặt lại mật khẩu thành công");
  }
);
