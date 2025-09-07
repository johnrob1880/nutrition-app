import { exec } from 'child_process';
import { promisify } from 'util';
import { format } from 'date-fns';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { getPool, closeConnection } from './connection';
import { getDatabaseUrl } from '../config/database.config';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

export interface BackupOptions {
  outputDir?: string;
  filename?: string;
  includeData?: boolean;
  verbose?: boolean;
}

export interface BackupResult {
  success: boolean;
  filename?: string;
  path?: string;
  size?: number;
  duration?: number;
  error?: string;
}

/**
 * Create a SQL backup of the PostgreSQL database using raw SQL queries
 */
export async function createBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const startTime = Date.now();
  
  const {
    outputDir = path.join(process.cwd(), 'backups'),
    filename = `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.sql`,
    includeData = true,
    verbose = false
  } = options;

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      if (verbose) console.log(`Created backup directory: ${outputDir}`);
    }

    const backupPath = path.join(outputDir, filename);
    const pool = getPool();

    if (verbose) {
      console.log('Starting SQL backup...');
      console.log(`Backup file: ${backupPath}`);
    }

    let sqlContent = '';
    
    // Add header
    sqlContent += `-- PostgreSQL database backup\n`;
    sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
    sqlContent += `-- Database: nutrition-app\n\n`;

    // Tables to backup in order (respecting foreign key constraints)
    const tables = [
      'operations',
      'nutritionists',
      'staff_members',
      'pens',
      'feeding_plans',
      'feeding_records',
      'treatment_records',
      'death_losses'
    ];

    if (includeData) {
      // Get table schemas and data
      for (const table of tables) {
        try {
          // Get table structure
          const schemaResult = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
          `, [table]);

          if (schemaResult.rows.length > 0) {
            sqlContent += `\n-- Table: ${table}\n`;
            
            // Clear existing data
            sqlContent += `DELETE FROM ${table};\n`;
            
            // Get data
            const dataResult = await pool.query(`SELECT * FROM ${table}`);
            
            if (dataResult.rows.length > 0) {
              // Generate INSERT statements
              for (const row of dataResult.rows) {
                const columns = Object.keys(row);
                const values = columns.map(col => {
                  const val = row[col];
                  if (val === null) return 'NULL';
                  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                  if (val instanceof Date) return `'${val.toISOString()}'`;
                  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                  return val;
                });
                
                sqlContent += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
              }
              
              if (verbose) {
                console.log(`  ✓ Backed up ${dataResult.rows.length} rows from ${table}`);
              }
            }
          }
        } catch (error) {
          if (verbose) {
            console.warn(`  ⚠ Could not backup table ${table}:`, error);
          }
        }
      }
    }

    // Write SQL file
    fs.writeFileSync(backupPath, sqlContent);

    // Get file size
    const stats = fs.statSync(backupPath);
    const duration = Date.now() - startTime;

    if (verbose) {
      console.log(`✅ SQL backup completed successfully`);
      console.log(`   File: ${filename}`);
      console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)} seconds`);
    }

    return {
      success: true,
      filename,
      path: backupPath,
      size: stats.size,
      duration
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (verbose) {
      console.error('❌ Backup failed:', errorMessage);
      console.error('Note: SQL backup requires pg_dump. Consider using JSON backup as an alternative.');
    }

    return {
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Create a JSON backup of specific tables
 */
export async function createJSONBackup(
  tables?: string[],
  options: BackupOptions = {}
): Promise<BackupResult> {
  const startTime = Date.now();
  
  const {
    outputDir = path.join(process.cwd(), 'backups'),
    filename = `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`,
    verbose = false
  } = options;

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const backupPath = path.join(outputDir, filename);
    const pool = getPool();

    if (verbose) {
      console.log('Starting JSON backup...');
    }

    // Default tables to backup if none specified
    const tablesToBackup = tables || [
      'operations',
      'staff_members',
      'pens',
      'feeding_records',
      'treatment_records',
      'death_losses',
      'feeding_plans',
      'nutritionists'
    ];

    const backupData: Record<string, any[]> = {};

    // Export each table
    for (const table of tablesToBackup) {
      try {
        const result = await pool.query(`SELECT * FROM ${table}`);
        backupData[table] = result.rows;
        
        if (verbose) {
          console.log(`  ✓ Exported ${result.rows.length} rows from ${table}`);
        }
      } catch (error) {
        if (verbose) {
          console.warn(`  ⚠ Could not export table ${table}:`, error);
        }
      }
    }

    // Write JSON file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    // Get file size
    const stats = fs.statSync(backupPath);
    const duration = Date.now() - startTime;

    if (verbose) {
      console.log(`✅ JSON backup completed successfully`);
      console.log(`   File: ${filename}`);
      console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Duration: ${(duration / 1000).toFixed(2)} seconds`);
      console.log(`   Tables: ${Object.keys(backupData).length}`);
      console.log(`   Total rows: ${Object.values(backupData).reduce((sum, rows) => sum + rows.length, 0)}`);
    }

    return {
      success: true,
      filename,
      path: backupPath,
      size: stats.size,
      duration
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    if (verbose) {
      console.error('❌ JSON backup failed:', errorMessage);
    }

    return {
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime
    };
  }
}

/**
 * List available backups
 */
export function listBackups(backupDir?: string): {
  sql: string[];
  json: string[];
} {
  const dir = backupDir || path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(dir)) {
    return { sql: [], json: [] };
  }

  const files = fs.readdirSync(dir);
  
  return {
    sql: files.filter(f => f.endsWith('.sql')).sort().reverse(),
    json: files.filter(f => f.endsWith('.json')).sort().reverse()
  };
}

/**
 * Delete old backups (keep most recent N backups)
 */
export function cleanupBackups(
  keepCount: number = 5,
  backupDir?: string,
  verbose: boolean = false
): { deleted: string[]; kept: string[] } {
  const dir = backupDir || path.join(process.cwd(), 'backups');
  
  if (!fs.existsSync(dir)) {
    return { deleted: [], kept: [] };
  }

  const backups = listBackups(dir);
  const allBackups = [...backups.sql, ...backups.json].sort().reverse();
  
  const kept = allBackups.slice(0, keepCount);
  const toDelete = allBackups.slice(keepCount);
  const deleted: string[] = [];

  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, file));
      deleted.push(file);
      
      if (verbose) {
        console.log(`  ✓ Deleted old backup: ${file}`);
      }
    } catch (error) {
      if (verbose) {
        console.warn(`  ⚠ Could not delete ${file}:`, error);
      }
    }
  }

  if (verbose && deleted.length > 0) {
    console.log(`Cleanup complete: deleted ${deleted.length} old backup(s), kept ${kept.length}`);
  }

  return { deleted, kept };
}

// CLI execution
const runCLI = async () => {
  const command = process.argv[2];
  const format = process.argv[3];

  try {
    if (command === 'list') {
      const backups = listBackups();
      console.log('\n📁 Available Backups:\n');
      console.log('SQL Backups:');
      if (backups.sql.length === 0) {
        console.log('  (none)');
      } else {
        backups.sql.forEach(f => console.log(`  - ${f}`));
      }
      console.log('\nJSON Backups:');
      if (backups.json.length === 0) {
        console.log('  (none)');
      } else {
        backups.json.forEach(f => console.log(`  - ${f}`));
      }
      process.exit(0);
    }

    if (command === 'cleanup') {
      const keepCount = parseInt(format) || 5;
      const result = cleanupBackups(keepCount, undefined, true);
      console.log(`\n✅ Cleanup complete`);
      console.log(`   Deleted: ${result.deleted.length} backup(s)`);
      console.log(`   Kept: ${result.kept.length} backup(s)`);
      process.exit(0);
    }

    // Default to backup creation
    let result: BackupResult;
    
    if (command === 'json' || format === 'json') {
      console.log('📦 Creating JSON backup...\n');
      result = await createJSONBackup(undefined, { verbose: true });
    } else {
      console.log('📦 Creating SQL backup...\n');
      result = await createBackup({ verbose: true });
    }

    if (result.success) {
      console.log('\n✅ Backup completed successfully!');
      process.exit(0);
    } else {
      console.error('\n❌ Backup failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
};

// Check if running as CLI
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  runCLI();
}