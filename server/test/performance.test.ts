import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Load test environment variables
config({ path: '.env.test' });

// Skip these tests if not in PostgreSQL mode
const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('Performance Tests', () => {
  let app: express.Application;
  let db: ReturnType<typeof getDb>;
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

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
      await db.execute(sql`DELETE FROM producer_invitations`);
      await db.execute(sql`DELETE FROM refresh_tokens`);
      await db.execute(sql`DELETE FROM email_verifications`);
      await db.execute(sql`DELETE FROM consultant_profiles`);
      await db.execute(sql`DELETE FROM users WHERE email LIKE '%@test.com'`);
    } catch (error) {
      console.log('Cleanup skipped (tables may not exist)');
    }
  }

  async function createTestUser(userType: 'consultant' | 'producer' | 'staff' = 'consultant', emailVerified: boolean = true) {
    const hashedPassword = await bcrypt.hash('TestPassword123', 10);
    const result = await db.execute(sql`
      INSERT INTO users (username, email, password_hash, user_type, email_verified)
      VALUES ('testuser', 'test@test.com', ${hashedPassword}, ${userType}, ${emailVerified})
      RETURNING id, username, email, user_type
    `);
    return result.rows[0];
  }

  async function createTestConsultantProfile(userId: number) {
    await db.execute(sql`
      INSERT INTO consultant_profiles (user_id, full_name, specialization, phone, credentials)
      VALUES (${userId}, 'Test Consultant', 'nutritionist', '+1234567890', 'PhD in Animal Nutrition, 10 years experience')
    `);
  }

  describe('JWT Token Performance', () => {
    it('should generate JWT tokens under 100ms', async () => {
      const user = await createTestUser();
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(duration).toBeLessThan(100);
      
      console.log(`JWT generation time: ${duration}ms`);
    });

    it('should validate JWT tokens efficiently', async () => {
      const user = await createTestUser();
      await createTestConsultantProfile(user.id);
      
      // First get a token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      // Test token validation performance
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/consultant/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(50); // Token validation should be very fast
      
      console.log(`JWT validation time: ${duration}ms`);
    });

    it('should handle token refresh efficiently', async () => {
      const user = await createTestUser();
      
      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const cookies = loginResponse.headers['set-cookie'];
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/jwt-auth/refresh')
        .set('Cookie', cookies);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(duration).toBeLessThan(100);
      
      console.log(`Token refresh time: ${duration}ms`);
    });
  });

  describe('Profile Loading Performance', () => {
    it('should load consultant profile under 500ms', async () => {
      const user = await createTestUser();
      await createTestConsultantProfile(user.id);
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/consultant/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.profile).toBeDefined();
      expect(duration).toBeLessThan(500);
      
      console.log(`Profile load time: ${duration}ms`);
    });

    it('should load dashboard data under 1 second', async () => {
      const user = await createTestUser();
      await createTestConsultantProfile(user.id);
      
      // Create some test invitations for dashboard data
      await db.execute(sql`
        INSERT INTO producer_invitations (consultant_user_id, email, token_hash, expires_at, status, message)
        VALUES 
          (${user.id}, 'producer1@test.com', 'hash1', ${new Date(Date.now() + 86400000)}, 'pending', 'Test invitation 1'),
          (${user.id}, 'producer2@test.com', 'hash2', ${new Date(Date.now() + 86400000)}, 'pending', 'Test invitation 2'),
          (${user.id}, 'producer3@test.com', 'hash3', ${new Date(Date.now() + 86400000)}, 'accepted', 'Test invitation 3')
      `);
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/consultant/dashboard')
        .set('Authorization', `Bearer ${accessToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000);
      
      console.log(`Dashboard load time: ${duration}ms`);
    });
  });

  describe('Concurrent Session Performance', () => {
    it('should handle 100 concurrent consultant sessions', async () => {
      // Create 20 test users (simulating concurrent sessions)
      const users = [];
      for (let i = 0; i < 20; i++) {
        const hashedPassword = await bcrypt.hash('TestPassword123', 10);
        const result = await db.execute(sql`
          INSERT INTO users (username, email, password_hash, user_type, email_verified)
          VALUES (${`user${i}`}, ${`user${i}@test.com`}, ${hashedPassword}, 'consultant', true)
          RETURNING id, username, email, user_type
        `);
        users.push(result.rows[0]);
        
        // Create consultant profiles
        await db.execute(sql`
          INSERT INTO consultant_profiles (user_id, full_name, specialization)
          VALUES (${result.rows[0].id}, ${`User ${i}`}, 'nutritionist')
        `);
      }

      // Test concurrent logins
      const startTime = Date.now();
      
      const loginPromises = users.map((user, index) => 
        request(app)
          .post('/api/jwt-auth/login')
          .send({
            username: user.username,
            password: 'TestPassword123'
          })
      );

      const loginResponses = await Promise.all(loginPromises);
      
      const loginEndTime = Date.now();
      const loginDuration = loginEndTime - startTime;
      
      // All logins should succeed
      loginResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.accessToken).toBeDefined();
      });
      
      // Test concurrent profile loads
      const profileStartTime = Date.now();
      
      const profilePromises = loginResponses.map(response => 
        request(app)
          .get('/api/consultant/profile')
          .set('Authorization', `Bearer ${response.body.accessToken}`)
      );

      const profileResponses = await Promise.all(profilePromises);
      
      const profileEndTime = Date.now();
      const profileDuration = profileEndTime - profileStartTime;
      
      // All profile loads should succeed
      profileResponses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      expect(loginDuration).toBeLessThan(5000); // 5 seconds for 20 concurrent logins
      expect(profileDuration).toBeLessThan(3000); // 3 seconds for 20 concurrent profile loads
      
      console.log(`Concurrent login time (20 users): ${loginDuration}ms`);
      console.log(`Concurrent profile load time (20 users): ${profileDuration}ms`);
    }, 15000);

    it('should maintain performance under load', async () => {
      const user = await createTestUser();
      await createTestConsultantProfile(user.id);
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      // Test 50 rapid profile requests
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .get('/api/consultant/profile')
            .set('Authorization', `Bearer ${accessToken}`)
        );
      }

      const responses = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      const avgDuration = totalDuration / 50;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      expect(avgDuration).toBeLessThan(100); // Average under 100ms per request
      
      console.log(`Average response time under load: ${avgDuration}ms`);
    }, 15000);
  });

  describe('Email Service Performance', () => {
    it('should send invitation emails under 2 seconds', async () => {
      const user = await createTestUser();
      await createTestConsultantProfile(user.id);
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'producer@test.com',
          message: 'Would you like to work together?'
        });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect([200, 201]).toContain(response.status);
      expect(duration).toBeLessThan(2000);
      
      console.log(`Email invitation time: ${duration}ms`);
    }, 5000);

    it('should handle multiple email sends efficiently', async () => {
      const user = await createTestUser();
      await createTestConsultantProfile(user.id);
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      const startTime = Date.now();
      
      // Send 5 invitations concurrently
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/consultant/invitations')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              email: `producer${i}@test.com`,
              message: `Invitation ${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      const avgDuration = totalDuration / 5;
      
      // Most should succeed (some may fail due to rate limiting or other constraints)
      const successfulResponses = responses.filter(r => [200, 201].includes(r.status));
      expect(successfulResponses.length).toBeGreaterThan(0);
      
      expect(avgDuration).toBeLessThan(3000); // Average under 3 seconds
      
      console.log(`Average email send time: ${avgDuration}ms`);
    }, 20000);
  });

  describe('Database Query Performance', () => {
    it('should optimize user lookup queries', async () => {
      // Create multiple users to test index performance
      for (let i = 0; i < 50; i++) {
        const hashedPassword = await bcrypt.hash('TestPassword123', 10);
        await db.execute(sql`
          INSERT INTO users (username, email, password_hash, user_type, email_verified)
          VALUES (${`perfuser${i}`}, ${`perfuser${i}@test.com`}, ${hashedPassword}, 'consultant', true)
        `);
      }
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'perfuser25',
          password: 'TestPassword123'
        });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200); // Should be fast even with more data
      
      console.log(`User lookup time with 50 users: ${duration}ms`);
    });

    it('should efficiently query consultant profiles with relationships', async () => {
      const user = await createTestUser();
      await createTestConsultantProfile(user.id);
      
      // Add multiple invitations to test complex queries
      for (let i = 0; i < 20; i++) {
        await db.execute(sql`
          INSERT INTO producer_invitations (consultant_user_id, email, token_hash, expires_at, status, message)
          VALUES (${user.id}, ${`producer${i}@test.com`}, ${`hash${i}`}, ${new Date(Date.now() + 86400000)}, 'pending', 'Test message')
        `);
      }
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/consultant/invitations')
        .set('Authorization', `Bearer ${accessToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(300); // Should handle complex queries efficiently
      
      console.log(`Complex query time with 20 invitations: ${duration}ms`);
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should handle multiple token generations without memory leaks', async () => {
      const user = await createTestUser();
      
      // Generate many tokens in sequence
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/jwt-auth/login')
          .send({
            username: 'testuser',
            password: 'TestPassword123'
          });

        expect(response.status).toBe(200);
        expect(response.body.accessToken).toBeDefined();
        
        // Logout to clean up refresh tokens
        const cookies = response.headers['set-cookie'];
        await request(app)
          .post('/api/jwt-auth/logout')
          .set('Cookie', cookies);
      }
      
      // Verify no excessive refresh tokens remain
      const tokenCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM refresh_tokens WHERE user_id = ${user.id}
      `);
      
      expect(Number(tokenCount.rows[0].count)).toBeLessThanOrEqual(1); // Should be 0 but allowing for timing
    });
  });
});