"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.refresh = exports.login = exports.register = void 0;
const token_service_1 = require("../lib/auth/token-service");
const cookies_1 = require("../lib/auth/cookies");
const user_model_1 = require("../models/user.model");
const bcrypt_1 = __importDefault(require("bcrypt"));
const async_handler_1 = require("../utils/async-handler");
const errors_1 = require("../errors");
const response_1 = require("../utils/response");
const auth_dto_1 = require("../dtos/auth.dto");
/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
exports.register = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { phoneNumber, password, name } = req.body;
    if (!phoneNumber || !password) {
        throw new errors_1.ValidationError("Thiếu số điện thoại hoặc mật khẩu");
    }
    if (password.length < 6) {
        throw new errors_1.ValidationError("Mật khẩu phải có ít nhất 6 ký tự");
    }
    const existedUser = await user_model_1.UserModel.findOne({ phoneNumber });
    if (existedUser) {
        throw new errors_1.ConflictError("Số điện thoại đã được đăng ký");
    }
    const passwordHash = await bcrypt_1.default.hash(password, 10);
    const user = await user_model_1.UserModel.create({ phoneNumber, passwordHash, name });
    const { accessToken, refreshToken } = await (0, token_service_1.createTokenPair)(user._id.toString());
    (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
    (0, response_1.sendCreated)(res, { accessToken, user: (0, auth_dto_1.toAuthUser)(user) }, "Đăng ký thành công");
});
/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập
 * @access  Public
 */
exports.login = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
        throw new errors_1.ValidationError("Thiếu số điện thoại hoặc mật khẩu");
    }
    const user = await user_model_1.UserModel.findOne({ phoneNumber });
    // Không tiết lộ lỗi cụ thể - dùng message chung
    if (!user) {
        throw new errors_1.UnauthorizedError("Sai số điện thoại hoặc mật khẩu");
    }
    const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new errors_1.UnauthorizedError("Sai số điện thoại hoặc mật khẩu");
    }
    const { accessToken, refreshToken } = await (0, token_service_1.createTokenPair)(user._id.toString());
    (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
    (0, response_1.sendSuccess)(res, { accessToken, user: (0, auth_dto_1.toAuthUser)(user) }, "Đăng nhập thành công");
});
/**
 * @route   POST /api/auth/refresh
 * @desc    Làm mới access token
 * @access  Public (cần refresh token trong cookie)
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
 * @desc    Đăng xuất
 * @access  Private
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
