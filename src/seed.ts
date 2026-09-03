import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import { connectDatabase } from './config/database';
import { User, UserRole, UserStatus } from './models/User';
import { Organization, OrganizationStatus } from './models/Organization';
import { UserOrganization } from './models/UserOrganization';
import { IDRecord, IDStatus } from './models/IDRecord';
import { hashPassword } from './utils/password';
import { logger } from './utils/logger';
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';
const UPLOADER_PASSWORD = process.env.SEED_UPLOADER_PASSWORD || 'Uploader@123456';

import { MongoMemoryServer } from 'mongodb-memory-server';

async function seed() {
  try {
    await connectDatabase();
  } catch {
    logger.info('Local MongoDB not running. Launching in-memory MongoDB server...');
    const mongod = await MongoMemoryServer.create({ instance: { dbName: 'qr_id_verification', port: 27017 } });
    await mongoose.connect(mongod.getUri());
  }
  logger.info('🌱 Starting seed...');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Organization.deleteMany({}),
    UserOrganization.deleteMany({}),
    IDRecord.deleteMany({}),
  ]);
  logger.info('Cleared existing data');

  // Create Admin
  const adminHash = await hashPassword(ADMIN_PASSWORD);
  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@example.com',
    passwordHash: adminHash,
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });
  logger.info(`Created admin: admin@example.com / ${ADMIN_PASSWORD}`);

  // Create Organizations
  const [abcOrg, xyzOrg, defOrg] = await Organization.create([
    { name: 'ABC Organization', description: 'Primary organization A', status: OrganizationStatus.ACTIVE },
    { name: 'XYZ Organization', description: 'Primary organization B', status: OrganizationStatus.ACTIVE },
    { name: 'DEF Organization', description: 'Primary organization C', status: OrganizationStatus.ACTIVE },
  ]);
  logger.info('Created 3 organizations: ABC, XYZ, DEF');

  // Create Uploaders
  const uploaderHash = await hashPassword(UPLOADER_PASSWORD);
  const [john, mary] = await User.create([
    {
      name: 'John Doe',
      email: 'john@example.com',
      passwordHash: uploaderHash,
      role: UserRole.UPLOADER,
      status: UserStatus.ACTIVE,
    },
    {
      name: 'Mary Jane',
      email: 'mary@example.com',
      passwordHash: uploaderHash,
      role: UserRole.UPLOADER,
      status: UserStatus.ACTIVE,
    },
  ]);
  logger.info(`Created uploaders: john@example.com, mary@example.com / ${UPLOADER_PASSWORD}`);

  // Assign: John → ABC + XYZ | Mary → DEF
  await UserOrganization.create([
    { userId: john._id, organizationId: abcOrg._id, assignedBy: admin._id },
    { userId: john._id, organizationId: xyzOrg._id, assignedBy: admin._id },
    { userId: mary._id, organizationId: defOrg._id, assignedBy: admin._id },
  ]);
  logger.info('Assigned: John → ABC+XYZ, Mary → DEF');

  // Create Sample IDs
  const sampleIds = [
    { organizationId: abcOrg._id, idNumber: 'ABC-0001', status: IDStatus.ACTIVE, createdBy: john._id, updatedBy: john._id },
    { organizationId: abcOrg._id, idNumber: 'ABC-0002', status: IDStatus.ACTIVE, createdBy: john._id, updatedBy: john._id },
    { organizationId: abcOrg._id, idNumber: 'ABC-0003', status: IDStatus.REVOKED, createdBy: john._id, updatedBy: admin._id },
    { organizationId: xyzOrg._id, idNumber: 'XYZ-0001', status: IDStatus.ACTIVE, createdBy: john._id, updatedBy: john._id },
    { organizationId: xyzOrg._id, idNumber: 'XYZ-0002', status: IDStatus.EXPIRED, createdBy: john._id, updatedBy: john._id },
    { organizationId: defOrg._id, idNumber: 'DEF-0001', status: IDStatus.ACTIVE, createdBy: mary._id, updatedBy: mary._id },
    { organizationId: defOrg._id, idNumber: 'DEF-0002', status: IDStatus.ACTIVE, createdBy: mary._id, updatedBy: mary._id },
  ];

  const idsWithTokens = sampleIds.map((id) => ({
    ...id,
    verificationToken: crypto.randomBytes(32).toString('hex'),
  }));

  const createdIds = await IDRecord.create(idsWithTokens);
  logger.info(`Created ${createdIds.length} sample IDs`);

  logger.info('\n✅ Seed complete!\n');
  logger.info('=== CREDENTIALS ===');
  logger.info(`Admin:    admin@example.com / ${ADMIN_PASSWORD}`);
  logger.info(`Uploader: john@example.com  / ${UPLOADER_PASSWORD} (ABC, XYZ)`);
  logger.info(`Uploader: mary@example.com  / ${UPLOADER_PASSWORD} (DEF)`);
  logger.info('===================\n');
  logger.info('Sample QR tokens:');
  createdIds.forEach((id) =>
    logger.info(`  ${id.idNumber}: /verify/${id.verificationToken}`)
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
