// src/controllers/interaction.controller.ts
import { Request, Response } from "express";
import {
  interactionTrackerService,
  TrackPayload,
} from "../services/interaction-tracker.service";
import {
  InteractionType,
  InteractionSource,
} from "../models/user-interaction.model";

export class InteractionController {

  async track(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId as string;
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

      if (!Object.values(InteractionType).includes(type)) {
        res.status(400).json({
          message: `type không hợp lệ: "${type}"`,
          validValues: Object.values(InteractionType),
        });
        return;
      }

      if (!Object.values(InteractionSource).includes(source)) {
        res.status(400).json({
          message: `source không hợp lệ: "${source}"`,
          validValues: Object.values(InteractionSource),
        });
        return;
      }

      // ── Validate viewDuration nếu type là view ─────────────────────────
      if (type === InteractionType.VIEW && viewDuration !== undefined) {
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

      const payload: TrackPayload = {
        userId,
        postId,
        type:        type        as InteractionType,
        source:      source      as InteractionSource,
        viewDuration,
        scrollDepth,
        deviceType,
      };

      await interactionTrackerService.track(payload);

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[InteractionController.track]", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

export const interactionController = new InteractionController();