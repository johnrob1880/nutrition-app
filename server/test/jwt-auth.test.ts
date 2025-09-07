import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Load test environment variables
config({ path: '.env.test' });

// Skip these tests if not in PostgreSQL mode
const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('JWT Authentication System', () => {
  let app: express.Application;
  let db: ReturnType<typeof getDb>;
  const JWT_SECRET = process.env.JWT_SECRET;

  beforeAll(async () => {
    // Ensure database is accessible
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    
    db = getDb();
    
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Register routes
    await registerRoutes(app);
    
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeConnection();
  });

  beforeEach(async () => {
    // Clean data before each test for isolation
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      // Clean up test data in dependency order
      await db.execute(sql`DELETE FROM refresh_tokens`);
      await db.execute(sql`DELETE FROM email_verifications`);
      await db.execute(sql`DELETE FROM consultant_profiles`);
      await db.execute(sql`DELETE FROM users WHERE email LIKE '%@test.com'`);
    } catch (error) {
      console.log('Cleanup skipped (tables may not exist)');
    }
  }

  async function createTestUser(userType: 'consultant' | 'producer' | 'staff' = 'consultant') {
    const hashedPassword = await bcrypt.hash('TestPassword123', 10);
    const result = await db.execute(sql`
      INSERT INTO users (username, email, password_hash, user_type, email_verified)
      VALUES ('testuser', 'test@test.com', ${hashedPassword}, ${userType}, true)
      RETURNING id, username, email, user_type
    `);
    return result.rows[0];
  }

  async function createTestConsultantProfile(userId: number) {
    await db.execute(sql`
      INSERT INTO consultant_profiles (user_id, full_name, specialization)
      VALUES (${userId}, 'Test Consultant', 'nutritionist')
    `);
  }

  describe('User Registration', () => {
    it('should register a new consultant successfully', async () => {
      const registrationData = {
        username: 'newconsultant',
        email: 'consultant@test.com',
        password: 'SecurePass123',
        fullName: 'New Consultant',
        specialization: 'nutritionist'
      };

      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send(registrationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Registration successful. Please check your email for verification.');
      expect(response.body.userId).toBeDefined();

      // Verify user was created in database
      const userResult = await db.execute(sql`
        SELECT * FROM users WHERE email = 'consultant@test.com'
      `);
      expect(userResult.rows).toHaveLength(1);
      expect(userResult.rows[0].username).toBe('newconsultant');
      expect(userResult.rows[0].user_type).toBe('consultant');
      expect(userResult.rows[0].email_verified).toBe(false);

      // Verify consultant profile was created
      const profileResult = await db.execute(sql`
        SELECT * FROM consultant_profiles WHERE user_id = ${userResult.rows[0].id}
      `);
      expect(profileResult.rows).toHaveLength(1);
      expect(profileResult.rows[0].specialization).toBe('nutritionist');
    });

    it('should reject registration with duplicate username', async () => {
      await createTestUser();

      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send({
          username: 'testuser',
          email: 'different@test.com',
          password: 'SecurePass123',
          fullName: 'Different User',
          specialization: 'veterinarian'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USERNAME_EXISTS');
    });

    it('should reject registration with duplicate email', async () => {
      await createTestUser();

      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send({
          username: 'differentuser',
          email: 'test@test.com',
          password: 'SecurePass123',
          fullName: 'Different User',
          specialization: 'veterinarian'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should validate password requirements', async () => {
      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send({
          username: 'newuser',
          email: 'new@test.com',
          password: 'weak',
          fullName: 'New User',
          specialization: 'nutritionist'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate specialization enum', async () => {
      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send({
          username: 'newuser',
          email: 'new@test.com',
          password: 'SecurePass123',
          fullName: 'New User',
          specialization: 'invalid_specialization'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('User Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual({
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.user_type
      });
      expect(response.body.accessToken).toBeDefined();

      // Verify JWT token structure
      const decoded = jwt.verify(response.body.accessToken, JWT_SECRET, {
        issuer: 'nutrition-app',
        audience: 'nutrition-app-users',
      }) as any;
      expect(decoded.userId).toBe(user.id);
      expect(decoded.userType).toBe(user.user_type);
    });

    it('should login with email instead of username', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          email: 'test@test.com',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe(user.id);
    });

    it('should reject login with invalid password', async () => {
      await createTestUser();

      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'WrongPassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'nonexistent',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for unverified email', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123', 10);
      await db.execute(sql`
        INSERT INTO users (username, email, password_hash, user_type, email_verified)
        VALUES ('unverified', 'unverified@test.com', ${hashedPassword}, 'consultant', false)
      `);

      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'unverified',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  describe('JWT Token Management', () => {
    it('should generate valid access and refresh tokens', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = response.body;
      
      // Verify access token
      const decoded = jwt.verify(accessToken, JWT_SECRET, {
        issuer: 'nutrition-app',
        audience: 'nutrition-app-users',
      }) as any;
      expect(decoded.userId).toBe(user.id);
      expect(decoded.userType).toBe('consultant');
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);

      // Verify refresh token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.find((cookie: string) => cookie.startsWith('refreshToken='))).toBeDefined();

      // Verify refresh token in database
      const refreshTokenResult = await db.execute(sql`
        SELECT * FROM refresh_tokens WHERE user_id = ${user.id}
      `);
      expect(refreshTokenResult.rows).toHaveLength(1);
    });

    it('should refresh access token with valid refresh token', async () => {
      const user = await createTestUser();

      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const cookies = loginResponse.headers['set-cookie'];
      
      // Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/jwt-auth/refresh')
        .set('Cookie', cookies);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.accessToken).toBeDefined();
      expect(refreshResponse.body.accessToken).not.toBe(loginResponse.body.accessToken);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=invalid-token']);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should logout and invalidate refresh token', async () => {
      const user = await createTestUser();

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Logout
      const logoutResponse = await request(app)
        .post('/api/jwt-auth/logout')
        .set('Cookie', cookies);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Verify refresh token is removed from database
      const refreshTokenResult = await db.execute(sql`
        SELECT * FROM refresh_tokens WHERE user_id = ${user.id}
      `);
      expect(refreshTokenResult.rows).toHaveLength(0);

      // Verify refresh token no longer works
      const refreshResponse = await request(app)
        .post('/api/jwt-auth/refresh')
        .set('Cookie', cookies);

      expect(refreshResponse.status).toBe(401);
    });
  });

  describe('User Type Authorization', () => {
    it('should differentiate between user types in JWT token', async () => {
      const consultant = await createTestUser('consultant');
      const producer = await createTestUser('producer');
      const staff = await createTestUser('staff');

      // Update usernames and emails to avoid conflicts
      await db.execute(sql`
        UPDATE users SET username = 'producer', email = 'producer@test.com' 
        WHERE id = ${producer.id}
      `);
      await db.execute(sql`
        UPDATE users SET username = 'staff', email = 'staff@test.com' 
        WHERE id = ${staff.id}
      `);

      // Test consultant login
      const consultantResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'TestPassword123' });

      const consultantToken = jwt.verify(consultantResponse.body.accessToken, JWT_SECRET, {
        issuer: 'nutrition-app',
        audience: 'nutrition-app-users',
      }) as any;
      expect(consultantToken.userType).toBe('consultant');

      // Test producer login
      const producerResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'producer', password: 'TestPassword123' });

      const producerToken = jwt.verify(producerResponse.body.accessToken, JWT_SECRET, {
        issuer: 'nutrition-app',
        audience: 'nutrition-app-users',
      }) as any;
      expect(producerToken.userType).toBe('producer');

      // Test staff login
      const staffResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'staff', password: 'TestPassword123' });

      const staffToken = jwt.verify(staffResponse.body.accessToken, JWT_SECRET, {
        issuer: 'nutrition-app',
        audience: 'nutrition-app-users',
      }) as any;
      expect(staffToken.userType).toBe('staff');
    });
  });

  describe('Email Verification', () => {
    it('should create email verification token on registration', async () => {
      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send({
          username: 'newuser',
          email: 'new@test.com',
          password: 'SecurePass123',
          fullName: 'New User',
          specialization: 'nutritionist'
        });

      expect(response.status).toBe(201);

      // Verify email verification token was created
      const verificationResult = await db.execute(sql`
        SELECT * FROM email_verifications 
        WHERE user_id = ${response.body.userId}
      `);
      expect(verificationResult.rows).toHaveLength(1);
      expect(verificationResult.rows[0].verified_at).toBe(null);
    });

    it('should verify email with valid token', async () => {
      // Create user and verification token manually for testing
      const user = await createTestUser();
      await db.execute(sql`
        UPDATE users SET email_verified = false WHERE id = ${user.id}
      `);

      const verificationToken = 'test-verification-token';
      const hashedToken = await bcrypt.hash(verificationToken, 10);
      await db.execute(sql`
        INSERT INTO email_verifications (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${hashedToken}, ${new Date(Date.now() + 24 * 60 * 60 * 1000)})
      `);

      const response = await request(app)
        .post('/api/jwt-auth/verify-email')
        .send({ token: verificationToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify user is now email verified
      const userResult = await db.execute(sql`
        SELECT email_verified FROM users WHERE id = ${user.id}
      `);
      expect(userResult.rows[0].email_verified).toBe(true);
    });

    it('should reject verification with expired token', async () => {
      const user = await createTestUser();
      const verificationToken = 'expired-token';
      const hashedToken = await bcrypt.hash(verificationToken, 10);
      
      await db.execute(sql`
        INSERT INTO email_verifications (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${hashedToken}, ${new Date(Date.now() - 1000)})
      `);

      const response = await request(app)
        .post('/api/jwt-auth/verify-email')
        .send({ token: verificationToken });

      expect(response.status).toBe(410);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });
});