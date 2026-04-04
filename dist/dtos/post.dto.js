"use strict";
// src/dtos/post.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentSummaryDto = exports.SavedPostsResponseDto = exports.ShareResponseDto = exports.PostLikersDto = exports.PaginatedPostsDto = exports.PostDetailDto = exports.PostResponseDto = exports.PaginationDto = exports.AIScoreDto = exports.PostLocationDto = exports.PostMediaDto = exports.GetSavedPostsDto = exports.SavePostDto = exports.SharePostDto = exports.LikePostDto = exports.SearchPostsDto = exports.GetFeedDto = exports.GetPostsQueryDto = exports.MediaFileDto = exports.UpdatePostDto = exports.CreatePostDto = void 0;
exports.toPostResponse = toPostResponse;
exports.toPostDetail = toPostDetail;
// ==========================================
// REQUEST DTOs
// ==========================================
class CreatePostDto {
}
exports.CreatePostDto = CreatePostDto;
class UpdatePostDto {
}
exports.UpdatePostDto = UpdatePostDto;
class MediaFileDto {
}
exports.MediaFileDto = MediaFileDto;
class GetPostsQueryDto {
}
exports.GetPostsQueryDto = GetPostsQueryDto;
class GetFeedDto {
}
exports.GetFeedDto = GetFeedDto;
class SearchPostsDto {
}
exports.SearchPostsDto = SearchPostsDto;
class LikePostDto {
}
exports.LikePostDto = LikePostDto;
class SharePostDto {
}
exports.SharePostDto = SharePostDto;
class SavePostDto {
}
exports.SavePostDto = SavePostDto;
class GetSavedPostsDto {
}
exports.GetSavedPostsDto = GetSavedPostsDto;
// ==========================================
// RESPONSE DTOs
// ==========================================
class PostMediaDto {
}
exports.PostMediaDto = PostMediaDto;
class PostLocationDto {
}
exports.PostLocationDto = PostLocationDto;
class AIScoreDto {
}
exports.AIScoreDto = AIScoreDto;
class PaginationDto {
}
exports.PaginationDto = PaginationDto;
class PostResponseDto {
}
exports.PostResponseDto = PostResponseDto;
class PostDetailDto extends PostResponseDto {
}
exports.PostDetailDto = PostDetailDto;
class PaginatedPostsDto {
}
exports.PaginatedPostsDto = PaginatedPostsDto;
class PostLikersDto {
}
exports.PostLikersDto = PostLikersDto;
class ShareResponseDto {
}
exports.ShareResponseDto = ShareResponseDto;
class SavedPostsResponseDto {
}
exports.SavedPostsResponseDto = SavedPostsResponseDto;
// ==========================================
// COMMENT SUMMARY (tránh circular import với comment.dto)
// ==========================================
class CommentSummaryDto {
}
exports.CommentSummaryDto = CommentSummaryDto;
/**
 * Map IPost document → PostResponseDto
 */
function toPostResponse(post, options = {}) {
    return {
        id: post._id.toString(),
        userId: post.userId.toString(),
        user: options.user,
        contentText: post.contentText,
        contentRichText: post.contentRichText,
        visibility: post.visibility,
        media: options.media ?? [],
        hashtags: options.hashtags ?? [],
        mentions: options.mentions ?? [],
        location: options.location,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        sharesCount: post.sharesCount,
        savesCount: post.savesCount,
        viewsCount: post.viewsCount,
        isLiked: options.isLiked ?? false,
        isSaved: options.isSaved ?? false,
        moderationStatus: post.moderationStatus,
        isHidden: post.isHidden,
        isEdited: post.isEdited,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
    };
}
/**
 * Map IPost document → PostDetailDto
 * Bao gồm AI scores gom từ 4 field riêng lẻ, hiddenReason, topComments
 */
function toPostDetail(post, options = {}) {
    return {
        ...toPostResponse(post, options),
        aiScores: {
            toxic: post.aiToxicScore,
            hateSpeech: post.aiHateSpeechScore,
            spam: post.aiSpamScore,
            overallRisk: post.aiOverallRisk,
        },
        hiddenReason: post.hiddenReason,
        topComments: options.topComments ?? [],
    };
}
