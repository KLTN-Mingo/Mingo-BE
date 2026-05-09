import { Router } from "express";
import { searchGlobal } from "../controllers/search.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authMiddleware, searchGlobal);

export default router;
