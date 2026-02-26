// src/errors/app-error.ts

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = "INTERNAL_SERVER_ERROR",
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 400
export class ValidationError extends AppError {
  constructor(
    message: string = "Dữ liệu không hợp lệ",
    errorCode: string = "VALIDATION_ERROR"
  ) {
    super(message, 400, errorCode);
  }
}

// 401
export class UnauthorizedError extends AppError {
  constructor(
    message: string = "Chưa xác thực",
    errorCode: string = "UNAUTHORIZED"
  ) {
    super(message, 401, errorCode);
  }
}

// 401 - Token không hợp lệ / hết hạn
export class TokenError extends AppError {
  constructor(
    message: string = "Token không hợp lệ",
    errorCode: string = "TOKEN_INVALID"
  ) {
    super(message, 401, errorCode);
  }
}

// 401 - Phát hiện tái sử dụng refresh token
export class TokenReuseError extends AppError {
  constructor(
    message: string = "Phát hiện sử dụng lại token - có thể bị tấn công",
    errorCode: string = "TOKEN_REUSE_DETECTED"
  ) {
    super(message, 401, errorCode);
  }
}

// 403
export class ForbiddenError extends AppError {
  constructor(
    message: string = "Không có quyền truy cập",
    errorCode: string = "FORBIDDEN"
  ) {
    super(message, 403, errorCode);
  }
}

// 404
export class NotFoundError extends AppError {
  constructor(
    message: string = "Không tìm thấy tài nguyên",
    errorCode: string = "NOT_FOUND"
  ) {
    super(message, 404, errorCode);
  }
}

// 409
export class ConflictError extends AppError {
  constructor(
    message: string = "Xung đột dữ liệu",
    errorCode: string = "CONFLICT"
  ) {
    super(message, 409, errorCode);
  }
}

// 500 - Lỗi nghiệp vụ không mong đợi
export class InternalServerError extends AppError {
  constructor(
    message: string = "Lỗi máy chủ nội bộ",
    errorCode: string = "INTERNAL_SERVER_ERROR"
  ) {
    super(message, 500, errorCode, false);
  }
}

// 500 - Lỗi database
export class DatabaseError extends AppError {
  constructor(
    message: string = "Lỗi cơ sở dữ liệu",
    errorCode: string = "DATABASE_ERROR"
  ) {
    super(message, 500, errorCode, false);
  }
}
