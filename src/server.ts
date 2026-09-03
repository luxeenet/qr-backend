import { connectDatabase } from './config/database';
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import fs from 'fs';
import path from 'path';

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

import { User, UserRole, UserStatus } from './models/User';
import { Organization, OrganizationStatus } from './models/Organization';
import { UserOrganization } from './models/UserOrganization';
import { IDRecord, IDStatus } from './models/IDRecord';
import { hashPassword } from './utils/password';
import crypto from 'crypto';

const autoSeedIfEmpty = async () => {
  const count = await User.countDocuments({});
  if (count === 0) {
    logger.info('🌱 Database empty. Auto-seeding default data...');
    const adminHash = await hashPassword('Admin@123456');
    const uploaderHash = await hashPassword('Uploader@123456');

    const admin = await User.create({
      name: 'System Admin',
      email: 'admin@example.com',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    const [abcOrg, xyzOrg, defOrg] = await Organization.create([
      { name: 'ABC Organization', description: 'Primary organization A', status: OrganizationStatus.ACTIVE },
      { name: 'XYZ Organization', description: 'Primary organization B', status: OrganizationStatus.ACTIVE },
      { name: 'DEF Organization', description: 'Primary organization C', status: OrganizationStatus.ACTIVE },
    ]);

    const [john, mary] = await User.create([
      { name: 'John Doe', email: 'john@example.com', passwordHash: uploaderHash, role: UserRole.UPLOADER, status: UserStatus.ACTIVE },
      { name: 'Mary Jane', email: 'mary@example.com', passwordHash: uploaderHash, role: UserRole.UPLOADER, status: UserStatus.ACTIVE },
    ]);

    await UserOrganization.create([
      { userId: john._id, organizationId: abcOrg._id, assignedBy: admin._id },
      { userId: john._id, organizationId: xyzOrg._id, assignedBy: admin._id },
      { userId: mary._id, organizationId: defOrg._id, assignedBy: admin._id },
    ]);

    await IDRecord.create([
      { organizationId: abcOrg._id, idNumber: 'ABC-0001', verificationToken: '748132f49f9b62686a2c29edb6c22fb42e1ae8f231eac3cb4ccf6a4405f4768d', status: IDStatus.ACTIVE, createdBy: john._id, updatedBy: john._id },
      { organizationId: abcOrg._id, idNumber: 'ABC-0002', verificationToken: crypto.randomBytes(32).toString('hex'), status: IDStatus.ACTIVE, createdBy: john._id, updatedBy: john._id },
      { organizationId: xyzOrg._id, idNumber: 'XYZ-0001', verificationToken: crypto.randomBytes(32).toString('hex'), status: IDStatus.ACTIVE, createdBy: john._id, updatedBy: john._id },
    ]);
    logger.info('✅ Auto-seed completed (admin@example.com / Admin@123456)');
  }
};

const start = async () => {
  await connectDatabase();
  await autoSeedIfEmpty();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
    logger.info(`📚 API Docs: http://localhost:${env.PORT}/api/docs`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Could not close connections in time. Forcing exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', err);
    shutdown('unhandledRejection');
  });
};

start();
