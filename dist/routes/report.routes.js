"use strict";
// src/routes/report.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = require("../controllers/report.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post("/", auth_middleware_1.authMiddleware, report_controller_1.createReport);
router.get("/my", auth_middleware_1.authMiddleware, report_controller_1.getMyReports);
exports.default = router;
