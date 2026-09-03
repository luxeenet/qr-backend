import { Router } from 'express';
import { auditController } from './audit.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', auditController.list);
router.get('/:id', auditController.getById);

export default router;
