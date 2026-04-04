"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auth.routes.ts
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post("/register", auth_controller_1.register);
router.post("/login", auth_controller_1.login);
router.post("/google", auth_controller_1.googleLogin);
router.post("/2fa/setup", auth_middleware_1.authMiddleware, auth_controller_1.setupTwoFactor);
router.post("/2fa/enable", auth_middleware_1.authMiddleware, auth_controller_1.enableTwoFactor);
router.post("/2fa/disable", auth_middleware_1.authMiddleware, auth_controller_1.disableTwoFactor);
router.post("/2fa/complete-login", auth_controller_1.completeTwoFactorLogin);
router.post("/refresh-token", auth_controller_1.refresh);
router.post("/logout", auth_middleware_1.authMiddleware, auth_controller_1.logout);
exports.default = router;
