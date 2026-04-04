"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refresh = exports.completeTwoFactorLogin = exports.disableTwoFactor = exports.enableTwoFactor = exports.setupTwoFactor = exports.googleLogin = exports.login = exports.register = void 0;
// src/controllers/auth.controller.ts
const crypto_1 = __importDefault(require("crypto"));
const token_service_1 = require("../lib/auth/token-service");
const cookies_1 = require("../lib/auth/cookies");
const jwt_1 = require("../lib/auth/jwt");
const user_model_1 = require("../models/user.model");
const bcrypt_1 = __importDefault(require("bcrypt"));
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../errors");
const response_1 = require("../utils/response");
const auth_dto_1 = require("../dtos/auth.dto");
const otplib_1 = require("otplib");
const google_auth_library_1 = require("google-auth-library");
function randomEmailOnlyPhone() {
    return `e_${crypto_1.default.randomBytes(12).toString("hex")}`;
}
/**
 * @route   POST /api/auth/register
 */
exports.register = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { phoneNumber, email, password, name } = req.body;
    if (!password) {
        throw new errors_1.ValidationError("Thiếu mật khẩu");
    }
    if (password.length < 6) {
        throw new errors_1.ValidationError("Mật khẩu phải có ít nhất 6 ký tự");
    }
    const phone = phoneNumber?.trim();
    const em = email?.trim().toLowerCase();
    if (!phone && !em) {
        throw new errors_1.ValidationError("Cần số điện thoại hoặc email");
    }
    let finalPhone;
    if (phone) {
        const existedPhone = await user_model_1.UserModel.findOne({ phoneNumber: phone });
        if (existedPhone) {
            throw new errors_1.ConflictError("Số điện thoại đã được đăng ký");
        }
        finalPhone = phone;
    }
    else {
        let candidate = randomEmailOnlyPhone();
        for (let i = 0; i < 12; i++) {
            const dup = await user_model_1.UserModel.findOne({ phoneNumber: candidate });
            if (!dup)
                break;
            candidate = randomEmailOnlyPhone();
        }
        finalPhone = candidate;
    }
    if (em) {
        const existedEmail = await user_model_1.UserModel.findOne({ email: em });
        if (existedEmail) {
            throw new errors_1.ConflictError("Email đã được đăng ký");
        }
    }
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const user = await user_model_1.UserModel.create({
        phoneNumber: finalPhone,
        email: em || undefined,
        passwordHash,
        name,
    });
    const { accessToken, refreshToken } = await (0, token_service_1.createTokenPair)(user._id.toString());
    (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
    (0, response_1.sendCreated)(res, { accessToken, user: (0, auth_dto_1.toAuthUser)(user) }, "Đăng ký thành công");
});
/**
 * @route   POST /api/auth/login
 */
exports.login = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { phoneNumber, email, password } = req.body;
    if (!password) {
        throw new errors_1.ValidationError("Thiếu mật khẩu");
    }
    const phone = phoneNumber?.trim();
    const em = email?.trim().toLowerCase();
    if (!phone && !em) {
        throw new errors_1.ValidationError("Cần số điện thoại hoặc email");
    }
    const user = em
        ? await user_model_1.UserModel.findOne({ email: em })
        : await user_model_1.UserModel.findOne({ phoneNumber: phone });
    if (!user) {
        throw new errors_1.UnauthorizedError("Sai số điện thoại/email hoặc mật khẩu");
    }
    if (user.isBlocked) {
        throw new errors_1.UnauthorizedError("Tài khoản đã bị khóa");
    }
    const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new errors_1.UnauthorizedError("Sai số điện thoại/email hoặc mật khẩu");
    }
    if (user.twoFactorEnabled && user.twoFactorSecret) {
        const pendingToken = (0, jwt_1.generateTwoFactorPendingToken)(user._id.toString());
        return (0, response_1.sendSuccess)(res, { requiresTwoFactor: true, pendingToken }, "Cần xác thực hai yếu tố");
    }
    const { accessToken, refreshToken } = await (0, token_service_1.createTokenPair)(user._id.toString());
    (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
    (0, response_1.sendSuccess)(res, { accessToken, user: (0, auth_dto_1.toAuthUser)(user) }, "Đăng nhập thành công");
});
/**
 * @route   POST /api/auth/google
 * @body    { idToken: string }
 */
exports.googleLogin = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { idToken } = req.body;
    if (!idToken?.trim()) {
        throw new errors_1.ValidationError("idToken là bắt buộc");
    }
    const raw = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!raw) {
        throw new errors_1.ValidationError("Chưa cấu hình GOOGLE_CLIENT_ID trên server");
    }
    const audiences = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const client = new google_auth_library_1.OAuth2Client();
    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: audiences.length ? audiences : undefined,
        });
        payload = ticket.getPayload();
    }
    catch {
        throw new errors_1.UnauthorizedError("Google idToken không hợp lệ");
    }
    if (!payload) {
        throw new errors_1.UnauthorizedError("Google idToken không hợp lệ");
    }
    const sub = payload.sub;
    if (!sub) {
        throw new errors_1.UnauthorizedError("Google idToken không hợp lệ");
    }
    const googleId = sub;
    const gEmail = typeof payload.email === "string"
        ? payload.email.toLowerCase()
        : undefined;
    let user = await user_model_1.UserModel.findOne({
        $or: [{ googleId }, ...(gEmail ? [{ email: gEmail }] : [])],
    });
    if (!user) {
        const randomPass = crypto_1.default.randomBytes(32).toString("hex");
        const passwordHash = await bcrypt_1.default.hash(randomPass, 10);
        const phone = `g_${googleId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
        let finalPhone = phone;
        for (let i = 0; i < 5; i++) {
            const dup = await user_model_1.UserModel.findOne({ phoneNumber: finalPhone });
            if (!dup)
                break;
            finalPhone = `g_${googleId.slice(0, 10)}_${crypto_1.default.randomBytes(4).toString("hex")}`;
        }
        user = await user_model_1.UserModel.create({
            phoneNumber: finalPhone,
            email: gEmail || undefined,
            passwordHash,
            googleId,
            name: typeof payload.name === "string" ? payload.name : undefined,
            verified: true,
        });
    }
    else {
        if (!user.googleId) {
            user.googleId = googleId;
        }
        if (gEmail && !user.email) {
            user.email = gEmail;
        }
        await user.save();
    }
    if (user.isBlocked) {
        throw new errors_1.UnauthorizedError("Tài khoản đã bị khóa");
    }
    if (user.twoFactorEnabled && user.twoFactorSecret) {
        const pendingToken = (0, jwt_1.generateTwoFactorPendingToken)(user._id.toString());
        return (0, response_1.sendSuccess)(res, { requiresTwoFactor: true, pendingToken }, "Cần xác thực hai yếu tố");
    }
    const { accessToken, refreshToken } = await (0, token_service_1.createTokenPair)(user._id.toString());
    (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
    (0, response_1.sendSuccess)(res, { accessToken, user: (0, auth_dto_1.toAuthUser)(user) }, "Đăng nhập Google thành công");
});
/**
 * @route   POST /api/auth/2fa/setup
 */
exports.setupTwoFactor = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const user = await user_model_1.UserModel.findById(userId);
    if (!user)
        throw new errors_1.NotFoundError("Không tìm thấy người dùng");
    if (user.twoFactorEnabled) {
        throw new errors_1.ValidationError("2FA đã được bật");
    }
    const secret = (0, otplib_1.generateSecret)();
    const label = user.email || user.phoneNumber;
    const otpauthUrl = (0, otplib_1.generateURI)({
        issuer: "Mingo",
        label,
        secret,
    });
    (0, response_1.sendSuccess)(res, { secret, otpauthUrl }, "Quét QR trong app Authenticator rồi gọi POST /api/auth/2fa/enable");
});
/**
 * @route   POST /api/auth/2fa/enable
 * @body    { secret: string, code: string }
 */
exports.enableTwoFactor = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { secret, code } = req.body;
    if (!secret || !code) {
        throw new errors_1.ValidationError("secret và code là bắt buộc");
    }
    const user = await user_model_1.UserModel.findById(userId);
    if (!user)
        throw new errors_1.NotFoundError("Không tìm thấy người dùng");
    if (user.twoFactorEnabled) {
        throw new errors_1.ValidationError("2FA đã được bật");
    }
    const { valid: ok } = (0, otplib_1.verifySync)({ token: code, secret });
    if (!ok) {
        throw new errors_1.ValidationError("Mã 2FA không đúng");
    }
    user.twoFactorSecret = secret;
    user.twoFactorEnabled = true;
    await user.save();
    (0, response_1.sendSuccess)(res, { twoFactorEnabled: true }, "Đã bật 2FA");
});
/**
 * @route   POST /api/auth/2fa/disable
 * @body    { code: string, password: string }
 */
exports.disableTwoFactor = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.userId;
    const { code, password } = req.body;
    if (!code || !password) {
        throw new errors_1.ValidationError("code và password là bắt buộc");
    }
    const user = await user_model_1.UserModel.findById(userId);
    if (!user)
        throw new errors_1.NotFoundError("Không tìm thấy người dùng");
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        throw new errors_1.ValidationError("2FA chưa được bật");
    }
    const passOk = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!passOk) {
        throw new errors_1.UnauthorizedError("Mật khẩu không đúng");
    }
    const { valid: totpOk } = (0, otplib_1.verifySync)({
        token: code,
        secret: user.twoFactorSecret,
    });
    if (!totpOk) {
        throw new errors_1.ValidationError("Mã 2FA không đúng");
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    (0, response_1.sendSuccess)(res, { twoFactorEnabled: false }, "Đã tắt 2FA");
});
/**
 * @route   POST /api/auth/2fa/complete-login
 * @body    { pendingToken: string, code: string }
 */
exports.completeTwoFactorLogin = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { pendingToken, code } = req.body;
    if (!pendingToken || !code) {
        throw new errors_1.ValidationError("pendingToken và code là bắt buộc");
    }
    let userId;
    try {
        userId = (0, jwt_1.verifyTwoFactorPendingToken)(pendingToken);
    }
    catch {
        throw new errors_1.UnauthorizedError("Phiên 2FA không hợp lệ hoặc đã hết hạn. Đăng nhập lại.");
    }
    const user = await user_model_1.UserModel.findById(userId);
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        throw new errors_1.UnauthorizedError("2FA không áp dụng cho tài khoản này");
    }
    const { valid: ok } = (0, otplib_1.verifySync)({
        token: code,
        secret: user.twoFactorSecret,
    });
    if (!ok) {
        throw new errors_1.UnauthorizedError("Mã 2FA không đúng");
    }
    const { accessToken, refreshToken } = await (0, token_service_1.createTokenPair)(user._id.toString());
    (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
    (0, response_1.sendSuccess)(res, { accessToken, user: (0, auth_dto_1.toAuthUser)(user) }, "Đăng nhập thành công");
});
/**
 * @route   POST /api/auth/refresh-token
 */
exports.refresh = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const token = (0, cookies_1.getRefreshTokenFromCookie)(req);
    if (!token) {
        throw new errors_1.UnauthorizedError("Không tìm thấy refresh token");
    }
    const result = await (0, token_service_1.refreshTokens)(token);
    (0, cookies_1.setRefreshTokenCookie)(res, result.refreshToken);
    (0, response_1.sendSuccess)(res, { accessToken: result.accessToken }, "Làm mới token thành công");
});
/**
 * @route   POST /api/auth/logout
 */
exports.logout = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { allDevices } = req.body;
    const userId = req.user?.userId;
    if (allDevices && userId) {
        await (0, token_service_1.revokeAllUserTokens)(userId);
    }
    (0, cookies_1.clearAllAuthCookies)(res);
    (0, response_1.sendSuccess)(res, null, allDevices
        ? "Đăng xuất khỏi tất cả thiết bị thành công"
        : "Đăng xuất thành công");
});
