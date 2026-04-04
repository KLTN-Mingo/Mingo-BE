"use strict";
// src/controllers/notification.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAllNotifications = exports.deleteAllRead = exports.deleteNotification = exports.markAllAsSeen = exports.markAllAsRead = exports.markAsRead = exports.getUnreadNotifications = exports.getNotificationCount = exports.getNotifications = void 0;
const async_handler_1 = require("../utils/async-handler");
const response_1 = require("../utils/response");
const errors_1 = require("../errors");
const notification_service_1 = require("../services/notification.service");
// Helper to get userId from request
function getUserId(req) {
    const userId = req.user?.userId;
    if (!userId) {
        throw new errors_1.ValidationError("Không tìm thấy thông tin người dùng");
    }
    return userId;
}
// Helper to get string param
function getParam(param) {
    if (Array.isArray(param))
        return param[0];
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
exports.getNotifications = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { page = "1", limit = "20", type, isRead, } = req.query;
    const result = await notification_service_1.NotificationService.getNotifications(userId, parseInt(page), parseInt(limit), type, isRead === "true" ? true : isRead === "false" ? false : undefined);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách thông báo thành công");
});
/**
 * @route   GET /api/notifications/count
 * @desc    Lấy số lượng notifications
 * @access  Private
 */
exports.getNotificationCount = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const result = await notification_service_1.NotificationService.getNotificationCount(userId);
    (0, response_1.sendSuccess)(res, result, "Lấy số lượng thông báo thành công");
});
/**
 * @route   GET /api/notifications/unread
 * @desc    Lấy danh sách notifications chưa đọc
 * @access  Private
 */
exports.getUnreadNotifications = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const { page = "1", limit = "20" } = req.query;
    const result = await notification_service_1.NotificationService.getNotifications(userId, parseInt(page), parseInt(limit), undefined, false);
    (0, response_1.sendSuccess)(res, result, "Lấy danh sách thông báo chưa đọc thành công");
});
// ══════════════════════════════════════════════════════════════════════════════
// UPDATE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Đánh dấu notification đã đọc
 * @access  Private
 */
exports.markAsRead = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const notificationId = getParam(req.params.notificationId);
    await notification_service_1.NotificationService.markAsRead(notificationId, userId);
    (0, response_1.sendSuccess)(res, null, "Đã đánh dấu đã đọc");
});
/**
 * @route   PUT /api/notifications/read-all
 * @desc    Đánh dấu tất cả notifications đã đọc
 * @access  Private
 */
exports.markAllAsRead = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const count = await notification_service_1.NotificationService.markAllAsRead(userId);
    (0, response_1.sendSuccess)(res, { count }, `Đã đánh dấu ${count} thông báo đã đọc`);
});
/**
 * @route   PUT /api/notifications/seen-all
 * @desc    Đánh dấu tất cả notifications đã xem
 * @access  Private
 */
exports.markAllAsSeen = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const count = await notification_service_1.NotificationService.markAllAsSeen(userId);
    (0, response_1.sendSuccess)(res, { count }, `Đã đánh dấu ${count} thông báo đã xem`);
});
// ══════════════════════════════════════════════════════════════════════════════
// DELETE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Xóa một notification
 * @access  Private
 */
exports.deleteNotification = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const notificationId = getParam(req.params.notificationId);
    await notification_service_1.NotificationService.deleteNotification(notificationId, userId);
    (0, response_1.sendSuccess)(res, null, "Đã xóa thông báo");
});
/**
 * @route   DELETE /api/notifications/read
 * @desc    Xóa tất cả notifications đã đọc
 * @access  Private
 */
exports.deleteAllRead = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const count = await notification_service_1.NotificationService.deleteAllRead(userId);
    (0, response_1.sendSuccess)(res, { count }, `Đã xóa ${count} thông báo đã đọc`);
});
/**
 * @route   DELETE /api/notifications
 * @desc    Xóa tất cả notifications
 * @access  Private
 */
exports.deleteAllNotifications = (0, async_handler_1.asyncHandler)(async (req, res) => {
    const userId = getUserId(req);
    const count = await notification_service_1.NotificationService.deleteAll(userId);
    (0, response_1.sendSuccess)(res, { count }, `Đã xóa ${count} thông báo`);
});
