import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { auditService } from './audit.service';
import { apiResponse } from '../../utils/apiResponse';

export const auditController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await auditService.list(req);
      return apiResponse.success(res, result.data, 'Audit logs retrieved', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const log = await auditService.getById(req.params.id);
      return apiResponse.success(res, { log }, 'Audit log entry retrieved');
    } catch (err) {
      next(err);
    }
  },
};
