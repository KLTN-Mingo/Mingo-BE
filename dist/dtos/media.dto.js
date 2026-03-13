"use strict";
// src/dtos/media.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMediaResponse = toMediaResponse;
exports.toMediaDetail = toMediaDetail;
const user_dto_1 = require("./user.dto");
// ==========================================
// MAPPER FUNCTIONS
// ==========================================
function toMediaResponse(media) {
    return {
        id: media._id.toString(),
        postId: media.postId.toString(),
        userId: media.userId.toString(),
        mediaType: media.mediaType,
        mediaUrl: media.mediaUrl,
        thumbnailUrl: media.thumbnailUrl,
        caption: media.caption,
        width: media.width,
        height: media.height,
        duration: media.duration,
        fileSize: media.fileSize,
        orderIndex: media.orderIndex,
        likesCount: media.likesCount,
        commentsCount: media.commentsCount,
        sharesCount: media.sharesCount,
        createdAt: media.createdAt,
        updatedAt: media.updatedAt,
    };
}
function toMediaDetail(media, user, isLiked = false) {
    return {
        ...toMediaResponse(media),
        user: user ? (0, user_dto_1.toUserMinimal)(user) : undefined,
        isLiked,
    };
}
