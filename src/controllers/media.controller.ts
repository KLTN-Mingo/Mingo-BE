// src/controllers/media.controller.ts

import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess, sendCreated } from "../utils/response";
import { ValidationError } from "../errors";
import { MediaService } from "../services/media.service";

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
// CRUD
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/posts/:postId/media
 * @desc    Thêm media cho post
 * @access  Private (owner only)
 */
export const createMedia = asyncHandler(async (req: Request, res: Response) => {
  const postId = getParam(req.params.postId);
  const userId = getUserId(req);

  const result = await MediaService.createMedia(postId, userId, req.body);
  sendCreated(res, result, "Thêm media thành công");
});

/**
 * @route   GET /api/media/:mediaId
 * @desc    Lấy chi tiết media
 * @access  Private
 */
export const getMediaById = asyncHandler(
  async (req: Request, res: Response) => {
    const mediaId = getParam(req.params.mediaId);
    const currentUserId = getOptionalUserId(req);

    const result = await MediaService.getMediaById(mediaId, currentUserId);
    sendSuccess(res, result, "Lấy media thành công");
  }
);

/**
 * @route   GET /api/posts/:postId/media
 * @desc    Lấy tất cả media của post
 * @access  Private
 */
export const getPostMedia = asyncHandler(
  async (req: Request, res: Response) => {
    const postId = getParam(req.params.postId);
    const currentUserId = getOptionalUserId(req);

    const result = await MediaService.getPostMedia(postId, currentUserId);
    sendSuccess(res, result, "Lấy danh sách media thành công");
  }
);

/**
 * @route   PUT /api/media/:mediaId
 * @desc    Cập nhật media
 * @access  Private (owner only)
 */
export const updateMedia = asyncHandler(async (req: Request, res: Response) => {
  const mediaId = getParam(req.params.mediaId);
  const userId = getUserId(req);

  const result = await MediaService.updateMedia(mediaId, userId, req.body);
  sendSuccess(res, result, "Cập nhật media thành công");
});

/**
 * @route   DELETE /api/media/:mediaId
 * @desc    Xóa media
 * @access  Private (owner only)
 */
export const deleteMedia = asyncHandler(async (req: Request, res: Response) => {
  const mediaId = getParam(req.params.mediaId);
  const userId = getUserId(req);

  await MediaService.deleteMedia(mediaId, userId);
  sendSuccess(res, null, "Xóa media thành công");
});

// ══════════════════════════════════════════════════════════════════════════════
// LIKE / UNLIKE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/media/:mediaId/like
 * @desc    Like media
 * @access  Private
 */
export const likeMedia = asyncHandler(async (req: Request, res: Response) => {
  const mediaId = getParam(req.params.mediaId);
  const userId = getUserId(req);

  await MediaService.likeMedia(mediaId, userId);
  sendSuccess(res, null, "Like media thành công");
});

/**
 * @route   DELETE /api/media/:mediaId/like
 * @desc    Unlike media
 * @access  Private
 */
export const unlikeMedia = asyncHandler(async (req: Request, res: Response) => {
  const mediaId = getParam(req.params.mediaId);
  const userId = getUserId(req);

  await MediaService.unlikeMedia(mediaId, userId);
  sendSuccess(res, null, "Unlike media thành công");
});

/**
 * @route   GET /api/media/:mediaId/likes
 * @desc    Lấy danh sách người đã like media
 * @access  Private
 */
export const getMediaLikes = asyncHandler(
  async (req: Request, res: Response) => {
    const mediaId = getParam(req.params.mediaId);
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    const result = await MediaService.getMediaLikes(
      mediaId,
      parseInt(page),
      parseInt(limit)
    );
    sendSuccess(res, result, "Lấy danh sách likes thành công");
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// COMMENTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/media/:mediaId/comments
 * @desc    Lấy comments của media
 * @access  Private
 */
export const getMediaComments = asyncHandler(
  async (req: Request, res: Response) => {
    const mediaId = getParam(req.params.mediaId);
    const currentUserId = getOptionalUserId(req);
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    const result = await MediaService.getMediaComments(
      mediaId,
      parseInt(page),
      parseInt(limit),
      currentUserId
    );
    sendSuccess(res, result, "Lấy danh sách comments thành công");
  }
);

/**
 * @route   POST /api/media/:mediaId/comments
 * @desc    Tạo comment cho media
 * @access  Private
 */
export const createMediaComment = asyncHandler(
  async (req: Request, res: Response) => {
    const mediaId = getParam(req.params.mediaId);
    const userId = getUserId(req);
    const { contentText } = req.body;

    const result = await MediaService.createMediaComment(
      mediaId,
      userId,
      contentText
    );
    sendCreated(res, result, "Tạo comment thành công");
  }
);

/**
 * @route   POST /api/media/:mediaId/comments/:commentId/replies
 * @desc    Tạo reply cho comment trên media
 * @access  Private
 */
export const createMediaCommentReply = asyncHandler(
  async (req: Request, res: Response) => {
    const mediaId = getParam(req.params.mediaId);
    const parentCommentId = getParam(req.params.commentId);
    const userId = getUserId(req);
    const { contentText, originalCommentId } = req.body;

    const result = await MediaService.createMediaCommentReply(
      mediaId,
      userId,
      parentCommentId,
      originalCommentId || parentCommentId,
      contentText
    );
    sendCreated(res, result, "Tạo reply thành công");
  }
);

/**
 * @route   GET /api/media/:mediaId/comments/:commentId/replies
 * @desc    Lấy replies của comment trên media
 * @access  Private
 */
export const getMediaCommentReplies = asyncHandler(
  async (req: Request, res: Response) => {
    const commentId = getParam(req.params.commentId);
    const currentUserId = getOptionalUserId(req);
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    const result = await MediaService.getMediaCommentReplies(
      commentId,
      parseInt(page),
      parseInt(limit),
      currentUserId
    );
    sendSuccess(res, result, "Lấy danh sách replies thành công");
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// SHARE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/media/:mediaId/share
 * @desc    Share media
 * @access  Private
 */
export const shareMedia = asyncHandler(async (req: Request, res: Response) => {
  const mediaId = getParam(req.params.mediaId);
  const userId = getUserId(req);
  const { caption } = req.body;

  await MediaService.shareMedia(mediaId, userId, caption);
  sendSuccess(res, null, "Share media thành công");
});

/**
 * @route   GET /api/media/:mediaId/shares
 * @desc    Lấy danh sách người đã share media
 * @access  Private
 */
export const getMediaShares = asyncHandler(
  async (req: Request, res: Response) => {
    const mediaId = getParam(req.params.mediaId);
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    const result = await MediaService.getMediaShares(
      mediaId,
      parseInt(page),
      parseInt(limit)
    );
    sendSuccess(res, result, "Lấy danh sách shares thành công");
  }
);
