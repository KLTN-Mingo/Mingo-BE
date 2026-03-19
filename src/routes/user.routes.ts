import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  deleteUser,
  getCurrentUser,
  getUserById,
  getUsers,
  updateProfile,
} from "../controllers/user.controller";
import { ForbiddenError } from "../errors";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

function adminMiddleware(req: Request, _res: Response, next: NextFunction) {
  if ((req as any).user?.role !== "admin") {
    return next(
      new ForbiddenError("Chỉ admin mới có quyền thực hiện thao tác này")
    );
  }

  next();
}

// ── Current user routes (đặt trước :id để tránh conflict) ───────────────────
router.get("/me", authMiddleware, getCurrentUser);
router.put("/me", authMiddleware, updateProfile);

// ── Admin routes ─────────────────────────────────────────────────────────────
router.get("/", authMiddleware, adminMiddleware, getUsers);
router.delete("/:id", authMiddleware, adminMiddleware, deleteUser);

// ── Public user routes ───────────────────────────────────────────────────────
router.get("/:id", authMiddleware, getUserById);

export default router;
