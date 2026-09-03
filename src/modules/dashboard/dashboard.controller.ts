import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { dashboardService } from './dashboard.service';
import { apiResponse } from '../../utils/apiResponse';
import { UserRole } from '../../models/User';

export const dashboardController = {
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let stats;
      if (req.user!.role === UserRole.ADMIN) {
        stats = await dashboardService.getAdminStats();
      } else {
        stats = await dashboardService.getUploaderStats(req.user!._id);
      }
      return apiResponse.success(res, stats, 'Dashboard statistics retrieved');
    } catch (err) {
      next(err);
    }
  },
};
