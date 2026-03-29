// src/routes/report.routes.ts

import { Router } from "express";
import { createReport, getMyReports } from "../controllers/report.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authMiddleware, createReport);
router.get("/my", authMiddleware, getMyReports);

export default router;
