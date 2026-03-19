"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRefreshTokenCookie = setRefreshTokenCookie;
exports.getRefreshTokenFromCookie = getRefreshTokenFromCookie;
exports.clearAllAuthCookies = clearAllAuthCookies;
const COOKIE_NAME = "refreshToken";
function setRefreshTokenCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
    });
}
function getRefreshTokenFromCookie(req) {
    return req.cookies?.[COOKIE_NAME];
}
function clearAllAuthCookies(res) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
}
