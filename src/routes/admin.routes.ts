// // src/routes/admin.routes.ts

// import { Router } from "express";
// import { authMiddleware } from "../middleware/auth.middleware";
// import { adminMiddleware } from "../middleware/admin.middleware";
// import {
//   getReports,
//   handleReport,
//   getAdminDashboardStats,
//   getPendingReportsAdmin,
//   getViolationsDaily,
//   getAiPerformance,
//   resolveAdminReport,
//   getAdminUsers,
//   getAdminUserById,
//   patchAdminUserBlock,
//   patchAdminUserUnblock,
//   patchAdminUserToggleActive,
//   deleteAdminUser,
//   getAdminUsersStats,
//   getAdminUserPosts,
//   getAdminUserReports,
// } from "../controllers/admin.controller";

// const router = Router();

// router.use(authMiddleware, adminMiddleware);

// router.get("/users/stats", getAdminUsersStats);
// router.get("/users", getAdminUsers);
// router.get("/users/:id", getAdminUserById);
// router.get("/users/:id/posts", getAdminUserPosts);
// router.get("/users/:id/reports", getAdminUserReports);
// router.patch("/users/:id/block", patchAdminUserBlock);
// router.patch("/users/:id/unblock", patchAdminUserUnblock);
// router.patch("/users/:id/toggle-active", patchAdminUserToggleActive);
// router.delete("/users/:id", deleteAdminUser);

// router.get("/dashboard/stats", getAdminDashboardStats);
// router.get("/violations/daily", getViolationsDaily);
// router.get("/ai/performance", getAiPerformance);

// router.get("/reports/pending", getPendingReportsAdmin);
// router.put("/reports/:id/resolve", resolveAdminReport);

// router.get("/reports", getReports);
// router.patch("/reports/:reportId", handleReport);

// router.get("/stats", getAdminDashboardStats);

// export default router;

// src/routes/admin.routes.ts

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminMiddleware } from "../middleware/admin.middleware";
import {
  // ── Dashboard & AI ──────────────────────────────────────────
  getAdminDashboardStats,
  getViolationsDaily,
  getAiPerformance,
  // ── Reports ─────────────────────────────────────────────────
  getReports,
  handleReport,
  getPendingReportsAdmin,
  resolveAdminReport,
  // ── Users ───────────────────────────────────────────────────
  getAdminUsers,
  getAdminUserById,
  getAdminUserStats, // ← MỚI: stats của 1 user cụ thể
  getAdminUserPosts,
  getAdminUserReports,
  getAdminUsersStats,
  patchAdminUserBlock,
  patchAdminUserUnblock,
  patchAdminUserToggleActive,
  deleteAdminUser,
  // ── Posts ───────────────────────────────────────────────────
  getAdminPosts, // ← MỚI
  getAdminPostById, // ← MỚI
  patchAdminPost, // ← MỚI
  getAdminPostComments, // ← MỚI
  getAdminPostReports, // ← MỚI
  getAdminPostActivity, // ← MỚI
} from "../controllers/admin.controller";

const router = Router();

// Tất cả admin routes đều cần đăng nhập + role admin
router.use(authMiddleware, adminMiddleware);

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────
router.get("/dashboard/stats", getAdminDashboardStats);
router.get("/stats", getAdminDashboardStats); // alias cũ
router.get("/violations/daily", getViolationsDaily);
router.get("/ai/performance", getAiPerformance);

// ─────────────────────────────────────────────────────────────
//  USERS
//  Chú ý: route /users/stats phải đứng TRƯỚC /users/:id
//  để Express không nhầm "stats" là một :id
// ─────────────────────────────────────────────────────────────
router.get("/users/stats", getAdminUsersStats); // tổng quan tất cả users
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);
router.get("/users/:id/stats", getAdminUserStats); // stats riêng của 1 user ← MỚI
router.get("/users/:id/posts", getAdminUserPosts);
router.get("/users/:id/reports", getAdminUserReports);
router.patch("/users/:id/block", patchAdminUserBlock);
router.patch("/users/:id/unblock", patchAdminUserUnblock);
router.patch("/users/:id/toggle-active", patchAdminUserToggleActive);
router.delete("/users/:id", deleteAdminUser);

// ─────────────────────────────────────────────────────────────
//  POSTS  ← TOÀN BỘ MỚI
// ─────────────────────────────────────────────────────────────
router.get("/posts", getAdminPosts);
router.get("/posts/:id", getAdminPostById);
router.patch("/posts/:id", patchAdminPost); // body: { action: "hide"|"unhide"|"delete" }
router.get("/posts/:id/comments", getAdminPostComments);
router.get("/posts/:id/reports", getAdminPostReports);
router.get("/posts/:id/activity", getAdminPostActivity);

// ─────────────────────────────────────────────────────────────
//  REPORTS
// ─────────────────────────────────────────────────────────────
router.get("/reports/pending", getPendingReportsAdmin); // phải trước /reports/:id
router.get("/reports", getReports);
router.patch("/reports/:reportId", handleReport);
router.put("/reports/:id/resolve", resolveAdminReport);

export default router;
