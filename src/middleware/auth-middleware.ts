// src/middleware/auth-middleware.ts
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth/jwt";
import { UnauthorizedError } from "../errors";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new UnauthorizedError("Không tìm thấy access token");
  }

  try {
    const payload = verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch (error) {
    next(error);
  }
}
