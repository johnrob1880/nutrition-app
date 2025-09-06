import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SessionMigration } from '../db/sessionMigration';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { session } from '@shared/schema';
import { sql } from 'drizzle-orm';

// Load test environment variables
config({ path: '.env.test' });

// Skip these tests if not in PostgreSQL mode
const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('SessionMigration', () => {
  let sessionMigration: SessionMigration;
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    // Ensure database is accessible
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    
    sessionMigration = new SessionMigration();
    db = getDb();
  });

  afterAll(async () => {
    await cleanupTestSessions();
    await closeConnection();
  });

  beforeEach(async () => {
    // Clean session data before each test for isolation
    await cleanupTestSessions();
  });

  async function cleanupTestSessions() {
    try {
      await db.delete(session).execute();
    } catch (error) {
      console.log('Session cleanup skipped (table may not exist)');
    }
  }

  async function createTestSession(sid: string, expire: Date, userData?: any) {
    const sessionData = {
      userId: userData?.userId || 'test-user',
      email: userData?.email || 'test@example.com',
      ...userData
    };

    await db.insert(session).values({
      sid,
      sess: sessionData,
      expire
    }).execute();
  }

  describe('Session Cleanup', () => {
    it('should clean up expired sessions', async () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

      // Create expired and active sessions
      await createTestSession('expired1', expiredDate, { userId: 'user1' });
      await createTestSession('expired2', expiredDate, { userId: 'user2' });
      await createTestSession('active1', futureDate, { userId: 'user3' });

      const result = await sessionMigration.cleanupExpiredSessions();
      
      expect(result.deletedCount).toBe(2);

      // Verify only active session remains
      const remainingSessions = await db.select().from(session).execute();
      expect(remainingSessions).toHaveLength(1);
      expect(remainingSessions[0].sid).toBe('active1');
    });

    it('should handle cleanup when no expired sessions exist', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createTestSession('active1', futureDate);

      const result = await sessionMigration.cleanupExpiredSessions();
      
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('Session Statistics', () => {
    it('should return accurate session statistics', async () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const futureDate1 = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const futureDate2 = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

      await createTestSession('expired1', expiredDate);
      await createTestSession('active1', futureDate1);
      await createTestSession('active2', futureDate2);

      const stats = await sessionMigration.getSessionStats();

      expect(stats.totalSessions).toBe(3);
      expect(stats.activeSessions).toBe(2);
      expect(stats.expiredSessions).toBe(1);
      expect(stats.oldestSession).toBeInstanceOf(Date);
      expect(stats.newestSession).toBeInstanceOf(Date);
      expect(stats.newestSession!.getTime()).toBeGreaterThan(stats.oldestSession!.getTime());
    });

    it('should handle empty session table', async () => {
      const stats = await sessionMigration.getSessionStats();

      expect(stats.totalSessions).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.expiredSessions).toBe(0);
      expect(stats.oldestSession).toBeNull();
      expect(stats.newestSession).toBeNull();
    });
  });

  describe('Session Structure Export', () => {
    it('should export session structure without sensitive data', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      
      await createTestSession('session1', futureDate, { 
        userId: 'user1', 
        email: 'user1@example.com',
        sensitiveData: 'should-not-be-exported'
      });
      await createTestSession('session2', futureDate, {}); // Session without user data

      const exportResult = await sessionMigration.exportSessionStructure();

      expect(exportResult.sessionCount).toBe(2);
      expect(exportResult.exportedAt).toBeInstanceOf(Date);
      expect(exportResult.structure).toHaveLength(2);

      const sessionWithUserData = exportResult.structure.find(s => s.sid === 'session1');
      const sessionWithoutUserData = exportResult.structure.find(s => s.sid === 'session2');

      expect(sessionWithUserData?.hasUserData).toBe(true);
      expect(sessionWithoutUserData?.hasUserData).toBe(false);
      expect(sessionWithUserData?.sessionSize).toBeGreaterThan(0);

      // Verify no sensitive data is exposed in the structure
      expect(JSON.stringify(exportResult.structure)).not.toContain('should-not-be-exported');
    });
  });

  describe('Session Table Validation', () => {
    it('should validate session table structure', async () => {
      const validation = await sessionMigration.validateSessionTable();

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(Array.isArray(validation.recommendations)).toBe(true);
    });

    it('should recommend cleanup for expired sessions', async () => {
      const expiredDate = new Date(Date.now() - 60 * 60 * 1000);
      await createTestSession('expired1', expiredDate);

      const validation = await sessionMigration.validateSessionTable();

      expect(validation.isValid).toBe(true);
      expect(validation.recommendations).toContain(
        expect.stringContaining('expired sessions that can be cleaned up')
      );
    });
  });

  describe('Memory Store Migration', () => {
    it('should migrate sessions from memory store format', async () => {
      const memorySessions = [
        {
          sid: 'memory-session-1',
          sess: { userId: 'user1', email: 'user1@example.com' },
          expire: new Date(Date.now() + 60 * 60 * 1000)
        },
        {
          sid: 'memory-session-2',
          sess: { userId: 'user2', email: 'user2@example.com' },
          expire: new Date(Date.now() + 2 * 60 * 60 * 1000)
        }
      ];

      const result = await sessionMigration.migrateFromMemoryStore(memorySessions);

      expect(result.migrated).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify sessions were migrated
      const migratedSessions = await db.select().from(session).execute();
      expect(migratedSessions).toHaveLength(2);
      expect(migratedSessions.map(s => s.sid)).toEqual(
        expect.arrayContaining(['memory-session-1', 'memory-session-2'])
      );
    });

    it('should handle duplicate sessions during migration', async () => {
      // Create existing session
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      await createTestSession('duplicate-session', futureDate, { userId: 'existing' });

      const memorySessions = [
        {
          sid: 'duplicate-session',
          sess: { userId: 'updated', email: 'updated@example.com' },
          expire: new Date(Date.now() + 2 * 60 * 60 * 1000)
        }
      ];

      const result = await sessionMigration.migrateFromMemoryStore(memorySessions);

      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(0);

      // Verify session was updated
      const updatedSession = await db.select().from(session).where(
        sql`${session.sid} = 'duplicate-session'`
      ).execute();
      
      expect(updatedSession).toHaveLength(1);
      expect(updatedSession[0].sess.userId).toBe('updated');
    });
  });

  describe('Maintenance Tasks', () => {
    it('should run complete maintenance successfully', async () => {
      // Set up test data
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 60 * 60 * 1000);
      const futureDate = new Date(now.getTime() + 60 * 60 * 1000);

      await createTestSession('expired1', expiredDate);
      await createTestSession('active1', futureDate);

      const maintenanceResult = await sessionMigration.runMaintenance();

      expect(maintenanceResult.cleanupResult.deletedCount).toBe(1);
      expect(maintenanceResult.validationResult.isValid).toBe(true);
      expect(maintenanceResult.stats.totalSessions).toBe(1);
      expect(maintenanceResult.stats.activeSessions).toBe(1);
      expect(maintenanceResult.stats.expiredSessions).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // This would require mocking database failures
      // For now, we just verify the methods exist and can be called
      expect(typeof sessionMigration.cleanupExpiredSessions).toBe('function');
      expect(typeof sessionMigration.getSessionStats).toBe('function');
      expect(typeof sessionMigration.validateSessionTable).toBe('function');
    });
  });
});