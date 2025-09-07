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
        daysOnFeed: pen.startDate ? this.calculateDaysOnFeed(pen.startDate, pen.endDate) : 0,
        feedConversion: pen.feedConversion || 0,
        projectedCloseoutDate: pen.projectedCloseoutDate || '',
        estimatedValue: pen.estimatedValue || 0,
        nutritionistId: pen.nutritionistId
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
        daysOnFeed: pen.startDate ? this.calculateDaysOnFeed(pen.startDate, pen.endDate) : 0,
        feedConversion: pen.feedConversion || 0,
        projectedCloseoutDate: pen.projectedCloseoutDate || '',
        estimatedValue: pen.estimatedValue || 0,
        nutritionistId: pen.nutritionistId
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
        daysOnFeed: pen.startDate ? this.calculateDaysOnFeed(pen.startDate, pen.endDate) : 0,
        feedConversion: pen.feedConversion || 0,
        projectedCloseoutDate: pen.projectedCloseoutDate || '',
        estimatedValue: pen.estimatedValue || 0,
        nutritionistId: pen.nutritionistId
      } as Pen;
    });
  }

  // Feeding Management
  async createFeedingRecord(record: InsertFeedingRecord): Promise<FeedingRecord> {
    return this.executeWithRetry(async () => {
      // Get current date/time for the feeding, use provided values if available
      const feedingTime = record.feedingTime || new Date();
      const feedingDate = record.feedingDate || feedingTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Use the ingredients from actualIngredients if available, otherwise use ingredients
      const ingredientsToUse = record.actualIngredients || record.ingredients || [];
      
      // Calculate total actual amount from ingredients
      let totalActualAmount = record.amount;
      if (!totalActualAmount && record.actualIngredients?.length > 0) {
        totalActualAmount = record.actualIngredients.reduce((sum, ing) => 
          sum + parseFloat(ing.actualAmount), 0
        );
      }
      if (!totalActualAmount) {
        totalActualAmount = 0;
      }
      
      const result = await this.db
        .insert(schema.feedingRecords)
        .values({
          penId: record.penId,
          scheduleId: record.scheduleId || 'default-schedule', 
          plannedAmount: record.plannedAmount || totalActualAmount.toString(),  
          feedingTime: feedingTime,
          feedingDate: feedingDate,
          feedType: record.feedType || 'Mixed Feed',
          amount: totalActualAmount,
          unit: record.unit || 'lbs',
          ingredients: ingredientsToUse as any,
          fedBy: record.fedBy || record.operatorEmail,
          notes: record.notes || `Feeding completed for schedule ${record.scheduleId || 'default-schedule'}`,
          operatorEmail: record.operatorEmail,
        })
        .returning();
      
      return {
        id: result[0].id.toString(),
        operationId: record.operationId || 0,
        penId: record.penId,
        scheduleId: record.scheduleId || result[0].scheduleId,
        plannedAmount: record.plannedAmount || result[0].plannedAmount,
        actualIngredients: record.actualIngredients || [],
        feedingTime: feedingTime.toISOString(),
        operatorEmail: record.operatorEmail,
        createdAt: result[0].createdAt.toISOString(),
        feedingDate: result[0].feedingDate,
        feedType: result[0].feedType,
        amount: result[0].amount,
        unit: result[0].unit,
        ingredients: result[0].ingredients as any,
        fedBy: result[0].fedBy,
        notes: result[0].notes,
      } as FeedingRecord;
    });
  }

  async getFeedingRecordsByOperatorEmail(operatorEmail: string): Promise<FeedingRecord[]> {
    return this.executeWithRetry(async () => {
      // Get the operation for this operator to get the correct operation ID
      const operation = await this.getOperationByEmail(operatorEmail);
      if (!operation) {
        return [];
      }

      const results = await this.db
        .select()
        .from(schema.feedingRecords)
        .where(eq(schema.feedingRecords.operatorEmail, operatorEmail));
      
      return results.map(record => {
        // Convert database ingredients to ActualIngredient format
        const ingredients = record.ingredients as any[] || [];
        const actualIngredients = ingredients.map(ing => ({
          name: ing.name || '',
          plannedAmount: ing.plannedAmount || ing.amount || '0',
          actualAmount: ing.actualAmount || ing.amount || '0', 
          unit: ing.unit || 'lbs',
          category: ing.category || 'Feedstuff'
        }));

        return {
          id: record.id.toString(),
          operationId: operation.id,
          penId: record.penId,
          scheduleId: record.scheduleId, // Use actual scheduleId from database
          plannedAmount: record.plannedAmount || '0', // Use actual plannedAmount from database
          actualIngredients: actualIngredients,
          feedingTime: record.feedingTime?.toISOString() || new Date().toISOString(), // Use actual feedingTime from database
          operatorEmail: record.operatorEmail,
          createdAt: record.createdAt?.toISOString() || new Date().toISOString()
        } as FeedingRecord;
      });
    });
  }

  async getFeedingPlansByOperatorEmail(operatorEmail: string): Promise<FeedingPlan[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select({
          id: schema.feedingPlans.id,
          penId: schema.feedingPlans.penId,
          name: schema.feedingPlans.name,
          operatorEmail: schema.feedingPlans.operatorEmail,
          ingredients: schema.feedingPlans.ingredients,
          totalCostPerTon: schema.feedingPlans.totalCostPerTon,
          proteinContent: schema.feedingPlans.proteinContent,
          energyContent: schema.feedingPlans.energyContent,
          dailyFeedAmount: schema.feedingPlans.dailyFeedAmount,
          estimatedDailyGain: schema.feedingPlans.estimatedDailyGain,
          feedConversionRatio: schema.feedingPlans.feedConversionRatio,
          createdDate: schema.feedingPlans.createdDate,
          lastModified: schema.feedingPlans.lastModified,
          notes: schema.feedingPlans.notes,
          penName: schema.pens.name,
          feedType: schema.pens.feedType,
          penCurrent: schema.pens.current,
        })
        .from(schema.feedingPlans)
        .leftJoin(schema.pens, eq(schema.feedingPlans.penId, schema.pens.id))
        .where(eq(schema.feedingPlans.operatorEmail, operatorEmail));
      
      return results.map(plan => ({
        id: plan.id.toString(),
        penId: plan.penId.toString(),
        penName: plan.penName || 'Unknown Pen',
        planName: plan.name,
        startDate: plan.createdDate,
        daysToFeed: 120, // Default value, could be calculated
        currentDay: 30, // Default value, could be calculated
        status: 'Active' as const,
        feedType: plan.feedType || 'Mixed Feed',
        schedules: (() => {
          // Keep ingredient amounts as total amounts to match totalAmount field
          const totalIngredients = plan.ingredients as any[] || [];
          const cattleCount = plan.penCurrent || 1; // Use pen's current cattle count
          
          // Calculate half of total ingredients for each feeding (morning/evening split)
          const halfPortionIngredients = totalIngredients.map(ing => {
            const fullDayAmount = parseFloat(ing.amount || '0');
            const halfAmount = (fullDayAmount / 2).toFixed(2);
            return {
              ...ing,
              amount: halfAmount // Half of daily amount for each feeding session
            };
          });

          return [
            {
              id: `${plan.id}-morning`,
              time: '07:00',
              totalAmount: `${Math.round(plan.dailyFeedAmount ? plan.dailyFeedAmount / 2 : 850)} lbs`,
              ingredients: halfPortionIngredients as FeedIngredient[],
              totalNutrition: {
                protein: `${plan.proteinContent || 0}%`,
                fat: '3.5%', // Default value
                fiber: '18%', // Default value
                moisture: '12%' // Default value
              }
            },
            {
              id: `${plan.id}-evening`,
              time: '16:00',
              totalAmount: `${Math.round(plan.dailyFeedAmount ? plan.dailyFeedAmount / 2 : 850)} lbs`,
              ingredients: halfPortionIngredients as FeedIngredient[],
              totalNutrition: {
                protein: `${plan.proteinContent || 0}%`,
                fat: '3.5%', // Default value
                fiber: '18%', // Default value
                moisture: '12%' // Default value
              }
            }
          ];
        })(),
        operatorEmail: plan.operatorEmail,
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
      // Get the pen to determine head count and other details
      const pen = await this.db
        .select()
        .from(schema.pens)
        .where(eq(schema.pens.id, saleRecord.penId))
        .limit(1);
      
      if (!pen.length) {
        throw new Error('Pen not found');
      }

      const penData = pen[0];
      const headCount = penData.current;
      const totalRevenue = (saleRecord.finalWeight * saleRecord.pricePerCwt * headCount) / 100;
      
      // Calculate days on feed and average daily gain
      const startDate = new Date(penData.startDate);
      const saleDate = new Date(saleRecord.saleDate);
      const daysOnFeed = Math.floor((saleDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalGain = saleRecord.finalWeight - penData.startingWeight;
      const averageDailyGain = daysOnFeed > 0 ? totalGain / daysOnFeed : 0;

      // Insert the sale record
      const result = await this.db
        .insert(schema.cattleSales)
        .values({
          penId: saleRecord.penId,
          saleDate: saleRecord.saleDate,
          headCount: headCount,
          averageWeight: saleRecord.finalWeight,
          pricePerCwt: saleRecord.pricePerCwt,
          totalRevenue: totalRevenue,
          daysOnFeed: daysOnFeed,
          averageDailyGain: averageDailyGain,
          buyerName: null,
          transportCost: null,
          notes: null,
          operatorEmail: saleRecord.operatorEmail,
        })
        .returning();
      
      // Update the pen to mark it as sold (Inactive with 0 cattle)
      await this.db
        .update(schema.pens)
        .set({
          current: 0,
          status: 'Inactive',
        })
        .where(eq(schema.pens.id, saleRecord.penId));
      
      return {
        id: result[0].id.toString(),
        operationId: saleRecord.operationId,
        penId: saleRecord.penId,
        penName: penData.name,
        finalWeight: saleRecord.finalWeight,
        pricePerCwt: saleRecord.pricePerCwt,
        totalRevenue: totalRevenue,
        cattleCount: headCount,
        cattleType: penData.cattleType,
        startingWeight: penData.startingWeight,
        averageDailyGain: parseFloat(averageDailyGain.toFixed(2)),
        daysOnFeed: daysOnFeed,
        nutritionistId: penData.nutritionistId || undefined,
        saleDate: saleRecord.saleDate,
        operatorEmail: saleRecord.operatorEmail,
        createdAt: result[0].createdAt.toISOString(),
      } as CattleSale;
    });
  }

  async getCattleSalesByOperatorEmail(operatorEmail: string): Promise<CattleSale[]> {
    return this.executeWithRetry(async () => {
      const results = await this.db
        .select()
        .from(schema.cattleSales)
        .where(eq(schema.cattleSales.operatorEmail, operatorEmail));
      
      // Get operation data
      const operations = await this.db
        .select()
        .from(schema.operations)
        .where(eq(schema.operations.operatorEmail, operatorEmail))
        .limit(1);
      
      const operationId = operations[0]?.id || 0;
      
      // Get all pen IDs from sales
      const penIds = [...new Set(results.map(sale => sale.penId))];
      
      // Fetch pen data for all sold pens
      const pens = penIds.length > 0 ? await this.db
        .select()
        .from(schema.pens)
        .where(inArray(schema.pens.id, penIds.map(id => parseInt(id)))) : [];
      
      // Create a map of pen data - ensure consistent string keys
      const penMap = new Map(pens.map(pen => [pen.id.toString(), pen]));
      
      return results.map(sale => {
        const pen = penMap.get(sale.penId);
        
        // Use stored values from the sale record instead of recalculating
        const daysOnFeed = sale.daysOnFeed || 0;
        const averageDailyGain = sale.averageDailyGain || 0;
        
        return {
          id: sale.id.toString(),
          operationId: operationId,
          penId: sale.penId,
          penName: pen?.name || 'Unknown Pen',
          finalWeight: sale.averageWeight,
          pricePerCwt: sale.pricePerCwt,
          totalRevenue: sale.totalRevenue,
          cattleCount: sale.headCount,
          cattleType: pen?.cattleType || 'Unknown',
          startingWeight: pen?.startingWeight || 0,
          averageDailyGain: averageDailyGain,
          daysOnFeed: daysOnFeed,
          nutritionistId: pen?.nutritionistId || undefined,
          saleDate: sale.saleDate,
          penStartDate: pen?.startDate ? new Date(pen.startDate).toISOString().split('T')[0] : undefined,
          operatorEmail: sale.operatorEmail,
          createdAt: sale.createdAt.toISOString(),
        } as CattleSale;
      });
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
        createdAt: loss.createdAt?.toISOString() || new Date(loss.lossDate + 'T08:00:00.000Z').toISOString(),
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
        createdAt: treatment.createdAt?.toISOString() || new Date(treatment.treatmentDate + 'T08:00:00.000Z').toISOString(),
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
          headCount: record.cattleCount,
          averageWeight: record.finalWeight,
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
        cattleCount: sale.headCount,
        finalWeight: sale.averageWeight,
        pricePerCwt: sale.pricePerCwt,
        totalRevenue: sale.totalRevenue,
        tagNumbers: sale.tagNumbers || undefined,
        notes: sale.notes || undefined,
        operatorEmail: sale.operatorEmail,
        createdAt: sale.createdAt?.toISOString() || new Date(sale.saleDate + 'T08:00:00.000Z').toISOString(),
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