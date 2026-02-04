// src/lib/auth/cookies.ts
import { Response, Request } from "express";

const COOKIE_NAME = "refreshToken";

export function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
  });
}

export function getRefreshTokenFromCookie(req: Request) {
  return req.cookies?.[COOKIE_NAME];
}

export function clearAllAuthCookies(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}
