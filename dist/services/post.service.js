"use strict";
// src/services/post.service.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const saved_post_model_1 = require("../models/saved-post.model");
const share_model_1 = require("../models/share.model");
const topic_extractor_service_1 = require("./topic-extractor.service");
const moderation_service_1 = require("./moderation/moderation.service");
// ─── Helper: load related data cho một post ───────────────────────────────────
async function loadPostRelations(postId, currentUserId) {
    const post = await post_model_1.PostModel.findById(postId).lean();
    if (!post)
        throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
    const [author, mediaRows, hashtagRows, mentionRows, likeRow, savedRow] = await Promise.all([
        user_model_1.UserModel.findById(post.userId).lean(),
        post_media_model_1.PostMediaModel.find({ postId }).sort({ orderIndex: 1 }).lean(),
        post_hashtag_model_1.PostHashtagModel.find({ postId }).lean(),
        post_mention_model_1.PostMentionModel.find({ postId }).populate("mentionedUserId").lean(),
        currentUserId
            ? like_model_1.LikeModel.findOne({ postId, userId: currentUserId }).lean()
            : Promise.resolve(null),
        currentUserId
            ? saved_post_model_1.SavedPostModel.findOne({
                postId,
                userId: new mongoose_1.Types.ObjectId(currentUserId),
            }).lean()
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
    async getFeedPosts(userId, page, limit, tab = "explore") {
        const { FeedService } = await Promise.resolve().then(() => __importStar(require("./feed.service")));
        if (tab === "friends") {
            return FeedService.getFriendsFeed(userId, page, limit);
        }
        return FeedService.getPersonalizedFeed(userId, page, limit);
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
        const mediaTypes = dto.mediaFiles?.map((m) => m.mediaType) ?? [];
        const topics = topic_extractor_service_1.topicExtractorService.extract({
            contentText: dto.contentText,
            hashtags: dto.hashtags ?? [],
            mediaTypes,
        });
        const post = await post_model_1.PostModel.create({
            userId: new mongoose_1.Types.ObjectId(userId),
            contentText: dto.contentText,
            contentRichText: dto.contentRichText,
            visibility: dto.visibility ?? post_model_1.PostVisibility.PUBLIC,
            moderationStatus: post_model_1.ModerationStatus.PENDING,
            locationName: dto.locationName,
            locationLatitude: dto.locationLatitude,
            locationLongitude: dto.locationLongitude,
            topics,
        });
        if (dto.mediaFiles?.length) {
            await post_media_model_1.PostMediaModel.insertMany(dto.mediaFiles.map((m, i) => ({
                postId: post._id,
                userId: new mongoose_1.Types.ObjectId(userId),
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
        // Fire-and-forget: không block response
        if (dto.contentText?.trim()) {
            try {
                const user = await user_model_1.UserModel.findById(userId)
                    .select("createdAt")
                    .lean();
                const accountAgeDays = user
                    ? (Date.now() - new Date(user.createdAt).getTime()) / 86400000
                    : 999;
                void moderation_service_1.ModerationService.moderateAndUpdate("post", post._id.toString(), dto.contentText, {
                    isNewAccount: accountAgeDays < 7,
                    reportCount: 0,
                }).catch((err) => console.error("[Moderation] Post error:", err));
            }
            catch (err) {
                console.error("[Moderation] Post error:", err);
            }
        }
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
        if (dto.contentText !== undefined) {
            post.contentText = dto.contentText;
            const currentHashtags = await post_hashtag_model_1.PostHashtagModel
                .find({ postId: post._id })
                .distinct("hashtag");
            post.topics = topic_extractor_service_1.topicExtractorService.extract({
                contentText: dto.contentText,
                hashtags: currentHashtags,
            });
        }
        if (dto.contentRichText !== undefined) {
            post.contentRichText = dto.contentRichText;
        }
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
            saved_post_model_1.SavedPostModel.deleteMany({ postId: oid }),
            share_model_1.ShareModel.deleteMany({ postId: oid }),
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
    async savePost(postId, userId, collectionName = "default") {
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const post = await post_model_1.PostModel.findById(postId);
        if (!post)
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        const uid = new mongoose_1.Types.ObjectId(userId);
        const pid = new mongoose_1.Types.ObjectId(postId);
        const existing = await saved_post_model_1.SavedPostModel.findOne({ userId: uid, postId: pid });
        if (existing)
            return;
        await saved_post_model_1.SavedPostModel.create({
            userId: uid,
            postId: pid,
            collectionName: collectionName.slice(0, 100),
        });
        await post_model_1.PostModel.findByIdAndUpdate(postId, { $inc: { savesCount: 1 } });
    },
    async unsavePost(postId, userId) {
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const uid = new mongoose_1.Types.ObjectId(userId);
        const pid = new mongoose_1.Types.ObjectId(postId);
        const deleted = await saved_post_model_1.SavedPostModel.findOneAndDelete({
            userId: uid,
            postId: pid,
        });
        if (!deleted)
            return;
        await post_model_1.PostModel.findByIdAndUpdate(postId, {
            $inc: { savesCount: -1 },
        });
    },
    async getSavedPosts(userId, page, limit) {
        const uid = new mongoose_1.Types.ObjectId(userId);
        const total = await saved_post_model_1.SavedPostModel.countDocuments({ userId: uid });
        const rows = await saved_post_model_1.SavedPostModel.find({ userId: uid })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select("postId")
            .lean();
        const posts = [];
        for (const row of rows) {
            const pid = row.postId?.toString();
            if (!pid)
                continue;
            try {
                const dto = await this.getPostById(pid, userId);
                posts.push({
                    id: dto.id,
                    userId: dto.userId,
                    user: dto.user,
                    contentText: dto.contentText,
                    contentRichText: dto.contentRichText,
                    visibility: dto.visibility,
                    media: dto.media,
                    hashtags: dto.hashtags,
                    mentions: dto.mentions,
                    location: dto.location,
                    likesCount: dto.likesCount,
                    commentsCount: dto.commentsCount,
                    sharesCount: dto.sharesCount,
                    savesCount: dto.savesCount,
                    viewsCount: dto.viewsCount,
                    isLiked: dto.isLiked,
                    isSaved: true,
                    moderationStatus: dto.moderationStatus,
                    isHidden: dto.isHidden,
                    isEdited: dto.isEdited,
                    createdAt: dto.createdAt,
                    updatedAt: dto.updatedAt,
                });
            }
            catch {
                /* bài đã xóa — bỏ qua */
            }
        }
        const totalPages = Math.ceil(total / limit) || 0;
        return {
            posts,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            },
        };
    },
    async sharePost(postId, userId, sharedTo, caption) {
        if (!mongoose_1.Types.ObjectId.isValid(postId)) {
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        }
        const post = await post_model_1.PostModel.findById(postId);
        if (!post)
            throw new errors_1.NotFoundError(`Không tìm thấy bài viết với ID: ${postId}`);
        await share_model_1.ShareModel.create({
            userId: new mongoose_1.Types.ObjectId(userId),
            postId: new mongoose_1.Types.ObjectId(postId),
            sharedTo,
            caption: caption?.slice(0, 2000),
        });
        await post_model_1.PostModel.findByIdAndUpdate(postId, { $inc: { sharesCount: 1 } });
    },
};
