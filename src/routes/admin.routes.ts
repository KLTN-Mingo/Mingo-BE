// src/routes/admin.routes.ts

import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { ForbiddenError } from "../errors";
import {
  getReports,
  handleReport,
  getDashboardStats,
} from "../controllers/admin.controller";

const router = Router();

export function isAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if ((req as any).user?.role !== "admin") {
    return next(
      new ForbiddenError("Chỉ admin mới có quyền thực hiện thao tác này")
    );
  }
  next();
}

router.use(authMiddleware, isAdmin);

router.get("/reports", getReports);
router.patch("/reports/:reportId", handleReport);
router.get("/stats", getDashboardStats);

export default router;
