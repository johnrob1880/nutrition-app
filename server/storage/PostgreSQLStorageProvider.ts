import { eq, and, sql, inArray } from 'drizzle-orm';
import { getDb, executeWithRetry } from '../db/connection';
import * as schema from '@shared/schema';
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
  FeedingIngredient
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

  // Helper method to calculate days on feed
  private calculateDaysOnFeed(startDate: Date | string, endDate?: Date | string): number {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
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
    const operation = await this.getOperationByEmail(operatorEmail);
    if (!operation) return [];
    return this.getPensByOperationId(operation.id);
  }

  async getPensByOperationId(operationId: number): Promise<Pen[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.pens)
        .where(eq(schema.pens.operationId, operationId));
      return results.map(pen => ({
        ...pen,
        // lastFed, startDate, endDate, createdAt, updatedAt are Date or null
        lastFed: pen.lastFed,
        startDate: pen.startDate,
        endDate: pen.endDate,
        createdAt: pen.createdAt,
        updatedAt: pen.updatedAt,
      }));
    });
  }

  async createPen(penData: CreatePenRequest): Promise<Pen> {
    return this.executeWithRetry(async () => {
      // If operationId is not provided, look it up using operatorEmail
      let operationId = penData.operationId;
      if (!operationId && penData.operatorEmail) {
        const operation = await this.db
          .select()
          .from(schema.operations)
          .where(eq(schema.operations.operatorEmail, penData.operatorEmail))
          .limit(1);
        
        if (operation.length === 0) {
          throw new Error(`Operation not found for email: ${penData.operatorEmail}`);
        }
        operationId = operation[0].id;
      }

      if (!operationId) {
        throw new Error('Either operationId or operatorEmail must be provided');
      }

      const result = await this.db
        .insert(schema.pens)
        .values({
          name: penData.name,
          operationId: operationId,
          capacity: penData.capacity,
          current: penData.current,
          cattleType: penData.cattleType,
          startingWeight: penData.startingWeight,
          currentWeight: penData.startingWeight,
          marketWeight: penData.marketWeight,
          feedType: penData.feedType,
          isCrossbred: penData.isCrossbred,
          startDate: penData.startDate ? new Date(penData.startDate) : undefined,
          nutritionistId: penData.nutritionistId ? Number(penData.nutritionistId) : undefined,
        })
        .returning();
      return result[0];
    });
  }

  async updatePenWeight(request: UpdateWeightRequest): Promise<Pen | undefined> {
    return this.executeWithRetry(async () => {
      const penId = request.penId;
      // Update pen weight
      const result = await this.db
        .update(schema.pens)
        .set({ 
          currentWeight: request.newWeight,
          updatedAt: new Date()
        })
        .where(eq(schema.pens.id, penId))
        .returning();
      if (result.length === 0) return undefined;
      // Record weight history
      await this.db
        .insert(schema.weightRecords)
        .values({
          penId: penId,
          weight: request.newWeight,
          recordedBy: request.operatorEmail,
        });
      return result[0];
    });
  }

  // Feeding Management
  async createFeedingRecord(record: InsertFeedingRecord): Promise<FeedingRecord> {
    return this.executeWithRetry(async () => {
      const feedingTime = record.feedingTime || new Date();
      const feedingDate = record.feedingDate || (feedingTime instanceof Date ? feedingTime.toISOString().split('T')[0] : '');
      const result = await this.db
        .insert(schema.feedingRecords)
        .values({
          penId: record.penId,
          scheduleId: record.scheduleId || 'default-schedule',
          plannedAmount: record.plannedAmount || (record.amount ? record.amount.toString() : '0'),
          feedingTime: feedingTime,
          feedingDate: feedingDate,
          feedType: record.feedType || 'Mixed Feed',
          amount: record.amount || 0,
          unit: record.unit || 'lbs',
          ingredients: record.ingredients || [],
          fedBy: record.fedBy || record.operatorEmail,
          notes: record.notes || null,
          operatorEmail: record.operatorEmail,
        })
        .returning();
      return result[0];
    });
  }

  async getFeedingRecordsByOperatorEmail(operatorEmail: string): Promise<FeedingRecord[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.feedingRecords)
        .where(eq(schema.feedingRecords.operatorEmail, operatorEmail));
      return results;
    });
  }

  async getFeedingPlansByOperatorEmail(operatorEmail: string): Promise<FeedingPlan[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.feedingPlans)
        .where(eq(schema.feedingPlans.operatorEmail, operatorEmail));
      return results;
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

      // Get active schedules count (feeding plans that are active)
      const feedingPlans = await this.getFeedingPlansByOperatorEmail(operatorEmail);
      const activeSchedules = feedingPlans.length;

      // Calculate average feed per day from feeding plans
      const avgFeedPerDay = feedingPlans.length > 0
        ? (feedingPlans.reduce((sum, plan) => sum + (plan.dailyFeedAmount || 0), 0) / feedingPlans.length).toFixed(2)
        : '0';

      return {
        totalPens: pens.length,
        totalCattle: currentCattle, // Fix: use totalCattle instead of currentCattle
        activeSchedules,
        staffCount,
        avgFeedPerDay: `${avgFeedPerDay} lbs`,
        lastSync: new Date().toISOString()
      };
    });
  }

  // Cattle Sales
  async sellCattle(saleRecord: InsertCattleSale): Promise<CattleSale> {
    return this.executeWithRetry(async () => {
      const pen = await this.db
        .select()
        .from(schema.pens)
        .where(eq(schema.pens.id, saleRecord.penId))
        .limit(1);
      if (!pen.length) throw new Error('Pen not found');
      const penData = pen[0];
      const headCount = penData.current;
      const totalRevenue = (saleRecord.averageWeight * saleRecord.pricePerCwt * headCount) / 100;
      // Calculate days on feed and average daily gain
      const startDate = penData.startDate instanceof Date ? penData.startDate : new Date(penData.startDate);
      const saleDate = new Date(saleRecord.saleDate);
      const daysOnFeed = Math.floor((saleDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalGain = saleRecord.averageWeight - penData.startingWeight;
      const averageDailyGain = daysOnFeed > 0 ? totalGain / daysOnFeed : 0;
      const result = await this.db
        .insert(schema.cattleSales)
        .values({
          penId: saleRecord.penId,
          saleDate: saleRecord.saleDate,
          headCount: headCount,
          averageWeight: saleRecord.averageWeight,
          pricePerCwt: saleRecord.pricePerCwt,
          totalRevenue: totalRevenue,
          daysOnFeed: daysOnFeed,
          averageDailyGain: averageDailyGain,
          buyerName: null,
          transportCost: null,
          notes: saleRecord.notes || null,
          operatorEmail: saleRecord.operatorEmail,
        })
        .returning();
      await this.db
        .update(schema.pens)
        .set({
          current: 0,
          status: 'Inactive',
        })
        .where(eq(schema.pens.id, saleRecord.penId));
      return result[0];
    });
  }

  async getCattleSalesByOperatorEmail(operatorEmail: string): Promise<CattleSale[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.cattleSales)
        .where(eq(schema.cattleSales.operatorEmail, operatorEmail));
      return results.map(sale => ({
        ...sale,
        createdAt: sale.createdAt,
      }));
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
        ...loss,
        tagNumbers: loss.tagNumbers ?? null,
        notes: loss.notes ?? null,
        createdAt: loss.createdAt,
      }));
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
        ...treatment,
        tagNumbers: treatment.tagNumbers ?? null,
        notes: treatment.notes ?? null,
        createdAt: treatment.createdAt,
      }));
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
      return result[0];
    });
  }

  async getPartialSalesByOperatorEmail(operatorEmail: string): Promise<PartialSale[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.partialSales)
        .where(eq(schema.partialSales.operatorEmail, operatorEmail));
      return results.map(sale => ({
        ...sale,
        tagNumbers: sale.tagNumbers ?? null,
        notes: sale.notes ?? null,
        createdAt: sale.createdAt,
      }));
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