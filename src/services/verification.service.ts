// src/services/verification.service.ts
import crypto from "crypto";
import { Types } from "mongoose";
import {
  VerificationTokenModel,
  VerificationPurpose,
  VerificationChannel,
} from "../models/verification-token.model";
import { ValidationError, NotFoundError } from "../errors";

/**
 * Cấu hình mặc định cho từng purpose.
 * - OTP: 6 chữ số, 10 phút
 * - Token (link): 32 byte hex, 30 phút (verify) / 60 phút (reset)
 */
const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_OTP_EXPIRES_MIN = 10;
const DEFAULT_LINK_TOKEN_BYTES = 32;
const DEFAULT_VERIFY_LINK_EXPIRES_MIN = 30;
const DEFAULT_RESET_LINK_EXPIRES_MIN = 60;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function hashRaw(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateOtp(length = DEFAULT_OTP_LENGTH): string {
  // Dùng crypto.randomInt để OTP đều phân phối, tránh bias.
  let s = "";
  for (let i = 0; i < length; i++) {
    s += crypto.randomInt(0, 10).toString();
  }
  return s;
}

function generateLinkToken(): string {
  return crypto.randomBytes(DEFAULT_LINK_TOKEN_BYTES).toString("hex");
}

function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface IssuedToken {
  /** Raw token gửi cho user (không lưu DB). */
  rawToken: string;
  /** OTP code song song link (gửi cùng email). Có thể bỏ qua nếu channel là SMS. */
  otp?: string;
  expiresAt: Date;
}

export interface IssueOptions {
  userId?: string | Types.ObjectId | null;
  identifier: string;
  channel: VerificationChannel;
  purpose: VerificationPurpose;
  /** Sinh OTP riêng cho email (đi kèm link). Mặc định: true. */
  withOtp?: boolean;
  expiresInMinutes?: number;
  metadata?: Record<string, unknown>;
}

export const VerificationService = {
  /**
   * Tạo verification record mới. Vô hiệu hoá các record cùng (identifier+purpose)
   * còn pending để chỉ 1 token sống tại một thời điểm.
   *
   * Throw ValidationError nếu user gọi quá dày (chống spam).
   */
  async issue(opts: IssueOptions): Promise<IssuedToken> {
    const identifier = normalizeIdentifier(opts.identifier);
    if (!identifier) {
      throw new ValidationError("Thiếu định danh (email/phone)");
    }

    // Anti-spam: chỉ cho phép gửi lại sau RESEND_COOLDOWN_SECONDS
    const cutoff = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000);
    const recent = await VerificationTokenModel.findOne({
      identifier,
      purpose: opts.purpose,
      createdAt: { $gt: cutoff },
    })
      .sort({ createdAt: -1 })
      .lean();
    if (recent) {
      throw new ValidationError(
        `Vui lòng đợi ${RESEND_COOLDOWN_SECONDS}s rồi yêu cầu lại`,
        "VERIFICATION_RATE_LIMITED"
      );
    }

    // Vô hiệu hoá các token cũ cùng (identifier + purpose) chưa dùng.
    await VerificationTokenModel.updateMany(
      {
        identifier,
        purpose: opts.purpose,
        usedAt: null,
      },
      { $set: { usedAt: new Date() } }
    );

    const expiresInMinutes =
      opts.expiresInMinutes ??
      (opts.purpose === VerificationPurpose.PASSWORD_RESET
        ? DEFAULT_RESET_LINK_EXPIRES_MIN
        : DEFAULT_VERIFY_LINK_EXPIRES_MIN);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    let rawToken: string;
    let otp: string | undefined;

    if (opts.channel === VerificationChannel.SMS) {
      // SMS: chỉ cần OTP (raw == OTP).
      otp = generateOtp();
      rawToken = otp;
    } else {
      // EMAIL: link token + OTP đi kèm để FE/dev có lựa chọn.
      rawToken = generateLinkToken();
      if (opts.withOtp !== false) {
        otp = generateOtp();
      }
    }

    // Hash riêng cho rawToken; OTP cũng được hash chung 1 record nếu có.
    // Lưu ý: chỉ hash 1 trong 2 — link token là chính. OTP sẽ được hash thêm
    // và verify riêng qua tokenHash so sánh từng giá trị.
    // Cách đơn giản: lưu 2 record (link + otp) hoặc gộp bằng cách dùng cả 2.
    // Ở đây, để đơn giản & đủ dùng: nếu có OTP, ta lưu thêm 1 record OTP riêng.

    await VerificationTokenModel.create({
      userId: opts.userId ? new Types.ObjectId(String(opts.userId)) : null,
      identifier,
      channel: opts.channel,
      purpose: opts.purpose,
      tokenHash: hashRaw(rawToken),
      expiresAt,
      metadata: opts.metadata,
    });

    if (otp && otp !== rawToken) {
      await VerificationTokenModel.create({
        userId: opts.userId ? new Types.ObjectId(String(opts.userId)) : null,
        identifier,
        channel: opts.channel,
        purpose: opts.purpose,
        tokenHash: hashRaw(otp),
        expiresAt,
        metadata: { ...(opts.metadata ?? {}), kind: "otp" },
      });
    }

    return { rawToken, otp, expiresAt };
  },

  /**
   * Verify một token/OTP. Trả về userId & identifier nếu hợp lệ.
   * - Tăng attempts cho mọi attempt sai (chống brute-force).
   * - Sau N lần sai, đánh dấu used để buộc user xin token mới.
   */
  async verify(opts: {
    identifier: string;
    purpose: VerificationPurpose;
    code: string;
  }): Promise<{ userId: Types.ObjectId | null; identifier: string }> {
    const identifier = normalizeIdentifier(opts.identifier);
    const code = opts.code?.trim();
    if (!identifier || !code) {
      throw new ValidationError("Thiếu identifier hoặc mã xác thực");
    }

    const tokenHash = hashRaw(code);
    const record = await VerificationTokenModel.findOne({
      identifier,
      purpose: opts.purpose,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .limit(1);

    // Không có record → có thể đã hết hạn / đã verify trước đó.
    if (!record) {
      throw new NotFoundError(
        "Mã xác thực không tồn tại hoặc đã hết hạn",
        "VERIFICATION_NOT_FOUND"
      );
    }

    if (record.tokenHash !== tokenHash) {
      record.attempts += 1;
      if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        record.usedAt = new Date();
      }
      await record.save();
      throw new ValidationError(
        "Mã xác thực không đúng",
        "VERIFICATION_CODE_INVALID"
      );
    }

    record.usedAt = new Date();
    await record.save();

    // Vô hiệu hoá record OTP/link còn lại cùng cặp để tránh dùng kênh khác.
    await VerificationTokenModel.updateMany(
      {
        _id: { $ne: record._id },
        identifier,
        purpose: opts.purpose,
        usedAt: null,
      },
      { $set: { usedAt: new Date() } }
    );

    return { userId: record.userId, identifier: record.identifier };
  },
};

export const VerificationConfig = {
  DEFAULT_OTP_LENGTH,
  DEFAULT_OTP_EXPIRES_MIN,
  DEFAULT_VERIFY_LINK_EXPIRES_MIN,
  DEFAULT_RESET_LINK_EXPIRES_MIN,
  MAX_VERIFY_ATTEMPTS,
};
