import { Router } from 'express';
import { verificationController } from './verification.controller';
import { verificationRateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

// Public — no authentication required
router.get('/:token', verificationRateLimit, verificationController.verify);
router.get('/:token/image', verificationController.getPublicImage);

export default router;
