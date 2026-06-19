// src/services/cloudinary.service.ts
import { v2 as cloudinary } from "cloudinary";
import { InternalServerError } from "../errors/app-error";
import streamifier from "streamifier";
import { ModerationService } from "./moderation/moderation.service";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format: string;
  resourceType: "image" | "video" | "raw";
  bytes: number;
  duration?: number; // For videos
}

class CloudinaryService {
  /**
   * Extract Cloudinary public_id from secure_url.
   * Example: .../image/upload/v123/folder/file.jpg => folder/file
   */
  extractPublicIdFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const uploadIndex = segments.findIndex((segment) => segment === "upload");

      if (uploadIndex === -1 || uploadIndex + 1 >= segments.length) {
        return null;
      }

      let publicIdSegments = segments.slice(uploadIndex + 1);
      const versionIndex = publicIdSegments.findIndex((segment) =>
        /^v\d+$/.test(segment)
      );

      if (versionIndex >= 0) {
        publicIdSegments = publicIdSegments.slice(versionIndex + 1);
      }

      if (publicIdSegments.length === 0) {
        return null;
      }

      const last = publicIdSegments[publicIdSegments.length - 1];
      const dotIndex = last.lastIndexOf(".");
      if (dotIndex > 0) {
        publicIdSegments[publicIdSegments.length - 1] = last.slice(0, dotIndex);
      }

      return publicIdSegments.join("/");
    } catch {
      return null;
    }
  }

  /**
   * Upload image to Cloudinary
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string = "social-network/posts"
  ): Promise<UploadResult> {
    try {
      return await new Promise<UploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
            transformation: [
              { width: 1200, height: 1200, crop: "limit" },
              { quality: "auto:good" },
            ],
          },
          (error, result) => {
            if (error) {
              reject(
                new InternalServerError(
                  `Lỗi upload ảnh: ${error.message}`,
                  "CLOUDINARY_UPLOAD_ERROR"
                )
              );
              return;
            }

            if (!result) {
              reject(
                new InternalServerError("Không nhận được kết quả từ Cloudinary")
              );
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
            // ❌ Đã xóa: tự gọi moderateImage ở đây.
            // Moderation giờ do triggerMediaModeration() ở media.service.ts đảm nhiệm,
            // sau khi TẤT CẢ media trong batch đã insert xong (tránh race condition).
          }
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    } catch (error) {
      if (error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError("Lỗi không xác định khi upload ảnh");
    }
  }

  /**
   * Upload video to Cloudinary
   */
  async uploadVideo(
    file: Express.Multer.File,
    folder: string = "social-network/videos"
  ): Promise<UploadResult> {
    try {
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        throw new InternalServerError("Video quá lớn. Tối đa 100MB");
      }

      return await new Promise<UploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "video",
            chunk_size: 6000000,
          },
          (error, result) => {
            if (error) {
              reject(
                new InternalServerError(`Lỗi upload video: ${error.message}`)
              );
              return;
            }

            if (!result) {
              reject(
                new InternalServerError("Không nhận được kết quả từ Cloudinary")
              );
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
            // ❌ Đã xóa: tự gọi moderateImage(thumbnailUrl) ở đây.
            // Đây chính là nguồn bug — video bị duyệt nhầm qua pipeline ẢNH
            // (dùng thumbnail .jpg) thay vì pipeline VIDEO (moderateVideo, full video).
            // Moderation giờ do triggerMediaModeration() ở media.service.ts đảm nhiệm.
          }
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      });
    } catch (error) {
      if (error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError("Lỗi không xác định khi upload video");
    }
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(
    publicId: string,
    resourceType: "image" | "video" = "image"
  ): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (error) {
      throw new InternalServerError("Lỗi khi xóa file");
    }
  }

  /**
   * Generate thumbnail for video
   */
  generateVideoThumbnail(publicId: string): string {
    return cloudinary.url(publicId, {
      resource_type: "video",
      format: "jpg",
      transformation: [{ width: 640, height: 360, crop: "fill" }],
    });
  }
}

export const cloudinaryService = new CloudinaryService();
