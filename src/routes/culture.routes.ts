// src/routes/culture.routes.ts
import { Router } from "express";
import { explainCultureTerm } from "../controllers/culture.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/explain", authMiddleware, explainCultureTerm);

export default router;
