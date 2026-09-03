import request from 'supertest';
import app from '../src/app';
import { User, UserRole, UserStatus } from '../src/models/User';
import { hashPassword } from '../src/utils/password';
import { setupTestDB } from './helpers/testDb';

setupTestDB();

describe('Authentication', () => {
  beforeEach(async () => {
    const hash = await hashPassword('Admin@123456');
    await User.create({
      name: 'Test Admin',
      email: 'admin@test.com',
      passwordHash: hash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
  });

  it('should login with valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'Admin@123456',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('should reject invalid password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject login for non-existent user', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@test.com',
      password: 'Admin@123456',
    });
    expect(res.status).toBe(401);
  });

  it('should return 401 for protected route without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return user profile with valid token', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'Admin@123456',
    });
    const { accessToken } = loginRes.body.data;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('admin@test.com');
  });
});
