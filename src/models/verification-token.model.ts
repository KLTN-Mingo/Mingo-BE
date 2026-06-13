// src/models/verification-token.model.ts
import { Schema, model, Document, Types } from "mongoose";

/**
 * Mục đích sử dụng của một verification token.
 * Phân tách rõ luồng để cùng schema có thể tái sử dụng nhưng không đụng nhau.
 */
export enum VerificationPurpose {
  EMAIL_VERIFY = "email_verify",
  PHONE_VERIFY = "phone_verify",
  REGISTER_EMAIL_VERIFY = "register_email_verify",
  REGISTER_PHONE_VERIFY = "register_phone_verify",
  PASSWORD_RESET = "password_reset",
}

/**
 * Channel = cách gửi token tới user.
 * - email: gửi link verify hoặc OTP qua email
 * - sms:   gửi OTP qua SMS (Twilio/...) — placeholder hiện tại in console.
 */
export enum VerificationChannel {
  EMAIL = "email",
  SMS = "sms",
}

export interface IVerificationToken extends Document {
  _id: Types.ObjectId;

  /** Có thể null khi user chưa đăng nhập (forgot password trước khi biết userId). */
  userId: Types.ObjectId | null;

  /** Chuẩn hoá: email lowercase hoặc số điện thoại đã trim. */
  identifier: string;

  channel: VerificationChannel;
  purpose: VerificationPurpose;

  /** Hash của token/OTP (sha256 hex). KHÔNG lưu raw. */
  tokenHash: string;

  expiresAt: Date;
  usedAt: Date | null;

  /** Số lần thử verify sai để chống brute-force OTP. */
  attempts: number;

  /** Metadata tuỳ chọn: ip, userAgent, ... — debug & audit. */
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const VerificationTokenSchema = new Schema<IVerificationToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    channel: {
      type: String,
      enum: Object.values(VerificationChannel),
      required: true,
    },
    purpose: {
      type: String,
      enum: Object.values(VerificationPurpose),
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// MongoDB tự xoá document hết hạn — không cần cron.
VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Truy vấn nhanh: verify(identifier + purpose) chỉ nhìn token chưa dùng.
VerificationTokenSchema.index({
  identifier: 1,
  purpose: 1,
  usedAt: 1,
  createdAt: -1,
});

export const VerificationTokenModel = model<IVerificationToken>(
  "VerificationToken",
  VerificationTokenSchema
);
