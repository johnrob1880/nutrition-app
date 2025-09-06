import { eq, and, sql } from 'drizzle-orm';
import { getDb, executeWithRetry } from '../db/connection';
import * as schema from '../db/schema';
import { IStorageProvider } from './IStorageProvider';
import type {
  Operation,
  InsertOperation,
  Pen,
  CreatePenRequest,
  FeedingPlan,
  DashboardStats,
  UpdateWeightRequest,
  UpcomingScheduleChange,
  FeedingRecord,
  InsertFeedingRecord,
  CattleSale,
  InsertCattleSale,
  Nutritionist,
  AcceptInvitationRequest,
  DeathLoss,
  InsertDeathLoss,
  TreatmentRecord,
  InsertTreatmentRecord,
  PartialSale,
  InsertPartialSale,
  StaffMember,
  StaffInvitation,
  InsertStaffInvitation,
  FeedIngredient
} from '@shared/schema';

/**
 * PostgreSQL Storage Provider
 * 
 * Implements the IStorageProvider interface using PostgreSQL with Drizzle ORM
 */
export class PostgreSQLStorageProvider implements IStorageProvider {
  private db: ReturnType<typeof getDb>;

  constructor() {
    this.db = getDb();
  }

  // Helper method for executing with retry
  async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return executeWithRetry(fn);
  }

  // Operation Management
  async getOperation(id: number): Promise<Operation | undefined> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .select()
        .from(schema.operations)
        .where(eq(schema.operations.id, id))
        .limit(1);
      
      return result[0] as Operation | undefined;
    });
  }

  async getOperationByEmail(email: string): Promise<Operation | undefined> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .select()
        .from(schema.operations)
        .where(eq(schema.operations.operatorEmail, email))
        .limit(1);
      
      return result[0] as Operation | undefined;
    });
  }

  async createOperation(operation: InsertOperation): Promise<Operation> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .insert(schema.operations)
        .values(operation)
        .returning();
      
      return result[0] as Operation;
    });
  }

  async updateOperation(id: number, operation: Partial<InsertOperation>): Promise<Operation | undefined> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .update(schema.operations)
        .set(operation)
        .where(eq(schema.operations.id, id))
        .returning();
      
      return result[0] as Operation | undefined;
    });
  }

  async validateInviteCode(inviteCode: string, operatorEmail: string): Promise<boolean> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .select()
        .from(schema.inviteCodes)
        .where(
          and(
            eq(schema.inviteCodes.code, inviteCode),
            eq(schema.inviteCodes.operatorEmail, operatorEmail),
            eq(schema.inviteCodes.used, false)
          )
        )
        .limit(1);
      
      return result.length > 0;
    });
  }

  // Pen Management
  async getPensByOperatorEmail(operatorEmail: string): Promise<Pen[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.pens)
        .where(eq(schema.pens.operatorEmail, operatorEmail));
      
      // Convert database records to Pen interface
      return results.map(pen => ({
        id: pen.id.toString(),
        name: pen.name,
        capacity: pen.capacity,
        current: pen.current,
        status: pen.status as 'Active' | 'Maintenance' | 'Inactive',
        feedType: pen.feedType,
        lastFed: pen.lastFed?.toISOString() || '',
        operatorEmail: pen.operatorEmail,
        cattleType: pen.cattleType as 'Steers' | 'Heifers' | 'Mixed',
        startingWeight: pen.startingWeight,
        marketWeight: pen.marketWeight,
        averageDailyGain: pen.averageDailyGain || 0,
        isCrossbred: pen.isCrossbred || false,
        currentWeight: pen.currentWeight,
        weightHistory: [],
        daysOnFeed: pen.daysOnFeed || 0,
        feedConversion: pen.feedConversion || 0,
        projectedCloseoutDate: pen.projectedCloseoutDate || '',
        estimatedValue: pen.estimatedValue || 0
      })) as Pen[];
    });
  }

  async createPen(penData: CreatePenRequest): Promise<Pen> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .insert(schema.pens)
        .values({
          name: penData.name,
          operatorEmail: penData.operatorEmail,
          capacity: penData.capacity,
          current: penData.current,
          cattleType: penData.cattleType,
          startingWeight: penData.startingWeight,
          currentWeight: penData.startingWeight,
          marketWeight: penData.marketWeight,
          feedType: penData.feedType,
          isCrossbred: penData.isCrossbred || false,
        })
        .returning();
      
      const pen = result[0];
      return {
        id: pen.id.toString(),
        name: pen.name,
        capacity: pen.capacity,
        current: pen.current,
        status: pen.status as 'Active' | 'Maintenance' | 'Inactive',
        feedType: pen.feedType,
        lastFed: pen.lastFed?.toISOString() || '',
        operatorEmail: pen.operatorEmail,
        cattleType: pen.cattleType as 'Steers' | 'Heifers' | 'Mixed',
        startingWeight: pen.startingWeight,
        marketWeight: pen.marketWeight,
        averageDailyGain: pen.averageDailyGain || 0,
        isCrossbred: pen.isCrossbred || false,
        currentWeight: pen.currentWeight,
        weightHistory: [],
        daysOnFeed: pen.daysOnFeed || 0,
        feedConversion: pen.feedConversion || 0,
        projectedCloseoutDate: pen.projectedCloseoutDate || '',
        estimatedValue: pen.estimatedValue || 0
      } as Pen;
    });
  }

  async updatePenWeight(request: UpdateWeightRequest): Promise<Pen | undefined> {
    return this.executeWithRetry(async () => {
      const penId = parseInt(request.penId);
      
      // Update pen weight
      const result = await this.db
        .update(schema.pens)
        .set({ 
          currentWeight: request.currentWeight,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(schema.pens.id, penId),
            eq(schema.pens.operatorEmail, request.operatorEmail)
          )
        )
        .returning();
      
      if (result.length === 0) return undefined;

      // Record weight history
      await this.db
        .insert(schema.weightRecords)
        .values({
          penId: penId,
          weight: request.currentWeight,
          recordedBy: request.operatorEmail,
        });
      
      const pen = result[0];
      return {
        id: pen.id.toString(),
        name: pen.name,
        capacity: pen.capacity,
        current: pen.current,
        status: pen.status as 'Active' | 'Maintenance' | 'Inactive',
        feedType: pen.feedType,
        lastFed: pen.lastFed?.toISOString() || '',
        operatorEmail: pen.operatorEmail,
        cattleType: pen.cattleType as 'Steers' | 'Heifers' | 'Mixed',
        startingWeight: pen.startingWeight,
        marketWeight: pen.marketWeight,
        averageDailyGain: pen.averageDailyGain || 0,
        isCrossbred: pen.isCrossbred || false,
        currentWeight: pen.currentWeight,
        weightHistory: [],
        daysOnFeed: pen.daysOnFeed || 0,
        feedConversion: pen.feedConversion || 0,
        projectedCloseoutDate: pen.projectedCloseoutDate || '',
        estimatedValue: pen.estimatedValue || 0
      } as Pen;
    });
  }

  // Feeding Management
  async createFeedingRecord(record: InsertFeedingRecord): Promise<FeedingRecord> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .insert(schema.feedingRecords)
        .values({
          penId: record.penId,
          feedingDate: record.feedingDate,
          feedType: record.feedType,
          amount: record.amount,
          unit: record.unit,
          ingredients: record.ingredients as any,
          fedBy: record.fedBy,
          notes: record.notes,
          operatorEmail: record.operatorEmail,
        })
        .returning();
      
      return {
        id: result[0].id,
        ...record
      } as FeedingRecord;
    });
  }

  async getFeedingRecordsByOperatorEmail(operatorEmail: string): Promise<FeedingRecord[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.feedingRecords)
        .where(eq(schema.feedingRecords.operatorEmail, operatorEmail));
      
      return results.map(record => ({
        id: record.id,
        penId: record.penId,
        feedingDate: record.feedingDate,
        feedType: record.feedType,
        amount: record.amount,
        unit: record.unit,
        ingredients: record.ingredients as FeedIngredient[],
        fedBy: record.fedBy,
        notes: record.notes || undefined,
        operatorEmail: record.operatorEmail,
      })) as FeedingRecord[];
    });
  }

  async getFeedingPlansByOperatorEmail(operatorEmail: string): Promise<FeedingPlan[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.feedingPlans)
        .where(eq(schema.feedingPlans.operatorEmail, operatorEmail));
      
      return results.map(plan => ({
        id: plan.id.toString(),
        penId: plan.penId.toString(),
        name: plan.name,
        operatorEmail: plan.operatorEmail,
        ingredients: plan.ingredients as FeedIngredient[],
        totalCostPerTon: plan.totalCostPerTon || 0,
        proteinContent: plan.proteinContent || 0,
        energyContent: plan.energyContent || 0,
        dailyFeedAmount: plan.dailyFeedAmount || 0,
        estimatedDailyGain: plan.estimatedDailyGain || 0,
        feedConversionRatio: plan.feedConversionRatio || 0,
        createdDate: plan.createdDate,
        lastModified: plan.lastModified,
        notes: plan.notes || '',
      })) as FeedingPlan[];
    });
  }

  async getUpcomingScheduleChanges(operatorEmail: string): Promise<UpcomingScheduleChange[]> {
    // This would typically query a schedule changes table
    // For now, return empty array as the table doesn't exist yet
    return [];
  }

  // Dashboard and Analytics
  async getDashboardStats(operatorEmail: string): Promise<DashboardStats> {
    return this.executeWithRetry(async () => {
      const pens = await this.getPensByOperatorEmail(operatorEmail);
      
      const totalCapacity = pens.reduce((sum, pen) => sum + pen.capacity, 0);
      const currentCattle = pens.reduce((sum, pen) => sum + pen.current, 0);
      const averageWeight = pens.length > 0
        ? pens.reduce((sum, pen) => sum + (pen.currentWeight || 0), 0) / pens.length
        : 0;
      
      // Get staff count
      const operation = await this.getOperationByEmail(operatorEmail);
      let staffCount = 0;
      
      if (operation) {
        const staff = await this.db
          .select()
          .from(schema.staffMembers)
          .where(
            and(
              eq(schema.staffMembers.operationId, operation.id),
              eq(schema.staffMembers.status, 'active')
            )
          );
        staffCount = staff.length;
      }

      return {
        totalPens: pens.length,
        totalCapacity,
        currentCattle,
        utilizationRate: totalCapacity > 0 ? (currentCattle / totalCapacity) * 100 : 0,
        averageWeight,
        staffCount
      };
    });
  }

  // Cattle Sales
  async sellCattle(saleRecord: InsertCattleSale): Promise<CattleSale> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .insert(schema.cattleSales)
        .values({
          penId: saleRecord.penId,
          saleDate: saleRecord.saleDate,
          headCount: saleRecord.headCount,
          averageWeight: saleRecord.averageWeight,
          pricePerCwt: saleRecord.pricePerCwt,
          totalRevenue: saleRecord.totalRevenue,
          buyerName: saleRecord.buyerName,
          transportCost: saleRecord.transportCost,
          notes: saleRecord.notes,
          operatorEmail: saleRecord.operatorEmail,
        })
        .returning();
      
      return {
        id: result[0].id,
        ...saleRecord
      } as CattleSale;
    });
  }

  async getCattleSalesByOperatorEmail(operatorEmail: string): Promise<CattleSale[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.cattleSales)
        .where(eq(schema.cattleSales.operatorEmail, operatorEmail));
      
      return results.map(sale => ({
        id: sale.id,
        penId: sale.penId,
        saleDate: sale.saleDate,
        headCount: sale.headCount,
        averageWeight: sale.averageWeight,
        pricePerCwt: sale.pricePerCwt,
        totalRevenue: sale.totalRevenue,
        buyerName: sale.buyerName || undefined,
        transportCost: sale.transportCost || undefined,
        notes: sale.notes || undefined,
        operatorEmail: sale.operatorEmail,
      })) as CattleSale[];
    });
  }

  // Nutritionist Management
  async getNutritionistsByOperatorEmail(operatorEmail: string): Promise<Nutritionist[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.nutritionists)
        .where(eq(schema.nutritionists.operatorEmail, operatorEmail));
      
      return results.map(nutritionist => ({
        id: nutritionist.id,
        name: nutritionist.name,
        company: nutritionist.company || '',
        email: nutritionist.email,
        phone: nutritionist.phone || '',
        specialties: nutritionist.specialties as string[] || [],
        operatorEmail: nutritionist.operatorEmail,
        status: nutritionist.status as 'active' | 'inactive' | 'pending',
        joinedDate: nutritionist.joinedDate || '',
      })) as Nutritionist[];
    });
  }

  async acceptNutritionistInvitation(request: AcceptInvitationRequest): Promise<Nutritionist | undefined> {
    // Implementation would handle nutritionist invitation acceptance
    // For now, return undefined as this feature is not fully implemented
    return undefined;
  }

  // Health Tracking - Death Loss
  async recordDeathLoss(record: InsertDeathLoss): Promise<DeathLoss> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .insert(schema.deathLosses)
        .values({
          penId: record.penId,
          lossDate: record.lossDate,
          reason: record.reason,
          cattleCount: record.cattleCount,
          estimatedWeight: record.estimatedWeight,
          tagNumbers: record.tagNumbers,
          notes: record.notes,
          operatorEmail: record.operatorEmail,
        })
        .returning();
      
      return {
        id: result[0].id,
        ...record
      } as DeathLoss;
    });
  }

  async getDeathLossByOperatorEmail(operatorEmail: string): Promise<DeathLoss[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.deathLosses)
        .where(eq(schema.deathLosses.operatorEmail, operatorEmail));
      
      return results.map(loss => ({
        id: loss.id,
        penId: loss.penId,
        lossDate: loss.lossDate,
        reason: loss.reason,
        cattleCount: loss.cattleCount,
        estimatedWeight: loss.estimatedWeight,
        tagNumbers: loss.tagNumbers || undefined,
        notes: loss.notes || undefined,
        operatorEmail: loss.operatorEmail,
      })) as DeathLoss[];
    });
  }

  // Health Tracking - Treatments
  async recordTreatment(record: InsertTreatmentRecord): Promise<TreatmentRecord> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .insert(schema.treatmentRecords)
        .values({
          penId: record.penId,
          treatmentDate: record.treatmentDate,
          treatmentType: record.treatmentType,
          product: record.product,
          dosage: record.dosage,
          cattleCount: record.cattleCount,
          tagNumbers: record.tagNumbers,
          treatedBy: record.treatedBy,
          notes: record.notes,
          operatorEmail: record.operatorEmail,
        })
        .returning();
      
      return {
        id: result[0].id,
        ...record
      } as TreatmentRecord;
    });
  }

  async getTreatmentsByOperatorEmail(operatorEmail: string): Promise<TreatmentRecord[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.treatmentRecords)
        .where(eq(schema.treatmentRecords.operatorEmail, operatorEmail));
      
      return results.map(treatment => ({
        id: treatment.id,
        penId: treatment.penId,
        treatmentDate: treatment.treatmentDate,
        treatmentType: treatment.treatmentType,
        product: treatment.product,
        dosage: treatment.dosage,
        cattleCount: treatment.cattleCount,
        tagNumbers: treatment.tagNumbers || undefined,
        treatedBy: treatment.treatedBy,
        notes: treatment.notes || undefined,
        operatorEmail: treatment.operatorEmail,
      })) as TreatmentRecord[];
    });
  }

  // Partial Sales
  async recordPartialSale(record: InsertPartialSale): Promise<PartialSale> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .insert(schema.partialSales)
        .values({
          penId: record.penId,
          saleDate: record.saleDate,
          headCount: record.headCount,
          averageWeight: record.averageWeight,
          pricePerCwt: record.pricePerCwt,
          totalRevenue: record.totalRevenue,
          tagNumbers: record.tagNumbers,
          notes: record.notes,
          operatorEmail: record.operatorEmail,
        })
        .returning();
      
      return {
        id: result[0].id,
        ...record
      } as PartialSale;
    });
  }

  async getPartialSalesByOperatorEmail(operatorEmail: string): Promise<PartialSale[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.partialSales)
        .where(eq(schema.partialSales.operatorEmail, operatorEmail));
      
      return results.map(sale => ({
        id: sale.id,
        penId: sale.penId,
        saleDate: sale.saleDate,
        headCount: sale.headCount,
        averageWeight: sale.averageWeight,
        pricePerCwt: sale.pricePerCwt,
        totalRevenue: sale.totalRevenue,
        tagNumbers: sale.tagNumbers || undefined,
        notes: sale.notes || undefined,
        operatorEmail: sale.operatorEmail,
      })) as PartialSale[];
    });
  }

  // Staff Management
  async inviteStaffMember(invitation: InsertStaffInvitation): Promise<StaffInvitation> {
    return this.executeWithRetry(async () => {
      const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const result = await this.db
        .insert(schema.staffInvitations)
        .values({
          ...invitation,
          token,
          expiresAt,
        })
        .returning();
      
      return result[0] as StaffInvitation;
    });
  }

  async getStaffMembersByOperationId(operationId: number): Promise<StaffMember[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.staffMembers)
        .where(eq(schema.staffMembers.operationId, operationId));
      
      return results as StaffMember[];
    });
  }

  async acceptStaffInvitation(token: string): Promise<StaffMember | undefined> {
    return this.executeWithRetry(async () => {
      // Get invitation
      const invitations = await this.db
        .select()
        .from(schema.staffInvitations)
        .where(eq(schema.staffInvitations.token, token))
        .limit(1);
      
      if (invitations.length === 0) return undefined;
      
      const invitation = invitations[0];
      
      // Check if expired or already used
      if (invitation.usedAt || invitation.expiresAt < new Date()) {
        return undefined;
      }
      
      // Mark invitation as used
      await this.db
        .update(schema.staffInvitations)
        .set({ usedAt: new Date() })
        .where(eq(schema.staffInvitations.id, invitation.id));
      
      // Create staff member
      const result = await this.db
        .insert(schema.staffMembers)
        .values({
          operationId: invitation.operationId,
          email: invitation.email,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          role: 'staff',
          status: 'active',
          acceptedAt: new Date(),
          invitedBy: invitation.invitedBy,
        })
        .returning();
      
      return result[0] as StaffMember;
    });
  }

  async getStaffMemberByEmail(email: string): Promise<StaffMember | undefined> {
    return this.executeWithRetry(async () => {
      const result = await this.db
        .select()
        .from(schema.staffMembers)
        .where(eq(schema.staffMembers.email, email))
        .limit(1);
      
      return result[0] as StaffMember | undefined;
    });
  }

  async getUserRole(email: string): Promise<{ role: 'owner' | 'staff', operationId: number } | undefined> {
    return this.executeWithRetry(async () => {
      const staff = await this.getStaffMemberByEmail(email);
      
      if (staff) {
        return {
          role: staff.role as 'owner' | 'staff',
          operationId: staff.operationId,
        };
      }
      
      return undefined;
    });
  }
}