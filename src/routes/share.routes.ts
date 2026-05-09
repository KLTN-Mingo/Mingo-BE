import { Router } from "express";
import { repostPost, sendShareMessage } from "../controllers/share.controller";
import { RepostDto, SendDMShareDto } from "../dtos/share.dto";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateDto } from "../middleware/validate-dto.middleware";

const router = Router();

router.post("/message", authMiddleware, validateDto(SendDMShareDto), sendShareMessage);
router.post("/repost", authMiddleware, validateDto(RepostDto), repostPost);

export default router;
