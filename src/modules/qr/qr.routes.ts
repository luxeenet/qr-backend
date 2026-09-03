import { Router } from 'express';
import { qrController } from './qr.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAnyRole, requireAdmin } from '../../middleware/role.middleware';

const router = Router();

router.use(authenticate, requireAnyRole);

router.get('/:id/png', qrController.getPng);
router.get('/:id/svg', qrController.getSvg);
router.get('/:id/url', qrController.getUrl);
router.post('/:id/regenerate', requireAdmin, qrController.regenerate);

export default router;
