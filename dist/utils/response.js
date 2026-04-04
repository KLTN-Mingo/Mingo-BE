"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSuccess = buildSuccess;
exports.buildPaginated = buildPaginated;
exports.buildError = buildError;
exports.sendSuccess = sendSuccess;
exports.sendCreated = sendCreated;
exports.sendPaginated = sendPaginated;
exports.sendError = sendError;
// ─── Builder functions (trả về plain object, không gắn với Express) ────────────
function buildSuccess(data, message = "Thành công") {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    };
}
function buildPaginated(data, pagination, message = "Thành công") {
    const { page, limit, total } = pagination;
    const totalPages = Math.ceil(total / limit);
    return {
        success: true,
        message,
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
        },
        timestamp: new Date().toISOString(),
    };
}
function buildError(code, message, details) {
    return {
        success: false,
        error: { code, message, details },
        timestamp: new Date().toISOString(),
    };
}
// ─── Express response helpers (gắn res.status().json() luôn) ──────────────────
function sendSuccess(res, data, message, statusCode = 200) {
    res.status(statusCode).json(buildSuccess(data, message));
}
function sendCreated(res, data, message = "Tạo mới thành công") {
    res.status(201).json(buildSuccess(data, message));
}
function sendPaginated(res, data, pagination, message) {
    res.status(200).json(buildPaginated(data, pagination, message));
}
/**
 * Gửi error response từ AppError - dùng trong error middleware
 */
function sendError(res, error, details) {
    res
        .status(error.statusCode)
        .json(buildError(error.errorCode, error.message, details));
}
