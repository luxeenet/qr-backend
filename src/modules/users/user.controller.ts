import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { userService } from './user.service';
import { apiResponse } from '../../utils/apiResponse';

export const userController = {
  async createUploader(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.createUploader(
        req.body,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.created(res, { user }, 'Uploader created successfully');
    } catch (err) {
      next(err);
    }
  },

  async listUploaders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await userService.listUploaders(req);
      return apiResponse.success(res, result.data, 'Uploaders retrieved', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  },

  async getUploaderById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.getUploaderById(req.params.id);
      return apiResponse.success(res, { user }, 'Uploader retrieved');
    } catch (err) {
      next(err);
    }
  },

  async updateUploader(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.updateUploader(
        req.params.id,
        req.body,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, { user }, 'Uploader updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async changeStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.changeStatus(
        req.params.id,
        req.body.status,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, { user }, 'Uploader status updated');
    } catch (err) {
      next(err);
    }
  },

  async deleteUploader(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await userService.softDelete(req.params.id, req.user!._id, req.ip, req.headers['user-agent']);
      return apiResponse.success(res, null, 'Uploader deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  async assignOrganizations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.assignOrganizations(
        req.params.id,
        req.body.organizationIds,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, { user }, 'Organizations assigned successfully');
    } catch (err) {
      next(err);
    }
  },

  async removeOrganizationAssignment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await userService.removeOrganizationAssignment(
        req.params.id,
        req.params.organizationId,
        req.user!._id,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, null, 'Organization assignment removed successfully');
    } catch (err) {
      next(err);
    }
  },
};
