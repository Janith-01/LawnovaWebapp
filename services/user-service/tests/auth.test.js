import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'student@example.com',
          password: 'SecurePass123',
          fullName: 'John Student',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('student@example.com');
      expect(response.body.data.role).toBe('student');
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      await User.create({
        email: 'student@example.com',
        passwordHash: 'hash',
        fullName: 'Existing User',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'student@example.com',
          password: 'SecurePass123',
          fullName: 'John Student',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('should validate password strength', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'student@example.com',
          password: 'weak',
          fullName: 'John Student',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'student@example.com',
        passwordHash: 'SecurePass123', // Will be hashed by pre-save hook
        fullName: 'Test Student',
      });
    });

    it('should login user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@example.com',
          password: 'SecurePass123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('student@example.com');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@example.com',
          password: 'SecurePass123',
        });

      const { refreshToken } = loginResponse.body.data;

      // Then refresh
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data).toHaveProperty('accessToken');
      expect(refreshResponse.body.data).toHaveProperty('refreshToken');
      expect(refreshResponse.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/users/me', () => {
    it('should return current user profile with valid token', async () => {
      // Setup: create user and login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@example.com',
          password: 'SecurePass123',
        });

      const { accessToken } = loginResponse.body.data;

      // Get profile
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('student@example.com');
    });

    it('should reject missing authorization header', async () => {
      const response = await request(app)
        .get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/users/me/change-password', () => {
    let accessToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@example.com',
          password: 'SecurePass123',
        });

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/users/me/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'SecurePass123',
          newPassword: 'NewSecurePass456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .post('/api/users/me/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewSecurePass456',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Admin Endpoints', () => {
    let adminToken;
    let adminUser;
    let regularUser;

    beforeEach(async () => {
      // Create admin user
      adminUser = await User.create({
        email: 'admin@example.com',
        passwordHash: 'AdminPass123',
        fullName: 'Admin User',
        role: 'admin',
      });

      // Create regular user
      regularUser = await User.create({
        email: 'student@example.com',
        passwordHash: 'SecurePass123',
        fullName: 'Regular Student',
        role: 'student',
      });

      // Login as admin
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'AdminPass123',
        });

      adminToken = loginResponse.body.data.accessToken;
    });

    describe('POST /api/admin/users/:id/deactivate', () => {
      it('should deactivate user as admin', async () => {
        const response = await request(app)
          .post(`/api/admin/users/${regularUser._id}/deactivate`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isActive).toBe(false);
      });

      it('should reject if not admin', async () => {
        // Login as regular user
        const studentLoginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'student@example.com',
            password: 'SecurePass123',
          });

        const studentToken = studentLoginResponse.body.data.accessToken;

        const response = await request(app)
          .post(`/api/admin/users/${regularUser._id}/deactivate`)
          .set('Authorization', `Bearer ${studentToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('ADMIN_REQUIRED');
      });
    });

    describe('GET /api/admin/users', () => {
      it('should list users as admin', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.meta).toHaveProperty('page');
        expect(response.body.meta).toHaveProperty('total');
      });
    });
  });
});
