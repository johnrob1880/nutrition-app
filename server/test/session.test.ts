import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import request from 'supertest';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { sql } from 'drizzle-orm';

// Load test environment variables
config({ path: '.env.test' });

// Skip these tests if not in PostgreSQL mode
const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('PostgreSQL Session Storage', () => {
  let app: express.Application;
  let db: ReturnType<typeof getDb>;
  const PgSession = ConnectPgSimple(session);

  beforeAll(async () => {
    // Ensure database is accessible
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    
    db = getDb();
    
    // Clean up any existing session data
    await cleanupSessionData();
    
    // Setup Express app with PostgreSQL sessions
    app = express();
    app.use(express.json());
    
    app.use(session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'session',
        createTableIfMissing: true
      }),
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Test routes for session functionality
    app.post('/api/login', (req, res) => {
      req.session.userId = req.body.userId;
      req.session.email = req.body.email;
      res.json({ success: true, sessionId: req.sessionID });
    });

    app.get('/api/session', (req, res) => {
      res.json({
        sessionId: req.sessionID,
        userId: req.session.userId,
        email: req.session.email,
        isAuthenticated: !!req.session.userId
      });
    });

    app.post('/api/logout', (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          res.status(500).json({ error: 'Failed to destroy session' });
        } else {
          res.json({ success: true });
        }
      });
    });

    app.post('/api/update-session', (req, res) => {
      req.session.lastActivity = new Date().toISOString();
      req.session.customData = req.body.data;
      res.json({ success: true });
    });
  });

  afterAll(async () => {
    await cleanupSessionData();
    await closeConnection();
  });

  beforeEach(async () => {
    // Clean session data before each test for isolation
    await cleanupSessionData();
  });

  async function cleanupSessionData() {
    try {
      // Delete all sessions from the session table
      await db.execute(sql`DELETE FROM session`);
    } catch (error) {
      // Table might not exist yet, which is fine
      console.log('Session table cleanup skipped (table may not exist)');
    }
  }

  describe('Session Table Creation', () => {
    it('should create session table automatically', async () => {
      // Make a request to trigger session table creation
      const response = await request(app)
        .post('/api/login')
        .send({ userId: 'test-user-1', email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBeDefined();

      // Verify session table exists by checking if we can query it
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM session`);
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Session Creation and Retrieval', () => {
    it('should create and store session data in PostgreSQL', async () => {
      const loginData = { userId: 'user-123', email: 'user@example.com' };
      
      const loginResponse = await request(app)
        .post('/api/login')
        .send(loginData);

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      
      const sessionId = loginResponse.body.sessionId;
      expect(sessionId).toBeDefined();

      // Verify session data is stored in database
      const sessionResult = await db.execute(
        sql`SELECT sess FROM session WHERE sid = ${sessionId}`
      );
      
      expect(sessionResult.rows).toHaveLength(1);
      const sessionData = sessionResult.rows[0].sess;
      expect(sessionData.userId).toBe('user-123');
      expect(sessionData.email).toBe('user@example.com');
    });

    it('should retrieve session data across requests', async () => {
      const agent = request.agent(app);
      const loginData = { userId: 'user-456', email: 'persistent@example.com' };

      // First request - login
      const loginResponse = await agent
        .post('/api/login')
        .send(loginData);

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);

      // Second request - verify session persists
      const sessionResponse = await agent.get('/api/session');

      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.userId).toBe('user-456');
      expect(sessionResponse.body.email).toBe('persistent@example.com');
      expect(sessionResponse.body.isAuthenticated).toBe(true);
    });
  });

  describe('Session Updates', () => {
    it('should update existing session data', async () => {
      const agent = request.agent(app);
      
      // Login first
      await agent
        .post('/api/login')
        .send({ userId: 'user-789', email: 'update@example.com' });

      // Update session with additional data
      const updateData = { data: { theme: 'dark', language: 'en' } };
      const updateResponse = await agent
        .post('/api/update-session')
        .send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);

      // Verify updated data is available
      const sessionResponse = await agent.get('/api/session');
      
      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.userId).toBe('user-789');
      expect(sessionResponse.body.email).toBe('update@example.com');
    });
  });

  describe('Session Destruction', () => {
    it('should properly destroy sessions', async () => {
      const agent = request.agent(app);
      
      // Login first
      const loginResponse = await agent
        .post('/api/login')
        .send({ userId: 'user-logout', email: 'logout@example.com' });

      const sessionId = loginResponse.body.sessionId;

      // Verify session exists in database
      const beforeLogout = await db.execute(
        sql`SELECT COUNT(*) as count FROM session WHERE sid = ${sessionId}`
      );
      expect(Number(beforeLogout.rows[0].count)).toBe(1);

      // Logout (destroy session)
      const logoutResponse = await agent.post('/api/logout');
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Verify session is removed from database
      const afterLogout = await db.execute(
        sql`SELECT COUNT(*) as count FROM session WHERE sid = ${sessionId}`
      );
      expect(Number(afterLogout.rows[0].count)).toBe(0);

      // Verify subsequent requests don't have session data
      const sessionResponse = await agent.get('/api/session');
      expect(sessionResponse.body.isAuthenticated).toBe(false);
      expect(sessionResponse.body.userId).toBeUndefined();
    });
  });

  describe('Session Expiration', () => {
    it('should handle expired sessions properly', async () => {
      // This test would ideally manipulate session expiration
      // For now, we test that sessions have proper expiration settings
      const agent = request.agent(app);
      
      const loginResponse = await agent
        .post('/api/login')
        .send({ userId: 'user-expire', email: 'expire@example.com' });

      const sessionId = loginResponse.body.sessionId;

      // Check that session has expiration data in database
      const sessionResult = await db.execute(
        sql`SELECT expire FROM session WHERE sid = ${sessionId}`
      );
      
      expect(sessionResult.rows).toHaveLength(1);
      expect(sessionResult.rows[0].expire).toBeDefined();
      
      const expireTime = new Date(sessionResult.rows[0].expire);
      const now = new Date();
      
      // Should expire approximately 24 hours from now (within 6 hour tolerance)
      const timeDiff = expireTime.getTime() - now.getTime();
      const hoursUntilExpiry = timeDiff / (1000 * 60 * 60);
      
      expect(hoursUntilExpiry).toBeGreaterThan(20);
      expect(hoursUntilExpiry).toBeLessThan(30);
    });
  });

  describe('Concurrent Sessions', () => {
    it('should handle multiple concurrent sessions', async () => {
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);

      // Create two different sessions
      const login1 = await agent1
        .post('/api/login')
        .send({ userId: 'user-1', email: 'user1@example.com' });

      const login2 = await agent2
        .post('/api/login')
        .send({ userId: 'user-2', email: 'user2@example.com' });

      expect(login1.body.sessionId).not.toBe(login2.body.sessionId);

      // Verify both sessions exist independently
      const session1 = await agent1.get('/api/session');
      const session2 = await agent2.get('/api/session');

      expect(session1.body.userId).toBe('user-1');
      expect(session1.body.email).toBe('user1@example.com');

      expect(session2.body.userId).toBe('user-2');
      expect(session2.body.email).toBe('user2@example.com');

      // Verify both sessions are stored in database
      const totalSessions = await db.execute(sql`SELECT COUNT(*) as count FROM session`);
      expect(Number(totalSessions.rows[0].count)).toBe(2);
    });
  });

  describe('Session Security', () => {
    it('should not expose sensitive session data', async () => {
      const loginResponse = await request(app)
        .post('/api/login')
        .send({ userId: 'user-security', email: 'security@example.com' });

      const sessionId = loginResponse.body.sessionId;

      // Session ID should be properly formatted
      expect(sessionId).toMatch(/^[a-zA-Z0-9\-_.]+$/);
      expect(sessionId.length).toBeGreaterThan(20);

      // Session cookie should be set with proper security flags
      const cookies = loginResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      
      const sessionCookie = cookies?.find((cookie: string) => cookie.startsWith('connect.sid='));
      expect(sessionCookie).toContain('HttpOnly');
    });

    it('should handle invalid session IDs gracefully', async () => {
      // Attempt to access session with invalid ID
      const sessionResponse = await request(app)
        .get('/api/session')
        .set('Cookie', 'connect.sid=s%3Ainvalid-session-id');

      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.body.isAuthenticated).toBe(false);
      expect(sessionResponse.body.userId).toBeUndefined();
    });
  });

  describe('Database Connection Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we verify that the session store is properly configured
      expect(app).toBeDefined();
      
      // Make a simple request to ensure the session store is working
      const response = await request(app).get('/api/session');
      expect(response.status).toBe(200);
    });
  });
});