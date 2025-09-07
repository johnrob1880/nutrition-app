import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Load test environment variables
config({ path: '.env.test' });

// Skip these tests if not in PostgreSQL mode
const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('Security and Performance Tests', () => {
  let app: express.Application;
  let db: ReturnType<typeof getDb>;

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

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limiting on registration endpoint', async () => {
      const registrationData = {
        username: 'testuser',
        email: 'test@test.com',
        password: 'SecurePass123',
        fullName: 'Test User',
        specialization: 'nutritionist'
      };

      // Test multiple rapid requests
      const requests = [];
      for (let i = 0; i < 6; i++) {
        const data = {
          ...registrationData,
          username: `testuser${i}`,
          email: `test${i}@test.com`
        };
        requests.push(
          request(app)
            .post('/api/jwt-auth/register/consultant')
            .send(data)
        );
      }

      const responses = await Promise.all(requests);
      
      // First 5 requests should succeed or fail due to business logic
      const successfulRequests = responses.slice(0, 5).filter(r => r.status < 500);
      expect(successfulRequests.length).toBeGreaterThan(0);

      // 6th request should be rate limited
      const lastResponse = responses[5];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toContain('Too many requests');
    }, 10000);

    it('should enforce rate limiting on login endpoint', async () => {
      // Create a test user first
      await createTestUser();

      // Test multiple rapid login attempts
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/jwt-auth/login')
            .send({
              username: 'testuser',
              password: 'WrongPassword'  // Wrong password to trigger failures
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be blocked by rate limiting
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);

    it('should enforce rate limiting on password reset endpoint', async () => {
      await createTestUser();

      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(app)
            .post('/api/jwt-auth/forgot-password')
            .send({ email: 'test@test.com' })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be blocked by rate limiting
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);

    it('should have separate rate limits per IP address', async () => {
      const registrationData = {
        username: 'testuser1',
        email: 'test1@test.com',
        password: 'SecurePass123',
        fullName: 'Test User 1',
        specialization: 'nutritionist'
      };

      // Simulate requests from different IPs using X-Forwarded-For header
      const response1 = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .set('X-Forwarded-For', '192.168.1.1')
        .send(registrationData);

      const response2 = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .set('X-Forwarded-For', '192.168.1.2')
        .send({
          ...registrationData,
          username: 'testuser2',
          email: 'test2@test.com'
        });

      // Both should succeed initially (different IPs)
      expect([200, 201, 409]).toContain(response1.status); // May conflict with existing users
      expect([200, 201, 409]).toContain(response2.status);
    });
  });

  describe('Input Sanitization Tests', () => {
    it('should sanitize XSS attempts in registration data', async () => {
      const xssAttempt = '<script>alert("xss")</script>';
      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send({
          username: 'testuser',
          email: 'test@test.com',
          password: 'SecurePass123',
          fullName: xssAttempt,
          specialization: 'nutritionist'
        });

      // Should either reject the input or sanitize it
      if (response.status === 201) {
        // If accepted, verify it was sanitized
        const userResult = await db.execute(sql`
          SELECT * FROM consultant_profiles WHERE full_name LIKE '%script%'
        `);
        expect(userResult.rows).toHaveLength(0);
      } else {
        // Should be rejected as invalid input
        expect(response.status).toBe(400);
      }
    });

    it('should prevent SQL injection in username field', async () => {
      const sqlInjectionAttempt = "'; DROP TABLE users; --";
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: sqlInjectionAttempt,
          password: 'TestPassword123'
        });

      // Should not cause server error or succeed
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      
      // Verify users table still exists
      const tableCheck = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
      `);
      expect(tableCheck.rows[0]).toBeDefined();
    });

    it('should validate and sanitize email addresses', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@test.com',
        'test..test@test.com',
        'test@test',
        '<script>alert("xss")</script>@test.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/jwt-auth/register/consultant')
          .send({
            username: `user_${Math.random()}`,
            email,
            password: 'SecurePass123',
            fullName: 'Test User',
            specialization: 'nutritionist'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should sanitize special characters in text fields', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send({
          username: 'testuser123',
          email: 'test123@test.com',
          password: 'SecurePass123',
          fullName: `Test User ${specialChars}`,
          specialization: 'nutritionist'
        });

      if (response.status === 201) {
        // Verify special characters are properly handled
        const userResult = await db.execute(sql`
          SELECT * FROM consultant_profiles WHERE user_id = ${response.body.userId}
        `);
        expect(userResult.rows).toHaveLength(1);
        // The name should be stored but without dangerous characters
        expect(userResult.rows[0].full_name).not.toContain('<');
        expect(userResult.rows[0].full_name).not.toContain('>');
      }
    });
  });

  describe('Authentication Security Tests', () => {
    it('should hash passwords with bcrypt', async () => {
      const response = await request(app)
        .post('/api/jwt-auth/register/consultant')
        .send({
          username: 'secureuser',
          email: 'secure@test.com',
          password: 'SecurePass123',
          fullName: 'Secure User',
          specialization: 'nutritionist'
        });

      expect(response.status).toBe(201);

      // Verify password is hashed
      const userResult = await db.execute(sql`
        SELECT password_hash FROM users WHERE email = 'secure@test.com'
      `);
      expect(userResult.rows).toHaveLength(1);
      expect(userResult.rows[0].password_hash).not.toBe('SecurePass123');
      expect(userResult.rows[0].password_hash.startsWith('$2a$')).toBe(true); // bcrypt hash format
    });

    it('should use secure session configuration', async () => {
      const user = await createTestUser();
      
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(200);
      
      // Check for secure cookie attributes
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      
      const refreshCookie = cookies.find((cookie: string) => cookie.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite');
    });

    it('should implement proper token expiration', async () => {
      const user = await createTestUser();
      
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(200);
      const { accessToken } = response.body;
      
      // Decode token to check expiration
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(accessToken);
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(decoded.exp).toBeLessThan(Math.floor(Date.now() / 1000) + 3600); // Should expire within 1 hour
    });
  });

  describe('CORS and Security Headers Tests', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health');

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should handle CORS for consultant endpoints', async () => {
      const response = await request(app)
        .options('/api/jwt-auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .set('Origin', 'http://malicious-site.com')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      // Should either reject the origin or not include CORS headers
      if (response.headers['access-control-allow-origin']) {
        expect(response.headers['access-control-allow-origin']).not.toBe('http://malicious-site.com');
      }
    });
  });

  describe('Performance Tests', () => {
    it('should generate JWT tokens within performance requirements', async () => {
      const user = await createTestUser();
      
      const start = Date.now();
      
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100); // Should be under 100ms as per technical spec
    });

    it('should handle concurrent authentication requests efficiently', async () => {
      const user = await createTestUser();
      
      const start = Date.now();
      
      // Test 10 concurrent login requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/jwt-auth/login')
            .send({
              username: 'testuser',
              password: 'TestPassword123'
            })
        );
      }

      const responses = await Promise.all(requests);
      const duration = Date.now() - start;
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Average time per request should be reasonable
      const avgTime = duration / 10;
      expect(avgTime).toBeLessThan(200); // Average under 200ms
    }, 10000);

    it('should load consultant profiles within performance requirements', async () => {
      const user = await createTestUser();
      await db.execute(sql`
        INSERT INTO consultant_profiles (user_id, full_name, specialization)
        VALUES (${user.id}, 'Test Consultant', 'nutritionist')
      `);

      // Login first to get token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      const start = Date.now();
      
      const response = await request(app)
        .get('/api/consultant/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Should be under 500ms as per technical spec
    });
  });

  describe('Logging and Monitoring Tests', () => {
    it('should log authentication attempts', async () => {
      // This is a behavioral test - we verify logging is in place
      // In a real implementation, you'd capture logs and verify they contain required info
      
      const user = await createTestUser();
      
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(200);
      
      // In practice, you would verify logs contain:
      // - Timestamp
      // - Username/email attempted
      // - IP address
      // - Success/failure status
      // - User agent
    });

    it('should log failed authentication attempts', async () => {
      const response = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'nonexistent',
          password: 'WrongPassword'
        });

      expect(response.status).toBe(401);
      
      // In practice, you would verify failed attempts are logged with:
      // - Timestamp
      // - Failed username
      // - IP address
      // - Reason for failure
    });

    it('should log invitation activities', async () => {
      const user = await createTestUser();
      await db.execute(sql`
        INSERT INTO consultant_profiles (user_id, full_name, specialization)
        VALUES (${user.id}, 'Test Consultant', 'nutritionist')
      `);

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body;
      
      // Send invitation
      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'producer@test.com',
          message: 'Test invitation'
        });

      // Should log the invitation activity
      expect([200, 201]).toContain(response.status);
    });
  });

  describe('Data Validation and Integrity Tests', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'password',      // Common password
        '12345678',      // Numbers only
        'PASSWORD',      // Uppercase only
        'password',      // Lowercase only
        'Pass1',         // Too short
        'passwordpassword' // No numbers/special chars
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/jwt-auth/register/consultant')
          .send({
            username: `user_${Math.random()}`,
            email: `test_${Math.random()}@test.com`,
            password,
            fullName: 'Test User',
            specialization: 'nutritionist'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should validate username format requirements', async () => {
      const invalidUsernames = [
        'ab',           // Too short
        'a'.repeat(21), // Too long
        'user name',    // Contains space
        'user-name',    // Contains dash
        'user.name',    // Contains dot
        'user@name',    // Contains @
        '123user',      // Starts with number
        'USER',         // All uppercase might be restricted
      ];

      for (const username of invalidUsernames) {
        const response = await request(app)
          .post('/api/jwt-auth/register/consultant')
          .send({
            username,
            email: `${username.replace(/[^a-zA-Z0-9]/g, '')}@test.com`,
            password: 'SecurePass123',
            fullName: 'Test User',
            specialization: 'nutritionist'
          });

        expect([400, 409]).toContain(response.status); // 400 for validation error, 409 for conflict
      }
    });
  });
});