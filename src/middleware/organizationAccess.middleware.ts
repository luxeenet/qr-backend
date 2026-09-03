import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '../models/User';
import { UserOrganization } from '../models/UserOrganization';
import { Organization } from '../models/Organization';
import { OrganizationAccessError, NotFoundError } from '../utils/errors';

/**
 * Verifies the authenticated uploader is assigned to the organization
 * specified by req.params.organizationId.
 * Admins always pass through.
 */
export const requireOrganizationAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { user } = req;
    if (!user) throw new OrganizationAccessError();

    // Admins bypass org access check
    if (user.role === UserRole.ADMIN) {
      return next();
    }

    const organizationId = req.params.organizationId || req.body.organizationId;
    if (!organizationId) throw new OrganizationAccessError('Organization ID is required');

    // Verify org exists
    const org = await Organization.findOne({ _id: organizationId, deletedAt: null }).lean();
    if (!org) throw new NotFoundError('Organization not found');

    // Check assignment
    const assignment = await UserOrganization.findOne({
      userId: user.userId,
      organizationId,
    }).lean();

    if (!assignment) {
      throw new OrganizationAccessError();
    }

    next();
  } catch (err) {
    next(err);
  }
};
