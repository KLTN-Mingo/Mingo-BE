"use strict";
// src/dtos/comment.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedCommentsDto = exports.CommentDetailDto = exports.CommentResponseDto = exports.CommentAuthorDto = exports.GetRepliesQueryDto = exports.GetCommentsQueryDto = exports.UpdateCommentDto = exports.CreateReplyDto = exports.CreateCommentDto = void 0;
exports.toCommentResponse = toCommentResponse;
exports.toCommentDetail = toCommentDetail;
// ==========================================
// REQUEST DTOs
// ==========================================
class CreateCommentDto {
}
exports.CreateCommentDto = CreateCommentDto;
class CreateReplyDto {
}
exports.CreateReplyDto = CreateReplyDto;
class UpdateCommentDto {
}
exports.UpdateCommentDto = UpdateCommentDto;
class GetCommentsQueryDto {
}
exports.GetCommentsQueryDto = GetCommentsQueryDto;
class GetRepliesQueryDto {
}
exports.GetRepliesQueryDto = GetRepliesQueryDto;
// ==========================================
// RESPONSE DTOs
// ==========================================
class CommentAuthorDto {
}
exports.CommentAuthorDto = CommentAuthorDto;
class CommentResponseDto {
}
exports.CommentResponseDto = CommentResponseDto;
class CommentDetailDto extends CommentResponseDto {
}
exports.CommentDetailDto = CommentDetailDto;
class PaginatedCommentsDto {
}
exports.PaginatedCommentsDto = PaginatedCommentsDto;
function toCommentResponse(comment, options = {}) {
    return {
        id: comment._id.toString(),
        postId: comment.postId.toString(),
        userId: comment.userId.toString(),
        user: options.user,
        contentText: comment.contentText,
        parentCommentId: comment.parentCommentId?.toString() ?? null,
        originalCommentId: comment.originalCommentId?.toString() ?? null,
        isReply: !!comment.parentCommentId,
        likesCount: comment.likesCount,
        repliesCount: comment.repliesCount,
        isLiked: options.isLiked ?? false,
        moderationStatus: comment.moderationStatus,
        isHidden: comment.isHidden,
        isEdited: comment.isEdited,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
    };
}
function toCommentDetail(comment, options = {}) {
    return {
        ...toCommentResponse(comment, options),
        topReplies: options.topReplies ?? [],
    };
}
