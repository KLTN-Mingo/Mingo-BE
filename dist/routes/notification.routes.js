"use strict";
// src/routes/notification.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Tất cả routes đều cần authenticate
router.use(auth_middleware_1.authMiddleware);
// ══════════════════════════════════════════════════════════════════════════════
// GET NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════
// Lấy số lượng notifications (đặt trước các route có param)
router.get("/count", notification_controller_1.getNotificationCount);
// Lấy danh sách notifications chưa đọc
router.get("/unread", notification_controller_1.getUnreadNotifications);
// Lấy danh sách notifications
router.get("/", notification_controller_1.getNotifications);
// ══════════════════════════════════════════════════════════════════════════════
// UPDATE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════
// Đánh dấu tất cả đã đọc
router.put("/read-all", notification_controller_1.markAllAsRead);
// Đánh dấu tất cả đã xem
router.put("/seen-all", notification_controller_1.markAllAsSeen);
// Đánh dấu một notification đã đọc
router.put("/:notificationId/read", notification_controller_1.markAsRead);
// ══════════════════════════════════════════════════════════════════════════════
// DELETE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════
// Xóa tất cả notifications đã đọc
router.delete("/read", notification_controller_1.deleteAllRead);
// Xóa tất cả notifications
router.delete("/all", notification_controller_1.deleteAllNotifications);
// Xóa một notification
router.delete("/:notificationId", notification_controller_1.deleteNotification);
exports.default = router;
