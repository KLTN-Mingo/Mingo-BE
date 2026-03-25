// src/routes/interaction.routes.ts
import { Router } from 'express';
import { interactionController } from '../controllers/interaction.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/track', authMiddleware, interactionController.track.bind(interactionController));

export default router;