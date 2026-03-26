// src/controllers/post.controller.ts

import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/async-handler";
import { ValidationError } from "../errors";
import { sendSuccess, sendPaginated } from "../utils/response";
import { PostVisibility } from "../models/post.model";
import { type CreatePostDto, type UpdatePostDto } from "../dtos/post.dto";
import { PostService } from "../services/post.service";
import {
  interactionTrackerService,
  type TrackPayload,
} from "../services/interaction-tracker.service";
import {
  InteractionType,
  InteractionSource,
} from "../models/user-interaction.model";
import { feedAnalyticsService } from "../services/feed-analytics.service";

// ─── Helper ───────────────────────────────────────────────────────────────────

function validateVisibility(
  visibility: string
): asserts visibility is PostVisibility {
  if (!Object.values(PostVisibility).includes(visibility as PostVisibility)) {
    throw new ValidationError(
      `Chế độ hiển thị không hợp lệ. Các giá trị hợp lệ: ${Object.values(PostVisibility).join(", ")}`,
      "INVALID_VISIBILITY"
    );
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * @route   GET /api/posts
 * @desc    Lấy tất cả bài viết
 * @access  Private
 */
export const getAllPosts = asyncHandler(async (req: Request, res: Response) => {
  const currentUserId = (req as any).user?.userId as string | undefined;

  const posts = await PostService.getAllPosts(currentUserId);
  sendSuccess(res, posts);
});

/**
 * @route   GET /api/posts/trending
 * @desc    Lấy top 10 bài viết trending
 * @access  Public
 */
export const getTrendingPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const currentUserId = (req as any).user?.userId as string | undefined;

    const posts = await PostService.getTrendingPosts(currentUserId);
    sendSuccess(res, posts);
  }
);

/**
 * @route   GET /api/posts/feed
 * @query   tab=friends | explore (mặc định: explore)
 * @desc    Tab "friends": bài từ bạn bè/bạn thân (người đang follow), sort mới nhất. Tab "explore": feed khám phá đề xuất cá nhân hóa.
 * @access  Private
 */
export const getFeedPosts = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const {
      page: pageStr,
      limit: limitStr,
      tab: tabStr,
    } = req.query as Record<string, string>;

    const page = parseInt(pageStr) || 1;
    const limit = parseInt(limitStr) || 10;
    const tab = tabStr === "friends" ? "friends" : "explore";

    if (page < 1) throw new ValidationError("Số trang phải lớn hơn 0");
    if (limit < 1 || limit > 50)
      throw new ValidationError("Limit phải từ 1 đến 50");

    const result = await PostService.getFeedPosts(userId, page, limit, tab);

    sendPaginated(res, result.posts, result.pagination);
  }
);

/**
 * @route   POST /api/posts/feed/feedback
 * @desc    Nhận feedback để điều chỉnh profile recommendation
 * @access  Private
 */
export const submitFeedFeedback = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId as string;
    const { postId, feedbackType, tab } = req.body as {
      postId?: string;
      feedbackType?: "hide" | "not_interested" | "see_more";
      tab?: "friends" | "explore";
    };

    if (!postId || !feedbackType) {
      throw new ValidationError("postId và feedbackType là bắt buộc");
    }

    if (!Types.ObjectId.isValid(postId)) {
      throw new ValidationError("postId không hợp lệ", "INVALID_POST_ID");
    }

    const feedbackToInteraction: Record<string, InteractionType> = {
      hide: InteractionType.HIDE,
      not_interested: InteractionType.NOT_INTERESTED,
      see_more: InteractionType.SEE_MORE,
    };

    const interactionType = feedbackToInteraction[feedbackType];
    if (!interactionType) {
      throw new ValidationError(
        "feedbackType không hợp lệ. Chỉ chấp nhận: hide, not_interested, see_more",
        "INVALID_FEEDBACK_TYPE"
      );
    }

    const source =
      tab === "friends" ? InteractionSource.FEED : InteractionSource.EXPLORE;

    const payload: TrackPayload = {
      userId,
      postId,
      type: interactionType,
      source,
    };

    await interactionTrackerService.track(payload);

    sendSuccess(
      res,
      { postId, feedbackType, source },
      "Đã ghi nhận phản hồi feed"
    );
  }
);

/**
 * @route   GET /api/posts/feed/metrics
 * @query   days=7&tab=friends|explore
 * @desc    Tổng hợp CTR/engagement cho feed recommendation
 * @access  Private
 */
export const getFeedMetrics = asyncHandler(
  async (req: Request, res: Response) => {
    const { days: daysStr, tab: tabStr } = req.query as Record<string, string>;

    const days = daysStr ? Number.parseInt(daysStr, 10) : 7;
    if (Number.isNaN(days) || days < 1 || days > 90) {
      throw new ValidationError("days phải nằm trong khoảng 1 đến 90");
    }

    const tab =
      tabStr === "friends" || tabStr === "explore" ? tabStr : undefined;
    const metrics = await feedAnalyticsService.getMetrics(days, tab);

    sendSuccess(res, metrics);
  }
);

/**
 * @route   GET /api/posts/stats/count
 * @desc    Đếm tổng số bài viết
 * @access  Private + Admin
 */
export const getPostStats = asyncHandler(
  async (req: Request, res: Response) => {
    const [total, today] = await Promise.all([
      PostService.countPosts(),
      PostService.countPostsToday(),
    ]);

    sendSuccess(res, { total, today });
  }
);

/**
 * @route   GET /api/posts/:id
 * @desc    Lấy chi tiết bài viết theo ID
 * @access  Private
 */
export const getPostById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const currentUserId = (req as any).user?.userId as string | undefined;

  const post = await PostService.getPostById(id, currentUserId);
  sendSuccess(res, post);
});

/**
 * @route   POST /api/posts
 * @desc    Tạo bài viết mới
 * @access  Private
 */
export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId as string;
  const {
    contentText,
    visibility = PostVisibility.PUBLIC,
    mediaFiles = [],
    hashtags = [],
    mentions = [],
    locationName,
    locationLatitude,
    locationLongitude,
  } = req.body as CreatePostDto;

  // Validation
  if (!contentText?.trim() && mediaFiles.length === 0) {
    throw new ValidationError(
      "Bài viết phải có nội dung hoặc ít nhất một file media",
      "EMPTY_POST"
    );
  }

  if (contentText && contentText.length > 10000) {
    throw new ValidationError(
      "Nội dung bài viết không được vượt quá 10000 ký tự"
    );
  }

  validateVisibility(visibility);

  if (mediaFiles.length > 10) {
    throw new ValidationError(
      "Mỗi bài viết chỉ được đính kèm tối đa 10 file media"
    );
  }

  if (hashtags.length > 30) {
    throw new ValidationError("Mỗi bài viết chỉ được có tối đa 30 hashtag");
  }

  if (mentions.length > 50) {
    throw new ValidationError("Mỗi bài viết chỉ được tag tối đa 50 người");
  }

  const post = await PostService.createPost(userId, {
    contentText,
    visibility,
    mediaFiles,
    hashtags,
    mentions,
    locationName,
    locationLatitude,
    locationLongitude,
  });

  sendSuccess(res, post, "Tạo bài viết thành công", 201);
});

/**
 * @route   PUT /api/posts/:id
 * @desc    Cập nhật bài viết (chỉ chủ bài viết)
 * @access  Private
 */
export const updatePost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const userId = (req as any).user?.userId as string;
  const { contentText, visibility } = req.body as UpdatePostDto;

  if (!contentText && !visibility) {
    throw new ValidationError("Cần có ít nhất một trường để cập nhật");
  }

  if (contentText !== undefined) {
    if (contentText.trim().length === 0) {
      throw new ValidationError("Nội dung bài viết không được để trống");
    }
    if (contentText.length > 10000) {
      throw new ValidationError(
        "Nội dung bài viết không được vượt quá 10000 ký tự"
      );
    }
  }

  if (visibility !== undefined) {
    validateVisibility(visibility);
  }

  const post = await PostService.updatePost(id, userId, {
    contentText,
    visibility,
  });
  sendSuccess(res, post, "Cập nhật bài viết thành công");
});

/**
 * @route   DELETE /api/posts/:id
 * @desc    Xóa bài viết (chủ bài viết hoặc admin)
 * @access  Private
 */
export const deletePost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const currentUser = (req as any).user;

  const isAdmin = currentUser?.role === "admin";

  await PostService.deletePost(id, currentUser.userId, isAdmin);
  sendSuccess(res, null, "Xóa bài viết thành công");
});

/**
 * @route   POST /api/posts/:id/like
 * @desc    Like bài viết
 * @access  Private
 */
export const likePost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const userId = (req as any).user?.userId as string;

  await PostService.likePost(id, userId);
  sendSuccess(res, null, "Đã thích bài viết");
});

/**
 * @route   DELETE /api/posts/:id/like
 * @desc    Bỏ like bài viết
 * @access  Private
 */
export const unlikePost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const userId = (req as any).user?.userId as string;

  await PostService.unlikePost(id, userId);
  sendSuccess(res, null, "Đã bỏ thích bài viết");
});
