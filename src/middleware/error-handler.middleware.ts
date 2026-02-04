// src/middlewares/error-handler.middleware.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";
import { MongoError } from "mongodb";

/**
 * Interface cho error response
 */
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    errorCode?: string;
    statusCode: number;
    stack?: string;
    details?: any;
  };
}

/**
 * Global error handler middleware
 * Phải có 4 parameters để Express nhận diện đây là error handler
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Nếu là AppError (custom error)
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        errorCode: err.errorCode,
        statusCode: err.statusCode,
      },
    };

    // Chỉ show stack trace trong development
    if (process.env.NODE_ENV === "development") {
      response.error.stack = err.stack;
    }

    return res.status(err.statusCode).json(response);
  }

  // Xử lý MongoDB duplicate key error
  if (err.name === "MongoServerError" && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    return res.status(409).json({
      success: false,
      error: {
        message: `${field} đã tồn tại trong hệ thống`,
        errorCode: "DUPLICATE_KEY",
        statusCode: 409,
      },
    });
  }

  // Xử lý Mongoose validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: {
        message: "Dữ liệu không hợp lệ",
        errorCode: "VALIDATION_ERROR",
        statusCode: 400,
        details: (err as any).errors,
      },
    });
  }

  // Xử lý JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: {
        message: "Token không hợp lệ",
        errorCode: "INVALID_TOKEN",
        statusCode: 401,
      },
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: {
        message: "Token đã hết hạn",
        errorCode: "TOKEN_EXPIRED",
        statusCode: 401,
      },
    });
  }

  // Lỗi không xác định - Internal Server Error
  console.error("❌ Unhandled Error:", err);

  const response: ErrorResponse = {
    success: false,
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "Đã xảy ra lỗi, vui lòng thử lại sau"
          : err.message,
      errorCode: "INTERNAL_SERVER_ERROR",
      statusCode: 500,
    },
  };

  if (process.env.NODE_ENV === "development") {
    response.error.stack = err.stack;
  }

  return res.status(500).json(response);
}

/**
 * Middleware bắt 404 - Route không tồn tại
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.originalUrl} không tồn tại`,
      errorCode: "ROUTE_NOT_FOUND",
      statusCode: 404,
    },
  });
}
