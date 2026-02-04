// src/errors/app-error.ts

/**
 * Base error class cho toàn bộ application
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error - 400
 */
export class ValidationError extends AppError {
  constructor(message: string = "Dữ liệu không hợp lệ", errorCode?: string) {
    super(message, 400, errorCode || "VALIDATION_ERROR");
  }
}

/**
 * Unauthorized Error - 401
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Chưa xác thực", errorCode?: string) {
    super(message, 401, errorCode || "UNAUTHORIZED");
  }
}

/**
 * Forbidden Error - 403
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Không có quyền truy cập", errorCode?: string) {
    super(message, 403, errorCode || "FORBIDDEN");
  }
}

/**
 * Not Found Error - 404
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = "Không tìm thấy tài nguyên",
    errorCode?: string
  ) {
    super(message, 404, errorCode || "NOT_FOUND");
  }
}

/**
 * Conflict Error - 409
 */
export class ConflictError extends AppError {
  constructor(message: string = "Xung đột dữ liệu", errorCode?: string) {
    super(message, 409, errorCode || "CONFLICT");
  }
}

/**
 * Internal Server Error - 500
 */
export class InternalServerError extends AppError {
  constructor(message: string = "Lỗi máy chủ nội bộ", errorCode?: string) {
    super(message, 500, errorCode || "INTERNAL_SERVER_ERROR", false);
  }
}

/**
 * Database Error - 500
 */
export class DatabaseError extends AppError {
  constructor(message: string = "Lỗi cơ sở dữ liệu", errorCode?: string) {
    super(message, 500, errorCode || "DATABASE_ERROR", false);
  }
}

/**
 * Token Error - 401
 */
export class TokenError extends AppError {
  constructor(message: string = "Token không hợp lệ", errorCode?: string) {
    super(message, 401, errorCode || "TOKEN_ERROR");
  }
}

/**
 * Token Reuse Error - 401 (đặc biệt cho refresh token rotation)
 */
export class TokenReuseError extends AppError {
  constructor(
    message: string = "Phát hiện sử dụng lại token - có thể bị tấn công",
    errorCode?: string
  ) {
    super(message, 401, errorCode || "TOKEN_REUSE_DETECTED");
  }
}
