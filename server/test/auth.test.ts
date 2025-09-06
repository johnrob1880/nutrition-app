import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { createSessionConfig } from '../config/session';
import { sql } from 'drizzle-orm';

// Load test environment variables
config({ path: '.env.test' });

// Skip these tests if not in PostgreSQL mode
const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('Session-based Authentication', () => {
  let app: express.Application;
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    // Ensure database is accessible
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    
    db = getDb();
    
    // Setup Express app with session middleware
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(createSessionConfig());
    
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
      // Clean up sessions and test data
      await db.execute(sql`DELETE FROM session`);
      await db.execute(sql`DELETE FROM staff_members`);
      await db.execute(sql`DELETE FROM operations`);
    } catch (error) {
      console.log('Cleanup skipped (tables may not exist)');
    }
  }

  async function createTestOperation() {
    const result = await db.execute(sql`
      INSERT INTO operations (name, operator_email, first_name, last_name, location, invite_code)
      VALUES ('Test Ranch', 'owner@example.com', 'John', 'Doe', 'Test Location', 'TEST123')
      RETURNING id
    `);
    return result.rows[0].id;
  }

  async function createTestStaffMember(operationId: number) {
    await db.execute(sql`
      INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
      VALUES (${operationId}, 'staff@example.com', 'Jane', 'Smith', 'staff', 'active', 'owner@example.com')
    `);
  }

  describe('Authentication Endpoints', () => {
    it('should login successfully with valid operation owner email', async () => {
      const operationId = await createTestOperation();

      // Create owner staff member entry
      await db.execute(sql`
        INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
        VALUES (${operationId}, 'owner@example.com', 'John', 'Doe', 'owner', 'active', 'system')
      `);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual({
        email: 'owner@example.com',
        role: 'owner',
        operationId: operationId
      });
      expect(response.body.sessionId).toBeDefined();
      
      // Verify session cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.find((cookie: string) => cookie.startsWith('nutrition.sid='))).toBeDefined();
    });

    it('should login successfully with valid staff member email', async () => {
      const operationId = await createTestOperation();
      await createTestStaffMember(operationId);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'staff@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual({
        email: 'staff@example.com',
        role: 'staff',
        operationId: operationId
      });
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('User not found');
    });

    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Email is required');
    });
  });

  describe('Session Management', () => {
    it('should maintain session across requests', async () => {
      const operationId = await createTestOperation();
      await db.execute(sql`
        INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
        VALUES (${operationId}, 'owner@example.com', 'John', 'Doe', 'owner', 'active', 'system')
      `);

      const agent = request.agent(app);

      // Login
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);

      // Check session status
      const sessionResponse = await agent.get('/api/auth/session');
      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.isAuthenticated).toBe(true);
      expect(sessionResponse.body.user.email).toBe('owner@example.com');

      // Use protected endpoint
      const checkResponse = await agent.get('/api/auth/check');
      expect(checkResponse.status).toBe(200);
      expect(checkResponse.body.valid).toBe(true);
    });

    it('should destroy session on logout', async () => {
      const operationId = await createTestOperation();
      await db.execute(sql`
        INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
        VALUES (${operationId}, 'owner@example.com', 'John', 'Doe', 'owner', 'active', 'system')
      `);

      const agent = request.agent(app);

      // Login
      await agent
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      // Verify session exists
      const sessionBefore = await agent.get('/api/auth/session');
      expect(sessionBefore.body.isAuthenticated).toBe(true);

      // Logout
      const logoutResponse = await agent.post('/api/auth/logout');
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Verify session is destroyed
      const sessionAfter = await agent.get('/api/auth/session');
      expect(sessionAfter.body.isAuthenticated).toBe(false);

      // Verify protected endpoint is now blocked
      const checkResponse = await agent.get('/api/auth/check');
      expect(checkResponse.status).toBe(401);
    });

    it('should return session info for authenticated user', async () => {
      const operationId = await createTestOperation();
      await db.execute(sql`
        INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
        VALUES (${operationId}, 'staff@example.com', 'Jane', 'Smith', 'staff', 'active', 'owner@example.com')
      `);

      const agent = request.agent(app);

      // Login
      await agent
        .post('/api/auth/login')
        .send({ email: 'staff@example.com' });

      // Get session info
      const response = await agent.get('/api/auth/session');
      
      expect(response.status).toBe(200);
      expect(response.body.isAuthenticated).toBe(true);
      expect(response.body.user).toEqual({
        email: 'staff@example.com',
        role: 'staff',
        operationId: operationId
      });
      expect(response.body.sessionId).toBeDefined();
    });

    it('should return unauthenticated status for no session', async () => {
      const response = await request(app).get('/api/auth/session');
      
      expect(response.status).toBe(200);
      expect(response.body.isAuthenticated).toBe(false);
      expect(response.body.user).toBeNull();
      expect(response.body.sessionId).toBeDefined();
    });
  });

  describe('Protected Routes', () => {
    it('should allow access to protected routes with valid session', async () => {
      const operationId = await createTestOperation();
      await db.execute(sql`
        INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
        VALUES (${operationId}, 'owner@example.com', 'John', 'Doe', 'owner', 'active', 'system')
      `);

      const agent = request.agent(app);

      // Login
      await agent
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      // Access protected route
      const response = await agent.get('/api/auth/check');
      
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.user.email).toBe('owner@example.com');
    });

    it('should block access to protected routes without session', async () => {
      const response = await request(app).get('/api/auth/check');
      
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('Session Persistence', () => {
    it('should persist session data in PostgreSQL', async () => {
      const operationId = await createTestOperation();
      await db.execute(sql`
        INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
        VALUES (${operationId}, 'owner@example.com', 'John', 'Doe', 'owner', 'active', 'system')
      `);

      const agent = request.agent(app);

      // Login
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      const sessionId = loginResponse.body.sessionId;

      // Verify session exists in database
      const sessionResult = await db.execute(
        sql`SELECT sess FROM session WHERE sid = ${sessionId}`
      );
      
      expect(sessionResult.rows).toHaveLength(1);
      const sessionData = sessionResult.rows[0].sess;
      expect(sessionData.email).toBe('owner@example.com');
      expect(sessionData.role).toBe('owner');
      expect(sessionData.operationId).toBe(operationId);
    });
  });
});