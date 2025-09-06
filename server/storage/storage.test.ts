import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IStorageProvider } from './IStorageProvider';
import { InMemoryStorageProvider } from './InMemoryStorageProvider';
import { StorageFactory } from './StorageFactory';
import type { InsertOperation, CreatePenRequest, InsertFeedingRecord, InsertDeathLoss, InsertTreatmentRecord, InsertStaffInvitation } from '@shared/schema';

describe('Storage Abstraction Layer', () => {
  let storageProvider: IStorageProvider;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    storageProvider = new InMemoryStorageProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('IStorageProvider Interface Compliance', () => {
    it('should implement all required operation methods', () => {
      expect(typeof storageProvider.getOperation).toBe('function');
      expect(typeof storageProvider.getOperationByEmail).toBe('function');
      expect(typeof storageProvider.createOperation).toBe('function');
      expect(typeof storageProvider.updateOperation).toBe('function');
      expect(typeof storageProvider.validateInviteCode).toBe('function');
    });

    it('should implement all required pen methods', () => {
      expect(typeof storageProvider.getPensByOperatorEmail).toBe('function');
      expect(typeof storageProvider.createPen).toBe('function');
      expect(typeof storageProvider.updatePenWeight).toBe('function');
    });

    it('should implement all required feeding methods', () => {
      expect(typeof storageProvider.createFeedingRecord).toBe('function');
      expect(typeof storageProvider.getFeedingRecordsByOperatorEmail).toBe('function');
      expect(typeof storageProvider.getFeedingPlansByOperatorEmail).toBe('function');
      expect(typeof storageProvider.getUpcomingScheduleChanges).toBe('function');
    });

    it('should implement all required health tracking methods', () => {
      expect(typeof storageProvider.recordDeathLoss).toBe('function');
      expect(typeof storageProvider.getDeathLossByOperatorEmail).toBe('function');
      expect(typeof storageProvider.recordTreatment).toBe('function');
      expect(typeof storageProvider.getTreatmentsByOperatorEmail).toBe('function');
    });

    it('should implement all required staff management methods', () => {
      expect(typeof storageProvider.inviteStaffMember).toBe('function');
      expect(typeof storageProvider.getStaffMembersByOperationId).toBe('function');
      expect(typeof storageProvider.acceptStaffInvitation).toBe('function');
      expect(typeof storageProvider.getStaffMemberByEmail).toBe('function');
      expect(typeof storageProvider.getUserRole).toBe('function');
    });
  });

  describe('Operation Management', () => {
    it('should create and retrieve operations', async () => {
      const operationData: InsertOperation = {
        name: 'Test Ranch',
        operatorEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        location: 'Test Location',
        inviteCode: 'RANCH2025'
      };

      const createdOperation = await storageProvider.createOperation(operationData);
      
      expect(createdOperation).toBeDefined();
      expect(createdOperation.name).toBe('Test Ranch');
      expect(createdOperation.operatorEmail).toBe('test@example.com');

      const retrieved = await storageProvider.getOperationByEmail('test@example.com');
      expect(retrieved).toEqual(createdOperation);
    });

    it('should validate invite codes', async () => {
      const isValid = await storageProvider.validateInviteCode('RANCH2025', 'johnrob1880@gmail.com');
      expect(isValid).toBe(true);

      const isInvalid = await storageProvider.validateInviteCode('INVALID', 'test@example.com');
      expect(isInvalid).toBe(false);
    });

    it('should update operations', async () => {
      const operationData: InsertOperation = {
        name: 'Test Ranch',
        operatorEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        location: 'Test Location',
        inviteCode: 'RANCH2025'
      };

      const created = await storageProvider.createOperation(operationData);
      const updated = await storageProvider.updateOperation(created.id, { name: 'Updated Ranch' });

      expect(updated?.name).toBe('Updated Ranch');
      expect(updated?.operatorEmail).toBe('test@example.com');
    });
  });

  describe('Pen Management', () => {
    it('should create and retrieve pens', async () => {
      const penData: CreatePenRequest = {
        name: 'Test Pen',
        operatorEmail: 'johnrob1880@gmail.com',
        capacity: 100,
        current: 50,
        cattleType: 'Steers',
        startingWeight: 650,
        marketWeight: 1200,
        feedType: 'High Energy'
      };

      const createdPen = await storageProvider.createPen(penData);
      
      expect(createdPen).toBeDefined();
      expect(createdPen.name).toBe('Test Pen');
      expect(createdPen.capacity).toBe(100);

      const pens = await storageProvider.getPensByOperatorEmail('johnrob1880@gmail.com');
      expect(pens.some(pen => pen.name === 'Test Pen')).toBe(true);
    });

    it('should update pen weights', async () => {
      const weightUpdate = {
        penId: '1',
        currentWeight: 750,
        operatorEmail: 'johnrob1880@gmail.com'
      };

      const updatedPen = await storageProvider.updatePenWeight(weightUpdate);
      expect(updatedPen?.currentWeight).toBe(750);
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
        operatorEmail: 'johnrob1880@gmail.com'
      };

      const recorded = await storageProvider.recordDeathLoss(deathLossData);
      
      expect(recorded).toBeDefined();
      expect(recorded.reason).toBe('Disease');
      expect(recorded.cattleCount).toBe(2);

      const losses = await storageProvider.getDeathLossByOperatorEmail('johnrob1880@gmail.com');
      expect(losses.some(loss => loss.reason === 'Disease')).toBe(true);
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
        operatorEmail: 'johnrob1880@gmail.com'
      };

      const recorded = await storageProvider.recordTreatment(treatmentData);
      
      expect(recorded).toBeDefined();
      expect(recorded.treatmentType).toBe('Vaccination');
      expect(recorded.product).toBe('Vaccine X');

      const treatments = await storageProvider.getTreatmentsByOperatorEmail('johnrob1880@gmail.com');
      expect(treatments.some(treatment => treatment.treatmentType === 'Vaccination')).toBe(true);
    });
  });

  describe('Staff Management', () => {
    it('should handle staff invitations', async () => {
      const invitationData: InsertStaffInvitation = {
        operationId: 1,
        email: 'staff@example.com',
        firstName: 'Jane',
        lastName: 'Helper',
        invitedBy: 'owner@example.com'
      };

      const invitation = await storageProvider.inviteStaffMember(invitationData);
      
      expect(invitation).toBeDefined();
      expect(invitation.email).toBe('staff@example.com');
      expect(invitation.firstName).toBe('Jane');
    });

    it('should retrieve user roles', async () => {
      const role = await storageProvider.getUserRole('johnrob1880@gmail.com');
      
      expect(role).toBeDefined();
      expect(['owner', 'staff']).toContain(role?.role);
      expect(typeof role?.operationId).toBe('number');
    });
  });
});

describe('StorageFactory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    StorageFactory.reset(); // Reset singleton before each test
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create InMemoryStorageProvider when STORAGE_TYPE is memory', async () => {
    process.env.STORAGE_TYPE = 'memory';
    
    const provider = await StorageFactory.createProvider();
    
    expect(provider).toBeInstanceOf(InMemoryStorageProvider);
  });

  it('should default to InMemoryStorageProvider when STORAGE_TYPE is not set', async () => {
    delete process.env.STORAGE_TYPE;
    
    const provider = await StorageFactory.createProvider();
    
    expect(provider).toBeInstanceOf(InMemoryStorageProvider);
  });

  it('should throw error for unsupported storage types', async () => {
    process.env.STORAGE_TYPE = 'unsupported';
    StorageFactory.reset(); // Reset singleton before testing
    
    await expect(StorageFactory.createProvider()).rejects.toThrow('Unsupported storage type');
  });

  it('should create provider only once (singleton pattern)', async () => {
    process.env.STORAGE_TYPE = 'memory';
    
    const provider1 = await StorageFactory.createProvider();
    const provider2 = await StorageFactory.createProvider();
    
    expect(provider1).toBe(provider2);
  });
});