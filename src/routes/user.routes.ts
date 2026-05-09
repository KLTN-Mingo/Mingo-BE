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
  getUserByPhone,
  getUserPosts,
  getUserStats,
  getUsers,
  uploadAvatar,
  uploadBackground,
  updateProfile,
} from "../controllers/user.controller";
import { reportUser } from "../controllers/report.controller";
import { ForbiddenError } from "../errors";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload, handleUploadError } from "../middleware/upload.middleware";

const router = Router();

function uploadSingleImage(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: any) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  };
}

const uploadAvatarMiddleware = uploadSingleImage("avatar");
const uploadBackgroundMiddleware = uploadSingleImage("background");

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
router.post("/me/avatar", authMiddleware, uploadAvatarMiddleware, uploadAvatar);
router.put("/me/avatar", authMiddleware, uploadAvatarMiddleware, uploadAvatar);
router.post(
  "/me/background",
  authMiddleware,
  uploadBackgroundMiddleware,
  uploadBackground
);
router.put(
  "/me/background",
  authMiddleware,
  uploadBackgroundMiddleware,
  uploadBackground
);

// ── Report user ──────────────────────────────────────────────────────────────
router.post("/:userId/report", authMiddleware, reportUser);

// ── Admin routes ─────────────────────────────────────────────────────────────
router.get("/", authMiddleware, adminMiddleware, getUsers);
router.delete("/:id", authMiddleware, adminMiddleware, deleteUser);

// ── Public user routes ───────────────────────────────────────────────────────
router.get("/phone/:phoneNumber", authMiddleware, getUserByPhone);
router.get("/:id/posts", authMiddleware, getUserPosts);
router.get("/:id", authMiddleware, getUserById);

export default router;
