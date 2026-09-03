import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { qrService } from './qr.service';
import { apiResponse } from '../../utils/apiResponse';

export const qrController = {
  async getPng(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const buffer = await qrService.generatePng(
        req.params.id,
        req.user!._id,
        req.user!.role
      );
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `attachment; filename="qr-${req.params.id}.png"`);
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  },

  async getSvg(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const svg = await qrService.generateSvg(req.params.id, req.user!._id, req.user!.role);
      res.set('Content-Type', 'image/svg+xml');
      res.set('Content-Disposition', `attachment; filename="qr-${req.params.id}.svg"`);
      return res.send(svg);
    } catch (err) {
      next(err);
    }
  },

  async getUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await qrService.getVerificationUrl(
        req.params.id,
        req.user!._id,
        req.user!.role
      );
      return apiResponse.success(res, result, 'Verification URL retrieved');
    } catch (err) {
      next(err);
    }
  },

  async regenerate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await qrService.regenerateToken(
        req.params.id,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, result, 'QR code regenerated successfully');
    } catch (err) {
      next(err);
    }
  },
};
