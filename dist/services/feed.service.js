"use strict";
// src/services/feed.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedService = void 0;
const mongoose_1 = require("mongoose");
const post_model_1 = require("../models/post.model");
const follow_model_1 = require("../models/follow.model");
const user_profile_model_1 = require("../models/user-profile.model");
const scoring_service_1 = require("./scoring.service");
const feed_constants_1 = require("../constants/feed.constants");
const post_dto_1 = require("../dtos/post.dto");
const block_model_1 = require("../models/block.model");
const user_interaction_model_1 = require("../models/user-interaction.model");
const post_media_model_1 = require("../models/post-media.model");
const post_hashtag_model_1 = require("../models/post-hashtag.model");
const post_mention_model_1 = require("../models/post-mention.model");
const like_model_1 = require("../models/like.model");
const user_model_1 = require("../models/user.model");
const user_dto_1 = require("../dtos/user.dto");
const feed_analytics_service_1 = require("./feed-analytics.service");
async function getSocialIds(userId) {
    const userObjectId = new mongoose_1.Types.ObjectId(userId);
    const [followingRows, followersRows, closeFriendRows] = await Promise.all([
        follow_model_1.FollowModel.find({
            followerId: userObjectId,
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
        })
            .select("followingId")
            .lean(),
        follow_model_1.FollowModel.find({
            followingId: userObjectId,
            followStatus: follow_model_1.FollowStatus.ACCEPTED,
        })
            .select("followerId")
            .lean(),
        follow_model_1.FollowModel.find({
            $or: [
                { followerId: userObjectId },
                { followingId: userObjectId },
            ],
            closeFriendStatus: follow_model_1.CloseFriendStatus.ACCEPTED,
        })
            .select("followerId followingId")
            .lean(),
    ]);
    const followingIds = new Set(followingRows.map((r) => r.followingId.toString()));
    const followerIds = new Set(followersRows.map((r) => r.followerId.toString()));
    const friendIds = new Set();
    followingIds.forEach((id) => {
        if (followerIds.has(id))
            friendIds.add(id);
    });
    const closeFriendIds = new Set();
    closeFriendRows.forEach((r) => {
        const a = r.followerId?.toString();
        const b = r.followingId?.toString();
        if (a && a !== userId)
            closeFriendIds.add(a);
        if (b && b !== userId)
            closeFriendIds.add(b);
    });
    return { followingIds, friendIds, closeFriendIds };
}
/** User IDs không được hiện trong feed: mình chặn họ hoặc họ chặn mình */
async function getBlockedUserIds(userId) {
    const userObjectId = new mongoose_1.Types.ObjectId(userId);
    const [iBlocked, blockedMe] = await Promise.all([
        block_model_1.BlockModel.find({ blockerId: userObjectId }).select("blockedId").lean(),
        block_model_1.BlockModel.find({ blockedId: userObjectId }).select("blockerId").lean(),
    ]);
    const set = new Set();
    iBlocked.forEach((r) => set.add(r.blockedId.toString()));
    blockedMe.forEach((r) => set.add(r.blockerId.toString()));
    return set;
}
/** Post IDs user đã xem (viewed=true) — loại khỏi feed để không thấy lại khi refresh */
async function getViewedPostIds(userId) {
    const rows = await user_interaction_model_1.UserInteractionModel.find({
        userId: new mongoose_1.Types.ObjectId(userId),
        viewed: true,
    })
        .select("postId")
        .lean();
    return new Set(rows.map((r) => r.postId.toString()));
}
function canViewPost(post, currentUserId, social) {
    const authorId = post.userId?.toString();
    if (!authorId)
        return false;
    if (authorId === currentUserId)
        return true;
    const visibility = post.visibility;
    switch (visibility) {
        case post_model_1.PostVisibility.PUBLIC:
            return true;
        case post_model_1.PostVisibility.PRIVATE:
            return false;
        case post_model_1.PostVisibility.FRIENDS:
            return social.friendIds.has(authorId);
        case post_model_1.PostVisibility.BESTFRIENDS:
            return social.closeFriendIds.has(authorId);
        default:
            return false;
    }
}
/** Batch load relations cho nhiều post — tránh N+1 (1 query author, 1 media, 1 hashtag, 1 mention, 1 like thay vì 5 per post). */
async function loadPostRelationsForFeedBatch(posts, currentUserId) {
    const result = new Map();
    if (posts.length === 0)
        return result;
    const postIds = posts.map((p) => p._id);
    const authorIds = [...new Set(posts.map((p) => p.userId.toString()))].map((id) => new mongoose_1.Types.ObjectId(id));
    const currentUserObjectId = new mongoose_1.Types.ObjectId(currentUserId);
    const [authors, mediaRows, hashtagRows, mentionRows, likeRows] = await Promise.all([
        user_model_1.UserModel.find({ _id: { $in: authorIds } }).lean(),
        post_media_model_1.PostMediaModel.find({ postId: { $in: postIds } })
            .sort({ orderIndex: 1 })
            .lean(),
        post_hashtag_model_1.PostHashtagModel.find({ postId: { $in: postIds } }).lean(),
        post_mention_model_1.PostMentionModel.find({ postId: { $in: postIds } })
            .populate("mentionedUserId")
            .lean(),
        like_model_1.LikeModel.find({
            postId: { $in: postIds },
            userId: currentUserObjectId,
        })
            .select("postId")
            .lean(),
    ]);
    const authorMap = new Map();
    authors.forEach((a) => {
        if (a?._id)
            authorMap.set(a._id.toString(), (0, user_dto_1.toUserMinimal)(a));
    });
    const mediaByPost = new Map();
    mediaRows.forEach((m) => {
        const pid = m.postId?.toString();
        if (!pid)
            return;
        const arr = mediaByPost.get(pid) ?? [];
        arr.push({
            id: m._id.toString(),
            mediaType: m.mediaType,
            mediaUrl: m.mediaUrl,
            thumbnailUrl: m.thumbnailUrl,
            width: m.width,
            height: m.height,
            duration: m.duration,
            fileSize: m.fileSize,
            orderIndex: m.orderIndex,
        });
        mediaByPost.set(pid, arr);
    });
    const hashtagsByPost = new Map();
    hashtagRows.forEach((h) => {
        const pid = h.postId?.toString();
        if (!pid)
            return;
        const arr = hashtagsByPost.get(pid) ?? [];
        arr.push(h.hashtag);
        hashtagsByPost.set(pid, arr);
    });
    const mentionsByPost = new Map();
    mentionRows.forEach((m) => {
        const pid = m.postId?.toString();
        if (!pid)
            return;
        const arr = mentionsByPost.get(pid) ?? [];
        const u = m.mentionedUserId ? (0, user_dto_1.toUserMinimal)(m.mentionedUserId) : null;
        if (u)
            arr.push(u);
        mentionsByPost.set(pid, arr);
    });
    const likedPostIds = new Set(likeRows.map((r) => r.postId?.toString()).filter(Boolean));
    for (const post of posts) {
        const postIdStr = post._id.toString();
        const authorIdStr = post.userId?.toString();
        const location = post.locationName || post.locationLatitude != null
            ? {
                name: post.locationName,
                latitude: post.locationLatitude,
                longitude: post.locationLongitude,
            }
            : undefined;
        result.set(postIdStr, {
            user: authorIdStr ? authorMap.get(authorIdStr) : undefined,
            media: mediaByPost.get(postIdStr) ?? [],
            hashtags: hashtagsByPost.get(postIdStr) ?? [],
            mentions: mentionsByPost.get(postIdStr) ?? [],
            location,
            isLiked: likedPostIds.has(postIdStr),
            isSaved: false,
        });
    }
    return result;
}
function applyExploration(sorted, explorationRate) {
    if (sorted.length <= 1 || explorationRate <= 0)
        return sorted;
    const keepTop = Math.max(1, Math.floor(sorted.length * (1 - explorationRate)));
    const top = sorted.slice(0, keepTop);
    const rest = sorted.slice(keepTop);
    if (rest.length === 0)
        return top;
    const shuffle = (arr) => {
        const out = [...arr];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    };
    return [...top, ...shuffle(rest)];
}
exports.FeedService = {
    /**
     * Feed Bạn bè: chỉ bài từ người đang follow (bạn thường hoặc bạn thân).
     * Sắp xếp theo thời gian mới nhất, không scoring/exploration.
     */
    async getFriendsFeed(userId, page, limit) {
        const [social, blockedUserIds, viewedPostIds] = await Promise.all([
            getSocialIds(userId),
            getBlockedUserIds(userId),
            getViewedPostIds(userId),
        ]);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - feed_constants_1.MAX_POST_AGE_DAYS);
        const followingObjectIds = [...social.followingIds].map((id) => new mongoose_1.Types.ObjectId(id));
        if (followingObjectIds.length === 0) {
            return {
                posts: [],
                pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
            };
        }
        const rawCandidates = await post_model_1.PostModel.find({
            userId: { $in: followingObjectIds },
            isHidden: false,
            moderationStatus: { $in: [post_model_1.ModerationStatus.APPROVED, post_model_1.ModerationStatus.PENDING] },
            createdAt: { $gte: cutoff },
        })
            .sort({ createdAt: -1 })
            .limit(feed_constants_1.CANDIDATE_POOL_SIZE * 2)
            .lean();
        const candidates = rawCandidates.filter((post) => {
            if (viewedPostIds.has(post._id.toString()))
                return false;
            const authorId = post.userId?.toString();
            if (authorId && blockedUserIds.has(authorId))
                return false;
            return canViewPost(post, userId, social);
        });
        const total = candidates.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const slice = candidates.slice(start, start + limit);
        if (slice.length === 0) {
            return {
                posts: [],
                pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
            };
        }
        const relationsMap = await loadPostRelationsForFeedBatch(slice.map((p) => ({
            _id: p._id,
            userId: p.userId,
            locationName: p.locationName,
            locationLatitude: p.locationLatitude,
            locationLongitude: p.locationLongitude,
        })), userId);
        const posts = slice.map((post) => {
            const relations = relationsMap.get(post._id.toString()) ?? {
                user: undefined,
                media: [],
                hashtags: [],
                mentions: [],
                location: undefined,
                isLiked: false,
                isSaved: false,
            };
            return (0, post_dto_1.toPostResponse)(post, relations);
        });
        try {
            await feed_analytics_service_1.feedAnalyticsService.trackImpressions(userId, "friends", slice.map((post, index) => ({
                postId: post._id.toString(),
                position: start + index + 1,
            })));
        }
        catch (err) {
            console.error("[FeedService.getFriendsFeed] trackImpressions error:", err);
        }
        return {
            posts,
            pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
        };
    },
    /**
     * Feed Khám phá: đề xuất cá nhân hóa (scoring + exploration), có thể có bài ngoài vòng bạn bè.
     */
    async getPersonalizedFeed(userId, page, limit) {
        const [social, blockedUserIds, viewedPostIds] = await Promise.all([
            getSocialIds(userId),
            getBlockedUserIds(userId),
            getViewedPostIds(userId),
        ]);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - feed_constants_1.MAX_POST_AGE_DAYS);
        const rawCandidates = await post_model_1.PostModel.find({
            isHidden: false,
            moderationStatus: { $in: [post_model_1.ModerationStatus.APPROVED, post_model_1.ModerationStatus.PENDING] },
            createdAt: { $gte: cutoff },
        })
            .sort({ createdAt: -1 })
            .limit(feed_constants_1.CANDIDATE_POOL_SIZE * 2)
            .lean();
        const candidates = rawCandidates.filter((post) => {
            if (viewedPostIds.has(post._id.toString()))
                return false;
            const authorId = post.userId?.toString();
            if (authorId && blockedUserIds.has(authorId))
                return false;
            return canViewPost(post, userId, social);
        }).slice(0, feed_constants_1.CANDIDATE_POOL_SIZE);
        if (candidates.length === 0) {
            return {
                posts: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0,
                    hasMore: false,
                },
            };
        }
        const userProfile = await user_profile_model_1.UserProfileModel.findOne({
            userId: new mongoose_1.Types.ObjectId(userId),
        }).lean();
        const scored = await scoring_service_1.scoringService.scorePosts(candidates, userId, userProfile, social.followingIds);
        const withExploration = applyExploration(scored, feed_constants_1.EXPLORATION_RATE);
        // total = kích thước pool đã lọc (tối đa CANDIDATE_POOL_SIZE), không phải tổng bài trong DB
        const total = withExploration.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const slice = withExploration.slice(start, start + limit);
        const slicePosts = slice.map((s) => s.post);
        const relationsMap = await loadPostRelationsForFeedBatch(slicePosts.map((p) => ({
            _id: p._id,
            userId: p.userId,
            locationName: p.locationName,
            locationLatitude: p.locationLatitude,
            locationLongitude: p.locationLongitude,
        })), userId);
        const posts = slicePosts.map((post) => {
            const relations = relationsMap.get(post._id.toString()) ?? {
                user: undefined,
                media: [],
                hashtags: [],
                mentions: [],
                location: undefined,
                isLiked: false,
                isSaved: false,
            };
            return (0, post_dto_1.toPostResponse)(post, relations);
        });
        try {
            await feed_analytics_service_1.feedAnalyticsService.trackImpressions(userId, "explore", slice.map((row, index) => ({
                postId: row.post._id.toString(),
                position: start + index + 1,
                score: row.breakdown,
            })));
        }
        catch (err) {
            console.error("[FeedService.getPersonalizedFeed] trackImpressions error:", err);
        }
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
};
