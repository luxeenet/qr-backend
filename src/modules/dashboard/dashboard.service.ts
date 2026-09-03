import { IDRecord, IDStatus } from '../../models/IDRecord';
import { Organization } from '../../models/Organization';
import { User, UserRole } from '../../models/User';
import { UserOrganization } from '../../models/UserOrganization';

export const dashboardService = {
  async getAdminStats() {
    const [
      totalOrgs,
      totalUploaders,
      totalIds,
      activeIds,
      revokedIds,
      expiredIds,
      suspendedIds,
      recentIds,
    ] = await Promise.all([
      Organization.countDocuments({ deletedAt: null }),
      User.countDocuments({ role: UserRole.UPLOADER, deletedAt: null }),
      IDRecord.countDocuments({ deletedAt: null }),
      IDRecord.countDocuments({ status: IDStatus.ACTIVE, deletedAt: null }),
      IDRecord.countDocuments({ status: IDStatus.REVOKED, deletedAt: null }),
      IDRecord.countDocuments({ status: IDStatus.EXPIRED, deletedAt: null }),
      IDRecord.countDocuments({ status: IDStatus.SUSPENDED, deletedAt: null }),
      IDRecord.find({ deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('organizationId', 'name')
        .populate('createdBy', 'name')
        .lean(),
    ]);

    return {
      totalOrganizations: totalOrgs,
      totalUploaders,
      totalIds,
      activeIds,
      revokedIds,
      expiredIds,
      suspendedIds,
      recentIds,
    };
  },

  async getUploaderStats(userId: string) {
    const assignments = await UserOrganization.find({ userId }).lean();
    const orgIds = assignments.map((a) => a.organizationId);

    const [totalIds, activeIds, recentIds] = await Promise.all([
      IDRecord.countDocuments({ organizationId: { $in: orgIds }, deletedAt: null }),
      IDRecord.countDocuments({
        organizationId: { $in: orgIds },
        status: IDStatus.ACTIVE,
        deletedAt: null,
      }),
      IDRecord.find({ organizationId: { $in: orgIds }, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('organizationId', 'name logoPath')
        .lean(),
    ]);

    const orgSummaries = await Promise.all(
      orgIds.map(async (orgId) => {
        const org = await Organization.findOne({ _id: orgId, deletedAt: null }).lean();
        const idCount = await IDRecord.countDocuments({ organizationId: orgId, deletedAt: null });
        return org ? { ...org, idCount } : null;
      })
    );

    return {
      assignedOrganizations: orgSummaries.filter(Boolean).length,
      totalIds,
      activeIds,
      organizations: orgSummaries.filter(Boolean),
      recentIds,
    };
  },
};
