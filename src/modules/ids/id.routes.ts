import { Router } from 'express';
import { idController } from './id.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAnyRole, requireAdmin } from '../../middleware/role.middleware';
import { uploadSingle } from '../../middleware/upload.middleware';

const router = Router();

router.use(authenticate, requireAnyRole);

router.post('/', uploadSingle('image'), idController.create);
router.get('/', idController.list);
router.get('/:id', idController.getById);
router.patch('/:id', idController.update);
router.delete('/:id', requireAdmin, idController.delete); // Admin-only enforced at route level too
router.get('/:id/image', idController.getImage);
router.post('/:id/image', uploadSingle('image'), idController.uploadImage);

export default router;
