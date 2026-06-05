// src/lib/auth/cookies.ts
import { Response, Request } from "express";

const COOKIE_NAME = "refreshToken";

export function setRefreshTokenCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === "production";
  const secure =
    String(process.env.COOKIE_SECURE ?? (isProduction ? "true" : "false"))
      .toLowerCase()
      .trim() === "true";
  const sameSiteRaw = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";
  const cookieDomain = process.env.COOKIE_DOMAIN?.trim();

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    domain: cookieDomain || undefined,
    path: "/",
  });
}

export function getRefreshTokenFromCookie(req: Request) {
  return req.cookies?.[COOKIE_NAME];
}

export function clearAllAuthCookies(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}
