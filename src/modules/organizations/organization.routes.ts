import { Router } from 'express';
import { organizationController } from './organization.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin, requireAnyRole } from '../../middleware/role.middleware';
import { uploadSingle } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

// Admin only
router.post('/', requireAdmin, organizationController.create);
router.delete('/:id', requireAdmin, organizationController.delete);
router.post('/:id/logo', requireAdmin, uploadSingle('logo'), organizationController.uploadLogo);
router.patch('/:id', requireAdmin, organizationController.update);

// Admin and uploader (uploader sees only assigned orgs)
router.get('/', requireAnyRole, organizationController.list);
router.get('/:id', requireAnyRole, organizationController.getById);

export default router;
