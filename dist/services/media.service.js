"use strict";
// src/services/media.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const mongoose_1 = require("mongoose");
const post_media_model_1 = require("../models/post-media.model");
const post_model_1 = require("../models/post.model");
const comment_model_1 = require("../models/comment.model");
const like_model_1 = require("../models/like.model");
const share_model_1 = require("../models/share.model");
const user_model_1 = require("../models/user.model");
const errors_1 = require("../errors");
const user_dto_1 = require("../dtos/user.dto");
const media_dto_1 = require("../dtos/media.dto");
// Helper: validate ObjectId
function assertObjectId(id, label) {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new errors_1.ValidationError(`${label} không hợp lệ`);
    }
}
exports.MediaService = {
    // ══════════════════════════════════════════════════════════════════════════════
    // CRUD OPERATIONS
    // ══════════════════════════════════════════════════════════════════════════════
    // Tạo media cho post
    async createMedia(postId, userId, dto) {
        assertObjectId(postId, "ID bài viết");
        const post = await post_model_1.PostModel.findById(postId);
        if (!post) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        // Chỉ chủ post mới được thêm media
        if (post.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Bạn không có quyền thêm media cho bài viết này");
        }
        const media = await post_media_model_1.PostMediaModel.create({
            postId: new mongoose_1.Types.ObjectId(postId),
            userId: new mongoose_1.Types.ObjectId(userId),
            mediaType: dto.mediaType,
            mediaUrl: dto.mediaUrl,
            thumbnailUrl: dto.thumbnailUrl,
            caption: dto.caption,
            width: dto.width,
            height: dto.height,
            duration: dto.duration,
            fileSize: dto.fileSize,
            orderIndex: dto.orderIndex || 0,
        });
        return (0, media_dto_1.toMediaResponse)(media);
    },
    // Lấy media theo ID
    async getMediaById(mediaId, currentUserId) {
        assertObjectId(mediaId, "ID media");
        const media = await post_media_model_1.PostMediaModel.findById(mediaId);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        const [user, likeRow] = await Promise.all([
            user_model_1.UserModel.findById(media.userId).lean(),
            currentUserId
                ? like_model_1.LikeModel.findOne({
                    mediaId: media._id,
                    userId: new mongoose_1.Types.ObjectId(currentUserId),
                }).lean()
                : Promise.resolve(null),
        ]);
        return (0, media_dto_1.toMediaDetail)(media, user, !!likeRow);
    },
    // Lấy tất cả media của post
    async getPostMedia(postId, currentUserId) {
        assertObjectId(postId, "ID bài viết");
        const mediaList = await post_media_model_1.PostMediaModel.find({ postId: new mongoose_1.Types.ObjectId(postId) })
            .sort({ orderIndex: 1 })
            .lean();
        if (mediaList.length === 0)
            return [];
        // Get like status for all media
        const mediaIds = mediaList.map((m) => m._id);
        const userLikes = currentUserId
            ? await like_model_1.LikeModel.find({
                mediaId: { $in: mediaIds },
                userId: new mongoose_1.Types.ObjectId(currentUserId),
            }).lean()
            : [];
        const likedSet = new Set(userLikes.map((l) => l.mediaId?.toString()));
        // Get user info
        const userIds = [...new Set(mediaList.map((m) => m.userId.toString()))];
        const users = await user_model_1.UserModel.find({ _id: { $in: userIds } }).lean();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        return mediaList.map((media) => {
            const user = userMap.get(media.userId.toString());
            const isLiked = likedSet.has(media._id.toString());
            return (0, media_dto_1.toMediaDetail)(media, user, isLiked);
        });
    },
    // Cập nhật media
    async updateMedia(mediaId, userId, dto) {
        assertObjectId(mediaId, "ID media");
        const media = await post_media_model_1.PostMediaModel.findById(mediaId);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        if (media.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Bạn không có quyền sửa media này");
        }
        if (dto.caption !== undefined)
            media.caption = dto.caption;
        if (dto.orderIndex !== undefined)
            media.orderIndex = dto.orderIndex;
        await media.save();
        return (0, media_dto_1.toMediaResponse)(media);
    },
    // Xóa media
    async deleteMedia(mediaId, userId) {
        assertObjectId(mediaId, "ID media");
        const media = await post_media_model_1.PostMediaModel.findById(mediaId);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        if (media.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Bạn không có quyền xóa media này");
        }
        // Xóa tất cả likes, comments, shares của media
        await Promise.all([
            like_model_1.LikeModel.deleteMany({ mediaId: media._id }),
            comment_model_1.CommentModel.deleteMany({ mediaId: media._id }),
            share_model_1.ShareModel.deleteMany({ mediaId: media._id }),
            media.deleteOne(),
        ]);
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // LIKE / UNLIKE
    // ══════════════════════════════════════════════════════════════════════════════
    async likeMedia(mediaId, userId) {
        assertObjectId(mediaId, "ID media");
        const media = await post_media_model_1.PostMediaModel.findById(mediaId);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        const existing = await like_model_1.LikeModel.findOne({
            mediaId: new mongoose_1.Types.ObjectId(mediaId),
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        if (existing)
            return; // Idempotent
        await like_model_1.LikeModel.create({
            mediaId: new mongoose_1.Types.ObjectId(mediaId),
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        await post_media_model_1.PostMediaModel.findByIdAndUpdate(mediaId, {
            $inc: { likesCount: 1 },
        });
    },
    async unlikeMedia(mediaId, userId) {
        assertObjectId(mediaId, "ID media");
        const media = await post_media_model_1.PostMediaModel.findById(mediaId);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        const deleted = await like_model_1.LikeModel.findOneAndDelete({
            mediaId: new mongoose_1.Types.ObjectId(mediaId),
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        if (deleted) {
            await post_media_model_1.PostMediaModel.findByIdAndUpdate(mediaId, {
                $inc: { likesCount: -1 },
            });
        }
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // COMMENTS
    // ══════════════════════════════════════════════════════════════════════════════
    // Lấy comments của media
    async getMediaComments(mediaId, page = 1, limit = 20, currentUserId) {
        assertObjectId(mediaId, "ID media");
        const media = await post_media_model_1.PostMediaModel.findById(mediaId);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        const query = {
            mediaId: new mongoose_1.Types.ObjectId(mediaId),
            parentCommentId: null, // Only top-level comments
        };
        const [comments, total] = await Promise.all([
            comment_model_1.CommentModel.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            comment_model_1.CommentModel.countDocuments(query),
        ]);
        // Get user info and like status
        const userIds = [...new Set(comments.map((c) => c.userId.toString()))];
        const users = await user_model_1.UserModel.find({ _id: { $in: userIds } }).lean();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        const commentIds = comments.map((c) => c._id);
        const userLikes = currentUserId
            ? await like_model_1.LikeModel.find({
                commentId: { $in: commentIds },
                userId: new mongoose_1.Types.ObjectId(currentUserId),
            }).lean()
            : [];
        const likedSet = new Set(userLikes.map((l) => l.commentId?.toString()));
        const totalPages = Math.ceil(total / limit);
        return {
            comments: comments.map((comment) => ({
                id: comment._id.toString(),
                mediaId: comment.mediaId?.toString(),
                userId: comment.userId.toString(),
                user: userMap.get(comment.userId.toString())
                    ? (0, user_dto_1.toUserMinimal)(userMap.get(comment.userId.toString()))
                    : undefined,
                contentText: comment.contentText,
                likesCount: comment.likesCount,
                repliesCount: comment.repliesCount,
                isLiked: likedSet.has(comment._id.toString()),
                isEdited: comment.isEdited,
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    },
    // Tạo comment cho media
    async createMediaComment(mediaId, userId, contentText) {
        assertObjectId(mediaId, "ID media");
        const media = await post_media_model_1.PostMediaModel.findById(mediaId);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        const comment = await comment_model_1.CommentModel.create({
            mediaId: new mongoose_1.Types.ObjectId(mediaId),
            userId: new mongoose_1.Types.ObjectId(userId),
            contentText,
        });
        await post_media_model_1.PostMediaModel.findByIdAndUpdate(mediaId, {
            $inc: { commentsCount: 1 },
        });
        const user = await user_model_1.UserModel.findById(userId).lean();
        return {
            id: comment._id.toString(),
            mediaId: comment.mediaId?.toString(),
            userId: comment.userId.toString(),
            user: user ? (0, user_dto_1.toUserMinimal)(user) : undefined,
            contentText: comment.contentText,
            likesCount: comment.likesCount,
            repliesCount: comment.repliesCount,
            isLiked: false,
            isEdited: comment.isEdited,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
        };
    },
    // Tạo reply cho comment trên media
    async createMediaCommentReply(mediaId, userId, parentCommentId, originalCommentId, contentText) {
        assertObjectId(mediaId, "ID media");
        assertObjectId(parentCommentId, "ID comment cha");
        assertObjectId(originalCommentId, "ID comment gốc");
        const [media, parentComment, originalComment] = await Promise.all([
            post_media_model_1.PostMediaModel.findById(mediaId),
            comment_model_1.CommentModel.findById(parentCommentId),
            comment_model_1.CommentModel.findById(originalCommentId),
        ]);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        if (!parentComment) {
            throw new errors_1.NotFoundError("Không tìm thấy comment cha");
        }
        if (!originalComment) {
            throw new errors_1.NotFoundError("Không tìm thấy comment gốc");
        }
        const reply = await comment_model_1.CommentModel.create({
            mediaId: new mongoose_1.Types.ObjectId(mediaId),
            userId: new mongoose_1.Types.ObjectId(userId),
            parentCommentId: new mongoose_1.Types.ObjectId(parentCommentId),
            originalCommentId: new mongoose_1.Types.ObjectId(originalCommentId),
            contentText,
        });
        // Tăng repliesCount của originalComment và commentsCount của media
        await Promise.all([
            comment_model_1.CommentModel.findByIdAndUpdate(originalCommentId, {
                $inc: { repliesCount: 1 },
            }),
            post_media_model_1.PostMediaModel.findByIdAndUpdate(mediaId, {
                $inc: { commentsCount: 1 },
            }),
        ]);
        const user = await user_model_1.UserModel.findById(userId).lean();
        return {
            id: reply._id.toString(),
            mediaId: reply.mediaId?.toString(),
            parentCommentId: reply.parentCommentId?.toString(),
            originalCommentId: reply.originalCommentId?.toString(),
            userId: reply.userId.toString(),
            user: user ? (0, user_dto_1.toUserMinimal)(user) : undefined,
            contentText: reply.contentText,
            likesCount: reply.likesCount,
            repliesCount: reply.repliesCount,
            isLiked: false,
            isEdited: reply.isEdited,
            createdAt: reply.createdAt,
            updatedAt: reply.updatedAt,
        };
    },
    // Lấy replies của comment trên media
    async getMediaCommentReplies(commentId, page = 1, limit = 20, currentUserId) {
        assertObjectId(commentId, "ID comment");
        const comment = await comment_model_1.CommentModel.findById(commentId);
        if (!comment) {
            throw new errors_1.NotFoundError(`Không tìm thấy comment với ID: ${commentId}`);
        }
        const query = {
            originalCommentId: new mongoose_1.Types.ObjectId(commentId),
        };
        const [replies, total] = await Promise.all([
            comment_model_1.CommentModel.find(query)
                .sort({ createdAt: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            comment_model_1.CommentModel.countDocuments(query),
        ]);
        // Get user info and like status
        const userIds = [...new Set(replies.map((r) => r.userId.toString()))];
        const users = await user_model_1.UserModel.find({ _id: { $in: userIds } }).lean();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));
        const replyIds = replies.map((r) => r._id);
        const userLikes = currentUserId
            ? await like_model_1.LikeModel.find({
                commentId: { $in: replyIds },
                userId: new mongoose_1.Types.ObjectId(currentUserId),
            }).lean()
            : [];
        const likedSet = new Set(userLikes.map((l) => l.commentId?.toString()));
        const totalPages = Math.ceil(total / limit);
        return {
            replies: replies.map((reply) => ({
                id: reply._id.toString(),
                mediaId: reply.mediaId?.toString(),
                parentCommentId: reply.parentCommentId?.toString(),
                originalCommentId: reply.originalCommentId?.toString(),
                userId: reply.userId.toString(),
                user: userMap.get(reply.userId.toString())
                    ? (0, user_dto_1.toUserMinimal)(userMap.get(reply.userId.toString()))
                    : undefined,
                contentText: reply.contentText,
                likesCount: reply.likesCount,
                repliesCount: reply.repliesCount,
                isLiked: likedSet.has(reply._id.toString()),
                isEdited: reply.isEdited,
                createdAt: reply.createdAt,
                updatedAt: reply.updatedAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    },
    // ══════════════════════════════════════════════════════════════════════════════
    // SHARE
    // ══════════════════════════════════════════════════════════════════════════════
    async shareMedia(mediaId, userId, caption) {
        assertObjectId(mediaId, "ID media");
        const media = await post_media_model_1.PostMediaModel.findById(mediaId);
        if (!media) {
            throw new errors_1.NotFoundError(`Không tìm thấy media với ID: ${mediaId}`);
        }
        await share_model_1.ShareModel.create({
            mediaId: new mongoose_1.Types.ObjectId(mediaId),
            userId: new mongoose_1.Types.ObjectId(userId),
            caption,
        });
        await post_media_model_1.PostMediaModel.findByIdAndUpdate(mediaId, {
            $inc: { sharesCount: 1 },
        });
    },
    // Lấy danh sách người đã share media
    async getMediaShares(mediaId, page = 1, limit = 20) {
        assertObjectId(mediaId, "ID media");
        const query = { mediaId: new mongoose_1.Types.ObjectId(mediaId) };
        const [shares, total] = await Promise.all([
            share_model_1.ShareModel.find(query)
                .populate("userId", "name avatar verified")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            share_model_1.ShareModel.countDocuments(query),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            shares: shares.map((share) => ({
                id: share._id.toString(),
                user: share.userId ? (0, user_dto_1.toUserMinimal)(share.userId) : undefined,
                caption: share.caption,
                sharedAt: share.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    },
    // Lấy danh sách người đã like media
    async getMediaLikes(mediaId, page = 1, limit = 20) {
        assertObjectId(mediaId, "ID media");
        const query = { mediaId: new mongoose_1.Types.ObjectId(mediaId) };
        const [likes, total] = await Promise.all([
            like_model_1.LikeModel.find(query)
                .populate("userId", "name avatar verified")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            like_model_1.LikeModel.countDocuments(query),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            likes: likes.map((like) => ({
                id: like._id.toString(),
                user: like.userId ? (0, user_dto_1.toUserMinimal)(like.userId) : undefined,
                likedAt: like.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    },
};
