// src/lib/auth/jwt.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

const PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
const PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
const SECRET = process.env.JWT_SECRET;

const isRS256 = !!PRIVATE_KEY;

export function generateAccessToken(payload: object) {
  return jwt.sign(payload, isRS256 ? PRIVATE_KEY! : SECRET!, {
    algorithm: isRS256 ? "RS256" : "HS256",
    expiresIn: ACCESS_EXPIRES,
  });
}

export function generateRefreshToken(payload: object) {
  return jwt.sign(payload, isRS256 ? PRIVATE_KEY! : SECRET!, {
    algorithm: isRS256 ? "RS256" : "HS256",
    expiresIn: REFRESH_EXPIRES,
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, isRS256 ? PUBLIC_KEY! : SECRET!);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, isRS256 ? PUBLIC_KEY! : SECRET!);
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
