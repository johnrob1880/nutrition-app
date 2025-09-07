import type { 
  Operation, 
  InsertOperation, 
  Pen, 
  CreatePenRequest, 
  FeedingPlan, 
  FeedingSchedule, 
  DashboardStats, 
  FeedIngredient, 
  UpdateWeightRequest, 
  WeightRecord, 
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
  InsertStaffMember, 
  StaffInvitation, 
  InsertStaffInvitation 
} from '@shared/schema';
import { IStorageProvider } from './IStorageProvider';

/**
 * In-Memory Storage Provider
 * 
 * This implementation provides storage functionality using in-memory data structures.
 * It's suitable for development, testing, and demo purposes.
 */
export class InMemoryStorageProvider implements IStorageProvider {
  private operations: Map<number, Operation>;
  private currentId: number;
  private pens: Map<string, Pen>;
  private penIdCounter: number;
  private feedingRecords: Map<string, FeedingRecord>;
  private feedingRecordId: number;
  private cattleSales: Map<string, CattleSale>;
  private saleId: number;
  private inviteCodes: Map<string, string>; // inviteCode -> operatorEmail
  private nutritionists: Map<string, Nutritionist>;
  private deathLosses: Map<string, DeathLoss>;
  private deathLossId: number;
  private treatments: Map<string, TreatmentRecord>;
  private treatmentId: number;
  private partialSales: Map<string, PartialSale>;
  private partialSaleId: number;
  private staffMembers: Map<number, StaffMember>;
  private staffMemberId: number;
  private staffInvitations: Map<string, StaffInvitation>;
  private staffInvitationId: number;

  constructor() {
    this.operations = new Map();
    this.currentId = 1;
    this.pens = new Map();
    this.penIdCounter = 4; // Start after existing sample pens
    this.feedingRecords = new Map();
    this.feedingRecordId = 1;
    this.cattleSales = new Map();
    this.saleId = 1;
    this.inviteCodes = new Map();
    this.nutritionists = new Map();
    this.deathLosses = new Map();
    this.deathLossId = 1;
    this.treatments = new Map();
    this.treatmentId = 1;
    this.partialSales = new Map();
    this.partialSaleId = 1;
    this.staffMembers = new Map();
    this.staffMemberId = 1;
    this.staffInvitations = new Map();
    this.staffInvitationId = 1;
    this.initializeSampleData();
  }

  private initializeSampleData() {
    this.initializeInviteCodes();
    this.initializePensData();
    this.initializeNutritionistData();
    this.initializeStaffData();
  }

  private initializeInviteCodes() {
    // Initialize sample invite codes (in production, this would come from external system)
    this.inviteCodes.set("RANCH2025", "johnrob1880@gmail.com");
    this.inviteCodes.set("CATTLE123", "jane.smith@example.com");
    this.inviteCodes.set("FEEDLOT456", "bob.johnson@example.com");
    this.inviteCodes.set("BEEF789", "mary.davis@example.com");
  }

  private initializePensData() {
    // Initialize sample pens
    const samplePens: Pen[] = [
      {
        id: "1",
        name: "North Pasture",
        operatorEmail: "johnrob1880@gmail.com",
        capacity: 100,
        current: 85,
        status: "Active",
        lastFed: "2025-09-06T14:30:00Z",
        cattleType: "Steers",
        startingWeight: 650,
        currentWeight: 850,
        marketWeight: 1200,
        feedType: "High Energy",
        isCrossbred: false,
        daysOnFeed: 120,
        averageDailyGain: 3.2,
        startDate: "2025-05-09T08:00:00Z",
        endDate: undefined,
        weightHistory: [],
        nutritionistId: undefined
      },
      {
        id: "2",
        name: "South Field",
        operatorEmail: "johnrob1880@gmail.com",
        capacity: 150,
        current: 142,
        cattleType: "Heifers",
        startingWeight: 600,
        currentWeight: 780,
        marketWeight: 1100,
        feedType: "Balanced",
        daysOnFeed: 95,
        averageDailyGain: 2.8,
        feedConversion: 7.2,
        projectedCloseoutDate: "2025-11-30",
        estimatedValue: 156200
      },
      {
        id: "3",
        name: "East Lot",
        operatorEmail: "johnrob1880@gmail.com",
        capacity: 75,
        current: 68,
        cattleType: "Mixed",
        startingWeight: 625,
        currentWeight: 820,
        marketWeight: 1150,
        feedType: "Finisher",
        daysOnFeed: 110,
        averageDailyGain: 3.0,
        feedConversion: 6.5,
        projectedCloseoutDate: "2025-12-01",
        estimatedValue: 78200
      }
    ];

    samplePens.forEach(pen => this.pens.set(pen.id, pen));
  }

  private initializeNutritionistData() {
    const sampleNutritionists: Nutritionist[] = [
      {
        id: 1,
        name: "Dr. Sarah Johnson",
        company: "Cattle Nutrition Experts",
        email: "sarah.johnson@cne.com",
        phone: "(555) 123-4567",
        specialties: ["High-energy rations", "Feed efficiency optimization"],
        operatorEmail: "johnrob1880@gmail.com",
        status: "active",
        joinedDate: "2024-01-15"
      },
      {
        id: 2,
        name: "Mike Peterson",
        company: "Ranch Feed Solutions",
        email: "mike.peterson@rfs.com",
        phone: "(555) 987-6543",
        specialties: ["Pasture management", "Mineral supplements"],
        operatorEmail: "johnrob1880@gmail.com",
        status: "active",
        joinedDate: "2024-03-20"
      }
    ];

    sampleNutritionists.forEach(nutritionist => 
      this.nutritionists.set(nutritionist.email, nutritionist)
    );
  }

  private initializeStaffData() {
    const sampleStaff: StaffMember[] = [
      {
        id: 1,
        operationId: 1,
        email: "johnrob1880@gmail.com",
        firstName: "John",
        lastName: "Robinson",
        role: "owner",
        status: "active",
        invitedAt: new Date("2024-01-01"),
        acceptedAt: new Date("2024-01-01"),
        invitedBy: "system"
      }
    ];

    sampleStaff.forEach(staff => this.staffMembers.set(staff.id, staff));
  }

  // Operation Management
  async getOperation(id: number): Promise<Operation | undefined> {
    return this.operations.get(id);
  }

  async getOperationByEmail(email: string): Promise<Operation | undefined> {
    return Array.from(this.operations.values()).find(op => op.operatorEmail === email);
  }

  async getAllOperations(): Promise<Operation[]> {
    return Array.from(this.operations.values());
  }

  async createOperation(operation: InsertOperation): Promise<Operation> {
    const newOperation: Operation = {
      ...operation,
      id: this.currentId++,
      setupDate: new Date()
    };

    this.operations.set(newOperation.id, newOperation);
    return newOperation;
  }

  async updateOperation(id: number, operation: Partial<InsertOperation>): Promise<Operation | undefined> {
    const existing = this.operations.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...operation };
    this.operations.set(id, updated);
    return updated;
  }

  async validateInviteCode(inviteCode: string, operatorEmail: string): Promise<boolean> {
    return this.inviteCodes.get(inviteCode) === operatorEmail;
  }

  // Pen Management
  async getPensByOperatorEmail(operatorEmail: string): Promise<Pen[]> {
    return Array.from(this.pens.values()).filter(pen => pen.operatorEmail === operatorEmail);
  }

  async createPen(penData: CreatePenRequest): Promise<Pen> {
    const newPen: Pen = {
      ...penData,
      id: (this.penIdCounter++).toString(),
      currentWeight: penData.startingWeight,
      daysOnFeed: 0,
      averageDailyGain: 0,
      feedConversion: 0,
      projectedCloseoutDate: "",
      estimatedValue: 0,
      nutritionistId: penData.nutritionistId
    };

    this.pens.set(newPen.id, newPen);
    return newPen;
  }

  async updatePenWeight(request: UpdateWeightRequest): Promise<Pen | undefined> {
    const pen = this.pens.get(request.penId);
    if (!pen || pen.operatorEmail !== request.operatorEmail) return undefined;

    pen.currentWeight = request.currentWeight;
    this.pens.set(request.penId, pen);
    return pen;
  }

  // Feeding Management
  async createFeedingRecord(record: InsertFeedingRecord): Promise<FeedingRecord> {
    const newRecord: FeedingRecord = {
      ...record,
      id: this.feedingRecordId++
    };

    this.feedingRecords.set(newRecord.id.toString(), newRecord);
    return newRecord;
  }

  async getFeedingRecordsByOperatorEmail(operatorEmail: string): Promise<FeedingRecord[]> {
    return Array.from(this.feedingRecords.values())
      .filter(record => record.operatorEmail === operatorEmail);
  }

  async getFeedingPlansByOperatorEmail(operatorEmail: string): Promise<FeedingPlan[]> {
    // Sample feeding plans - in real implementation would come from database
    return [
      {
        id: "1",
        penId: "1",
        name: "High Energy Finisher",
        operatorEmail: operatorEmail,
        ingredients: [
          { name: "Corn", percentage: 65, cost: 0.25, protein: 8.5, energy: 88 },
          { name: "Soybean Meal", percentage: 15, cost: 0.45, protein: 48, energy: 85 },
          { name: "Hay", percentage: 15, cost: 0.15, protein: 12, energy: 60 },
          { name: "Mineral Mix", percentage: 5, cost: 1.20, protein: 0, energy: 0 }
        ],
        totalCostPerTon: 320.50,
        proteinContent: 14.2,
        energyContent: 82.5,
        dailyFeedAmount: 28,
        estimatedDailyGain: 3.2,
        feedConversionRatio: 6.8,
        createdDate: "2024-01-15",
        lastModified: "2024-03-20",
        notes: "Optimized for maximum gain in finishing phase"
      }
    ];
  }

  async getUpcomingScheduleChanges(operatorEmail: string): Promise<UpcomingScheduleChange[]> {
    // Sample schedule changes
    return [
      {
        penId: "1",
        penName: "North Pasture",
        changeDate: "2025-09-15",
        changeType: "Feed Type Change",
        currentValue: "High Energy",
        newValue: "Finisher",
        reason: "Approaching market weight"
      }
    ];
  }

  // Dashboard and Analytics
  async getDashboardStats(operatorEmail: string): Promise<DashboardStats> {
    const pens = await this.getPensByOperatorEmail(operatorEmail);
    const totalCapacity = pens.reduce((sum, pen) => sum + pen.capacity, 0);
    const totalCurrent = pens.reduce((sum, pen) => sum + pen.current, 0);
    const staffCount = Array.from(this.staffMembers.values())
      .filter(staff => staff.status === 'active').length;

    return {
      totalPens: pens.length,
      totalCapacity,
      currentCattle: totalCurrent,
      utilizationRate: totalCapacity > 0 ? (totalCurrent / totalCapacity) * 100 : 0,
      averageWeight: pens.length > 0 ? 
        pens.reduce((sum, pen) => sum + (pen.currentWeight || 0), 0) / pens.length : 0,
      staffCount
    };
  }

  // Cattle Sales
  async sellCattle(saleRecord: InsertCattleSale): Promise<CattleSale> {
    const newSale: CattleSale = {
      ...saleRecord,
      id: this.saleId++
    };

    this.cattleSales.set(newSale.id.toString(), newSale);
    return newSale;
  }

  async getCattleSalesByOperatorEmail(operatorEmail: string): Promise<CattleSale[]> {
    return Array.from(this.cattleSales.values())
      .filter(sale => sale.operatorEmail === operatorEmail);
  }

  // Nutritionist Management
  async getNutritionistsByOperatorEmail(operatorEmail: string): Promise<Nutritionist[]> {
    return Array.from(this.nutritionists.values())
      .filter(nutritionist => nutritionist.operatorEmail === operatorEmail);
  }

  async acceptNutritionistInvitation(request: AcceptInvitationRequest): Promise<Nutritionist | undefined> {
    // Implementation would handle accepting nutritionist invitations
    return undefined;
  }

  // Health Tracking - Death Loss
  async recordDeathLoss(record: InsertDeathLoss): Promise<DeathLoss> {
    const newRecord: DeathLoss = {
      ...record,
      id: this.deathLossId++
    };

    this.deathLosses.set(newRecord.id.toString(), newRecord);
    return newRecord;
  }

  async getDeathLossByOperatorEmail(operatorEmail: string): Promise<DeathLoss[]> {
    return Array.from(this.deathLosses.values())
      .filter(loss => loss.operatorEmail === operatorEmail);
  }

  // Health Tracking - Treatments
  async recordTreatment(record: InsertTreatmentRecord): Promise<TreatmentRecord> {
    const newRecord: TreatmentRecord = {
      ...record,
      id: this.treatmentId++
    };

    this.treatments.set(newRecord.id.toString(), newRecord);
    return newRecord;
  }

  async getTreatmentsByOperatorEmail(operatorEmail: string): Promise<TreatmentRecord[]> {
    return Array.from(this.treatments.values())
      .filter(treatment => treatment.operatorEmail === operatorEmail);
  }

  // Partial Sales
  async recordPartialSale(record: InsertPartialSale): Promise<PartialSale> {
    const newRecord: PartialSale = {
      ...record,
      id: this.partialSaleId++
    };

    this.partialSales.set(newRecord.id.toString(), newRecord);
    return newRecord;
  }

  async getPartialSalesByOperatorEmail(operatorEmail: string): Promise<PartialSale[]> {
    return Array.from(this.partialSales.values())
      .filter(sale => sale.operatorEmail === operatorEmail);
  }

  // Staff Management
  async inviteStaffMember(invitation: InsertStaffInvitation): Promise<StaffInvitation> {
    const newInvitation: StaffInvitation = {
      ...invitation,
      id: this.staffInvitationId++,
      token: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      usedAt: null,
      createdAt: new Date()
    };

    this.staffInvitations.set(newInvitation.token, newInvitation);
    return newInvitation;
  }

  async getStaffMembersByOperationId(operationId: number): Promise<StaffMember[]> {
    return Array.from(this.staffMembers.values())
      .filter(staff => staff.operationId === operationId);
  }

  async acceptStaffInvitation(token: string): Promise<StaffMember | undefined> {
    const invitation = this.staffInvitations.get(token);
    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      return undefined;
    }

    // Mark invitation as used
    invitation.usedAt = new Date();
    this.staffInvitations.set(token, invitation);

    // Create staff member
    const newStaff: StaffMember = {
      id: this.staffMemberId++,
      operationId: invitation.operationId,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      role: "staff",
      status: "active",
      invitedAt: invitation.createdAt,
      acceptedAt: new Date(),
      invitedBy: invitation.invitedBy
    };

    this.staffMembers.set(newStaff.id, newStaff);
    return newStaff;
  }

  async getStaffMemberByEmail(email: string): Promise<StaffMember | undefined> {
    return Array.from(this.staffMembers.values())
      .find(staff => staff.email === email);
  }

  async getUserRole(email: string): Promise<{ role: 'owner' | 'staff', operationId: number } | undefined> {
    const staff = await this.getStaffMemberByEmail(email);
    if (staff) {
      return { role: staff.role, operationId: staff.operationId };
    }
    return undefined;
  }
}