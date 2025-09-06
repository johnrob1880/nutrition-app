import { describe, test, expect } from 'vitest';
import { generateSeedData } from '../db/seed';

describe('Seed Data Generation (Unit Tests)', () => {
  describe('generateSeedData', () => {
    test('should generate seed data with proper structure', () => {
      const seedData = generateSeedData();

      // Test operation data
      expect(seedData.operation).toBeDefined();
      expect(seedData.operation.name).toBe('Demo Ranch');
      expect(seedData.operation.operatorEmail).toBe('demo@demoranch.com');
      expect(seedData.operation.firstName).toBe('John');
      expect(seedData.operation.lastName).toBe('Demo');
      expect(seedData.operation.location).toBe('Texas, USA');
      expect(seedData.operation.inviteCode).toMatch(/^DEMO-\d{4}$/);

      // Test staff member data
      expect(seedData.staffMember).toBeDefined();
      expect(seedData.staffMember.email).toBe('manager@demoranch.com');
      expect(seedData.staffMember.firstName).toBe('Sarah');
      expect(seedData.staffMember.lastName).toBe('Johnson');
      expect(seedData.staffMember.role).toBe('staff');
      expect(seedData.staffMember.status).toBe('active');

      // Test pen data
      expect(seedData.pens).toHaveLength(3);
      
      // Test Pen 1 - Premium Angus Steers
      const pen1 = seedData.pens[0];
      expect(pen1.name).toBe('North Pen A');
      expect(pen1.cattleType).toBe('Steers');
      expect(pen1.capacity).toBe(150);
      expect(pen1.current).toBe(125);
      expect(pen1.isCrossbred).toBe(false);
      expect(pen1.startingWeight).toBe(850);
      expect(pen1.feedType).toBe('High Energy Corn-Based');

      // Test Pen 2 - Commercial Heifers
      const pen2 = seedData.pens[1];
      expect(pen2.name).toBe('South Pen B');
      expect(pen2.cattleType).toBe('Heifers');
      expect(pen2.capacity).toBe(120);
      expect(pen2.current).toBe(110);
      expect(pen2.isCrossbred).toBe(true);
      expect(pen2.startingWeight).toBe(750);
      expect(pen2.feedType).toBe('Moderate Energy Mixed Ration');

      // Test Pen 3 - Mixed Group
      const pen3 = seedData.pens[2];
      expect(pen3.name).toBe('East Pen C');
      expect(pen3.cattleType).toBe('Mixed');
      expect(pen3.capacity).toBe(100);
      expect(pen3.current).toBe(85);
      expect(pen3.isCrossbred).toBe(true);
      expect(pen3.startingWeight).toBe(700);
      expect(pen3.feedType).toBe('Custom Finishing Ration');

      // Test feeding records (30 days)
      expect(seedData.feedingRecords).toHaveLength(90); // 3 pens × 30 days
      
      // Test treatment records
      expect(seedData.treatments).toHaveLength(6);
      const treatment1 = seedData.treatments[0];
      expect(treatment1.treatmentType).toBe('Vaccination');
      expect(treatment1.product).toBe('BOVI-SHIELD Gold FP5 L5');
      
      // Test death loss records
      expect(seedData.deathLosses).toHaveLength(2);
      const deathLoss1 = seedData.deathLosses[0];
      expect(deathLoss1.reason).toBe('Respiratory illness');
      expect(deathLoss1.cattleCount).toBe(1);
    });

    test('should generate unique pen IDs', () => {
      const seedData = generateSeedData();
      const penIds = seedData.pens.map(pen => pen.id);
      const uniqueIds = [...new Set(penIds)];
      expect(uniqueIds).toHaveLength(penIds.length);
    });

    test('should generate feeding records for all pens across 30 days', () => {
      const seedData = generateSeedData();
      const penIds = seedData.pens.map(pen => pen.id);
      
      // Check that each pen has 30 feeding records
      for (const penId of penIds) {
        const penRecords = seedData.feedingRecords.filter(record => record.penId === penId);
        expect(penRecords).toHaveLength(30);
      }
    });

    test('should generate historical data with proper dates', () => {
      const seedData = generateSeedData();
      
      // Check that feeding records span 30 days
      const dates = seedData.feedingRecords.map(record => new Date(record.feedingDate));
      const uniqueDates = [...new Set(dates.map(d => d.toISOString().split('T')[0]))];
      expect(uniqueDates).toHaveLength(30);
      
      // Check that the most recent date is today or yesterday
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      expect(maxDate >= yesterday).toBe(true);
    });

    test('should generate consistent data structure across multiple calls', () => {
      const seedData1 = generateSeedData();
      const seedData2 = generateSeedData();

      // Operation should have same structure but different invite codes
      expect(seedData1.operation.name).toBe(seedData2.operation.name);
      expect(seedData1.operation.operatorEmail).toBe(seedData2.operation.operatorEmail);
      expect(seedData1.operation.inviteCode).not.toBe(seedData2.operation.inviteCode);

      // Pens should have same structure
      expect(seedData1.pens).toHaveLength(seedData2.pens.length);
      expect(seedData1.pens[0].name).toBe(seedData2.pens[0].name);
      expect(seedData1.pens[0].cattleType).toBe(seedData2.pens[0].cattleType);

      // Records should have same counts
      expect(seedData1.feedingRecords).toHaveLength(seedData2.feedingRecords.length);
      expect(seedData1.treatments).toHaveLength(seedData2.treatments.length);
      expect(seedData1.deathLosses).toHaveLength(seedData2.deathLosses.length);
    });

    test('should generate valid feeding record ingredients', () => {
      const seedData = generateSeedData();
      
      for (const record of seedData.feedingRecords) {
        expect(record.ingredients).toBeDefined();
        expect(Array.isArray(record.ingredients)).toBe(true);
        expect(record.ingredients.length).toBeGreaterThan(0);
        
        // Check first ingredient structure
        const ingredient = record.ingredients[0];
        expect(ingredient).toHaveProperty('name');
        expect(ingredient).toHaveProperty('amount');
        expect(ingredient).toHaveProperty('unit');
        expect(ingredient).toHaveProperty('percentage');
        expect(typeof ingredient.name).toBe('string');
        expect(typeof ingredient.amount).toBe('string');
        expect(typeof ingredient.unit).toBe('string');
        expect(typeof ingredient.percentage).toBe('string');
      }
    });

    test('should generate treatment records with valid data ranges', () => {
      const seedData = generateSeedData();
      
      for (const treatment of seedData.treatments) {
        expect(treatment.cattleCount).toBeGreaterThan(0);
        expect(treatment.cattleCount).toBeLessThanOrEqual(125); // Max pen size
        expect(treatment.treatmentDate).toBeDefined();
        expect(treatment.product).toBeDefined();
        expect(treatment.dosage).toBeDefined();
        expect(treatment.treatedBy).toBeDefined();
        expect(treatment.operatorEmail).toBe('demo@demoranch.com');
        
        // Check date is within reasonable range (last 30 days)
        const treatmentDate = new Date(treatment.treatmentDate);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        expect(treatmentDate >= thirtyDaysAgo).toBe(true);
      }
    });

    test('should generate death loss records with valid data', () => {
      const seedData = generateSeedData();
      
      for (const deathLoss of seedData.deathLosses) {
        expect(deathLoss.cattleCount).toBeGreaterThan(0);
        expect(deathLoss.estimatedWeight).toBeGreaterThan(0);
        expect(deathLoss.reason).toBeDefined();
        expect(deathLoss.lossDate).toBeDefined();
        expect(deathLoss.operatorEmail).toBe('demo@demoranch.com');
        
        // Check date is within reasonable range (last 30 days)
        const lossDate = new Date(deathLoss.lossDate);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        expect(lossDate >= thirtyDaysAgo).toBe(true);
      }
    });
  });
});