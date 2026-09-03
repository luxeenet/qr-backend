import { AuditLog } from '../../models/AuditLog';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { NotFoundError } from '../../utils/errors';
import { Request } from 'express';

export const auditService = {
  async list(req: Request) {
    const { page, limit, skip } = getPagination(req);
    const userId = req.query.userId as string;
    const organizationId = req.query.organizationId as string;
    const action = req.query.action as string;
    const entityType = req.query.entityType as string;
    const from = req.query.from as string;
    const to = req.query.to as string;

    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    if (organizationId) filter.organizationId = organizationId;
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (from || to) {
      filter.createdAt = {};
      if (from) (filter.createdAt as Record<string, Date>).$gte = new Date(from);
      if (to) (filter.createdAt as Record<string, Date>).$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'name email role')
        .populate('organizationId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return { data: logs, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id: string) {
    const log = await AuditLog.findById(id)
      .populate('userId', 'name email role')
      .populate('organizationId', 'name')
      .lean();
    if (!log) throw new NotFoundError('Audit log entry not found');
    return log;
  },
};
