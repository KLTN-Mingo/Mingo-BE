"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUploadError = exports.upload = void 0;
// src/middleware/upload.middleware.ts
const multer_1 = __importDefault(require("multer"));
const app_error_1 = require("../errors/app-error");
// Configure multer for memory storage
const storage = multer_1.default.memoryStorage();
// File filter
const fileFilter = (req, file, cb) => {
    // Allowed image types
    const allowedImageTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
    ];
    // Allowed video types
    const allowedVideoTypes = [
        "video/mp4",
        "video/mpeg",
        "video/quicktime",
        "video/webm",
    ];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new app_error_1.ValidationError("File không hợp lệ. Chỉ cho phép ảnh (JPEG, PNG, GIF, WebP) và video (MP4, MPEG, MOV, WebM)"));
    }
};
// Create multer upload instance
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
        files: 10, // Max 10 files
    },
});
// Middleware for handling upload errors
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer_1.default.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                error: {
                    code: "FILE_TOO_LARGE",
                    message: "File quá lớn. Kích thước tối đa là 100MB",
                },
            });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
                success: false,
                error: {
                    code: "TOO_MANY_FILES",
                    message: "Quá nhiều file. Tối đa 10 files",
                },
            });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                error: {
                    code: "UNEXPECTED_FIELD",
                    message: "Field không hợp lệ",
                },
            });
        }
        return res.status(400).json({
            success: false,
            error: {
                code: "UPLOAD_ERROR",
                message: err.message,
            },
        });
    }
    next(err);
};
exports.handleUploadError = handleUploadError;
