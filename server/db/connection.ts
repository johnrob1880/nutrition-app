import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getDatabaseUrl, validateDatabaseConfig } from '../config/database.config';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create a database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const config = validateDatabaseConfig();
    const connectionString = getDatabaseUrl();
    
    if (!connectionString) {
      throw new Error('Database connection string is not configured');
    }

    pool = new Pool({
      connectionString,
      max: config.poolMax,
      min: config.poolMin,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  return pool;
}

/**
 * Get or create a Drizzle database instance
 */
export function getDb() {
  if (!db) {
    const poolInstance = getPool();
    db = drizzle(poolInstance, { schema });
  }
  return db;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const poolInstance = getPool();
    const client = await poolInstance.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Close database connections
 */
export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

/**
 * Execute a query with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Database operation failed (attempt ${i + 1}/${maxRetries}):`, error);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError || new Error('Database operation failed after retries');
}