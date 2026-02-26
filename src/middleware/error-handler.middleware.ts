// src/middleware/error-handler.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors";
import { buildError } from "../utils/response";

const isDev = process.env.NODE_ENV === "development";

export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json(
    buildError(
      "NOT_FOUND",
      `Route ${req.method} ${req.originalUrl} không tồn tại`
    )
  );
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // --- Operational errors (do chính mình throw) ---
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json(
        buildError(
          err.errorCode,
          err.message,
          isDev ? { stack: err.stack } : undefined
        )
      );
    return;
  }

  // --- Unexpected errors (bug, thư viện ngoài, ...) ---
  console.error("[Unhandled Error]", err);

  res
    .status(500)
    .json(
      buildError(
        "INTERNAL_SERVER_ERROR",
        "Đã có lỗi xảy ra, vui lòng thử lại sau",
        isDev ? { originalMessage: err.message, stack: err.stack } : undefined
      )
    );
}
