import { getDb } from './connection';
import { sql } from 'drizzle-orm';
import { session } from './schema';

/**
 * Session Migration and Maintenance Utilities
 * Provides tools to manage PostgreSQL session storage
 */
export class SessionMigration {
  private getDatabase() {
    return getDb();
  }

  /**
   * Clean up expired sessions from PostgreSQL
   * This helps maintain database performance by removing old sessions
   */
  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    try {
      const now = new Date();
      const db = this.getDatabase();
      const result = await db
        .delete(session)
        .where(sql`${session.expire} < ${now}`)
        .execute();
      
      return {
        deletedCount: result.rowCount || 0
      };
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw new Error('Failed to cleanup expired sessions');
    }
  }

  /**
   * Get session statistics for monitoring
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    oldestSession: Date | null;
    newestSession: Date | null;
  }> {
    try {
      const now = new Date();
      const db = this.getDatabase();
      
      // Get total session count
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(session)
        .execute();
      
      const totalSessions = Number(totalResult[0]?.count || 0);

      // Get active sessions count (not expired)
      const activeResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(session)
        .where(sql`${session.expire} > ${now}`)
        .execute();
      
      const activeSessions = Number(activeResult[0]?.count || 0);

      // Get expired sessions count
      const expiredSessions = totalSessions - activeSessions;

      // Get oldest and newest session dates
      const dateRangeResult = await db
        .select({
          oldest: sql<Date>`min(${session.expire})`,
          newest: sql<Date>`max(${session.expire})`
        })
        .from(session)
        .execute();

      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        oldestSession: dateRangeResult[0]?.oldest || null,
        newestSession: dateRangeResult[0]?.newest || null
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw new Error('Failed to get session statistics');
    }
  }

  /**
   * Export session data (for backup or migration purposes)
   * Note: This exports session structure but not sensitive data
   */
  async exportSessionStructure(): Promise<{
    sessionCount: number;
    exportedAt: Date;
    structure: Array<{
      sid: string;
      hasUserData: boolean;
      expireAt: Date;
      sessionSize: number;
    }>;
  }> {
    try {
      const db = this.getDatabase();
      const sessions = await db
        .select({
          sid: session.sid,
          sess: session.sess,
          expire: session.expire
        })
        .from(session)
        .execute();

      const structure = sessions.map(s => ({
        sid: s.sid,
        hasUserData: !!(s.sess && typeof s.sess === 'object' && 
                       ((s.sess as any).userId || (s.sess as any).email)),
        expireAt: s.expire,
        sessionSize: JSON.stringify(s.sess).length
      }));

      return {
        sessionCount: sessions.length,
        exportedAt: new Date(),
        structure
      };
    } catch (error) {
      console.error('Error exporting session structure:', error);
      throw new Error('Failed to export session structure');
    }
  }

  /**
   * Validate session table integrity
   */
  async validateSessionTable(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check if session table exists and has correct structure
      const db = this.getDatabase();
      const tableInfo = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'session'
        ORDER BY ordinal_position
      `);

      const expectedColumns = [
        { name: 'sid', type: 'text', nullable: false },
        { name: 'sess', type: 'jsonb', nullable: false },
        { name: 'expire', type: 'timestamp without time zone', nullable: false }
      ];

      // Verify table structure
      expectedColumns.forEach(expected => {
        const column = tableInfo.rows.find(row => row.column_name === expected.name);
        if (!column) {
          issues.push(`Missing column: ${expected.name}`);
        } else {
          if (!column.data_type.includes(expected.type.split(' ')[0])) {
            issues.push(`Column ${expected.name} has wrong type: expected ${expected.type}, got ${column.data_type}`);
          }
          if (expected.nullable === false && column.is_nullable === 'YES') {
            issues.push(`Column ${expected.name} should not be nullable`);
          }
        }
      });

      // Check for expired sessions that should be cleaned up
      const stats = await this.getSessionStats();
      if (stats.expiredSessions > 0) {
        recommendations.push(`Found ${stats.expiredSessions} expired sessions that can be cleaned up`);
      }

      // Check for very old sessions
      if (stats.oldestSession) {
        const oldestDate = new Date(stats.oldestSession);
        const daysSinceOldest = Math.floor(
          (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceOldest > 30) {
          recommendations.push(`Oldest session is ${daysSinceOldest} days old - consider cleanup`);
        }
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error) {
      console.error('Error validating session table:', error);
      return {
        isValid: false,
        issues: [`Failed to validate session table: ${error.message}`],
        recommendations: []
      };
    }
  }

  /**
   * Migrate sessions from memory store to PostgreSQL
   * This would be used if switching from memory-based to PostgreSQL sessions
   * Note: This is a placeholder as actual memory store integration would 
   * require access to the running memory store instance
   */
  async migrateFromMemoryStore(memorySessions: Array<{
    sid: string;
    sess: any;
    expire: Date;
  }>): Promise<{
    migrated: number;
    failed: number;
    errors: string[];
  }> {
    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      for (const memorySession of memorySessions) {
        try {
          // Insert session into PostgreSQL
          const db = this.getDatabase();
          await db
            .insert(session)
            .values({
              sid: memorySession.sid,
              sess: memorySession.sess,
              expire: memorySession.expire
            })
            .onConflictDoUpdate({
              target: session.sid,
              set: {
                sess: memorySession.sess,
                expire: memorySession.expire
              }
            })
            .execute();
          
          migrated++;
        } catch (error) {
          failed++;
          errors.push(`Failed to migrate session ${memorySession.sid}: ${error.message}`);
        }
      }

      return { migrated, failed, errors };
    } catch (error) {
      console.error('Error during session migration:', error);
      throw new Error('Session migration failed');
    }
  }

  /**
   * Run maintenance tasks on session storage
   */
  async runMaintenance(): Promise<{
    cleanupResult: { deletedCount: number };
    validationResult: Awaited<ReturnType<typeof this.validateSessionTable>>;
    stats: Awaited<ReturnType<typeof this.getSessionStats>>;
  }> {
    console.log('Starting session maintenance...');
    
    const cleanupResult = await this.cleanupExpiredSessions();
    console.log(`Cleaned up ${cleanupResult.deletedCount} expired sessions`);
    
    const validationResult = await this.validateSessionTable();
    if (!validationResult.isValid) {
      console.warn('Session table validation issues:', validationResult.issues);
    }
    
    if (validationResult.recommendations.length > 0) {
      console.log('Session maintenance recommendations:', validationResult.recommendations);
    }
    
    const stats = await this.getSessionStats();
    console.log(`Session stats: ${stats.activeSessions} active, ${stats.totalSessions} total`);
    
    return {
      cleanupResult,
      validationResult,
      stats
    };
  }
}

// Export singleton instance
export const sessionMigration = new SessionMigration();