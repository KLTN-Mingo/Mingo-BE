"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
/**
 * Wrapper function để tự động bắt lỗi cho async controller
 * Thay vì try-catch trong mỗi controller, chỉ cần wrap controller bằng asyncHandler
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
