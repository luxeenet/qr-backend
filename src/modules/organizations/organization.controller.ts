import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { organizationService } from './organization.service';
import { apiResponse } from '../../utils/apiResponse';
import { UserRole } from '../../models/User';
import { OrganizationStatus } from '../../models/Organization';
import { env } from '../../config/env';

export const organizationController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = await organizationService.create(
        req.body,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.created(res, { organization: org }, 'Organization created successfully');
    } catch (err) {
      next(err);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let result;
      if (req.user!.role === UserRole.ADMIN) {
        result = await organizationService.list(req);
      } else {
        result = await organizationService.listForUploader(req.user!._id, req);
      }
      return apiResponse.success(res, result.data, 'Organizations retrieved', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = await organizationService.getById(req.params.id);
      return apiResponse.success(res, { organization: org }, 'Organization retrieved');
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = await organizationService.update(
        req.params.id,
        req.body,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, { organization: org }, 'Organization updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async uploadLogo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return apiResponse.error(res, 'No logo file provided', 400, 'FILE_REQUIRED');
      }
      const org = await organizationService.uploadLogo(
        req.params.id,
        req.file.filename,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, { organization: org }, 'Logo uploaded successfully');
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await organizationService.softDelete(
        req.params.id,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, null, 'Organization deleted successfully');
    } catch (err) {
      next(err);
    }
  },
};
