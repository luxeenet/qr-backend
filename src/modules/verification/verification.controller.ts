import { Request, Response, NextFunction } from 'express';
import { verificationService } from './verification.service';
import { apiResponse } from '../../utils/apiResponse';

export const verificationController = {
  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await verificationService.verify(req.params.token);
      return apiResponse.success(res, result, 'Verification complete');
    } catch (err) {
      next(err);
    }
  },

  async getPublicImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { path, exists } = await verificationService.getPublicImage(req.params.token);
      if (!exists) {
        return apiResponse.error(res, 'Image not found', 404, 'NOT_FOUND');
      }
      return res.sendFile(path);
    } catch (err) {
      next(err);
    }
  },
};
