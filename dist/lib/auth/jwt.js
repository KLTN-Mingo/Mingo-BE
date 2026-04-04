"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.hashToken = hashToken;
exports.generateTwoFactorPendingToken = generateTwoFactorPendingToken;
exports.verifyTwoFactorPendingToken = verifyTwoFactorPendingToken;
// src/lib/auth/jwt.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";
const TWO_FA_PENDING_EXPIRES = "5m";
const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
const PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
const SECRET = process.env.JWT_SECRET;
const isRS256 = !!PRIVATE_KEY;
function generateAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, isRS256 ? PRIVATE_KEY : SECRET, {
        algorithm: isRS256 ? "RS256" : "HS256",
        expiresIn: ACCESS_EXPIRES,
    });
}
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, isRS256 ? PRIVATE_KEY : SECRET, {
        algorithm: isRS256 ? "RS256" : "HS256",
        expiresIn: REFRESH_EXPIRES,
    });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, isRS256 ? PUBLIC_KEY : SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, isRS256 ? PUBLIC_KEY : SECRET);
}
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function generateTwoFactorPendingToken(userId) {
    return jsonwebtoken_1.default.sign({ userId, purpose: "2fa_pending" }, isRS256 ? PRIVATE_KEY : SECRET, {
        algorithm: isRS256 ? "RS256" : "HS256",
        expiresIn: TWO_FA_PENDING_EXPIRES,
    });
}
function verifyTwoFactorPendingToken(token) {
    const payload = jsonwebtoken_1.default.verify(token, isRS256 ? PUBLIC_KEY : SECRET);
    if (payload.purpose !== "2fa_pending" || !payload.userId) {
        throw new Error("Invalid 2FA pending token");
    }
    return payload.userId;
}
