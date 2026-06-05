// src/lib/mailer.ts
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Cấu hình SMTP qua env. Thiếu cấu hình -> mailer chạy ở DEV mode (in console).
 *
 * Biến môi trường cần:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 *   SMTP_SECURE  (true|false; mặc định false cho 587, true cho 465)
 *   MAIL_FROM    (vd: "Mingo <no-reply@mingo.app>")
 */

let _transporter: Transporter | null = null;
let _checkedConfig = false;
let _isConfigured = false;

function buildTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true";

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function getTransporter(): Transporter | null {
  if (_checkedConfig) return _transporter;
  _transporter = buildTransporter();
  _isConfigured = !!_transporter;
  _checkedConfig = true;
  if (!_isConfigured) {
    console.warn(
      "[mailer] SMTP chưa cấu hình — email sẽ chỉ in ra console (DEV mode)."
    );
  } else {
    console.log("[mailer] SMTP đã cấu hình.");
  }
  return _transporter;
}

export function isMailerConfigured(): boolean {
  if (!_checkedConfig) getTransporter();
  return _isConfigured;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  /** Plain text body — luôn nên truyền để fallback. */
  text: string;
  /** HTML body — tuỳ chọn. */
  html?: string;
}

/**
 * Gửi email. Nếu chưa cấu hình SMTP, in ra console để dev có thể copy link/OTP.
 * Không bao giờ throw để controller không vỡ luồng nghiệp vụ chính khi mail down.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  const from =
    process.env.MAIL_FROM?.trim() || "Mingo <no-reply@mingo.local>";

  const transporter = getTransporter();
  if (!transporter) {
    console.log(
      `[mailer:DEV] To: ${opts.to}\n  Subject: ${opts.subject}\n  Text:\n${opts.text}`
    );
    return;
  }

  try {
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
  } catch (err) {
    console.error("[mailer] Send mail failed:", err);
  }
}

/**
 * Render template "verify email" — đơn giản, không cần engine.
 * FE gắn ?token=... vào trang verify để gọi POST /api/auth/email/verify.
 */
export function buildVerifyEmailContent(opts: {
  name?: string;
  verifyUrl: string;
  otp?: string;
  expiresInMinutes: number;
}) {
  const greeting = opts.name ? `Xin chào ${opts.name},` : "Xin chào,";
  const otpLine = opts.otp
    ? `Hoặc nhập mã OTP: ${opts.otp} (hết hạn sau ${opts.expiresInMinutes} phút).`
    : "";

  const text = `${greeting}

Vui lòng xác thực email của bạn bằng cách nhấn vào liên kết bên dưới:
${opts.verifyUrl}

${otpLine}

Liên kết hết hạn sau ${opts.expiresInMinutes} phút.
Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.

— Đội ngũ Mingo`;

  const html = `<p>${greeting}</p>
<p>Vui lòng xác thực email của bạn bằng cách nhấn vào liên kết:</p>
<p><a href="${opts.verifyUrl}">${opts.verifyUrl}</a></p>
${opts.otp ? `<p>Hoặc nhập mã OTP: <b>${opts.otp}</b> (hết hạn sau ${opts.expiresInMinutes} phút).</p>` : ""}
<p>Liên kết hết hạn sau ${opts.expiresInMinutes} phút.</p>
<p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
<p>— Đội ngũ Mingo</p>`;

  return { text, html };
}

export function buildResetPasswordEmailContent(opts: {
  name?: string;
  resetUrl: string;
  otp?: string;
  expiresInMinutes: number;
}) {
  const greeting = opts.name ? `Xin chào ${opts.name},` : "Xin chào,";
  const otpLine = opts.otp
    ? `Hoặc dùng mã OTP: ${opts.otp} (hết hạn sau ${opts.expiresInMinutes} phút).`
    : "";

  const text = `${greeting}

Bạn vừa yêu cầu đặt lại mật khẩu. Hãy nhấn vào liên kết để tiếp tục:
${opts.resetUrl}

${otpLine}

Liên kết hết hạn sau ${opts.expiresInMinutes} phút.
Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.

— Đội ngũ Mingo`;

  const html = `<p>${greeting}</p>
<p>Bạn vừa yêu cầu đặt lại mật khẩu. Hãy nhấn vào liên kết để tiếp tục:</p>
<p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p>
${opts.otp ? `<p>Hoặc dùng mã OTP: <b>${opts.otp}</b> (hết hạn sau ${opts.expiresInMinutes} phút).</p>` : ""}
<p>Liên kết hết hạn sau ${opts.expiresInMinutes} phút.</p>
<p>Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.</p>
<p>— Đội ngũ Mingo</p>`;

  return { text, html };
}
