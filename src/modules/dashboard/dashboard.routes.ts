import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAnyRole } from '../../middleware/role.middleware';

const router = Router();

router.use(authenticate, requireAnyRole);

router.get('/', dashboardController.getStats);

export default router;
