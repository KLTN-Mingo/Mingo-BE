"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionController = exports.InteractionController = void 0;
const interaction_tracker_service_1 = require("../services/interaction-tracker.service");
const user_interaction_model_1 = require("../models/user-interaction.model");
class InteractionController {
    async track(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const { postId, type, viewDuration, scrollDepth, source, deviceType } = req.body;
            // ── Validate bắt buộc ──────────────────────────────────────────────
            if (!postId || !type || !source) {
                res.status(400).json({
                    message: "postId, type và source là bắt buộc",
                });
                return;
            }
            if (!Object.values(user_interaction_model_1.InteractionType).includes(type)) {
                res.status(400).json({
                    message: `type không hợp lệ: "${type}"`,
                    validValues: Object.values(user_interaction_model_1.InteractionType),
                });
                return;
            }
            if (!Object.values(user_interaction_model_1.InteractionSource).includes(source)) {
                res.status(400).json({
                    message: `source không hợp lệ: "${source}"`,
                    validValues: Object.values(user_interaction_model_1.InteractionSource),
                });
                return;
            }
            // ── Validate viewDuration nếu type là view ─────────────────────────
            if (type === user_interaction_model_1.InteractionType.VIEW && viewDuration !== undefined) {
                if (typeof viewDuration !== "number" || viewDuration < 0) {
                    res.status(400).json({ message: "viewDuration phải là số không âm" });
                    return;
                }
            }
            // ── Validate scrollDepth nếu có ────────────────────────────────────
            if (scrollDepth !== undefined) {
                if (typeof scrollDepth !== "number" || scrollDepth < 0 || scrollDepth > 1) {
                    res.status(400).json({ message: "scrollDepth phải nằm trong khoảng 0 → 1" });
                    return;
                }
            }
            const payload = {
                userId,
                postId,
                type: type,
                source: source,
                viewDuration,
                scrollDepth,
                deviceType,
            };
            await interaction_tracker_service_1.interactionTrackerService.track(payload);
            res.status(200).json({ ok: true });
        }
        catch (err) {
            console.error("[InteractionController.track]", err);
            res.status(500).json({ message: "Internal server error" });
        }
    }
}
exports.InteractionController = InteractionController;
exports.interactionController = new InteractionController();
