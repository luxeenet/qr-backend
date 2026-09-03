import { Organization, OrganizationStatus } from '../../models/Organization';
import { UserOrganization } from '../../models/UserOrganization';
import { IDRecord } from '../../models/IDRecord';
import { AuditLog, AuditAction } from '../../models/AuditLog';
import { NotFoundError, ConflictError, ForbiddenError } from '../../utils/errors';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';

export const organizationService = {
  async create(
    data: { name: string; description?: string; status?: OrganizationStatus },
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const existing = await Organization.findOne({ name: data.name, deletedAt: null });
    if (existing) throw new ConflictError('An organization with this name already exists');

    const org = await Organization.create(data);

    await AuditLog.create({
      userId: actorId,
      organizationId: org._id,
      action: AuditAction.CREATE_ORGANIZATION,
      entityType: 'Organization',
      entityId: org._id.toString(),
      metadata: { name: org.name },
      ipAddress,
      userAgent,
    });

    return org;
  },

  async list(req: Request) {
    const { page, limit, skip } = getPagination(req);
    const search = req.query.search as string;
    const status = req.query.status as string;

    const filter: Record<string, unknown> = { deletedAt: null };
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (status) filter.status = status;

    const [orgs, total] = await Promise.all([
      Organization.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Organization.countDocuments(filter),
    ]);

    // Augment with ID count and uploader count
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const [idCount, uploaderCount] = await Promise.all([
          IDRecord.countDocuments({ organizationId: org._id, deletedAt: null }),
          UserOrganization.countDocuments({ organizationId: org._id }),
        ]);
        return { ...org, idCount, uploaderCount };
      })
    );

    return { data: enriched, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: string) {
    const org = await Organization.findOne({ _id: id, deletedAt: null }).lean();
    if (!org) throw new NotFoundError('Organization not found');

    const [idCount, uploaderCount] = await Promise.all([
      IDRecord.countDocuments({ organizationId: id, deletedAt: null }),
      UserOrganization.countDocuments({ organizationId: id }),
    ]);

    return { ...org, idCount, uploaderCount };
  },

  async update(
    id: string,
    data: { name?: string; description?: string; status?: OrganizationStatus },
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const org = await Organization.findOne({ _id: id, deletedAt: null });
    if (!org) throw new NotFoundError('Organization not found');

    if (data.name && data.name !== org.name) {
      const conflict = await Organization.findOne({ name: data.name, deletedAt: null, _id: { $ne: id } });
      if (conflict) throw new ConflictError('An organization with this name already exists');
    }

    const before = { name: org.name, description: org.description, status: org.status };
    Object.assign(org, data);
    await org.save();

    await AuditLog.create({
      userId: actorId,
      organizationId: org._id,
      action: AuditAction.UPDATE_ORGANIZATION,
      entityType: 'Organization',
      entityId: org._id.toString(),
      metadata: { before, after: data },
      ipAddress,
      userAgent,
    });

    return org;
  },

  async uploadLogo(
    id: string,
    filePath: string,
    actorId: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const org = await Organization.findOne({ _id: id, deletedAt: null });
    if (!org) throw new NotFoundError('Organization not found');

    // Delete old logo
    if (org.logoPath) {
      const oldPath = path.join(process.cwd(), env.UPLOAD_DIR, path.basename(org.logoPath));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    org.logoPath = filePath;
    await org.save();

    await AuditLog.create({
      userId: actorId,
      organizationId: org._id,
      action: AuditAction.UPLOAD_LOGO,
      entityType: 'Organization',
      entityId: org._id.toString(),
      ipAddress,
      userAgent,
    });

    return org;
  },

  async softDelete(id: string, actorId: string, ipAddress?: string, userAgent?: string) {
    const org = await Organization.findOne({ _id: id, deletedAt: null });
    if (!org) throw new NotFoundError('Organization not found');

    const idCount = await IDRecord.countDocuments({ organizationId: id, deletedAt: null });
    if (idCount > 0) {
      throw new ForbiddenError(
        `Cannot delete organization with ${idCount} active ID(s). Archive all IDs first.`
      );
    }

    org.deletedAt = new Date();
    await org.save();

    await AuditLog.create({
      userId: actorId,
      organizationId: org._id,
      action: AuditAction.DELETE_ORGANIZATION,
      entityType: 'Organization',
      entityId: org._id.toString(),
      ipAddress,
      userAgent,
    });
  },

  // For uploaders — only return their assigned organizations
  async listForUploader(userId: string, req: Request) {
    const { page, limit, skip } = getPagination(req);
    const assignments = await UserOrganization.find({ userId }).lean();
    const orgIds = assignments.map((a) => a.organizationId);

    const filter: Record<string, unknown> = { _id: { $in: orgIds }, deletedAt: null };
    const search = req.query.search as string;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [orgs, total] = await Promise.all([
      Organization.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Organization.countDocuments(filter),
    ]);

    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const idCount = await IDRecord.countDocuments({ organizationId: org._id, deletedAt: null });
        return { ...org, idCount };
      })
    );

    return { data: enriched, pagination: buildPaginationMeta(total, page, limit) };
  },
};
