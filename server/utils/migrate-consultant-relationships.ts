/**
 * Migration script to populate operationId in consultant_producer_relationships table
 * 
 * This script updates existing consultant producer relationships that were created
 * before the operationId field was properly populated during invitation acceptance.
 * 
 * Run this script once to ensure all relationships have the correct operationId.
 */

import { getDb } from '../db/connection';
import { consultantProducerRelationships, operations } from '@shared/schema';
import { eq, isNull, and } from 'drizzle-orm';

export async function migrateConsultantRelationships() {
  const db = getDb();
  
  console.log('Starting migration of consultant producer relationships...');
  
  try {
    // Find all relationships that have null operationId
    const relationshipsToUpdate = await db
      .select({
        id: consultantProducerRelationships.id,
        producerId: consultantProducerRelationships.producerId,
        consultantId: consultantProducerRelationships.consultantId,
        operationId: consultantProducerRelationships.operationId,
      })
      .from(consultantProducerRelationships)
      .where(isNull(consultantProducerRelationships.operationId));

    console.log(`Found ${relationshipsToUpdate.length} relationships without operationId`);

    if (relationshipsToUpdate.length === 0) {
      console.log('No relationships need updating. Migration complete.');
      return { updated: 0, skipped: 0 };
    }

    let updated = 0;
    let skipped = 0;

    // Process each relationship
    for (const relationship of relationshipsToUpdate) {
      try {
        // Find the operation for this producer
        const [operation] = await db
          .select({ id: operations.id })
          .from(operations)
          .where(eq(operations.userId, relationship.producerId))
          .limit(1);

        if (operation) {
          // Update the relationship with the operationId
          await db
            .update(consultantProducerRelationships)
            .set({ operationId: operation.id })
            .where(eq(consultantProducerRelationships.id, relationship.id));
          
          console.log(`Updated relationship ${relationship.id} with operationId ${operation.id}`);
          updated++;
        } else {
          console.warn(`No operation found for producer ${relationship.producerId}, skipping relationship ${relationship.id}`);
          skipped++;
        }
      } catch (error) {
        console.error(`Error updating relationship ${relationship.id}:`, error);
        skipped++;
      }
    }

    console.log(`Migration complete. Updated: ${updated}, Skipped: ${skipped}`);
    return { updated, skipped };

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// If this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateConsultantRelationships()
    .then((result) => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}