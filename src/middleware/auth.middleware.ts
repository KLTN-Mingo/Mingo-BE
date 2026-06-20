// src/middleware/auth-middleware.ts
import { Request, Response, NextFunction } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { verifyAccessToken } from "../lib/auth/jwt";
import { TokenError, UnauthorizedError } from "../errors";
import { UserModel, checkAndUnbanUser } from "../models/user.model";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Không tìm thấy authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new UnauthorizedError("Không tìm thấy access token");
  }

  try {
    const payload = verifyAccessToken(token) as { userId: string };

    const user = await UserModel.findById(payload.userId).select("role");

    if (!user) {
      throw new UnauthorizedError("Người dùng không tồn tại");
    }

    // Gán cả userId và role vào req.user
    (req as any).user = {
      userId: payload.userId,
      role: user.role, // Lấy role từ database
    };

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      next(new TokenError("Access token đã hết hạn"));
      return;
    }

    if (error instanceof JsonWebTokenError) {
      next(new TokenError("Access token không hợp lệ"));
      return;
    }

    next(error);
  }
}

/**
 * Middleware kiểm tra tài khoản bị khóa (ban).
 * Gọi checkAndUnbanUser trước khi check isBlocked để tự động unban khi hết hạn.
 * Dùng sau authMiddleware.
 */
export async function banCheckMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const userId = (req as any).user?.userId;
  if (!userId) return next();

  // Tự động unban nếu hết hạn
  await checkAndUnbanUser(userId);

  // Sau khi unban (nếu có), check lại
  const user = await UserModel.findById(userId).select("isBlocked").lean();
  if (user?.isBlocked) {
    throw new UnauthorizedError("Tài khoản đã bị khóa");
  }

  next();
}
