// src/routes/auth.routes.ts
import { Router } from "express";
import {
  login,
  refresh,
  logout,
  register,
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth-middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refresh);
router.post("/logout", authMiddleware, logout);

export default router;
