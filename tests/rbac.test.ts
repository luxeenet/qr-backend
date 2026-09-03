import request from 'supertest';
import app from '../src/app';
import { User, UserRole, UserStatus } from '../src/models/User';
import { Organization } from '../src/models/Organization';
import { UserOrganization } from '../src/models/UserOrganization';
import { IDRecord, IDStatus } from '../src/models/IDRecord';
import { hashPassword } from '../src/utils/password';
import { setupTestDB } from './helpers/testDb';
import crypto from 'crypto';
import mongoose from 'mongoose';

setupTestDB();

let adminToken: string;
let uploaderToken: string;
let orgId: string;
let otherOrgId: string;
let idRecordId: string;

const loginAs = async (email: string, password: string) => {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body.data.accessToken;
};

beforeEach(async () => {
  const adminHash = await hashPassword('Admin@123456');
  const uploaderHash = await hashPassword('Uploader@123456');

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    passwordHash: adminHash,
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });

  const uploader = await User.create({
    name: 'John',
    email: 'john@test.com',
    passwordHash: uploaderHash,
    role: UserRole.UPLOADER,
    status: UserStatus.ACTIVE,
  });

  const org = await Organization.create({ name: 'ABC Org', status: 'ACTIVE' });
  const otherOrg = await Organization.create({ name: 'DEF Org', status: 'ACTIVE' });
  orgId = org._id.toString();
  otherOrgId = otherOrg._id.toString();

  await UserOrganization.create({
    userId: uploader._id,
    organizationId: org._id,
    assignedBy: admin._id,
  });

  const idRecord = await IDRecord.create({
    organizationId: org._id,
    idNumber: 'ABC-0001',
    verificationToken: crypto.randomBytes(32).toString('hex'),
    status: IDStatus.ACTIVE,
    createdBy: uploader._id,
    updatedBy: uploader._id,
  });
  idRecordId = idRecord._id.toString();

  adminToken = await loginAs('admin@test.com', 'Admin@123456');
  uploaderToken = await loginAs('john@test.com', 'Uploader@123456');
});

describe('RBAC — Organizations', () => {
  it('admin can create an organization', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Org', status: 'ACTIVE' });
    expect(res.status).toBe(201);
  });

  it('uploader cannot create an organization', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${uploaderToken}`)
      .send({ name: 'Hack Org', status: 'ACTIVE' });
    expect(res.status).toBe(403);
  });

  it('uploader cannot delete an organization', async () => {
    const res = await request(app)
      .delete(`/api/v1/organizations/${orgId}`)
      .set('Authorization', `Bearer ${uploaderToken}`);
    expect(res.status).toBe(403);
  });

  it('uploader sees only assigned organizations', async () => {
    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${uploaderToken}`);
    expect(res.status).toBe(200);
    const names = res.body.data.map((o: { name: string }) => o.name);
    expect(names).toContain('ABC Org');
    expect(names).not.toContain('DEF Org');
  });
});

describe('RBAC — IDs', () => {
  it('uploader can view IDs in assigned org', async () => {
    const res = await request(app)
      .get(`/api/v1/ids?organizationId=${orgId}`)
      .set('Authorization', `Bearer ${uploaderToken}`);
    expect(res.status).toBe(200);
  });

  it('uploader cannot access IDs in unassigned org', async () => {
    const res = await request(app)
      .get(`/api/v1/ids?organizationId=${otherOrgId}`)
      .set('Authorization', `Bearer ${uploaderToken}`);
    expect(res.status).toBe(403);
  });

  it('uploader cannot delete an ID', async () => {
    const res = await request(app)
      .delete(`/api/v1/ids/${idRecordId}`)
      .set('Authorization', `Bearer ${uploaderToken}`);
    expect(res.status).toBe(403);
  });

  it('admin can delete an ID', async () => {
    const res = await request(app)
      .delete(`/api/v1/ids/${idRecordId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('RBAC — Audit Logs', () => {
  it('admin can view audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('uploader cannot view audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${uploaderToken}`);
    expect(res.status).toBe(403);
  });
});

describe('RBAC — Uploader Management', () => {
  it('uploader cannot create another uploader', async () => {
    const res = await request(app)
      .post('/api/v1/users/uploaders')
      .set('Authorization', `Bearer ${uploaderToken}`)
      .send({ name: 'Hack User', email: 'hack@test.com', password: 'Test@12345' });
    expect(res.status).toBe(403);
  });

  it('admin can create an uploader', async () => {
    const res = await request(app)
      .post('/api/v1/users/uploaders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Uploader', email: 'newuploader@test.com', password: 'Test@123456' });
    expect(res.status).toBe(201);
  });
});
