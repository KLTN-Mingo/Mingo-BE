// src/routes/notification.routes.ts

import { Router } from "express";
import {
  getNotifications,
  getNotificationCount,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  markAllAsSeen,
  deleteNotification,
  deleteAllRead,
  deleteAllNotifications,
} from "../controllers/notification.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Tất cả routes đều cần authenticate
router.use(authMiddleware);

// ══════════════════════════════════════════════════════════════════════════════
// GET NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

// Lấy số lượng notifications (đặt trước các route có param)
router.get("/count", getNotificationCount);

// Lấy danh sách notifications chưa đọc
router.get("/unread", getUnreadNotifications);

// Lấy danh sách notifications
router.get("/", getNotifications);

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

// Đánh dấu tất cả đã đọc
router.put("/read-all", markAllAsRead);

// Đánh dấu tất cả đã xem
router.put("/seen-all", markAllAsSeen);

// Đánh dấu một notification đã đọc
router.put("/:notificationId/read", markAsRead);

// ══════════════════════════════════════════════════════════════════════════════
// DELETE NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

// Xóa tất cả notifications đã đọc
router.delete("/read", deleteAllRead);

// Xóa tất cả notifications
router.delete("/all", deleteAllNotifications);

// Xóa một notification
router.delete("/:notificationId", deleteNotification);

export default router;
