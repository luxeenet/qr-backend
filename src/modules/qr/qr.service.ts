import QRCode from 'qrcode';
import crypto from 'crypto';
import { IDRecord } from '../../models/IDRecord';
import { UserOrganization } from '../../models/UserOrganization';
import { AuditLog, AuditAction } from '../../models/AuditLog';
import { User, UserRole } from '../../models/User';
import { NotFoundError, ForbiddenError, OrganizationAccessError } from '../../utils/errors';
import { env } from '../../config/env';

const getVerificationUrl = (token: string): string => {
  const baseUrl = process.env.FRONTEND_URL || env.APP_URL.replace(':5000', ':3000');
  return `${baseUrl.replace(/\/$/, '')}/verify/${token}`;
};

const checkAccess = async (record: { organizationId: unknown }, actorId: string, actorRole: string) => {
  if (actorRole === UserRole.UPLOADER) {
    const assignment = await UserOrganization.findOne({
      userId: actorId,
      organizationId: record.organizationId,
    });
    if (!assignment) throw new OrganizationAccessError();
  }
};

export const qrService = {
  async generatePng(id: string, actorId: string, actorRole: string): Promise<Buffer> {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null });
    if (!record) throw new NotFoundError('ID record not found');
    await checkAccess(record, actorId, actorRole);

    const url = getVerificationUrl(record.verificationToken);
    const buffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'H',
    });

    await AuditLog.create({
      userId: actorId,
      organizationId: record.organizationId,
      action: AuditAction.GENERATE_QR,
      entityType: 'IDRecord',
      entityId: record._id.toString(),
    });

    return buffer;
  },

  async generateSvg(id: string, actorId: string, actorRole: string): Promise<string> {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null });
    if (!record) throw new NotFoundError('ID record not found');
    await checkAccess(record, actorId, actorRole);

    const url = getVerificationUrl(record.verificationToken);
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'H' });

    return svg;
  },

  async getVerificationUrl(id: string, actorId: string, actorRole: string) {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null });
    if (!record) throw new NotFoundError('ID record not found');
    await checkAccess(record, actorId, actorRole);

    return {
      verificationUrl: getVerificationUrl(record.verificationToken),
      token: record.verificationToken,
    };
  },

  async regenerateToken(id: string, actorId: string, ipAddress?: string, userAgent?: string) {
    const record = await IDRecord.findOne({ _id: id, deletedAt: null });
    if (!record) throw new NotFoundError('ID record not found');

    const oldToken = record.verificationToken;
    record.verificationToken = crypto.randomBytes(32).toString('hex');
    record.updatedBy = actorId as unknown as typeof record.updatedBy;
    await record.save();

    await AuditLog.create({
      userId: actorId,
      organizationId: record.organizationId,
      action: AuditAction.REGENERATE_QR,
      entityType: 'IDRecord',
      entityId: record._id.toString(),
      metadata: { oldToken: '[redacted]', newToken: '[redacted]' },
      ipAddress,
      userAgent,
    });

    return {
      verificationUrl: getVerificationUrl(record.verificationToken),
      token: record.verificationToken,
    };
  },
};
