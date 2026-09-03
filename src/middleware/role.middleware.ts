import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '../models/User';
import { ForbiddenError } from '../utils/errors';

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ForbiddenError('Not authenticated'));
    }
    if (!roles.includes(req.user.role as UserRole)) {
      return next(new ForbiddenError('Insufficient permissions for this action'));
    }
    next();
  };
};

export const requireAdmin = requireRole(UserRole.ADMIN);
export const requireUploader = requireRole(UserRole.UPLOADER);
export const requireAnyRole = requireRole(UserRole.ADMIN, UserRole.UPLOADER);
