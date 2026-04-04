"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/interaction.routes.ts
const express_1 = require("express");
const interaction_controller_1 = require("../controllers/interaction.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/track', auth_middleware_1.authMiddleware, interaction_controller_1.interactionController.track.bind(interaction_controller_1.interactionController));
exports.default = router;
