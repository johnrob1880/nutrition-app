import { getDb, closeConnection } from './connection';
import { sql } from 'drizzle-orm';

/**
 * Migration script to drop deprecated tables after feeding program designer implementation
 *
 * This script safely removes:
 * - feeding_plans table (replaced by pen_feeding_programs)
 * - nutritionists table (replaced by users + consultant_profiles)
 *
 * Run this after verifying all data has been migrated to the new system.
 */

async function dropDeprecatedTables() {
  const db = getDb();

  try {
    console.log('🗑️  Starting deprecated table cleanup...');

    // Check if tables exist before attempting to drop them
    const checkFeedingPlans = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'feeding_plans'
      );
    `);

    const checkNutritionists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'nutritionists'
      );
    `);

    const feedingPlansExists = checkFeedingPlans[0]?.exists;
    const nutritionistsExists = checkNutritionists[0]?.exists;

    console.log(`📋 Table status:`);
    console.log(`   - feeding_plans: ${feedingPlansExists ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`   - nutritionists: ${nutritionistsExists ? 'EXISTS' : 'NOT FOUND'}`);

    // Verify tables are empty before dropping (safety check)
    if (feedingPlansExists) {
      const feedingPlansCount = await db.execute(sql`SELECT COUNT(*) FROM feeding_plans`);
      const count = Number(feedingPlansCount[0]?.count || 0);

      if (count > 0) {
        console.log(`⚠️  WARNING: feeding_plans table contains ${count} records!`);
        console.log('   Please migrate data before dropping the table.');
        console.log('   Aborting migration.');
        return false;
      }
      console.log(`✅ feeding_plans table is empty (safe to drop)`);
    }

    if (nutritionistsExists) {
      const nutritionistsCount = await db.execute(sql`SELECT COUNT(*) FROM nutritionists`);
      const count = Number(nutritionistsCount[0]?.count || 0);

      if (count > 0) {
        console.log(`⚠️  WARNING: nutritionists table contains ${count} records!`);
        console.log('   Please migrate data before dropping the table.');
        console.log('   Aborting migration.');
        return false;
      }
      console.log(`✅ nutritionists table is empty (safe to drop)`);
    }

    // Drop tables in the correct order (feeding_plans first due to potential dependencies)
    if (feedingPlansExists) {
      console.log('🗑️  Dropping feeding_plans table...');
      await db.execute(sql`DROP TABLE feeding_plans CASCADE`);
      console.log('✅ feeding_plans table dropped successfully');
    }

    if (nutritionistsExists) {
      console.log('🗑️  Dropping nutritionists table...');
      await db.execute(sql`DROP TABLE nutritionists CASCADE`);
      console.log('✅ nutritionists table dropped successfully');
    }

    // Verify tables were dropped
    const verifyFeedingPlans = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'feeding_plans'
      );
    `);

    const verifyNutritionists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'nutritionists'
      );
    `);

    if (!verifyFeedingPlans[0]?.exists && !verifyNutritionists[0]?.exists) {
      console.log('🎉 All deprecated tables have been successfully removed!');
      return true;
    } else {
      console.log('❌ Some tables were not properly dropped');
      return false;
    }

  } catch (error) {
    console.error('❌ Error during deprecated table cleanup:', error);
    return false;
  }
}

// Main execution function
async function main() {
  try {
    const success = await dropDeprecatedTables();

    if (success) {
      console.log('\n✅ Deprecated table cleanup completed successfully!');
      console.log('📝 Next steps:');
      console.log('   1. Remove deprecated API endpoints');
      console.log('   2. Remove deprecated type definitions');
      console.log('   3. Clean up unused imports');
      console.log('   4. Run full test suite');
    } else {
      console.log('\n❌ Deprecated table cleanup failed or was aborted');
      console.log('   Please check the logs above for details');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { dropDeprecatedTables };