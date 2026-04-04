"use strict";
// src/routes/admin.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = isAdmin;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const errors_1 = require("../errors");
const admin_controller_1 = require("../controllers/admin.controller");
const router = (0, express_1.Router)();
function isAdmin(req, _res, next) {
    if (req.user?.role !== "admin") {
        return next(new errors_1.ForbiddenError("Chỉ admin mới có quyền thực hiện thao tác này"));
    }
    next();
}
router.use(auth_middleware_1.authMiddleware, isAdmin);
router.get("/reports", admin_controller_1.getReports);
router.patch("/reports/:reportId", admin_controller_1.handleReport);
router.get("/stats", admin_controller_1.getDashboardStats);
exports.default = router;
