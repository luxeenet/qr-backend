import { User, UserRole, UserStatus } from '../../models/User';
import { UserOrganization } from '../../models/UserOrganization';
import { Organization } from '../../models/Organization';
import { AuditLog, AuditAction } from '../../models/AuditLog';
import { hashPassword } from '../../utils/password';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { Request } from 'express';

export const userService = {
  async createUploader(
    data: {
      name: string;
      email: string;
      password: string;
      organizationIds?: string[];
    },
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) throw new ConflictError('A user with this email already exists');

    const passwordHash = await hashPassword(data.password);
    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: UserRole.UPLOADER,
      status: UserStatus.ACTIVE,
    });

    // Assign organizations if provided
    if (data.organizationIds?.length) {
      const assignments = data.organizationIds.map((orgId) => ({
        userId: user._id,
        organizationId: orgId,
        assignedBy: actorId,
      }));
      await UserOrganization.insertMany(assignments, { ordered: false });
    }

    await AuditLog.create({
      userId: actorId,
      action: AuditAction.CREATE_UPLOADER,
      entityType: 'User',
      entityId: user._id.toString(),
      metadata: { name: user.name, email: user.email },
      ipAddress,
      userAgent,
    });

    return user;
  },

  async listUploaders(req: Request) {
    const { page, limit, skip } = getPagination(req);
    const search = req.query.search as string;
    const status = req.query.status as string;

    const filter: Record<string, unknown> = {
      role: UserRole.UPLOADER,
      deletedAt: null,
    };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) filter.status = status;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    // Augment with assigned org names
    const enriched = await Promise.all(
      users.map(async (u) => {
        const assignments = await UserOrganization.find({ userId: u._id })
          .populate('organizationId', 'name status')
          .lean();
        return {
          ...u,
          organizations: assignments.map((a) => a.organizationId),
        };
      })
    );

    return { data: enriched, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getUploaderById(id: string) {
    const user = await User.findOne({ _id: id, role: UserRole.UPLOADER, deletedAt: null }).lean();
    if (!user) throw new NotFoundError('Uploader not found');

    const assignments = await UserOrganization.find({ userId: id })
      .populate('organizationId', 'name status logoPath')
      .lean();

    return { ...user, organizations: assignments.map((a) => a.organizationId) };
  },

  async updateUploader(
    id: string,
    data: { name?: string; email?: string; status?: UserStatus },
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await User.findOne({ _id: id, role: UserRole.UPLOADER, deletedAt: null });
    if (!user) throw new NotFoundError('Uploader not found');

    if (data.email && data.email !== user.email) {
      const conflict = await User.findOne({ email: data.email.toLowerCase(), _id: { $ne: id } });
      if (conflict) throw new ConflictError('A user with this email already exists');
    }

    const before = { name: user.name, email: user.email, status: user.status };
    Object.assign(user, data);
    if (data.email) user.email = data.email.toLowerCase();
    await user.save();

    await AuditLog.create({
      userId: actorId,
      action: AuditAction.UPDATE_UPLOADER,
      entityType: 'User',
      entityId: user._id.toString(),
      metadata: { before, after: data },
      ipAddress,
      userAgent,
    });

    return user;
  },

  async changeStatus(
    id: string,
    status: UserStatus,
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const user = await User.findOne({ _id: id, role: UserRole.UPLOADER, deletedAt: null });
    if (!user) throw new NotFoundError('Uploader not found');

    user.status = status;
    await user.save();

    await AuditLog.create({
      userId: actorId,
      action: AuditAction.UPDATE_UPLOADER,
      entityType: 'User',
      entityId: user._id.toString(),
      metadata: { statusChange: status },
      ipAddress,
      userAgent,
    });

    return user;
  },

  async softDelete(id: string, actorId: string, ipAddress?: string, userAgent?: string) {
    const user = await User.findOne({ _id: id, role: UserRole.UPLOADER, deletedAt: null });
    if (!user) throw new NotFoundError('Uploader not found');
    user.deletedAt = new Date();
    await user.save();

    await AuditLog.create({
      userId: actorId,
      action: AuditAction.DELETE_UPLOADER,
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress,
      userAgent,
    });
  },

  async assignOrganizations(
    uploaderId: string,
    organizationIds: string[],
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const uploader = await User.findOne({ _id: uploaderId, role: UserRole.UPLOADER, deletedAt: null });
    if (!uploader) throw new NotFoundError('Uploader not found');

    for (const orgId of organizationIds) {
      const org = await Organization.findOne({ _id: orgId, deletedAt: null });
      if (!org) throw new NotFoundError(`Organization ${orgId} not found`);

      await UserOrganization.findOneAndUpdate(
        { userId: uploaderId, organizationId: orgId },
        { userId: uploaderId, organizationId: orgId, assignedBy: actorId },
        { upsert: true, new: true }
      );

      await AuditLog.create({
        userId: actorId,
        organizationId: org._id,
        action: AuditAction.ASSIGN_ORGANIZATION,
        entityType: 'UserOrganization',
        entityId: uploaderId,
        metadata: { organizationId: orgId, uploaderId },
        ipAddress,
        userAgent,
      });
    }

    return userService.getUploaderById(uploaderId);
  },

  async removeOrganizationAssignment(
    uploaderId: string,
    organizationId: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const assignment = await UserOrganization.findOneAndDelete({ userId: uploaderId, organizationId });
    if (!assignment) throw new NotFoundError('Assignment not found');

    await AuditLog.create({
      userId: actorId,
      organizationId,
      action: AuditAction.REMOVE_ORGANIZATION_ASSIGNMENT,
      entityType: 'UserOrganization',
      entityId: uploaderId,
      metadata: { organizationId, uploaderId },
      ipAddress,
      userAgent,
    });
  },
};
