import { IDRecord, IDStatus } from '../../models/IDRecord';
import { Organization } from '../../models/Organization';
import { env } from '../../config/env';
import { NotFoundError } from '../../utils/errors';

const statusMessages: Record<IDStatus, { verified: boolean; message: string }> = {
  [IDStatus.ACTIVE]: {
    verified: true,
    message: 'VALID ID — This ID is currently registered and active.',
  },
  [IDStatus.REVOKED]: {
    verified: false,
    message: 'INVALID ID — This ID has been revoked.',
  },
  [IDStatus.EXPIRED]: {
    verified: false,
    message: 'INVALID ID — This ID has expired.',
  },
  [IDStatus.SUSPENDED]: {
    verified: false,
    message: 'INVALID ID — This ID is currently suspended.',
  },
};

export const verificationService = {
  async verify(token: string) {
    const record = await IDRecord.findOne({
      verificationToken: token,
      deletedAt: null,
    }).lean();

    if (!record) {
      return {
        verified: false,
        status: null,
        message: 'INVALID VERIFICATION — This QR code is not recognized.',
        idNumber: null,
        idImageUrl: null,
        organization: null,
      };
    }

    const org = await Organization.findOne({ _id: record.organizationId }).lean();

    const { verified, message } = statusMessages[record.status] || {
      verified: false,
      message: 'Unknown status',
    };

    // Build safe public image URL
    const idImageUrl = record.imagePath
      ? `${env.APP_URL}/api/v1/verify/${token}/image`
      : null;

    const logoUrl = org?.logoPath
      ? `${env.APP_URL}/api/v1/organizations/${org._id}/logo`
      : null;

    return {
      verified,
      status: record.status,
      message,
      idNumber: record.idNumber,
      idImageUrl,
      organization: org
        ? {
            name: org.name,
            logoUrl,
          }
        : null,
    };
  },

  // Serve the ID image publicly for verified IDs
  async getPublicImage(token: string): Promise<{ path: string; exists: boolean }> {
    const record = await IDRecord.findOne({
      verificationToken: token,
      deletedAt: null,
    }).lean();

    if (!record || !record.imagePath) {
      return { path: '', exists: false };
    }

    const fs = await import('fs');
    const path = await import('path');
    const fullPath = path.join(process.cwd(), env.UPLOAD_DIR, path.basename(record.imagePath));

    return { path: fullPath, exists: fs.existsSync(fullPath) };
  },
};
