import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PostgreSQLStorageProvider } from './PostgreSQLStorageProvider';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { operations, staffMembers, pens, feedingRecords, deathLosses, treatmentRecords, weightRecords, cattleSales, feedingPlans, staffInvitations } from '../db/schema';
import type { InsertOperation, CreatePenRequest, InsertFeedingRecord, InsertDeathLoss, InsertTreatmentRecord } from '@shared/schema';

// Load test environment variables
config({ path: '.env.test' });

// Skip these tests if not in PostgreSQL mode
const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('PostgreSQLStorageProvider', () => {
  let provider: PostgreSQLStorageProvider;
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    // Ensure database is accessible
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    
    provider = new PostgreSQLStorageProvider();
    db = getDb();
    
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeConnection();
  });

  beforeEach(async () => {
    // Clean data before each test for isolation
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Delete in reverse order of foreign key dependencies
    // First delete all child tables that reference pens
    await db.delete(treatmentRecords).execute();
    await db.delete(deathLosses).execute();
    await db.delete(feedingRecords).execute();
    await db.delete(weightRecords).execute();
    await db.delete(cattleSales).execute();
    await db.delete(feedingPlans).execute();
    
    // Then delete tables that reference operations
    await db.delete(staffInvitations).execute();
    await db.delete(staffMembers).execute();
    
    // Finally delete parent tables
    await db.delete(pens).execute();
    await db.delete(operations).execute();
  }

  describe('Operation Management', () => {
    it('should create and retrieve operations', async () => {
      const operationData: InsertOperation = {
        name: 'Test Ranch',
        operatorEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        location: 'Test Location',
        inviteCode: 'TEST123'
      };

      const created = await provider.createOperation(operationData);
      
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Test Ranch');
      expect(created.operatorEmail).toBe('test@example.com');

      const retrieved = await provider.getOperation(created.id);
      expect(retrieved).toEqual(created);

      const retrievedByEmail = await provider.getOperationByEmail('test@example.com');
      expect(retrievedByEmail).toEqual(created);
    });

    it('should update operations', async () => {
      const operationData: InsertOperation = {
        name: 'Test Ranch',
        operatorEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        location: 'Test Location',
        inviteCode: 'TEST123'
      };

      const created = await provider.createOperation(operationData);
      const updated = await provider.updateOperation(created.id, { name: 'Updated Ranch' });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Ranch');
      expect(updated?.operatorEmail).toBe('test@example.com');
    });

    it('should handle non-existent operations gracefully', async () => {
      const result = await provider.getOperation(99999);
      expect(result).toBeUndefined();

      const resultByEmail = await provider.getOperationByEmail('nonexistent@example.com');
      expect(resultByEmail).toBeUndefined();
    });
  });

  describe('Pen Management', () => {
    it('should create and retrieve pens', async () => {
      const penData: CreatePenRequest = {
        name: 'Test Pen',
        operatorEmail: 'test@example.com',
        capacity: 100,
        current: 50,
        cattleType: 'Steers',
        startingWeight: 650,
        marketWeight: 1200,
        feedType: 'High Energy',
        isCrossbred: false
      };

      const created = await provider.createPen(penData);
      
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Test Pen');
      expect(created.capacity).toBe(100);

      const pens = await provider.getPensByOperatorEmail('test@example.com');
      expect(pens).toHaveLength(1);
      expect(pens[0].name).toBe('Test Pen');
    });

    it('should update pen weights', async () => {
      const penData: CreatePenRequest = {
        name: 'Test Pen',
        operatorEmail: 'test@example.com',
        capacity: 100,
        current: 50,
        cattleType: 'Steers',
        startingWeight: 650,
        marketWeight: 1200,
        feedType: 'High Energy',
        isCrossbred: false
      };

      const created = await provider.createPen(penData);
      
      const updated = await provider.updatePenWeight({
        penId: created.id,
        currentWeight: 750,
        operatorEmail: 'test@example.com'
      });

      expect(updated).toBeDefined();
      expect(updated?.currentWeight).toBe(750);
    });
  });

  describe('Health Tracking', () => {
    it('should record and retrieve death losses', async () => {
      const deathLossData: InsertDeathLoss = {
        penId: '1',
        lossDate: '2025-09-05',
        reason: 'Disease',
        cattleCount: 2,
        estimatedWeight: 800,
        tagNumbers: '001, 002',
        notes: 'Test death loss',
        operatorEmail: 'test@example.com'
      };

      const recorded = await provider.recordDeathLoss(deathLossData);
      
      expect(recorded).toBeDefined();
      expect(recorded.id).toBeDefined();
      expect(recorded.reason).toBe('Disease');
      expect(recorded.cattleCount).toBe(2);

      const losses = await provider.getDeathLossByOperatorEmail('test@example.com');
      expect(losses).toHaveLength(1);
      expect(losses[0].reason).toBe('Disease');
    });

    it('should record and retrieve treatments', async () => {
      const treatmentData: InsertTreatmentRecord = {
        penId: '1',
        treatmentDate: '2025-09-05',
        treatmentType: 'Vaccination',
        product: 'Vaccine X',
        dosage: '2ml',
        cattleCount: 10,
        tagNumbers: '001-010',
        treatedBy: 'Dr. Smith',
        notes: 'Annual vaccination',
        operatorEmail: 'test@example.com'
      };

      const recorded = await provider.recordTreatment(treatmentData);
      
      expect(recorded).toBeDefined();
      expect(recorded.id).toBeDefined();
      expect(recorded.treatmentType).toBe('Vaccination');
      expect(recorded.product).toBe('Vaccine X');

      const treatments = await provider.getTreatmentsByOperatorEmail('test@example.com');
      expect(treatments).toHaveLength(1);
      expect(treatments[0].treatmentType).toBe('Vaccination');
    });
  });

  describe('Feeding Management', () => {
    it('should create and retrieve feeding records', async () => {
      const feedingData: InsertFeedingRecord = {
        penId: '1',
        feedingDate: '2025-09-05',
        feedType: 'High Energy',
        amount: 500,
        unit: 'lbs',
        ingredients: [
          { name: 'Corn', percentage: 65, cost: 0.25, protein: 8.5, energy: 88 }
        ],
        fedBy: 'John Doe',
        notes: 'Morning feeding',
        operatorEmail: 'test@example.com'
      };

      const created = await provider.createFeedingRecord(feedingData);
      
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.feedType).toBe('High Energy');
      expect(created.amount).toBe(500);

      const records = await provider.getFeedingRecordsByOperatorEmail('test@example.com');
      expect(records).toHaveLength(1);
      expect(records[0].feedType).toBe('High Energy');
    });
  });

  describe('Staff Management', () => {
    it('should handle staff invitations', async () => {
      // First create an operation
      const operationData: InsertOperation = {
        name: 'Test Ranch',
        operatorEmail: 'owner@example.com',
        firstName: 'Owner',
        lastName: 'User',
        location: 'Test Location',
        inviteCode: 'TEST123'
      };
      const operation = await provider.createOperation(operationData);

      // Create staff invitation
      const invitation = await provider.inviteStaffMember({
        operationId: operation.id,
        email: 'staff@example.com',
        firstName: 'Staff',
        lastName: 'Member',
        invitedBy: 'owner@example.com'
      });

      expect(invitation).toBeDefined();
      expect(invitation.token).toBeDefined();
      expect(invitation.email).toBe('staff@example.com');

      // Accept invitation
      const staffMember = await provider.acceptStaffInvitation(invitation.token);
      
      expect(staffMember).toBeDefined();
      expect(staffMember?.email).toBe('staff@example.com');
      expect(staffMember?.status).toBe('active');

      // Verify staff member was created
      const retrieved = await provider.getStaffMemberByEmail('staff@example.com');
      expect(retrieved).toBeDefined();
      expect(retrieved?.firstName).toBe('Staff');
    });

    it('should retrieve user roles', async () => {
      // Create operation and staff
      const operationData: InsertOperation = {
        name: 'Test Ranch',
        operatorEmail: 'owner@example.com',
        firstName: 'Owner',
        lastName: 'User',
        location: 'Test Location',
        inviteCode: 'TEST123'
      };
      const operation = await provider.createOperation(operationData);

      // Create owner staff member
      await db.insert(staffMembers).values({
        operationId: operation.id,
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: 'User',
        role: 'owner',
        status: 'active',
        invitedBy: 'system'
      }).execute();

      const role = await provider.getUserRole('owner@example.com');
      
      expect(role).toBeDefined();
      expect(role?.role).toBe('owner');
      expect(role?.operationId).toBe(operation.id);
    });
  });

  describe('Dashboard Statistics', () => {
    it('should calculate dashboard stats correctly', async () => {
      // Create test data
      const pen1: CreatePenRequest = {
        name: 'Pen 1',
        operatorEmail: 'test@example.com',
        capacity: 100,
        current: 80,
        cattleType: 'Steers',
        startingWeight: 650,
        marketWeight: 1200,
        feedType: 'High Energy',
        isCrossbred: false
      };

      const pen2: CreatePenRequest = {
        name: 'Pen 2',
        operatorEmail: 'test@example.com',
        capacity: 150,
        current: 120,
        cattleType: 'Heifers',
        startingWeight: 600,
        marketWeight: 1100,
        feedType: 'Balanced',
        isCrossbred: true
      };

      await provider.createPen(pen1);
      await provider.createPen(pen2);

      const stats = await provider.getDashboardStats('test@example.com');
      
      expect(stats).toBeDefined();
      expect(stats.totalPens).toBe(2);
      expect(stats.totalCapacity).toBe(250);
      expect(stats.currentCattle).toBe(200);
      expect(stats.utilizationRate).toBeCloseTo(80, 1); // 200/250 * 100
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test with invalid data that would violate constraints
      const duplicateEmail: InsertOperation = {
        name: 'Ranch 1',
        operatorEmail: 'duplicate@example.com',
        firstName: 'John',
        lastName: 'Doe',
        location: 'Location',
        inviteCode: 'CODE1'
      };

      await provider.createOperation(duplicateEmail);
      
      // Attempting to create another with same email should fail gracefully
      await expect(provider.createOperation(duplicateEmail)).rejects.toThrow();
    });

    it('should handle connection issues with retry logic', async () => {
      // This test would require mocking the database connection
      // For now, we just verify the provider has retry capabilities
      expect(provider).toHaveProperty('executeWithRetry');
    });
  });
});