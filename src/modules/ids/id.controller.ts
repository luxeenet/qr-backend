import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { idService } from './id.service';
import { apiResponse } from '../../utils/apiResponse';
import { UserRole } from '../../models/User';
import { ForbiddenError } from '../../utils/errors';

export const idController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return apiResponse.error(res, 'ID image is required', 400, 'IMAGE_REQUIRED');
      }
      const imagePath = req.file.filename;
      const record = await idService.create(
        { ...req.body, imagePath },
        req.user!._id,
        req.user!.role,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.created(res, { id: record }, 'ID created successfully');
    } catch (err) {
      next(err);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await idService.list(req, req.user!._id, req.user!.role);
      return apiResponse.success(res, result.data, 'IDs retrieved', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const record = await idService.getById(req.params.id, req.user!._id, req.user!.role);
      return apiResponse.success(res, { id: record }, 'ID retrieved');
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const record = await idService.update(
        req.params.id,
        req.body,
        req.user!._id,
        req.user!.role,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, { id: record }, 'ID updated successfully');
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== UserRole.ADMIN) {
        return next(new ForbiddenError('Only administrators can delete IDs'));
      }
      await idService.softDelete(req.params.id, req.user!._id, req.ip, req.headers['user-agent']);
      return apiResponse.success(res, null, 'ID deleted successfully');
    } catch (err) {
      next(err);
    }
  },

  async getImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filePath = await idService.getImagePath(
        req.params.id,
        req.user!._id,
        req.user!.role
      );
      return res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  },

  async uploadImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return apiResponse.error(res, 'No image file provided', 400, 'FILE_REQUIRED');
      }
      const record = await idService.uploadImage(
        req.params.id,
        req.file.filename,
        req.user!._id,
        req.user!.role,
        req.ip,
        req.headers['user-agent']
      );
      return apiResponse.success(res, { id: record }, 'Image uploaded successfully');
    } catch (err) {
      next(err);
    }
  },
};
