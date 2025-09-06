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

describe.skipIf(skipIfNotPostgres)('Session Persistence Across Server Restarts', () => {
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    // Ensure database is accessible
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    
    db = getDb();
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeConnection();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      await db.execute(sql`DELETE FROM session`);
      await db.execute(sql`DELETE FROM staff_members`);
      await db.execute(sql`DELETE FROM operations`);
    } catch (error) {
      console.log('Cleanup skipped (tables may not exist)');
    }
  }

  async function createTestUser() {
    const operationResult = await db.execute(sql`
      INSERT INTO operations (name, operator_email, first_name, last_name, location, invite_code)
      VALUES ('Test Ranch', 'owner@example.com', 'John', 'Doe', 'Test Location', 'TEST123')
      RETURNING id
    `);
    const operationId = operationResult.rows[0].id;

    await db.execute(sql`
      INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
      VALUES (${operationId}, 'owner@example.com', 'John', 'Doe', 'owner', 'active', 'system')
    `);

    return operationId;
  }

  async function createApp() {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(createSessionConfig());
    await registerRoutes(app);
    return app;
  }

  describe('Session Persistence Verification', () => {
    it('should persist session data in PostgreSQL database', async () => {
      const operationId = await createTestUser();
      const app = await createApp();
      const agent = request.agent(app);

      // Login and get session ID
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      expect(loginResponse.status).toBe(200);
      const sessionId = loginResponse.body.sessionId;

      // Verify session is stored in database
      const sessionResult = await db.execute(
        sql`SELECT sid, sess, expire FROM session WHERE sid = ${sessionId}`
      );
      
      expect(sessionResult.rows).toHaveLength(1);
      const sessionData = sessionResult.rows[0];
      expect(sessionData.sid).toBe(sessionId);
      expect(sessionData.sess.email).toBe('owner@example.com');
      expect(sessionData.sess.role).toBe('owner');
      expect(sessionData.sess.operationId).toBe(operationId);
      expect(new Date(sessionData.expire)).toBeInstanceOf(Date);
    });

    it('should restore session after simulated server restart', async () => {
      const operationId = await createTestUser();
      
      // First "server instance" - login and create session
      const app1 = await createApp();
      const agent1 = request.agent(app1);

      const loginResponse = await agent1
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      expect(loginResponse.status).toBe(200);
      const sessionId = loginResponse.body.sessionId;

      // Verify session works
      const sessionCheck1 = await agent1.get('/api/auth/session');
      expect(sessionCheck1.body.isAuthenticated).toBe(true);

      // Extract session cookie for transfer to "new server instance"
      const cookies = loginResponse.headers['set-cookie'];
      const sessionCookie = cookies.find((cookie: string) => 
        cookie.startsWith('nutrition.sid=')
      );
      expect(sessionCookie).toBeDefined();

      // Simulate server restart by creating a new Express app instance
      const app2 = await createApp();

      // New request with the same session cookie (simulating browser with persistent cookie)
      const sessionCheck2 = await request(app2)
        .get('/api/auth/session')
        .set('Cookie', sessionCookie!);

      // Session should still be valid after "server restart"
      expect(sessionCheck2.status).toBe(200);
      expect(sessionCheck2.body.isAuthenticated).toBe(true);
      expect(sessionCheck2.body.user.email).toBe('owner@example.com');
      expect(sessionCheck2.body.user.role).toBe('owner');
      expect(sessionCheck2.body.user.operationId).toBe(operationId);
      expect(sessionCheck2.body.sessionId).toBe(sessionId);

      // Verify protected routes still work
      const protectedCheck = await request(app2)
        .get('/api/auth/check')
        .set('Cookie', sessionCookie!);

      expect(protectedCheck.status).toBe(200);
      expect(protectedCheck.body.valid).toBe(true);
      expect(protectedCheck.body.user.email).toBe('owner@example.com');
    });

    it('should handle multiple sessions persisting across restart', async () => {
      const operationId = await createTestUser();

      // Add a second staff member
      await db.execute(sql`
        INSERT INTO staff_members (operation_id, email, first_name, last_name, role, status, invited_by)
        VALUES (${operationId}, 'staff@example.com', 'Jane', 'Smith', 'staff', 'active', 'owner@example.com')
      `);

      // First server instance - create multiple sessions
      const app1 = await createApp();

      // Login with owner
      const ownerAgent = request.agent(app1);
      const ownerLogin = await ownerAgent
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      // Login with staff
      const staffAgent = request.agent(app1);
      const staffLogin = await staffAgent
        .post('/api/auth/login')
        .send({ email: 'staff@example.com' });

      expect(ownerLogin.status).toBe(200);
      expect(staffLogin.status).toBe(200);

      const ownerCookie = ownerLogin.headers['set-cookie'].find((c: string) => 
        c.startsWith('nutrition.sid=')
      );
      const staffCookie = staffLogin.headers['set-cookie'].find((c: string) => 
        c.startsWith('nutrition.sid=')
      );

      // Verify both sessions exist in database
      const sessionsInDb = await db.execute(sql`SELECT COUNT(*) as count FROM session`);
      expect(Number(sessionsInDb.rows[0].count)).toBe(2);

      // Simulate server restart
      const app2 = await createApp();

      // Both sessions should still work
      const ownerCheck = await request(app2)
        .get('/api/auth/session')
        .set('Cookie', ownerCookie!);

      const staffCheck = await request(app2)
        .get('/api/auth/session')
        .set('Cookie', staffCookie!);

      expect(ownerCheck.body.isAuthenticated).toBe(true);
      expect(ownerCheck.body.user.role).toBe('owner');
      
      expect(staffCheck.body.isAuthenticated).toBe(true);
      expect(staffCheck.body.user.role).toBe('staff');
    });

    it('should reject expired sessions after restart', async () => {
      const operationId = await createTestUser();
      const app1 = await createApp();
      const agent = request.agent(app1);

      // Login
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      const sessionCookie = loginResponse.headers['set-cookie'].find((c: string) => 
        c.startsWith('nutrition.sid=')
      );
      const sessionId = loginResponse.body.sessionId;

      // Manually expire the session in the database
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      await db.execute(sql`
        UPDATE session 
        SET expire = ${pastDate}
        WHERE sid = ${sessionId}
      `);

      // Simulate server restart
      const app2 = await createApp();

      // Expired session should not be authenticated
      const sessionCheck = await request(app2)
        .get('/api/auth/session')
        .set('Cookie', sessionCookie!);

      expect(sessionCheck.body.isAuthenticated).toBe(false);
      expect(sessionCheck.body.user).toBeNull();
    });

    it.skip('should demonstrate session data integrity after restart', async () => {
      const operationId = await createTestUser();
      const app1 = await createApp();
      const agent = request.agent(app1);

      // Login
      await agent
        .post('/api/auth/login')
        .send({ email: 'owner@example.com' });

      // Make a request that might modify session data (like updating lastActivity)
      await agent.get('/api/auth/check');

      // Get session info before restart
      const sessionBefore = await agent.get('/api/auth/session');
      const sessionId = sessionBefore.body.sessionId;
      const userData = sessionBefore.body.user;

      // Extract cookie from the agent
      const cookies = (agent as any).jar.getCookies('http://127.0.0.1');
      const sessionCookie = cookies.find((c: any) => c.key === 'nutrition.sid');
      expect(sessionCookie).toBeDefined();

      // Simulate server restart
      const app2 = await createApp();

      // Session data should be identical after restart
      const sessionAfter = await request(app2)
        .get('/api/auth/session')
        .set('Cookie', `${sessionCookie.key}=${sessionCookie.value}`);

      expect(sessionAfter.body.isAuthenticated).toBe(true);
      expect(sessionAfter.body.sessionId).toBe(sessionId);
      expect(sessionAfter.body.user).toEqual(userData);
    });
  });

  describe('Session Storage Reliability', () => {
    it('should maintain session count consistency', async () => {
      const operationId = await createTestUser();
      const app = await createApp();

      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const agent = request.agent(app);
        await agent
          .post('/api/auth/login')
          .send({ email: 'owner@example.com' });
        sessions.push(agent);
      }

      // Verify session count in database
      const sessionsCount = await db.execute(sql`SELECT COUNT(*) as count FROM session`);
      expect(Number(sessionsCount.rows[0].count)).toBe(3);

      // Logout one session
      await sessions[0].post('/api/auth/logout');

      // Verify count decreased
      const sessionsCountAfter = await db.execute(sql`SELECT COUNT(*) as count FROM session`);
      expect(Number(sessionsCountAfter.rows[0].count)).toBe(2);
    });
  });
});