import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.post('/uploaders', userController.createUploader);
router.get('/uploaders', userController.listUploaders);
router.get('/uploaders/:id', userController.getUploaderById);
router.patch('/uploaders/:id', userController.updateUploader);
router.patch('/uploaders/:id/status', userController.changeStatus);
router.delete('/uploaders/:id', userController.deleteUploader);

// Organization assignments
router.post('/uploaders/:id/organizations', userController.assignOrganizations);
router.delete(
  '/uploaders/:id/organizations/:organizationId',
  userController.removeOrganizationAssignment
);

export default router;
