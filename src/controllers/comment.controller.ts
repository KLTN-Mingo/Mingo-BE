// src/controllers/comment.controller.ts

import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess, sendCreated, sendPaginated } from "../utils/response";
import { ValidationError } from "../errors";
import { CommentService } from "../services/comment.service";
import { interactionTrackerService } from "../services/interaction-tracker.service";
import {
  InteractionType,
  InteractionSource,
} from "../models/user-interaction.model";

// Helper to get userId from request
function getUserId(req: Request): string {
  const userId = (req as any).user?.userId;
  if (!userId) {
    throw new ValidationError("Không tìm thấy thông tin người dùng");
  }
  return userId;
}

// Helper to get optional userId
function getOptionalUserId(req: Request): string | undefined {
  return (req as any).user?.userId;
}

// Helper to get string param
function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

// ══════════════════════════════════════════════════════════════════════════════
// POST COMMENTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/posts/:postId/comments
 * @desc    Lấy comments cấp 1 của một post
 * @access  Private
 */
export const getPostComments = asyncHandler(
  async (req: Request, res: Response) => {
    const postId = getParam(req.params.postId);
    const currentUserId = getOptionalUserId(req);
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    const result = await CommentService.getPostComments(
      postId,
      parseInt(page),
      parseInt(limit),
      currentUserId
    );

    sendSuccess(res, result, "Lấy danh sách comments thành công");
  }
);

/**
 * @route   POST /api/posts/:postId/comments
 * @desc    Tạo comment mới cho post
 * @access  Private
 */
export const createComment = asyncHandler(
  async (req: Request, res: Response) => {
    const postId = getParam(req.params.postId);
    const userId = getUserId(req);
    const { contentText } = req.body;

    const result = await CommentService.createComment(postId, userId, {
      contentText,
    });

    void interactionTrackerService
      .track({
        userId,
        postId,
        type: InteractionType.COMMENT,
        source: InteractionSource.PROFILE,
      })
      .catch((err) =>
        console.error("[CommentController] track createComment error:", err)
      );

    sendCreated(res, result, "Tạo comment thành công");
  }
);

/**
 * @route   POST /api/posts/:postId/comments/:commentId/replies
 * @desc    Tạo reply cho comment
 * @access  Private
 */
export const createReply = asyncHandler(async (req: Request, res: Response) => {
  const postId = getParam(req.params.postId);
  const parentCommentId = getParam(req.params.commentId);
  const userId = getUserId(req);
  const { contentText, originalCommentId } = req.body;

  const result = await CommentService.createReply(postId, userId, {
    parentCommentId,
    contentText,
    originalCommentId: originalCommentId || parentCommentId,
  });

  void interactionTrackerService
    .track({
      userId,
      postId,
      type: InteractionType.COMMENT,
      source: InteractionSource.PROFILE,
    })
    .catch((err) =>
      console.error("[CommentController] track createReply error:", err)
    );

  sendCreated(res, result, "Tạo reply thành công");
});

// ══════════════════════════════════════════════════════════════════════════════
// SINGLE COMMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/comments/:commentId
 * @desc    Lấy chi tiết comment
 * @access  Private
 */
export const getCommentById = asyncHandler(
  async (req: Request, res: Response) => {
    const commentId = getParam(req.params.commentId);
    const currentUserId = getOptionalUserId(req);

    const result = await CommentService.getCommentById(
      commentId,
      currentUserId
    );

    sendSuccess(res, result, "Lấy comment thành công");
  }
);

/**
 * @route   GET /api/comments/:commentId/replies
 * @desc    Lấy replies của comment
 * @access  Private
 */
export const getCommentReplies = asyncHandler(
  async (req: Request, res: Response) => {
    const commentId = getParam(req.params.commentId);
    const currentUserId = getOptionalUserId(req);
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    const result = await CommentService.getCommentReplies(
      commentId,
      parseInt(page),
      parseInt(limit),
      currentUserId
    );

    sendSuccess(res, result, "Lấy danh sách replies thành công");
  }
);

/**
 * @route   PUT /api/comments/:commentId
 * @desc    Cập nhật comment
 * @access  Private (owner only)
 */
export const updateComment = asyncHandler(
  async (req: Request, res: Response) => {
    const commentId = getParam(req.params.commentId);
    const userId = getUserId(req);
    const { contentText } = req.body;

    const result = await CommentService.updateComment(commentId, userId, {
      contentText,
    });

    sendSuccess(res, result, "Cập nhật comment thành công");
  }
);

/**
 * @route   DELETE /api/comments/:commentId
 * @desc    Xóa comment
 * @access  Private (owner only)
 */
export const deleteComment = asyncHandler(
  async (req: Request, res: Response) => {
    const commentId = getParam(req.params.commentId);
    const userId = getUserId(req);

    await CommentService.deleteComment(commentId, userId);

    sendSuccess(res, null, "Xóa comment thành công");
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// LIKE / UNLIKE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/comments/:commentId/like
 * @desc    Like comment
 * @access  Private
 */
export const likeComment = asyncHandler(async (req: Request, res: Response) => {
  const commentId = getParam(req.params.commentId);
  const userId = getUserId(req);

  await CommentService.likeComment(commentId, userId);

  sendSuccess(res, null, "Like comment thành công");
});

/**
 * @route   DELETE /api/comments/:commentId/like
 * @desc    Unlike comment
 * @access  Private
 */
export const unlikeComment = asyncHandler(
  async (req: Request, res: Response) => {
    const commentId = getParam(req.params.commentId);
    const userId = getUserId(req);

    await CommentService.unlikeComment(commentId, userId);

    sendSuccess(res, null, "Unlike comment thành công");
  }
);
