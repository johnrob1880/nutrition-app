import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { validateDatabaseConfig, getDatabaseUrl } from '../config/database.config';

async function testConnection() {
  console.log('Testing PostgreSQL connection...\n');
  
  try {
    const config = validateDatabaseConfig();
    console.log('Storage Type:', config.storageType);
    
    if (config.storageType === 'memory') {
      console.log('✓ Using in-memory storage (no database connection needed)');
      return;
    }
    
    const databaseUrl = getDatabaseUrl();
    console.log('Database URL:', databaseUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
    
    // Test connection
    const sql = neon(databaseUrl);
    const db = drizzle(sql);
    
    // Simple query to test connection
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    
    console.log('\n✅ Connection successful!');
    console.log('Current time:', result[0].current_time);
    console.log('PostgreSQL version:', result[0].pg_version);
    
    // Test if we can query tables (they might not exist yet)
    try {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      console.log('\nExisting tables:', tables.map(t => t.table_name).join(', ') || 'None');
    } catch (error) {
      console.log('\nNo tables found (this is expected for a fresh database)');
    }
    
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Docker is running: docker-compose ps');
    console.error('2. Check if PostgreSQL is ready: docker-compose logs db');
    console.error('3. Verify your .env or .env.development file has correct DATABASE_URL');
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConnection();
}