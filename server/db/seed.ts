import dotenv from 'dotenv';
import { getDb, closeConnection, executeWithRetry } from './connection';
import { operations, pens, feedingRecords, treatmentRecords, deathLosses, staffMembers, penFeedingPrograms, nutritionistTasks } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// Load environment variables
dotenv.config();

export interface SeedData {
  operation: {
    name: string;
    operatorEmail: string;
    firstName: string;
    lastName: string;
    location: string;
    inviteCode: string;
  };
  staffMember: {
    operationId: number;
    email: string;
    firstName: string;
    lastName: string;
    role: 'owner' | 'staff';
    status: 'invited' | 'active';
    invitedBy: string;
  };
  pens: Array<{
    id: string;
    name: string;
    operatorEmail: string;
    capacity: number;
    current: number;
    status: 'Active' | 'Maintenance' | 'Inactive';
    feedType: string;
    lastFed: Date | null;
    cattleType: 'Steers' | 'Heifers' | 'Mixed';
    startingWeight: number;
    currentWeight: number;
    marketWeight: number;
    averageDailyGain: number;
    isCrossbred: boolean;
    daysOnFeed: number;
    feedConversion: number;
    projectedCloseoutDate: string;
    estimatedValue: number;
    nutritionistId?: string;
  }>;
  feedingRecords: Array<{
    penId: string;
    feedingDate: string;
    feedType: string;
    amount: number;
    unit: string;
    ingredients: any;
    fedBy: string;
    notes: string;
    operatorEmail: string;
  }>;
  treatments: Array<{
    penId: string;
    treatmentDate: string;
    treatmentType: string;
    product: string;
    dosage: string;
    cattleCount: number;
    tagNumbers: string;
    treatedBy: string;
    notes: string;
    operatorEmail: string;
  }>;
  deathLosses: Array<{
    penId: string;
    lossDate: string;
    reason: string;
    cattleCount: number;
    estimatedWeight: number;
    tagNumbers: string;
    notes: string;
    operatorEmail: string;
  }>;
  penFeedingPrograms: Array<{
    id: string;
    penId: number;
    templateId: string;
    createdByUserId: number;
    status: 'draft' | 'active' | 'completed' | 'paused';
    startDate: string;
    endDate: string;
    programName: string;
    totalCostPerTon: number;
    proteinContent: number;
    energyContent: number;
    estimatedDailyGain: number;
    feedingTimes: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface SeedResult {
  success: boolean;
  operation?: any;
  staffMember?: any;
  pens?: any[];
  feedingRecords?: any[];
  treatments?: any[];
  deathLosses?: any[];
  penFeedingPrograms?: any[];
  error?: string;
}

/**
 * Generate seed data with sample operation and records
 */
export function generateSeedData(): SeedData {
  const operatorEmail = 'demo@demoranch.com';
  const currentDate = new Date();
  
  // Generate unique pen IDs
  const penIds = [
    `pen_${Math.random().toString(36).substr(2, 9)}_1`,
    `pen_${Math.random().toString(36).substr(2, 9)}_2`,
    `pen_${Math.random().toString(36).substr(2, 9)}_3`
  ];

  // Nutritionist ID (same for all pens for simplicity)
  const nutritionistId = 'dr_nutritionist_001';

  // Sample operation data
  const operation = {
    name: 'Demo Ranch',
    operatorEmail: operatorEmail,
    firstName: 'John',
    lastName: 'Demo',
    location: 'Texas, USA',
    inviteCode: `DEMO-${Math.floor(Math.random() * 9000) + 1000}`
  };

  // Staff member data
  const staffMember = {
    operationId: 1, // Will be updated after operation is created
    email: 'manager@demoranch.com',
    firstName: 'Sarah',
    lastName: 'Johnson',
    role: 'staff' as const,
    status: 'active' as const,
    invitedBy: operatorEmail
  };

  // Three pens with different configurations
  const pens = [
    // Pen 1: Premium Angus Steers
    {
      id: penIds[0],
      name: 'North Pen A',
      operatorEmail: operatorEmail,
      capacity: 150,
      current: 125,
      status: 'Active' as const,
      feedType: 'High Energy Corn-Based',
      lastFed: new Date(currentDate.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      cattleType: 'Steers' as const,
      startingWeight: 850,
      currentWeight: 1150,
      marketWeight: 1400,
      averageDailyGain: 3.2,
      isCrossbred: false,
      daysOnFeed: 95,
      feedConversion: 6.8,
      projectedCloseoutDate: new Date(currentDate.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedValue: 175000,
      nutritionistId: nutritionistId
    },
    // Pen 2: Commercial Heifers  
    {
      id: penIds[1],
      name: 'South Pen B',
      operatorEmail: operatorEmail,
      capacity: 120,
      current: 110,
      status: 'Active' as const,
      feedType: 'Moderate Energy Mixed Ration',
      lastFed: new Date(currentDate.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
      cattleType: 'Heifers' as const,
      startingWeight: 750,
      currentWeight: 950,
      marketWeight: 1200,
      averageDailyGain: 2.8,
      isCrossbred: true,
      daysOnFeed: 72,
      feedConversion: 7.2,
      projectedCloseoutDate: new Date(currentDate.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedValue: 132000,
      nutritionistId: nutritionistId
    },
    // Pen 3: Mixed Group - Custom Finishing Program
    {
      id: penIds[2],
      name: 'East Pen C',
      operatorEmail: operatorEmail,
      capacity: 100,
      current: 85,
      status: 'Active' as const,
      feedType: 'Custom Finishing Ration',
      lastFed: new Date(currentDate.getTime() - 6 * 60 * 60 * 1000), // 6 hours ago
      cattleType: 'Mixed' as const,
      startingWeight: 700,
      currentWeight: 1050,
      marketWeight: 1350,
      averageDailyGain: 2.9,
      isCrossbred: true,
      daysOnFeed: 120,
      feedConversion: 7.5,
      projectedCloseoutDate: new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedValue: 114750,
      nutritionistId: nutritionistId
    }
  ];

  // Generate 30 days of feeding records for each pen
  const feedingRecords = [];
  for (let day = 0; day < 30; day++) {
    const feedingDate = new Date(currentDate.getTime() - day * 24 * 60 * 60 * 1000);
    const dateString = feedingDate.toISOString().split('T')[0];
    
    for (const pen of pens) {
      const ingredients = pen.feedType === 'High Energy Corn-Based' 
        ? [
            { name: 'Corn', amount: '3060', unit: 'lbs', percentage: '70%' },
            { name: 'Soybean Meal', amount: '525', unit: 'lbs', percentage: '12%' },
            { name: 'Hay', amount: '395', unit: 'lbs', percentage: '9%' },
            { name: 'Mineral Mix', amount: '130', unit: 'lbs', percentage: '3%' },
            { name: 'Fat Supplement', amount: '265', unit: 'lbs', percentage: '6%' }
          ]
        : pen.feedType === 'Moderate Energy Mixed Ration'
        ? [
            { name: 'Corn', amount: '1925', unit: 'lbs', percentage: '50%' },
            { name: 'Barley', amount: '965', unit: 'lbs', percentage: '25%' },
            { name: 'Alfalfa Hay', amount: '730', unit: 'lbs', percentage: '19%' },
            { name: 'Protein Supplement', amount: '155', unit: 'lbs', percentage: '4%' },
            { name: 'Minerals', amount: '75', unit: 'lbs', percentage: '2%' }
          ]
        : [
            { name: 'Steam Flaked Corn', amount: '1785', unit: 'lbs', percentage: '60%' },
            { name: 'Cottonseed Hulls', amount: '595', unit: 'lbs', percentage: '20%' },
            { name: 'Distillers Grains', amount: '385', unit: 'lbs', percentage: '13%' },
            { name: 'Liquid Supplement', amount: '150', unit: 'lbs', percentage: '5%' },
            { name: 'Urea', amount: '60', unit: 'lbs', percentage: '2%' }
          ];

      feedingRecords.push({
        penId: pen.id,
        feedingDate: dateString,
        feedType: pen.feedType,
        amount: pen.feedType === 'High Energy Corn-Based' ? 4375 : pen.feedType === 'Moderate Energy Mixed Ration' ? 3850 : 2975,
        unit: 'lbs',
        ingredients: ingredients,
        fedBy: day % 3 === 0 ? 'Sarah Johnson' : day % 3 === 1 ? 'Mike Rodriguez' : 'Tom Anderson',
        notes: day % 7 === 0 ? 'Weekly weight check scheduled' : day % 14 === 0 ? 'Pen cleaning completed' : '',
        operatorEmail: operatorEmail
      });
    }
  }

  // Sample treatment records
  const treatments = [
    {
      penId: penIds[0],
      treatmentDate: new Date(currentDate.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      treatmentType: 'Vaccination',
      product: 'BOVI-SHIELD Gold FP5 L5',
      dosage: '2ml SubQ',
      cattleCount: 125,
      tagNumbers: 'All animals',
      treatedBy: 'Dr. James Wilson',
      notes: 'Annual vaccination program - all animals responded well',
      operatorEmail: operatorEmail
    },
    {
      penId: penIds[1],
      treatmentDate: new Date(currentDate.getTime() - 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      treatmentType: 'Antibiotic',
      product: 'Draxxin',
      dosage: '1.25ml/45kg IM',
      cattleCount: 3,
      tagNumbers: '1847, 1923, 2001',
      treatedBy: 'Sarah Johnson',
      notes: 'Treatment for respiratory symptoms - animals improving',
      operatorEmail: operatorEmail
    },
    {
      penId: penIds[0],
      treatmentDate: new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      treatmentType: 'Parasiticide',
      product: 'Cydectin Pour-On',
      dosage: '1ml/10kg topical',
      cattleCount: 125,
      tagNumbers: 'All animals',
      treatedBy: 'Mike Rodriguez',
      notes: 'Routine parasite control treatment',
      operatorEmail: operatorEmail
    },
    {
      penId: penIds[2],
      treatmentDate: new Date(currentDate.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      treatmentType: 'Anti-inflammatory',
      product: 'Banamine',
      dosage: '2.2mg/kg IM',
      cattleCount: 1,
      tagNumbers: '2156',
      treatedBy: 'Dr. James Wilson',
      notes: 'Treatment for lameness - animal responding well',
      operatorEmail: operatorEmail
    },
    {
      penId: penIds[1],
      treatmentDate: new Date(currentDate.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      treatmentType: 'Mineral Supplement',
      product: 'Injectable Vitamin E/Selenium',
      dosage: '1ml/45kg IM',
      cattleCount: 5,
      tagNumbers: '1756, 1834, 1899, 1945, 1998',
      treatedBy: 'Tom Anderson',
      notes: 'Supplementation for animals showing deficiency symptoms',
      operatorEmail: operatorEmail
    },
    {
      penId: penIds[2],
      treatmentDate: new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      treatmentType: 'Vaccination',
      product: 'Clostridial 7-Way',
      dosage: '2ml SubQ',
      cattleCount: 85,
      tagNumbers: 'All animals',
      treatedBy: 'Sarah Johnson',
      notes: 'Booster vaccination for newly arrived animals',
      operatorEmail: operatorEmail
    }
  ];

  // Sample death loss records
  const deathLosses = [
    {
      penId: penIds[1],
      lossDate: new Date(currentDate.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      reason: 'Respiratory illness',
      cattleCount: 1,
      estimatedWeight: 920,
      tagNumbers: '1678',
      notes: 'Animal found down in morning, appeared to have been sick overnight. Vet consulted, likely pneumonia.',
      operatorEmail: operatorEmail
    },
    {
      penId: penIds[0],
      lossDate: new Date(currentDate.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      reason: 'Injury',
      cattleCount: 1,
      estimatedWeight: 1180,
      tagNumbers: '0945',
      notes: 'Animal injured during loading, despite treatment efforts could not be saved.',
      operatorEmail: operatorEmail
    }
  ];

  // NOTE: Deprecated feeding plans and nutritionist data removed
  // as part of feeding program designer migration

  return {
    operation,
    staffMember,
    pens,
    feedingRecords,
    treatments,
    deathLosses,
    penFeedingPrograms: []  // Empty array for now to avoid seed complexity
  };
}

/**
 * Clear all seeded data from the database
 */
export async function clearDatabase(): Promise<void> {
  try {
    const db = getDb();
    
    console.log('Clearing database...');
    
    // Clear in reverse dependency order to avoid foreign key constraint issues
    await executeWithRetry(() => db.delete(feedingRecords));
    await executeWithRetry(() => db.delete(treatmentRecords));
    await executeWithRetry(() => db.delete(deathLosses));
    // NOTE: Skip penFeedingPrograms and nutritionistTasks if tables don't exist
    // These are part of the new feeding program system that may not be fully deployed
    await executeWithRetry(() => db.delete(staffMembers));
    await executeWithRetry(() => db.delete(pens));
    await executeWithRetry(() => db.delete(operations));
    
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
}

/**
 * Seed the database with sample data
 */
export async function seedDatabase(): Promise<SeedResult> {
  try {
    console.log('Starting database seeding...');
    
    const db = getDb();
    const seedData = generateSeedData();
    
    // Check if operation already exists (idempotent seeding)
    const existingOperation = await db.select().from(operations).where(eq(operations.operatorEmail, seedData.operation.operatorEmail));
    
    if (existingOperation.length > 0) {
      console.log('Demo operation already exists, skipping seeding');
      return {
        success: true,
        operation: existingOperation[0],
        pens: [],
        feedingRecords: [],
        treatments: [],
        deathLosses: [],
        feedingPlans: []
      };
    }
    
    // Insert operation
    console.log('Creating demo operation...');
    const [createdOperation] = await executeWithRetry(() => 
      db.insert(operations).values(seedData.operation).returning()
    );
    
    // Update staff member with correct operation ID
    seedData.staffMember.operationId = createdOperation.id;
    
    // Insert staff member
    console.log('Creating staff member...');
    const [createdStaffMember] = await executeWithRetry(() =>
      db.insert(staffMembers).values(seedData.staffMember).returning()
    );

    // NOTE: Nutritionist creation removed as part of feeding program migration
    
    // Insert pens
    console.log('Creating demo pens...');
    const pensForDb = seedData.pens.map(pen => ({
      name: pen.name,
      operatorEmail: pen.operatorEmail,
      capacity: pen.capacity,
      current: pen.current,
      status: pen.status,
      feedType: pen.feedType,
      lastFed: pen.lastFed,
      cattleType: pen.cattleType,
      startingWeight: pen.startingWeight,
      currentWeight: pen.currentWeight,
      marketWeight: pen.marketWeight,
      averageDailyGain: pen.averageDailyGain,
      isCrossbred: pen.isCrossbred,
      daysOnFeed: pen.daysOnFeed,
      feedConversion: pen.feedConversion,
      projectedCloseoutDate: pen.projectedCloseoutDate,
      estimatedValue: pen.estimatedValue,
      nutritionistId: null // No nutritionist assignment for now
    }));
    
    // NOTE: Using the same approach as PostgreSQLStorageProvider.createPen
    // Only insert the fields that are known to work in the current database
    const createdPensPromises = pensForDb.map(async (pen) => {
      return executeWithRetry(() => 
        db.insert(pens).values({
          name: pen.name,
          operationId: createdOperation.id,
          capacity: pen.capacity,
          current: pen.current,
          cattleType: pen.cattleType,
          startingWeight: pen.startingWeight,
          currentWeight: pen.currentWeight,
          marketWeight: pen.marketWeight,
          feedType: pen.feedType,
          isCrossbred: pen.isCrossbred || false,
          status: pen.status,
          averageDailyGain: pen.averageDailyGain,
          daysOnFeed: pen.daysOnFeed,
          feedConversion: pen.feedConversion,
          projectedCloseoutDate: pen.projectedCloseoutDate,
          estimatedValue: pen.estimatedValue
        } as any).returning()
      );
    });
    
    const createdPensResults = await Promise.all(createdPensPromises);
    const createdPens = createdPensResults.map(result => result[0]);
    
    // Create mapping from seed pen IDs to actual pen IDs
    const penIdMapping: Record<string, string> = {};
    seedData.pens.forEach((seedPen, index) => {
      penIdMapping[seedPen.id] = createdPens[index].id.toString();
    });
    
    // Insert feeding records
    console.log('Creating feeding records...');
    const feedingRecordsForDb = seedData.feedingRecords.map((record, index) => ({
      penId: penIdMapping[record.penId],
      scheduleId: `seed-schedule-${index}`, // Generate unique schedule IDs for seed data
      plannedAmount: record.amount.toString(), // Use amount as planned amount
      feedingTime: new Date(record.feedingDate + 'T08:00:00.000Z'), // Convert date to timestamp
      feedingDate: record.feedingDate,
      feedType: record.feedType,
      amount: record.amount,
      unit: record.unit,
      ingredients: record.ingredients,
      fedBy: record.fedBy,
      notes: record.notes,
      operatorEmail: record.operatorEmail
    }));
    
    const createdFeedingRecords = await executeWithRetry(() =>
      db.insert(feedingRecords).values(feedingRecordsForDb).returning()
    );
    
    // Insert treatment records
    console.log('Creating treatment records...');
    const treatmentsForDb = seedData.treatments.map(treatment => ({
      penId: penIdMapping[treatment.penId],
      treatmentDate: treatment.treatmentDate,
      treatmentType: treatment.treatmentType,
      product: treatment.product,
      dosage: treatment.dosage,
      cattleCount: treatment.cattleCount,
      tagNumbers: treatment.tagNumbers,
      treatedBy: treatment.treatedBy,
      notes: treatment.notes,
      operatorEmail: treatment.operatorEmail
    }));
    
    const createdTreatments = await executeWithRetry(() =>
      db.insert(treatmentRecords).values(treatmentsForDb).returning()
    );
    
    // Insert death loss records
    console.log('Creating death loss records...');
    const deathLossesForDb = seedData.deathLosses.map(deathLoss => ({
      penId: penIdMapping[deathLoss.penId],
      lossDate: deathLoss.lossDate,
      reason: deathLoss.reason,
      cattleCount: deathLoss.cattleCount,
      estimatedWeight: deathLoss.estimatedWeight,
      tagNumbers: deathLoss.tagNumbers,
      notes: deathLoss.notes,
      operatorEmail: deathLoss.operatorEmail
    }));
    
    const createdDeathLosses = await executeWithRetry(() =>
      db.insert(deathLosses).values(deathLossesForDb).returning()
    );
    
    // NOTE: Feeding plans insertion removed as part of migration to pen feeding programs
    
    console.log('Database seeding completed successfully!');
    console.log(`Created: ${createdPens.length} pens, ${createdFeedingRecords.length} feeding records, ${createdTreatments.length} treatments, ${createdDeathLosses.length} death loss records`);

    return {
      success: true,
      operation: createdOperation,
      staffMember: createdStaffMember,
      pens: createdPens,
      feedingRecords: createdFeedingRecords,
      treatments: createdTreatments,
      deathLosses: createdDeathLosses,
      penFeedingPrograms: []  // Empty for now
    };
    
  } catch (error) {
    console.error('Error seeding database:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then((result) => {
      if (result.success) {
        console.log('✅ Database seeding completed successfully');
        process.exit(0);
      } else {
        console.error('❌ Database seeding failed:', result.error);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Database seeding failed:', error);
      process.exit(1);
    })
    .finally(() => {
      closeConnection().catch(console.error);
    });
}