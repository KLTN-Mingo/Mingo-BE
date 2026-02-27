// src/controllers/notification.controller.ts

import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { sendSuccess } from "../utils/response";
import { ValidationError } from "../errors";
import { NotificationService } from "../services/notification.service";
import { NotificationType } from "../models/notification.model";

// Helper to get userId from request
function getUserId(req: Request): string {
  const userId = (req as any).user?.userId;
  if (!userId) {
    throw new ValidationError("Không tìm thấy thông tin người dùng");
  }
  return userId;
}

// Helper to get string param
function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || "";
}

// ══════════════════════════════════════════════════════════════════════════════
// GET NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/notifications
 * @desc    Lấy danh sách notifications
 * @access  Private
 */
export const getNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const {
      page = "1",
      limit = "20",
      type,
      isRead,
    } = req.query as Record<string, string>;

    const result = await NotificationService.getNotifications(
      userId,
      parseInt(page),
      parseInt(limit),
      type as NotificationType | undefined,
      isRead === "true" ? true : isRead === "false" ? false : undefined
    );

    sendSuccess(res, result, "Lấy danh sách thông báo thành công");
  }
);

/**
 * @route   GET /api/notifications/count
 * @desc    Lấy số lượng notifications
 * @access  Private
 */
export const getNotificationCount = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);

    const result = await NotificationService.getNotificationCount(userId);

    sendSuccess(res, result, "Lấy số lượng thông báo thành công");
  }
);

/**
 * @route   GET /api/notifications/unread
 * @desc    Lấy danh sách notifications chưa đọc
 * @access  Private
 */
export const getUnreadNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    const result = await NotificationService.getNotifications(
      userId,
      parseInt(page),
      parseInt(limit),
      undefined,
      false
    );

    sendSuccess(res, result, "Lấy danh sách thông báo chưa đọc thành công");
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Đánh dấu notification đã đọc
 * @access  Private
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const notificationId = getParam(req.params.notificationId);

  await NotificationService.markAsRead(notificationId, userId);

  sendSuccess(res, null, "Đã đánh dấu đã đọc");
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Đánh dấu tất cả notifications đã đọc
 * @access  Private
 */
export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);

    const count = await NotificationService.markAllAsRead(userId);

    sendSuccess(res, { count }, `Đã đánh dấu ${count} thông báo đã đọc`);
  }
);

/**
 * @route   PUT /api/notifications/seen-all
 * @desc    Đánh dấu tất cả notifications đã xem
 * @access  Private
 */
export const markAllAsSeen = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);

    const count = await NotificationService.markAllAsSeen(userId);

    sendSuccess(res, { count }, `Đã đánh dấu ${count} thông báo đã xem`);
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// DELETE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Xóa một notification
 * @access  Private
 */
export const deleteNotification = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const notificationId = getParam(req.params.notificationId);

    await NotificationService.deleteNotification(notificationId, userId);

    sendSuccess(res, null, "Đã xóa thông báo");
  }
);

/**
 * @route   DELETE /api/notifications/read
 * @desc    Xóa tất cả notifications đã đọc
 * @access  Private
 */
export const deleteAllRead = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);

    const count = await NotificationService.deleteAllRead(userId);

    sendSuccess(res, { count }, `Đã xóa ${count} thông báo đã đọc`);
  }
);

/**
 * @route   DELETE /api/notifications
 * @desc    Xóa tất cả notifications
 * @access  Private
 */
export const deleteAllNotifications = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getUserId(req);

    const count = await NotificationService.deleteAll(userId);

    sendSuccess(res, { count }, `Đã xóa ${count} thông báo`);
  }
);
