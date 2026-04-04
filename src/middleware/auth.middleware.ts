// src/middleware/auth-middleware.ts
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth/jwt";
import { UnauthorizedError } from "../errors";
import { UserModel } from "../models/user.model";

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
    next(error);
  }
}
