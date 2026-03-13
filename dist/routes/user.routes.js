"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const errors_1 = require("../errors");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
function adminMiddleware(req, _res, next) {
    if (req.user?.role !== "admin") {
        return next(new errors_1.ForbiddenError("Chỉ admin mới có quyền thực hiện thao tác này"));
    }
    next();
}
// ── Current user routes (đặt trước :id để tránh conflict) ───────────────────
router.get("/me", auth_middleware_1.authMiddleware, user_controller_1.getCurrentUser);
router.put("/me", auth_middleware_1.authMiddleware, user_controller_1.updateProfile);
// ── Admin routes ─────────────────────────────────────────────────────────────
router.get("/", auth_middleware_1.authMiddleware, adminMiddleware, user_controller_1.getUsers);
router.delete("/:id", auth_middleware_1.authMiddleware, adminMiddleware, user_controller_1.deleteUser);
// ── Public user routes ───────────────────────────────────────────────────────
router.get("/:id", auth_middleware_1.authMiddleware, user_controller_1.getUserById);
exports.default = router;
