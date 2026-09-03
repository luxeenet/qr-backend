import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { IDRecord, IIDRecord, IDStatus } from '../../models/IDRecord';
import { UserOrganization } from '../../models/UserOrganization';
import { Organization } from '../../models/Organization';
import { AuditLog, AuditAction } from '../../models/AuditLog';
import { User, UserRole } from '../../models/User';
import { NotFoundError, ForbiddenError, ConflictError, OrganizationAccessError } from '../../utils/errors';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { env } from '../../config/env';
import { Request } from 'express';

const generateVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const idService = {
  async create(
    data: {
      organizationId: string;
      idNumber: string;
      imagePath?: string;
      status?: IDStatus;
    },
    actorId: string,
    actorRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Verify org exists
    const org = await Organization.findOne({ _id: data.organizationId, deletedAt: null });
    if (!org) throw new NotFoundError('Organization not found');

    // Uploader must be assigned
    if (actorRole === UserRole.UPLOADER) {
      const assignment = await UserOrganization.findOne({
        userId: actorId,
        organizationId: data.organizationId,
      });
      if (!assignment) throw new OrganizationAccessError();
    }

    // Check unique ID number within org
    const existing = await IDRecord.findOne({
      organizationId: data.organizationId,
      idNumber: data.idNumber,
      deletedAt: null,
    });
    if (existing) throw new ConflictError('An ID with this number already exists in this organization');

    const verificationToken = generateVerificationToken();

    const record = await IDRecord.create({
      organizationId: data.organizationId,
      idNumber: data.idNumber,
      imagePath: data.imagePath,
      verificationToken,
      status: data.status || IDStatus.ACTIVE,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await AuditLog.create({
      userId: actorId,
      organizationId: data.organizationId,
      action: AuditAction.CREATE_ID,
      entityType: 'IDRecord',
      entityId: record._id.toString(),
      metadata: { idNumber: data.idNumber, organizationId: data.organizationId },
      ipAddress,
      userAgent,
    });

    return record;
  },

  async list(req: Request, actorId: string, actorRole: string) {
    const { page, limit, skip } = getPagination(req);
    const search = req.query.search as string;
    const status = req.query.status as string;
    const organizationId = req.query.organizationId as string;

    const filter: Record<string, unknown> = { deletedAt: null };

    if (status) filter.status = status;
    if (search) filter.idNumber = { $regex: search, $options: 'i' };

    if (actorRole === UserRole.UPLOADER) {
      // Restrict to assigned orgs only
      const assignments = await UserOrganization.find({ userId: actorId }).lean();
      const assignedOrgIds = assignments.map((a) => a.organizationId);

      if (organizationId) {
        if (!assignedOrgIds.some((id) => id.toString() === organizationId)) {
          throw new OrganizationAccessError();
        }
        filter.organizationId = organizationId;
      } else {
        filter.organizationId = { $in: assignedOrgIds };
      }
    } else {
      if (organizationId) filter.organizationId = organizationId;
    }

    const [records, total] = await Promise.all([
      IDRecord.find(filter)
        .populate('organizationId', 'name logoPath status')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IDRecord.countDocuments(filter),
    ]);

    return { data: records, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: string, actorId: string, actorRole: string) {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null })
      .populate('organizationId', 'name logoPath status description')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!record) throw new NotFoundError('ID record not found');

    if (actorRole === UserRole.UPLOADER) {
      const assignment = await UserOrganization.findOne({
        userId: actorId,
        organizationId: (record.organizationId as { _id: unknown })._id,
      });
      if (!assignment) throw new OrganizationAccessError();
    }

    return record;
  },

  async update(
    id: string,
    data: { idNumber?: string; status?: IDStatus; imagePath?: string },
    actorId: string,
    actorRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null });
    if (!record) throw new NotFoundError('ID record not found');

    if (actorRole === UserRole.UPLOADER) {
      const assignment = await UserOrganization.findOne({
        userId: actorId,
        organizationId: record.organizationId,
      });
      if (!assignment) throw new OrganizationAccessError();

      // Uploaders cannot change sensitive statuses
      if (data.status && data.status !== IDStatus.ACTIVE && data.status !== IDStatus.SUSPENDED) {
        throw new ForbiddenError('You do not have permission to change ID status to ' + data.status);
      }
    }

    if (data.idNumber && data.idNumber !== record.idNumber) {
      const conflict = await IDRecord.findOne({
        organizationId: record.organizationId,
        idNumber: data.idNumber,
        deletedAt: null,
        _id: { $ne: id },
      });
      if (conflict) throw new ConflictError('An ID with this number already exists in this organization');
    }

    const before = { idNumber: record.idNumber, status: record.status };
    Object.assign(record, { ...data, updatedBy: actorId });
    await record.save();

    await AuditLog.create({
      userId: actorId,
      organizationId: record.organizationId,
      action: data.status !== before.status ? AuditAction.CHANGE_ID_STATUS : AuditAction.UPDATE_ID,
      entityType: 'IDRecord',
      entityId: record._id.toString(),
      metadata: { before, after: data },
      ipAddress,
      userAgent,
    });

    return record;
  },

  async softDelete(id: string, actorId: string, ipAddress?: string, userAgent?: string) {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null });
    if (!record) throw new NotFoundError('ID record not found');

    record.deletedAt = new Date();
    record.updatedBy = actorId as unknown as IIDRecord['updatedBy'];
    await record.save();

    await AuditLog.create({
      userId: actorId,
      organizationId: record.organizationId,
      action: AuditAction.DELETE_ID,
      entityType: 'IDRecord',
      entityId: record._id.toString(),
      ipAddress,
      userAgent,
    });
  },

  async getImagePath(id: string, actorId: string, actorRole: string): Promise<string> {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null }).lean();
    if (!record) throw new NotFoundError('ID record not found');

    if (actorRole === UserRole.UPLOADER) {
      const assignment = await UserOrganization.findOne({
        userId: actorId,
        organizationId: record.organizationId,
      });
      if (!assignment) throw new OrganizationAccessError();
    }

    if (!record.imagePath) throw new NotFoundError('No image uploaded for this ID');

    const fullPath = path.join(process.cwd(), env.UPLOAD_DIR, path.basename(record.imagePath));
    if (!fs.existsSync(fullPath)) throw new NotFoundError('Image file not found');

    return fullPath;
  },

  async uploadImage(
    id: string,
    filename: string,
    actorId: string,
    actorRole: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null });
    if (!record) throw new NotFoundError('ID record not found');

    if (actorRole === UserRole.UPLOADER) {
      const assignment = await UserOrganization.findOne({
        userId: actorId,
        organizationId: record.organizationId,
      });
      if (!assignment) throw new OrganizationAccessError();
    }

    // Delete old image
    if (record.imagePath) {
      const oldPath = path.join(process.cwd(), env.UPLOAD_DIR, path.basename(record.imagePath));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    record.imagePath = filename;
    record.updatedBy = actorId as unknown as IIDRecord['updatedBy'];
    await record.save();

    await AuditLog.create({
      userId: actorId,
      organizationId: record.organizationId,
      action: AuditAction.UPLOAD_IMAGE,
      entityType: 'IDRecord',
      entityId: record._id.toString(),
      ipAddress,
      userAgent,
    });

    return record;
  },
};
