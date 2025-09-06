import { getDb, closeConnection, executeWithRetry } from './connection';
import { operations, pens, feedingRecords, treatmentRecords, deathLosses, staffMembers } from '@shared/schema';
import { InMemoryStorageProvider } from '../storage/InMemoryStorageProvider';
import { eq } from 'drizzle-orm';

export interface MigrationResult {
  success: boolean;
  operations: number;
  pens: number;
  feedingRecords: number;
  treatments: number;
  deathLosses: number;
  staffMembers: number;
  error?: string;
}

export interface MigrationProgress {
  stage: string;
  message: string;
  progress?: number;
  total?: number;
}

/**
 * Migrate data from in-memory storage to PostgreSQL database
 */
export async function migrateFromInMemory(
  progressCallback?: (progress: MigrationProgress) => void
): Promise<MigrationResult> {
  const progress = (stage: string, message: string, current?: number, total?: number) => {
    console.log(`[${stage}] ${message}`);
    if (progressCallback) {
      progressCallback({ stage, message, progress: current, total });
    }
  };

  try {
    progress('INIT', 'Starting migration from in-memory storage to PostgreSQL...');
    
    // Create in-memory storage provider to access existing data
    const inMemoryProvider = new InMemoryStorageProvider();
    const db = getDb();
    
    let totalOperations = 0;
    let totalPens = 0;
    let totalFeedingRecords = 0;
    let totalTreatments = 0;
    let totalDeathLosses = 0;
    let totalStaffMembers = 0;

    // Get all operations from in-memory storage
    progress('OPERATIONS', 'Fetching operations from in-memory storage...');
    const inMemoryOperations = await inMemoryProvider.getAllOperations();
    
    if (inMemoryOperations.length === 0) {
      progress('OPERATIONS', 'No operations found in in-memory storage');
      return {
        success: true,
        operations: 0,
        pens: 0,
        feedingRecords: 0,
        treatments: 0,
        deathLosses: 0,
        staffMembers: 0
      };
    }

    progress('OPERATIONS', `Found ${inMemoryOperations.length} operations to migrate`);

    // Migrate each operation
    for (let i = 0; i < inMemoryOperations.length; i++) {
      const operation = inMemoryOperations[i];
      progress('OPERATIONS', `Migrating operation: ${operation.name}`, i + 1, inMemoryOperations.length);

      // Check if operation already exists in PostgreSQL
      const existingOperation = await db.select()
        .from(operations)
        .where(eq(operations.operatorEmail, operation.operatorEmail));

      let dbOperation;
      if (existingOperation.length === 0) {
        // Insert operation into PostgreSQL
        [dbOperation] = await executeWithRetry(() =>
          db.insert(operations).values({
            name: operation.name,
            operatorEmail: operation.operatorEmail,
            firstName: operation.firstName,
            lastName: operation.lastName,
            location: operation.location,
            inviteCode: operation.inviteCode
          }).returning()
        );
        totalOperations++;
        progress('OPERATIONS', `Created operation: ${operation.name}`);
      } else {
        dbOperation = existingOperation[0];
        progress('OPERATIONS', `Operation already exists: ${operation.name}`);
      }

      // Migrate staff members for this operation
      progress('STAFF', `Migrating staff members for operation: ${operation.name}`);
      const staffMembers = await inMemoryProvider.getStaffMembersByOperationId(operation.id);
      
      for (const staff of staffMembers) {
        const existingStaff = await db.select()
          .from(staffMembers)
          .where(eq(staffMembers.email, staff.email));

        if (existingStaff.length === 0) {
          await executeWithRetry(() =>
            db.insert(staffMembers).values({
              operationId: dbOperation.id,
              email: staff.email,
              firstName: staff.firstName,
              lastName: staff.lastName,
              role: staff.role,
              status: staff.status,
              invitedBy: staff.invitedBy,
              invitedAt: staff.invitedAt || new Date(),
              acceptedAt: staff.acceptedAt
            })
          );
          totalStaffMembers++;
          progress('STAFF', `Migrated staff member: ${staff.firstName} ${staff.lastName}`);
        }
      }

      // Migrate pens for this operation
      progress('PENS', `Migrating pens for operation: ${operation.name}`);
      const operationPens = await inMemoryProvider.getPensByOperatorEmail(operation.operatorEmail);
      
      const penIdMapping: Record<string, number> = {};

      for (const pen of operationPens) {
        // Check if pen already exists
        const existingPen = await db.select()
          .from(pens)
          .where(eq(pens.name, pen.name))
          .where(eq(pens.operatorEmail, operation.operatorEmail));

        let dbPen;
        if (existingPen.length === 0) {
          [dbPen] = await executeWithRetry(() =>
            db.insert(pens).values({
              name: pen.name,
              operatorEmail: pen.operatorEmail,
              capacity: pen.capacity,
              current: pen.current,
              status: pen.status,
              feedType: pen.feedType,
              lastFed: pen.lastFed ? new Date(pen.lastFed) : null,
              cattleType: pen.cattleType,
              startingWeight: pen.startingWeight,
              currentWeight: pen.currentWeight,
              marketWeight: pen.marketWeight,
              averageDailyGain: pen.averageDailyGain,
              isCrossbred: pen.isCrossbred,
              daysOnFeed: 0, // Default value
              feedConversion: 0, // Default value
              projectedCloseoutDate: null,
              estimatedValue: 0
            }).returning()
          );
          penIdMapping[pen.id] = dbPen.id;
          totalPens++;
          progress('PENS', `Migrated pen: ${pen.name}`);
        } else {
          dbPen = existingPen[0];
          penIdMapping[pen.id] = dbPen.id;
          progress('PENS', `Pen already exists: ${pen.name}`);
        }
      }

      // Migrate feeding records
      progress('FEEDING', `Migrating feeding records for operation: ${operation.name}`);
      const feedingRecordsData = await inMemoryProvider.getFeedingRecordsByOperatorEmail(operation.operatorEmail);
      
      for (const record of feedingRecordsData) {
        const dbPenId = penIdMapping[record.penId];
        if (dbPenId) {
          // Check if feeding record already exists
          const existingRecord = await db.select()
            .from(feedingRecords)
            .where(eq(feedingRecords.penId, dbPenId.toString()))
            .where(eq(feedingRecords.feedingDate, record.feedingTime.split('T')[0]));

          if (existingRecord.length === 0) {
            await executeWithRetry(() =>
              db.insert(feedingRecords).values({
                penId: dbPenId.toString(),
                feedingDate: record.feedingTime.split('T')[0],
                feedType: record.actualIngredients[0]?.category || 'Mixed Feed',
                amount: parseFloat(record.plannedAmount) || 0,
                unit: 'lbs',
                ingredients: record.actualIngredients,
                fedBy: record.operatorEmail,
                notes: '',
                operatorEmail: record.operatorEmail
              })
            );
            totalFeedingRecords++;
          }
        }
      }

      // Migrate treatment records
      progress('TREATMENTS', `Migrating treatment records for operation: ${operation.name}`);
      const treatmentsData = await inMemoryProvider.getTreatmentsByOperatorEmail(operation.operatorEmail);
      
      for (const treatment of treatmentsData) {
        const dbPenId = penIdMapping[treatment.penId];
        if (dbPenId) {
          // Check if treatment already exists
          const existingTreatment = await db.select()
            .from(treatmentRecords)
            .where(eq(treatmentRecords.penId, dbPenId.toString()))
            .where(eq(treatmentRecords.treatmentDate, treatment.treatmentDate));

          if (existingTreatment.length === 0) {
            await executeWithRetry(() =>
              db.insert(treatmentRecords).values({
                penId: dbPenId.toString(),
                treatmentDate: treatment.treatmentDate,
                treatmentType: treatment.treatmentType,
                product: treatment.product,
                dosage: treatment.dosage,
                cattleCount: treatment.cattleCount,
                tagNumbers: treatment.tagNumbers || '',
                treatedBy: treatment.treatedBy,
                notes: treatment.notes || '',
                operatorEmail: treatment.operatorEmail
              })
            );
            totalTreatments++;
          }
        }
      }

      // Migrate death loss records
      progress('DEATHS', `Migrating death loss records for operation: ${operation.name}`);
      const deathLossData = await inMemoryProvider.getDeathLossByOperatorEmail(operation.operatorEmail);
      
      for (const deathLoss of deathLossData) {
        const dbPenId = penIdMapping[deathLoss.penId];
        if (dbPenId) {
          // Check if death loss already exists
          const existingDeathLoss = await db.select()
            .from(deathLosses)
            .where(eq(deathLosses.penId, dbPenId.toString()))
            .where(eq(deathLosses.lossDate, deathLoss.lossDate));

          if (existingDeathLoss.length === 0) {
            await executeWithRetry(() =>
              db.insert(deathLosses).values({
                penId: dbPenId.toString(),
                lossDate: deathLoss.lossDate,
                reason: deathLoss.reason,
                cattleCount: deathLoss.cattleCount,
                estimatedWeight: deathLoss.estimatedWeight,
                tagNumbers: deathLoss.tagNumbers || '',
                notes: deathLoss.notes || '',
                operatorEmail: deathLoss.operatorEmail
              })
            );
            totalDeathLosses++;
          }
        }
      }
    }

    progress('COMPLETE', 'Migration completed successfully!');
    
    console.log('\n📊 Migration Summary:');
    console.log(`   Operations: ${totalOperations}`);
    console.log(`   Pens: ${totalPens}`);
    console.log(`   Feeding Records: ${totalFeedingRecords}`);
    console.log(`   Treatments: ${totalTreatments}`);
    console.log(`   Death Losses: ${totalDeathLosses}`);
    console.log(`   Staff Members: ${totalStaffMembers}`);

    return {
      success: true,
      operations: totalOperations,
      pens: totalPens,
      feedingRecords: totalFeedingRecords,
      treatments: totalTreatments,
      deathLosses: totalDeathLosses,
      staffMembers: totalStaffMembers
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    progress('ERROR', `Migration failed: ${errorMessage}`);
    console.error('Migration error:', error);
    
    return {
      success: false,
      operations: 0,
      pens: 0,
      feedingRecords: 0,
      treatments: 0,
      deathLosses: 0,
      staffMembers: 0,
      error: errorMessage
    };
  }
}

/**
 * Verify migration integrity by comparing data counts
 */
export async function verifyMigration(): Promise<{
  success: boolean;
  details: Record<string, { inMemory: number; postgresql: number; match: boolean }>;
  error?: string;
}> {
  try {
    console.log('Verifying migration integrity...');
    
    const inMemoryProvider = new InMemoryStorageProvider();
    const db = getDb();
    
    // Get all operations to check against
    const inMemoryOps = await inMemoryProvider.getAllOperations();
    
    const details: Record<string, { inMemory: number; postgresql: number; match: boolean }> = {};
    
    // Check operations
    const pgOperations = await db.select().from(operations);
    details.operations = {
      inMemory: inMemoryOps.length,
      postgresql: pgOperations.length,
      match: inMemoryOps.length === pgOperations.length
    };
    
    // Check pens (aggregate across all operations)
    let totalInMemoryPens = 0;
    for (const op of inMemoryOps) {
      const pens = await inMemoryProvider.getPensByOperatorEmail(op.operatorEmail);
      totalInMemoryPens += pens.length;
    }
    
    const pgPens = await db.select().from(pens);
    details.pens = {
      inMemory: totalInMemoryPens,
      postgresql: pgPens.length,
      match: totalInMemoryPens === pgPens.length
    };
    
    // Check feeding records
    let totalInMemoryFeeding = 0;
    for (const op of inMemoryOps) {
      const records = await inMemoryProvider.getFeedingRecordsByOperatorEmail(op.operatorEmail);
      totalInMemoryFeeding += records.length;
    }
    
    const pgFeeding = await db.select().from(feedingRecords);
    details.feedingRecords = {
      inMemory: totalInMemoryFeeding,
      postgresql: pgFeeding.length,
      match: totalInMemoryFeeding === pgFeeding.length
    };
    
    console.log('Migration verification results:');
    console.log('Operations:', details.operations);
    console.log('Pens:', details.pens);
    console.log('Feeding Records:', details.feedingRecords);
    
    const allMatch = Object.values(details).every(item => item.match);
    
    return {
      success: allMatch,
      details
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Verification error:', error);
    
    return {
      success: false,
      details: {},
      error: errorMessage
    };
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'verify') {
    // Verification mode
    verifyMigration()
      .then((result) => {
        if (result.success) {
          console.log('✅ Migration verification passed');
          process.exit(0);
        } else {
          console.error('❌ Migration verification failed:', result.error || 'Data mismatch detected');
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error('❌ Migration verification failed:', error);
        process.exit(1);
      })
      .finally(() => {
        closeConnection().catch(console.error);
      });
  } else {
    // Migration mode
    migrateFromInMemory((progress) => {
      console.log(`📈 ${progress.stage}: ${progress.message}`);
      if (progress.progress && progress.total) {
        console.log(`   Progress: ${progress.progress}/${progress.total}`);
      }
    })
      .then((result) => {
        if (result.success) {
          console.log('✅ Migration completed successfully');
          process.exit(0);
        } else {
          console.error('❌ Migration failed:', result.error);
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
      })
      .finally(() => {
        closeConnection().catch(console.error);
      });
  }
}