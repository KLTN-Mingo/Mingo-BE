// src/routes/admin.routes.ts

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminMiddleware } from "../middleware/admin.middleware";
import {
  getReports,
  handleReport,
  getAdminDashboardStats,
  getPendingReportsAdmin,
  getViolationsDaily,
  getAiPerformance,
  resolveAdminReport,
  getAdminUsers,
  getAdminUserById,
  patchAdminUserBlock,
  patchAdminUserUnblock,
  patchAdminUserToggleActive,
  deleteAdminUser,
  getAdminUsersStats,
  getAdminUserPosts,
  getAdminUserReports,
} from "../controllers/admin.controller";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/users/stats", getAdminUsersStats);
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);
router.get("/users/:id/posts", getAdminUserPosts);
router.get("/users/:id/reports", getAdminUserReports);
router.patch("/users/:id/block", patchAdminUserBlock);
router.patch("/users/:id/unblock", patchAdminUserUnblock);
router.patch("/users/:id/toggle-active", patchAdminUserToggleActive);
router.delete("/users/:id", deleteAdminUser);

router.get("/dashboard/stats", getAdminDashboardStats);
router.get("/violations/daily", getViolationsDaily);
router.get("/ai/performance", getAiPerformance);

router.get("/reports/pending", getPendingReportsAdmin);
router.put("/reports/:id/resolve", resolveAdminReport);

router.get("/reports", getReports);
router.patch("/reports/:reportId", handleReport);

router.get("/stats", getAdminDashboardStats);

export default router;
