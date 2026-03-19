"use strict";
// src/services/post.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostService = void 0;
const date_fns_1 = require("date-fns");
const mongoose_1 = require("mongoose");
const post_model_1 = require("../models/post.model");
const errors_1 = require("../errors");
const post_dto_1 = require("../dtos/post.dto");
const user_dto_1 = require("../dtos/user.dto");
const post_media_model_1 = require("../models/post-media.model");
const post_hashtag_model_1 = require("../models/post-hashtag.model");
const post_mention_model_1 = require("../models/post-mention.model");
const like_model_1 = require("../models/like.model");
const comment_model_1 = require("../models/comment.model");
const user_model_1 = require("../models/user.model");
// ─── Helper: load related data cho một post ───────────────────────────────────
async function loadPostRelations(postId, currentUserId) {
    const post = await post_model_1.PostModel.findById(postId).lean();
    if (!post)
        throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    const [author, mediaRows, hashtagRows, mentionRows, likeRow] = await Promise.all([
        user_model_1.UserModel.findById(post.userId).lean(),
        post_media_model_1.PostMediaModel.find({ postId }).sort({ orderIndex: 1 }).lean(),
        post_hashtag_model_1.PostHashtagModel.find({ postId }).lean(),
        post_mention_model_1.PostMentionModel.find({ postId }).populate("mentionedUserId").lean(),
        currentUserId
            ? like_model_1.LikeModel.findOne({ postId, userId: currentUserId }).lean()
            : Promise.resolve(null),
    ]);
    const media = mediaRows.map((m) => ({
        id: m._id.toString(),
        mediaType: m.mediaType,
        mediaUrl: m.mediaUrl,
        thumbnailUrl: m.thumbnailUrl,
        width: m.width,
        height: m.height,
        duration: m.duration,
        fileSize: m.fileSize,
        orderIndex: m.orderIndex,
    }));
    const hashtags = hashtagRows.map((h) => h.hashtag);
    const mentions = mentionRows
        .map((m) => (m.mentionedUserId ? (0, user_dto_1.toUserMinimal)(m.mentionedUserId) : null))
        .filter(Boolean);
    const location = post.locationName || post.locationLatitude
        ? {
            name: post.locationName,
            latitude: post.locationLatitude,
            longitude: post.locationLongitude,
        }
        : undefined;
    return {
        user: author ? (0, user_dto_1.toUserMinimal)(author) : undefined,
        media,
        hashtags,
        mentions,
        location,
        isLiked: !!likeRow,
        isSaved: false, // TODO: tích hợp SavedPostModel khi có
    };
}
// ─── Service ──────────────────────────────────────────────────────────────────
exports.PostService = {
    // ── Get all posts ──────────────────────────────────────────────────────────
    async getAllPosts(currentUserId) {
        const posts = await post_model_1.PostModel.find({ isHidden: false })
            .sort({ createdAt: -1 })
            .lean();
        return Promise.all(posts.map(async (post) => {
            const relations = await loadPostRelations(post._id, currentUserId);
            return (0, post_dto_1.toPostResponse)(post, relations);
        }));
    },
    // ── Get feed ───────────────────────────────────────────────────────────────
    async getFeedPosts(userId, page, limit) {
        const skip = (page - 1) * limit;
        const currentUser = await user_model_1.UserModel.findById(userId)
            .select("following")
            .lean();
        const followingIds = currentUser?.following?.map((id) => id.toString()) ?? [];
        const relatedIds = [userId, ...followingIds];
        const [posts, total] = await Promise.all([
            post_model_1.PostModel.find({ userId: { $in: relatedIds }, isHidden: false })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            post_model_1.PostModel.countDocuments({
                userId: { $in: relatedIds },
                isHidden: false,
            }),
        ]);
        const postDtos = await Promise.all(posts.map(async (post) => {
            const relations = await loadPostRelations(post._id, userId);
            return (0, post_dto_1.toPostResponse)(post, relations);
        }));
        const totalPages = Math.ceil(total / limit);
        return {
            posts: postDtos,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    },
    // ── Get single post ────────────────────────────────────────────────────────
    async getPostById(postId, currentUserId) {
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const post = await post_model_1.PostModel.findById(postId).lean();
        if (!post) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const [relations, topCommentRows] = await Promise.all([
            loadPostRelations(post._id, currentUserId),
            comment_model_1.CommentModel.find({
                postId: post._id,
                isHidden: false,
                parentCommentId: null,
            })
                .sort({ likesCount: -1 })
                .limit(3)
                .populate("userId", "name avatar verified")
                .lean(),
        ]);
        const topComments = topCommentRows.map((c) => ({
            id: c._id.toString(),
            userId: c.userId?._id?.toString() ?? "",
            user: c.userId ? (0, user_dto_1.toUserMinimal)(c.userId) : undefined,
            contentText: c.contentText,
            likesCount: c.likesCount ?? 0,
            repliesCount: c.repliesCount ?? 0,
            createdAt: c.createdAt,
        }));
        return (0, post_dto_1.toPostDetail)(post, { ...relations, topComments });
    },
    // ── Trending posts ─────────────────────────────────────────────────────────
    async getTrendingPosts(currentUserId) {
        const posts = await post_model_1.PostModel.find({
            isHidden: false,
            moderationStatus: post_model_1.ModerationStatus.APPROVED,
        }).lean();
        const now = new Date();
        const top10 = posts
            .map((post) => {
            const hoursAgo = Math.max((0, date_fns_1.differenceInHours)(now, new Date(post.createdAt)), 1);
            const score = Math.log10(post.likesCount + 1) +
                Math.log10(post.commentsCount + 1) * 1.2 +
                Math.log10(post.sharesCount + 1) * 1.5 -
                hoursAgo * 0.1;
            return { post, score };
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((s) => s.post);
        return Promise.all(top10.map(async (post) => {
            const relations = await loadPostRelations(post._id, currentUserId);
            return (0, post_dto_1.toPostResponse)(post, relations);
        }));
    },
    // ── Create post ────────────────────────────────────────────────────────────
    async createPost(userId, dto) {
        const post = await post_model_1.PostModel.create({
            userId: new mongoose_1.Types.ObjectId(userId),
            contentText: dto.contentText,
            visibility: dto.visibility ?? post_model_1.PostVisibility.PUBLIC,
            moderationStatus: post_model_1.ModerationStatus.PENDING,
            locationName: dto.locationName,
            locationLatitude: dto.locationLatitude,
            locationLongitude: dto.locationLongitude,
        });
        if (dto.mediaFiles?.length) {
            await post_media_model_1.PostMediaModel.insertMany(dto.mediaFiles.map((m, i) => ({
                postId: post._id,
                mediaType: m.mediaType,
                mediaUrl: m.mediaUrl,
                thumbnailUrl: m.thumbnailUrl,
                width: m.width,
                height: m.height,
                duration: m.duration,
                fileSize: m.fileSize,
                orderIndex: m.orderIndex ?? i,
            })));
        }
        if (dto.hashtags?.length) {
            await post_hashtag_model_1.PostHashtagModel.insertMany(dto.hashtags.map((tag) => ({ postId: post._id, hashtag: tag })));
        }
        if (dto.mentions?.length) {
            await post_mention_model_1.PostMentionModel.insertMany(dto.mentions.map((mentionedId) => ({
                postId: post._id,
                mentionedUserId: new mongoose_1.Types.ObjectId(mentionedId),
            })));
        }
        await user_model_1.UserModel.findByIdAndUpdate(userId, { $inc: { postsCount: 1 } });
        return this.getPostById(post._id.toString(), userId);
    },
    // ── Update post ────────────────────────────────────────────────────────────
    async updatePost(postId, userId, dto) {
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const post = await post_model_1.PostModel.findById(postId);
        if (!post) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        if (post.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Bạn không có quyền chỉnh sửa bài viết này");
        }
        if (dto.contentText !== undefined)
            post.contentText = dto.contentText;
        if (dto.visibility !== undefined)
            post.visibility = dto.visibility;
        post.isEdited = true;
        await post.save();
        return this.getPostById(postId, userId);
    },
    // ── Delete post ────────────────────────────────────────────────────────────
    async deletePost(postId, userId, isAdmin = false) {
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const post = await post_model_1.PostModel.findById(postId);
        if (!post) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        if (!isAdmin && post.userId.toString() !== userId) {
            throw new errors_1.ForbiddenError("Bạn không có quyền xóa bài viết này");
        }
        const oid = post._id;
        const commentIds = await comment_model_1.CommentModel.find({ postId: oid }).distinct("_id");
        await Promise.all([
            like_model_1.LikeModel.deleteMany({ postId: oid }),
            like_model_1.LikeModel.deleteMany({ commentId: { $in: commentIds } }),
            comment_model_1.CommentModel.deleteMany({ postId: oid }),
            post_media_model_1.PostMediaModel.deleteMany({ postId: oid }),
            post_hashtag_model_1.PostHashtagModel.deleteMany({ postId: oid }),
            post_mention_model_1.PostMentionModel.deleteMany({ postId: oid }),
        ]);
        await post.deleteOne();
        await user_model_1.UserModel.findByIdAndUpdate(post.userId, {
            $inc: { postsCount: -1 },
        });
    },
    // ── Like post ──────────────────────────────────────────────────────────────
    async likePost(postId, userId) {
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const post = await post_model_1.PostModel.findById(postId);
        if (!post)
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        const existing = await like_model_1.LikeModel.findOne({ postId, userId });
        if (existing)
            return; // idempotent
        await like_model_1.LikeModel.create({
            postId: new mongoose_1.Types.ObjectId(postId),
            userId: new mongoose_1.Types.ObjectId(userId),
        });
        await post_model_1.PostModel.findByIdAndUpdate(postId, { $inc: { likesCount: 1 } });
    },
    // ── Unlike post ────────────────────────────────────────────────────────────
    async unlikePost(postId, userId) {
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const post = await post_model_1.PostModel.findById(postId);
        if (!post)
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        const deleted = await like_model_1.LikeModel.findOneAndDelete({ postId, userId });
        if (!deleted)
            return; // idempotent
        await post_model_1.PostModel.findByIdAndUpdate(postId, {
            $inc: { likesCount: -1 },
        });
    },
    // ── Count posts ────────────────────────────────────────────────────────────
    async countPosts() {
        return post_model_1.PostModel.countDocuments();
    },
    async countPostsToday() {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        return post_model_1.PostModel.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        });
    },
};
