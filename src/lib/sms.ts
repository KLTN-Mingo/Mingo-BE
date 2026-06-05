// src/lib/sms.ts
/**
 * SMS sender placeholder. Hiện tại in OTP ra console để dev/test.
 *
 * Khi triển khai production, gắn provider thực tế (Twilio/Vonage/Speedio):
 *   1. Cài SDK tương ứng (vd: `npm i twilio`).
 *   2. Set ENV: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM.
 *   3. Bật nhánh `sendViaTwilio` trong hàm `sendSms` bên dưới.
 *
 * Không throw để không phá luồng OTP khi provider down — nghiệp vụ verify
 * vẫn còn email làm kênh chính.
 */

interface TwilioClientLike {
  messages: {
    create(opts: {
      body: string;
      from: string;
      to: string;
    }): Promise<{ sid: string }>;
  };
}

let _twilioClient: TwilioClientLike | null = null;

function getTwilioClient(): TwilioClientLike | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  if (_twilioClient) return _twilioClient;
  try {
    // Tránh require nếu chưa cài twilio.

    const twilio = require("twilio");
    _twilioClient = twilio(sid, token) as TwilioClientLike;
    return _twilioClient;
  } catch {
    console.warn(
      "[sms] TWILIO_* được set nhưng package 'twilio' chưa cài. Bỏ qua."
    );
    return null;
  }
}

export interface SendSmsOptions {
  to: string;
  body: string;
}

export async function sendSms(opts: SendSmsOptions): Promise<void> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_FROM;

  if (!client || !from) {
    console.log(`[sms:DEV] To: ${opts.to}\n  Body: ${opts.body}`);
    return;
  }

  try {
    await client.messages.create({
      body: opts.body,
      from,
      to: opts.to,
    });
  } catch (err) {
    console.error("[sms] Send sms failed:", err);
  }
}

export function buildOtpSmsBody(otp: string, expiresInMinutes: number): string {
  return `[Mingo] Mã xác thực của bạn là ${otp}. Mã hết hạn sau ${expiresInMinutes} phút. Vui lòng không chia sẻ.`;
}
