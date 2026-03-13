"use strict";
// src/errors/app-error.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = exports.InternalServerError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.TokenReuseError = exports.TokenError = exports.UnauthorizedError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500, errorCode = "INTERNAL_SERVER_ERROR", isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// 400
class ValidationError extends AppError {
    constructor(message = "Dữ liệu không hợp lệ", errorCode = "VALIDATION_ERROR") {
        super(message, 400, errorCode);
    }
}
exports.ValidationError = ValidationError;
// 401
class UnauthorizedError extends AppError {
    constructor(message = "Chưa xác thực", errorCode = "UNAUTHORIZED") {
        super(message, 401, errorCode);
    }
}
exports.UnauthorizedError = UnauthorizedError;
// 401 - Token không hợp lệ / hết hạn
class TokenError extends AppError {
    constructor(message = "Token không hợp lệ", errorCode = "TOKEN_INVALID") {
        super(message, 401, errorCode);
    }
}
exports.TokenError = TokenError;
// 401 - Phát hiện tái sử dụng refresh token
class TokenReuseError extends AppError {
    constructor(message = "Phát hiện sử dụng lại token - có thể bị tấn công", errorCode = "TOKEN_REUSE_DETECTED") {
        super(message, 401, errorCode);
    }
}
exports.TokenReuseError = TokenReuseError;
// 403
class ForbiddenError extends AppError {
    constructor(message = "Không có quyền truy cập", errorCode = "FORBIDDEN") {
        super(message, 403, errorCode);
    }
}
exports.ForbiddenError = ForbiddenError;
// 404
class NotFoundError extends AppError {
    constructor(message = "Không tìm thấy tài nguyên", errorCode = "NOT_FOUND") {
        super(message, 404, errorCode);
    }
}
exports.NotFoundError = NotFoundError;
// 409
class ConflictError extends AppError {
    constructor(message = "Xung đột dữ liệu", errorCode = "CONFLICT") {
        super(message, 409, errorCode);
    }
}
exports.ConflictError = ConflictError;
// 500 - Lỗi nghiệp vụ không mong đợi
class InternalServerError extends AppError {
    constructor(message = "Lỗi máy chủ nội bộ", errorCode = "INTERNAL_SERVER_ERROR") {
        super(message, 500, errorCode, false);
    }
}
exports.InternalServerError = InternalServerError;
// 500 - Lỗi database
class DatabaseError extends AppError {
    constructor(message = "Lỗi cơ sở dữ liệu", errorCode = "DATABASE_ERROR") {
        super(message, 500, errorCode, false);
    }
}
exports.DatabaseError = DatabaseError;
