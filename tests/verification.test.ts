import request from 'supertest';
import app from '../src/app';
import { IDRecord, IDStatus } from '../src/models/IDRecord';
import { Organization } from '../src/models/Organization';
import { User, UserRole, UserStatus } from '../src/models/User';
import { hashPassword } from '../src/utils/password';
import { setupTestDB } from './helpers/testDb';
import crypto from 'crypto';

setupTestDB();

let activeToken: string;
let revokedToken: string;
let expiredToken: string;

beforeEach(async () => {
  const adminHash = await hashPassword('Admin@123456');
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    passwordHash: adminHash,
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });

  const org = await Organization.create({ name: 'Test Org', status: 'ACTIVE' });

  activeToken = crypto.randomBytes(32).toString('hex');
  revokedToken = crypto.randomBytes(32).toString('hex');
  expiredToken = crypto.randomBytes(32).toString('hex');

  await IDRecord.create([
    {
      organizationId: org._id,
      idNumber: 'ACTIVE-001',
      verificationToken: activeToken,
      status: IDStatus.ACTIVE,
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      organizationId: org._id,
      idNumber: 'REVOKED-001',
      verificationToken: revokedToken,
      status: IDStatus.REVOKED,
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      organizationId: org._id,
      idNumber: 'EXPIRED-001',
      verificationToken: expiredToken,
      status: IDStatus.EXPIRED,
      createdBy: admin._id,
      updatedBy: admin._id,
    },
  ]);
});

describe('Public Verification', () => {
  it('returns verified=true for active ID', async () => {
    const res = await request(app).get(`/api/v1/verify/${activeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.idNumber).toBe('ACTIVE-001');
  });

  it('returns verified=false for revoked ID', async () => {
    const res = await request(app).get(`/api/v1/verify/${revokedToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(false);
    expect(res.body.data.status).toBe('REVOKED');
  });

  it('returns verified=false for expired ID', async () => {
    const res = await request(app).get(`/api/v1/verify/${expiredToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(false);
    expect(res.body.data.status).toBe('EXPIRED');
  });

  it('returns not-recognized for unknown token', async () => {
    const fakeToken = crypto.randomBytes(32).toString('hex');
    const res = await request(app).get(`/api/v1/verify/${fakeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(false);
    expect(res.body.data.status).toBeNull();
  });

  it('does not expose sensitive fields', async () => {
    const res = await request(app).get(`/api/v1/verify/${activeToken}`);
    const data = res.body.data;
    expect(data.createdBy).toBeUndefined();
    expect(data.updatedBy).toBeUndefined();
    expect(data.imagePath).toBeUndefined();
    expect(data._id).toBeUndefined();
  });

  it('does not require authentication', async () => {
    const res = await request(app).get(`/api/v1/verify/${activeToken}`);
    expect(res.status).toBe(200); // No Bearer token needed
  });
});
