"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
const errors_1 = require("../errors");
const response_1 = require("../utils/response");
const isDev = process.env.NODE_ENV === "development";
function notFoundHandler(req, res, _next) {
    res.status(404).json((0, response_1.buildError)("NOT_FOUND", `Route ${req.method} ${req.originalUrl} không tồn tại`));
}
function errorHandler(err, req, res, _next) {
    // --- Operational errors (do chính mình throw) ---
    if (err instanceof errors_1.AppError) {
        res
            .status(err.statusCode)
            .json((0, response_1.buildError)(err.errorCode, err.message, isDev ? { stack: err.stack } : undefined));
        return;
    }
    // --- Unexpected errors (bug, thư viện ngoài, ...) ---
    console.error("[Unhandled Error]", err);
    res
        .status(500)
        .json((0, response_1.buildError)("INTERNAL_SERVER_ERROR", "Đã có lỗi xảy ra, vui lòng thử lại sau", isDev ? { originalMessage: err.message, stack: err.stack } : undefined));
}
