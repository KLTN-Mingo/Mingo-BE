"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/culture.routes.ts
const express_1 = require("express");
const culture_controller_1 = require("../controllers/culture.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post("/explain", auth_middleware_1.authMiddleware, culture_controller_1.explainCultureTerm);
exports.default = router;
