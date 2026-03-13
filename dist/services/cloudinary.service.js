"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryService = void 0;
// src/services/cloudinary.service.ts
const cloudinary_1 = require("cloudinary");
const app_error_1 = require("../errors/app-error");
const streamifier_1 = __importDefault(require("streamifier"));
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
class CloudinaryService {
    /**
     * Upload image to Cloudinary
     */
    async uploadImage(file, folder = "social-network/posts") {
        try {
            return await new Promise((resolve, reject) => {
                const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                    folder,
                    resource_type: "image",
                    transformation: [
                        { width: 1200, height: 1200, crop: "limit" },
                        { quality: "auto:good" },
                    ],
                }, (error, result) => {
                    if (error) {
                        reject(new app_error_1.InternalServerError(`Lỗi upload ảnh: ${error.message}`, "CLOUDINARY_UPLOAD_ERROR"));
                        return;
                    }
                    if (!result) {
                        reject(new app_error_1.InternalServerError("Không nhận được kết quả từ Cloudinary"));
                        return;
                    }
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        width: result.width,
                        height: result.height,
                        format: result.format,
                        resourceType: "image",
                        bytes: result.bytes,
                    });
                });
                streamifier_1.default.createReadStream(file.buffer).pipe(uploadStream);
            });
        }
        catch (error) {
            if (error instanceof app_error_1.InternalServerError) {
                throw error;
            }
            throw new app_error_1.InternalServerError("Lỗi không xác định khi upload ảnh");
        }
    }
    /**
     * Upload video to Cloudinary
     */
    async uploadVideo(file, folder = "social-network/videos") {
        try {
            const maxSize = 100 * 1024 * 1024; // 100MB
            if (file.size > maxSize) {
                throw new app_error_1.InternalServerError("Video quá lớn. Tối đa 100MB");
            }
            return await new Promise((resolve, reject) => {
                const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                    folder,
                    resource_type: "video",
                    chunk_size: 6000000,
                }, (error, result) => {
                    if (error) {
                        reject(new app_error_1.InternalServerError(`Lỗi upload video: ${error.message}`));
                        return;
                    }
                    if (!result) {
                        reject(new app_error_1.InternalServerError("Không nhận được kết quả từ Cloudinary"));
                        return;
                    }
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        width: result.width,
                        height: result.height,
                        format: result.format,
                        resourceType: "video",
                        bytes: result.bytes,
                        duration: result.duration,
                    });
                });
                streamifier_1.default.createReadStream(file.buffer).pipe(uploadStream);
            });
        }
        catch (error) {
            if (error instanceof app_error_1.InternalServerError) {
                throw error;
            }
            throw new app_error_1.InternalServerError("Lỗi không xác định khi upload video");
        }
    }
    /**
     * Delete file from Cloudinary
     */
    async deleteFile(publicId, resourceType = "image") {
        try {
            await cloudinary_1.v2.uploader.destroy(publicId, {
                resource_type: resourceType,
            });
        }
        catch (error) {
            throw new app_error_1.InternalServerError("Lỗi khi xóa file");
        }
    }
    /**
     * Generate thumbnail for video
     */
    generateVideoThumbnail(publicId) {
        return cloudinary_1.v2.url(publicId, {
            resource_type: "video",
            format: "jpg",
            transformation: [{ width: 640, height: 360, crop: "fill" }],
        });
    }
}
exports.cloudinaryService = new CloudinaryService();
