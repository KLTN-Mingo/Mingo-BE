"use strict";
// src/services/comment.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentService = void 0;
const mongoose_1 = require("mongoose");
const comment_model_1 = require("../models/comment.model");
const post_model_1 = require("../models/post.model");
const user_model_1 = require("../models/user.model");
const like_model_1 = require("../models/like.model");
const errors_1 = require("../errors");
const user_dto_1 = require("../dtos/user.dto");
const comment_dto_1 = require("../dtos/comment.dto");
// ─── Helper ───────────────────────────────────────────────────────────────────
function assertObjectId(id, label = "ID") {
    if (!mongoose_1.Types.ObjectId.isValid(id)) {
        throw new errors_1.NotFoundError(`Không tìm thấy ${label} với ID: ${id}`);
    }
}
async function populateCommentUser(comment, currentUserId) {
    const [author, likeRow] = await Promise.all([
        user_model_1.UserModel.findById(comment.userId).lean(),
        currentUserId
            ? like_model_1.LikeModel.findOne({
                commentId: comment._id,
                userId: currentUserId,
            }).lean()
            : Promise.resolve(null),
    ]);
    return {
        user: author ? (0, user_dto_1.toUserMinimal)(author) : undefined,
        isLiked: !!likeRow,
    };
}
// ─── Service ──────────────────────────────────────────────────────────────────
exports.CommentService = {
    // ── Lấy comments cấp 1 của một post (có phân trang) ──────────────────────
    async getPostComments(postId, page, limit, currentUserId) {
        assertObjectId(postId, "bài viết");
        const skip = (page - 1) * limit;
        const [comments, total] = await Promise.all([
            comment_model_1.CommentModel.find({
                postId: new mongoose_1.Types.ObjectId(postId),
                parentCommentId: null, // chỉ lấy top-level
                isHidden: false,
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            comment_model_1.CommentModel.countDocuments({
                postId: new mongoose_1.Types.ObjectId(postId),
                parentCommentId: null,
                isHidden: false,
            }),
        ]);
        const commentDtos = await Promise.all(comments.map(async (c) => {
            const { user, isLiked } = await populateCommentUser(c, currentUserId);
            // Lấy 2 replies đầu làm preview
            const topReplyRows = await comment_model_1.CommentModel.find({
                originalCommentId: c._id,
                isHidden: false,
            })
                .sort({ createdAt: 1 })
                .limit(2)
                .lean();
            const topReplies = await Promise.all(topReplyRows.map(async (r) => {
                const opts = await populateCommentUser(r, currentUserId);
                return (0, comment_dto_1.toCommentResponse)(r, opts);
            }));
            return (0, comment_dto_1.toCommentDetail)(c, { user, isLiked, topReplies });
        }));
        const totalPages = Math.ceil(total / limit);
        return {
            comments: commentDtos,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    },
    // ── Lấy replies của một comment (có phân trang) ───────────────────────────
    async getCommentReplies(originalCommentId, page, limit, currentUserId) {
        assertObjectId(originalCommentId, "bình luận");
        const skip = (page - 1) * limit;
        const oid = new mongoose_1.Types.ObjectId(originalCommentId);
        const [replies, total] = await Promise.all([
            comment_model_1.CommentModel.find({ originalCommentId: oid, isHidden: false })
                .sort({ createdAt: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            comment_model_1.CommentModel.countDocuments({ originalCommentId: oid, isHidden: false }),
        ]);
        const replyDtos = await Promise.all(replies.map(async (r) => {
            const opts = await populateCommentUser(r, currentUserId);
            return (0, comment_dto_1.toCommentResponse)(r, opts);
        }));
        const totalPages = Math.ceil(total / limit);
        return {
            comments: replyDtos,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    },
    // ── Lấy chi tiết một comment ──────────────────────────────────────────────
    async getCommentById(commentId, currentUserId) {
        assertObjectId(commentId, "bình luận");
        const comment = await comment_model_1.CommentModel.findById(commentId).lean();
        if (!comment) {
            throw new errors_1.NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
        }
        const [{ user, isLiked }, topReplyRows] = await Promise.all([
            populateCommentUser(comment, currentUserId),
            comment_model_1.CommentModel.find({
                originalCommentId: comment._id,
                isHidden: false,
            })
                .sort({ createdAt: 1 })
                .limit(3)
                .lean(),
        ]);
        const topReplies = await Promise.all(topReplyRows.map(async (r) => {
            const opts = await populateCommentUser(r, currentUserId);
            return (0, comment_dto_1.toCommentResponse)(r, opts);
        }));
        return (0, comment_dto_1.toCommentDetail)(comment, { user, isLiked, topReplies });
    },
    // ── Tạo comment cấp 1 ────────────────────────────────────────────────────
    async createComment(postId, userId, dto) {
        assertObjectId(postId, "bài viết");
        const post = await post_model_1.PostModel.findById(postId);
        if (!post)
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        const comment = await comment_model_1.CommentModel.create({
            postId: new mongoose_1.Types.ObjectId(postId),
            userId: new mongoose_1.Types.ObjectId(userId),
            contentText: dto.contentText,
            parentCommentId: null,
            originalCommentId: null,
        });
        // Tăng commentsCount của post
        await post_model_1.PostModel.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
        return this.getCommentById(comment._id.toString(), userId);
    },
    // ── Tạo reply ─────────────────────────────────────────────────────────────
    async createReply(postId, userId, dto) {
        assertObjectId(postId, "bài viết");
        assertObjectId(dto.parentCommentId, "bình luận cha");
        assertObjectId(dto.originalCommentId, "bình luận gốc");
        const [post, parentComment, originalComment] = await Promise.all([
            post_model_1.PostModel.findById(postId).lean(),
            comment_model_1.CommentModel.findById(dto.parentCommentId).lean(),
            comment_model_1.CommentModel.findById(dto.originalCommentId).lean(),
        ]);
        if (!post)
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        if (!parentComment)
            throw new errors_1.NotFoundError("Không tìm thấy bình luận cha");
        if (!originalComment)
            throw new errors_1.NotFoundError("Không tìm thấy bình luận gốc");
        const reply = await comment_model_1.CommentModel.create({
            postId: new mongoose_1.Types.ObjectId(postId),
            userId: new mongoose_1.Types.ObjectId(userId),
            contentText: dto.contentText,
            parentCommentId: new mongoose_1.Types.ObjectId(dto.parentCommentId),
            originalCommentId: new mongoose_1.Types.ObjectId(dto.originalCommentId),
        });
        // Tăng repliesCount của originalComment và commentsCount của post
        await Promise.all([
            comment_model_1.CommentModel.findByIdAndUpdate(dto.originalCommentId, {
                $inc: { repliesCount: 1 },
            }),
            post_model_1.PostModel.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } }),
        ]);
        const { user, isLiked } = await populateCommentUser(reply, userId);
        return (0, comment_dto_1.toCommentResponse)(reply, { user, isLiked });
    },
    // ── Cập nhật comment ─────────────────────────────────────────────────────
    async updateComment(commentId, userId, dto) {
        assertObjectId(commentId, "bình luận");
        const comment = await comment_model_1.CommentModel.findById(commentId);
        if (!comment) {
            throw new errors_1.NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
        }
        if (comment.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Bạn không có quyền chỉnh sửa bình luận này");
        }
        comment.contentText = dto.contentText;
        comment.isEdited = true;
        await comment.save();
        const { user, isLiked } = await populateCommentUser(comment, userId);
        return (0, comment_dto_1.toCommentResponse)(comment, { user, isLiked });
    },
    // ── Xóa comment cấp 1 (cascade xóa toàn bộ replies trong thread) ─────────
    async deleteComment(commentId, userId, isAdmin = false) {
        assertObjectId(commentId, "bình luận");
        const comment = await comment_model_1.CommentModel.findById(commentId);
        if (!comment) {
            throw new errors_1.NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
        }
        if (!isAdmin && comment.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Bạn không có quyền xóa bình luận này");
        }
        const isTopLevel = !comment.parentCommentId;
        if (isTopLevel) {
            // Xóa toàn bộ replies trong thread
            const replyIds = await comment_model_1.CommentModel.find({
                originalCommentId: comment._id,
            }).distinct("_id");
            await Promise.all([
                like_model_1.LikeModel.deleteMany({
                    commentId: { $in: [comment._id, ...replyIds] },
                }),
                comment_model_1.CommentModel.deleteMany({ originalCommentId: comment._id }),
            ]);
            const totalDeleted = 1 + replyIds.length;
            await post_model_1.PostModel.findByIdAndUpdate(comment.postId, {
                $inc: { commentsCount: -totalDeleted },
            });
        }
        else {
            // Xóa reply đơn lẻ
            await like_model_1.LikeModel.deleteMany({ commentId: comment._id });
            // Giảm repliesCount của originalComment
            await comment_model_1.CommentModel.findByIdAndUpdate(comment.originalCommentId, {
                $inc: { repliesCount: -1 },
            });
            await post_model_1.PostModel.findByIdAndUpdate(comment.postId, {
                $inc: { commentsCount: -1 },
            });
        }
        await comment.deleteOne();
    },
    // ── Like comment ──────────────────────────────────────────────────────────
    async likeComment(commentId, userId) {
        assertObjectId(commentId, "bình luận");
        const comment = await comment_model_1.CommentModel.findById(commentId);
        if (!comment) {
            throw new errors_1.NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
        }
        const existing = await like_model_1.LikeModel.findOne({ commentId, userId });
        if (existing)
            return; // idempotent
        await like_model_1.LikeModel.create({
            commentId: new mongoose_1.Types.ObjectId(commentId),
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        await comment_model_1.CommentModel.findByIdAndUpdate(commentId, {
            $inc: { likesCount: 1 },
        });
    },
    // ── Unlike comment ────────────────────────────────────────────────────────
    async unlikeComment(commentId, userId) {
        assertObjectId(commentId, "bình luận");
        const comment = await comment_model_1.CommentModel.findById(commentId);
        if (!comment) {
            throw new errors_1.NotFoundError(`Không tìm thấy bình luận với ID: ${commentId}`);
        }
        const deleted = await like_model_1.LikeModel.findOneAndDelete({ commentId, userId });
        if (!deleted)
            return; // idempotent
        await comment_model_1.CommentModel.findByIdAndUpdate(commentId, {
            $inc: { likesCount: -1 },
        });
    },
};
