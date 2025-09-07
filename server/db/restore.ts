import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { getPool, closeConnection, getDb } from './connection';
import { getDatabaseUrl } from '../config/database.config';
import { operations, staffMembers, pens, feedingRecords, treatmentRecords, deathLosses, feedingPlans, nutritionists } from '@shared/schema';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

export interface RestoreOptions {
  backupPath?: string;
  verbose?: boolean;
  confirmDrop?: boolean;
}

export interface RestoreResult {
  success: boolean;
  tablesRestored?: number;
  rowsRestored?: number;
  duration?: number;
  error?: string;
}

/**
 * Restore database from SQL backup using raw SQL execution
 */
export async function restoreFromSQL(options: RestoreOptions = {}): Promise<RestoreResult> {
  const startTime = Date.now();
  
  const {
    backupPath,
    verbose = false,
    confirmDrop = false
  } = options;

  try {
    if (!backupPath) {
      throw new Error('Backup path is required');
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    if (!confirmDrop) {
      console.warn('\n⚠️  WARNING: This will replace all existing data in the database!');
      console.warn('   Use --confirm flag to proceed with restore.\n');
      return {
        success: false,
        error: 'Restore cancelled - confirmation required',
        duration: Date.now() - startTime
      };
    }

    if (verbose) {
      console.log('Starting SQL restore...');
      console.log(`Restore file: ${backupPath}`);
    }

    // Read SQL file
    const sqlContent = fs.readFileSync(backupPath, 'utf-8');
    const pool = getPool();

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let executedCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (const statement of statements) {
      try {
        await pool.query(statement + ';');
        executedCount++;
      } catch (error) {
        errorCount++;
        if (verbose) {
          console.warn(`  ⚠ Failed to execute statement: ${error}`);
        }
      }
    }
    
    const duration = Date.now() - startTime;

    if (verbose) {
      console.log(`✅ SQL restore completed`);
      console.log(`   Statements executed: ${executedCount}`);
      if (errorCount > 0) {
        console.log(`   Statements failed: ${errorCount}`);
      }
      console.log(`   Duration: ${(duration / 1000).toFixed(2)} seconds`);
    }

    return {
      success: errorCount === 0,
      tablesRestored: executedCount,
      duration
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (verbose) {
      console.error('❌ Restore failed:', errorMessage);
      console.error('Note: SQL restore requires psql. Consider using JSON restore as an alternative.');
    }

    return {
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Restore database from JSON backup
 */
export async function restoreFromJSON(options: RestoreOptions = {}): Promise<RestoreResult> {
  const startTime = Date.now();
  
  const {
    backupPath,
    verbose = false,
    confirmDrop = false
  } = options;

  try {
    if (!backupPath) {
      throw new Error('Backup path is required');
    }

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    if (!confirmDrop) {
      console.warn('\n⚠️  WARNING: This will replace all existing data in the database!');
      console.warn('   Use --confirm flag to proceed with restore.\n');
      return {
        success: false,
        error: 'Restore cancelled - confirmation required',
        duration: Date.now() - startTime
      };
    }

    if (verbose) {
      console.log('Starting JSON restore...');
      console.log(`Restore file: ${backupPath}`);
    }

    // Read JSON backup
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    const backupData = JSON.parse(backupContent);

    const db = getDb();
    let tablesRestored = 0;
    let totalRows = 0;

    // Define table order for foreign key constraints
    const tableOrder = [
      { name: 'operations', table: operations },
      { name: 'nutritionists', table: nutritionists },
      { name: 'staff_members', table: staffMembers },
      { name: 'pens', table: pens },
      { name: 'feeding_plans', table: feedingPlans },
      { name: 'feeding_records', table: feedingRecords },
      { name: 'treatment_records', table: treatmentRecords },
      { name: 'death_losses', table: deathLosses }
    ];

    // Clear existing data in reverse order
    if (verbose) {
      console.log('Clearing existing data...');
    }

    for (const { name, table } of [...tableOrder].reverse()) {
      try {
        await db.delete(table);
        if (verbose) {
          console.log(`  ✓ Cleared table: ${name}`);
        }
      } catch (error) {
        if (verbose) {
          console.warn(`  ⚠ Could not clear table ${name}:`, error);
        }
      }
    }

    // Restore data in correct order
    if (verbose) {
      console.log('Restoring data...');
    }

    for (const { name, table } of tableOrder) {
      const data = backupData[name];
      
      if (data && Array.isArray(data) && data.length > 0) {
        try {
          // Insert data in batches to avoid memory issues
          const batchSize = 100;
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            await db.insert(table).values(batch);
          }
          
          tablesRestored++;
          totalRows += data.length;
          
          if (verbose) {
            console.log(`  ✓ Restored ${data.length} rows to ${name}`);
          }
        } catch (error) {
          if (verbose) {
            console.error(`  ❌ Failed to restore ${name}:`, error);
          }
        }
      } else if (verbose) {
        console.log(`  - No data for ${name}`);
      }
    }

    const duration = Date.now() - startTime;

    if (verbose) {
      console.log(`✅ JSON restore completed successfully`);
      console.log(`   Tables restored: ${tablesRestored}`);
      console.log(`   Total rows: ${totalRows}`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)} seconds`);
    }

    return {
      success: true,
      tablesRestored,
      rowsRestored: totalRows,
      duration
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (verbose) {
      console.error('❌ JSON restore failed:', errorMessage);
    }

    return {
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Verify database after restore
 */
export async function verifyRestore(verbose: boolean = false): Promise<{
  success: boolean;
  tables: Record<string, number>;
  error?: string;
}> {
  try {
    const pool = getPool();
    const tables: Record<string, number> = {};

    const tableNames = [
      'operations',
      'staff_members',
      'pens',
      'feeding_records',
      'treatment_records',
      'death_losses',
      'feeding_plans',
      'nutritionists'
    ];

    if (verbose) {
      console.log('Verifying restored data...');
    }

    for (const tableName of tableNames) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        tables[tableName] = parseInt(result.rows[0].count);
        
        if (verbose) {
          console.log(`  ${tableName}: ${tables[tableName]} rows`);
        }
      } catch (error) {
        tables[tableName] = 0;
        if (verbose) {
          console.warn(`  ⚠ Could not verify ${tableName}`);
        }
      }
    }

    const totalRows = Object.values(tables).reduce((sum, count) => sum + count, 0);

    if (verbose) {
      console.log(`\n✅ Verification complete`);
      console.log(`   Total rows across all tables: ${totalRows}`);
    }

    return {
      success: true,
      tables
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (verbose) {
      console.error('❌ Verification failed:', errorMessage);
    }

    return {
      success: false,
      tables: {},
      error: errorMessage
    };
  }
}

/**
 * Get latest backup file
 */
export function getLatestBackup(
  format: 'sql' | 'json' = 'sql',
  backupDir?: string
): string | null {
  const dir = backupDir || path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(dir)) {
    return null;
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(`.${format}`))
    .sort()
    .reverse();

  return files.length > 0 ? path.join(dir, files[0]) : null;
}

// CLI execution  
const runCLI = async () => {
  const format = process.argv[2]; // sql or json
  const args = process.argv.slice(3);
  const confirm = args.includes('--confirm');
  const backupFile = args.find(arg => !arg.startsWith('--'));

  const runRestore = async () => {
    try {
      let backupPath = backupFile;

      // If no backup file specified, use latest
      if (!backupPath) {
        const backupFormat = format === 'json' ? 'json' : 'sql';
        backupPath = getLatestBackup(backupFormat);
        
        if (!backupPath) {
          console.error('❌ No backup files found');
          console.log('\nUsage:');
          console.log('  npm run db:restore [sql|json] [backup-file] [--confirm]');
          console.log('\nExamples:');
          console.log('  npm run db:restore sql                    # Restore latest SQL backup');
          console.log('  npm run db:restore json --confirm         # Restore latest JSON backup');
          console.log('  npm run db:restore sql backup.sql --confirm');
          process.exit(1);
        }

        console.log(`Using latest ${backupFormat} backup: ${path.basename(backupPath)}`);
      }

      let result: RestoreResult;

      if (format === 'json' || backupPath.endsWith('.json')) {
        console.log('📥 Starting JSON restore...\n');
        result = await restoreFromJSON({
          backupPath,
          verbose: true,
          confirmDrop: confirm
        });
      } else {
        console.log('📥 Starting SQL restore...\n');
        result = await restoreFromSQL({
          backupPath,
          verbose: true,
          confirmDrop: confirm
        });
      }

      if (result.success) {
        // Verify the restore
        await verifyRestore(true);
        console.log('\n✅ Restore completed successfully!');
        process.exit(0);
      } else {
        console.error('\n❌ Restore failed:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Restore failed:', error);
      process.exit(1);
    } finally {
      await closeConnection();
    }
  };

  runRestore();
};

// Check if running as CLI
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  runCLI();
}