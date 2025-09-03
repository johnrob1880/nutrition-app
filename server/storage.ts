import { operations, type Operation, type InsertOperation, type Pen, type CreatePenRequest, type FeedingPlan, type FeedingSchedule, type DashboardStats, type FeedIngredient, type UpdateWeightRequest, type WeightRecord, type UpcomingScheduleChange, type FeedingRecord, type InsertFeedingRecord, type CattleSale, type InsertCattleSale, type Nutritionist, type AcceptInvitationRequest } from "@shared/schema";

export interface IStorage {
  getOperation(id: number): Promise<Operation | undefined>;
  getOperationByEmail(email: string): Promise<Operation | undefined>;
  createOperation(operation: InsertOperation): Promise<Operation>;
  updateOperation(id: number, operation: Partial<InsertOperation>): Promise<Operation | undefined>;
  // Invite code validation
  validateInviteCode(inviteCode: string, operatorEmail: string): Promise<boolean>;
  // External system simulation
  getPensByOperatorEmail(operatorEmail: string): Promise<Pen[]>;
  createPen(penData: CreatePenRequest): Promise<Pen>;
  getFeedingPlansByOperatorEmail(operatorEmail: string): Promise<FeedingPlan[]>;
  getUpcomingScheduleChanges(operatorEmail: string): Promise<UpcomingScheduleChange[]>;
  getDashboardStats(operatorEmail: string): Promise<DashboardStats>;
  updatePenWeight(request: UpdateWeightRequest): Promise<Pen | undefined>;
  // Feeding records
  createFeedingRecord(record: InsertFeedingRecord): Promise<FeedingRecord>;
  getFeedingRecordsByOperatorEmail(operatorEmail: string): Promise<FeedingRecord[]>;
  // Cattle sales
  sellCattle(saleRecord: InsertCattleSale): Promise<CattleSale>;
  getCattleSalesByOperatorEmail(operatorEmail: string): Promise<CattleSale[]>;
  // Nutritionists
  getNutritionistsByOperatorEmail(operatorEmail: string): Promise<Nutritionist[]>;
  acceptNutritionistInvitation(request: AcceptInvitationRequest): Promise<Nutritionist | undefined>;
}

export class MemStorage implements IStorage {
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
    this.initializePensData();
    this.initializeInviteCodes();
    this.initializeNutritionistData();
  }

  private initializeInviteCodes() {
    // Initialize sample invite codes (in production, this would come from external system)
    this.inviteCodes.set("RANCH2025", "johnrob1880@gmail.com");
    this.inviteCodes.set("CATTLE123", "jane.smith@example.com");
    this.inviteCodes.set("FEEDLOT456", "bob.johnson@example.com");
    this.inviteCodes.set("BEEF789", "mary.davis@example.com");
  }

  private initializePensData() {
    // Initialize sample pen data
    const samplePens: Pen[] = [
      {
        id: "pen-001",
        name: "Pen A-1",
        capacity: 25,
        current: 23,
        status: "Active",
        feedType: "High Protein Mix",
        lastFed: "7:15 AM Today",
        operatorEmail: "johnrob1880@gmail.com",
        nutritionistId: "NUT-001",
        cattleType: "Steers",
        startingWeight: 650,
        marketWeight: 1350,
        averageDailyGain: 3.2,
        isCrossbred: true,
        currentWeight: 890,
        weightHistory: [
          { date: "2025-01-01", weight: 650, recordedBy: "johnrob1880@gmail.com" },
          { date: "2025-01-13", weight: 890, recordedBy: "johnrob1880@gmail.com" }
        ]
      },
      {
        id: "pen-002",
        name: "Pen B-2",
        capacity: 30,
        current: 28,
        status: "Active",
        feedType: "Standard Grain Mix",
        lastFed: "8:45 AM Today",
        operatorEmail: "johnrob1880@gmail.com",
        cattleType: "Heifers",
        startingWeight: 550,
        marketWeight: 1200,
        averageDailyGain: 2.8,
        isCrossbred: false,
        currentWeight: 785,
        nutritionistId: "NUT-001",
        weightHistory: [
          { date: "2025-01-01", weight: 550, recordedBy: "johnrob1880@gmail.com" },
          { date: "2025-01-13", weight: 785, recordedBy: "johnrob1880@gmail.com" }
        ]
      },
      {
        id: "pen-003",
        name: "Pen C-1",
        capacity: 20,
        current: 0,
        status: "Maintenance",
        feedType: "N/A",
        lastFed: "N/A",
        operatorEmail: "johnrob1880@gmail.com",
        cattleType: "Mixed",
        startingWeight: 600,
        marketWeight: 1275,
        averageDailyGain: 3.0,
        isCrossbred: true,
        currentWeight: 600,
        weightHistory: [
          { date: "2025-01-01", weight: 600, recordedBy: "johnrob1880@gmail.com" }
        ]
      }
    ];

    samplePens.forEach(pen => {
      this.pens.set(pen.id, pen);
    });
  }

  async getOperation(id: number): Promise<Operation | undefined> {
    return this.operations.get(id);
  }

  async getOperationByEmail(email: string): Promise<Operation | undefined> {
    return Array.from(this.operations.values()).find(
      (operation) => operation.operatorEmail === email,
    );
  }

  async createOperation(insertOperation: InsertOperation): Promise<Operation> {
    const id = this.currentId++;
    const operation: Operation = { 
      ...insertOperation, 
      id,
      setupDate: new Date()
    };
    this.operations.set(id, operation);
    return operation;
  }

  async updateOperation(id: number, updateData: Partial<InsertOperation>): Promise<Operation | undefined> {
    const operation = this.operations.get(id);
    if (!operation) return undefined;
    
    const updatedOperation = { ...operation, ...updateData };
    this.operations.set(id, updatedOperation);
    return updatedOperation;
  }

  async validateInviteCode(inviteCode: string, operatorEmail: string): Promise<boolean> {
    // In production, this would validate against external system
    const associatedEmail = this.inviteCodes.get(inviteCode);
    return associatedEmail === operatorEmail;
  }

  // Simulate external system data
  async getPensByOperatorEmail(operatorEmail: string): Promise<Pen[]> {
    return Array.from(this.pens.values()).filter(pen => pen.operatorEmail === operatorEmail);
  }

  async createPen(penData: CreatePenRequest): Promise<Pen> {
    const penId = `pen-${String(this.penIdCounter++).padStart(3, '0')}`;
    
    const newPen: Pen = {
      id: penId,
      name: penData.name,
      capacity: penData.capacity,
      current: penData.current,
      status: 'Active',
      feedType: penData.feedType,
      lastFed: 'Never',
      operatorEmail: penData.operatorEmail,
      cattleType: penData.cattleType,
      startingWeight: penData.startingWeight,
      marketWeight: penData.marketWeight,
      averageDailyGain: 0, // Will be calculated over time
      isCrossbred: penData.isCrossbred,
      currentWeight: penData.startingWeight, // Start with starting weight
      nutritionistId: penData.nutritionistId, // Store the selected nutritionist
      weightHistory: [{
        date: new Date().toISOString().split('T')[0],
        weight: penData.startingWeight,
        recordedBy: penData.operatorEmail
      }]
    };

    this.pens.set(penId, newPen);
    return newPen;
  }

  async updatePenWeight(request: UpdateWeightRequest): Promise<Pen | undefined> {
    const pen = this.pens.get(request.penId);
    if (!pen || pen.operatorEmail !== request.operatorEmail) {
      return undefined;
    }

    // Validate that new weight is greater than starting weight
    if (request.newWeight <= pen.startingWeight) {
      throw new Error("Current weight must be greater than starting weight");
    }

    // Add new weight record to history
    const newWeightRecord: WeightRecord = {
      date: new Date().toISOString().split('T')[0],
      weight: request.newWeight,
      recordedBy: request.operatorEmail
    };

    // Update pen with new current weight and add to history
    const updatedPen: Pen = {
      ...pen,
      currentWeight: request.newWeight,
      weightHistory: [...pen.weightHistory, newWeightRecord]
    };

    this.pens.set(pen.id, updatedPen);
    return updatedPen;
  }

  async getFeedingPlansByOperatorEmail(operatorEmail: string): Promise<FeedingPlan[]> {
    const now = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    // Using type assertion to handle the complex nested types with strict literal unions
    const plans = [
      {
        id: "PLAN-001",
        penId: "pen-001",
        penName: "Pen A-1",
        planName: "High Protein Growth Phase",
        startDate: formatDate(new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)), // Started 15 days ago
        daysToFeed: 45,
        currentDay: 16,
        status: "Active" as const,
        feedType: "High Protein Mix",
        schedules: [
          {
            id: "SCH-001-1",
            time: "7:00 AM",
            totalAmount: "45 lbs",
            ingredients: [
              {
                name: "Corn Grain",
                category: "Grain" as const,
                amount: "20",
                unit: "lbs" as const,
                percentage: "44.4%",
                nutritionalValue: {
                  protein: "8.5%",
                  fat: "3.8%",
                  fiber: "2.2%",
                  moisture: "14%"
                }
              },
              {
                name: "Soybean Meal",
                category: "Protein" as const,
                amount: "12",
                unit: "lbs" as const,
                percentage: "26.7%",
                nutritionalValue: {
                  protein: "48%",
                  fat: "1.5%",
                  fiber: "7%",
                  moisture: "12%"
                }
              },
              {
                name: "Alfalfa Hay",
                category: "Feedstuff",
                amount: "10",
                unit: "lbs",
                percentage: "22.2%",
                nutritionalValue: {
                  protein: "17%",
                  fat: "2.5%",
                  fiber: "25%",
                  moisture: "10%"
                }
              },
              {
                name: "Vitamin E Supplement",
                category: "Supplement",
                amount: "2",
                unit: "oz",
                percentage: "2.8%",
                nutritionalValue: {
                  protein: "0%",
                  fat: "0%",
                  fiber: "0%",
                  moisture: "0%"
                }
              },
              {
                name: "Salt Mix",
                category: "Mineral",
                amount: "1",
                unit: "lbs",
                percentage: "2.2%"
              }
            ],
            totalNutrition: {
              protein: "18.2%",
              fat: "2.8%",
              fiber: "8.5%",
              moisture: "12.5%"
            }
          }
        ],
        operatorEmail
      },
      {
        id: "PLAN-002",
        penId: "pen-002",
        penName: "Pen B-2",
        planName: "Standard Growth Program",
        startDate: formatDate(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)), // Started 8 days ago
        daysToFeed: 60,
        currentDay: 9,
        status: "Active" as const,
        feedType: "Standard Growth Mix",
        schedules: [
          {
            id: "SCH-002-1",
            time: "6:30 AM",
            totalAmount: "38 lbs",
            ingredients: [
              {
                name: "Corn Silage",
                category: "Feedstuff",
                amount: "22",
                unit: "lbs",
                percentage: "57.9%",
                nutritionalValue: {
                  protein: "8.0%",
                  fat: "3.2%",
                  fiber: "22%",
                  moisture: "65%"
                }
              },
              {
                name: "Cottonseed Meal",
                category: "Protein",
                amount: "8",
                unit: "lbs",
                percentage: "21.1%",
                nutritionalValue: {
                  protein: "41%",
                  fat: "5.8%",
                  fiber: "12%",
                  moisture: "10%"
                }
              },
              {
                name: "Wheat Middlings",
                category: "Grain",
                amount: "6",
                unit: "lbs",
                percentage: "15.8%",
                nutritionalValue: {
                  protein: "17%",
                  fat: "4.2%",
                  fiber: "9%",
                  moisture: "12%"
                }
              },
              {
                name: "Limestone",
                category: "Mineral",
                amount: "1.5",
                unit: "lbs",
                percentage: "3.9%"
              },
              {
                name: "Trace Mineral Mix",
                category: "Supplement",
                amount: "0.5",
                unit: "lbs",
                percentage: "1.3%"
              }
            ],
            totalNutrition: {
              protein: "16.8%",
              fat: "4.1%",
              fiber: "18.2%",
              moisture: "45.8%"
            }
          },
          {
            id: "SCH-002-2",
            time: "5:00 PM",
            totalAmount: "38 lbs",
            ingredients: [
              {
                name: "Corn Silage",
                category: "Feedstuff",
                amount: "22",
                unit: "lbs",
                percentage: "57.9%",
                nutritionalValue: {
                  protein: "8.0%",
                  fat: "3.2%",
                  fiber: "22%",
                  moisture: "65%"
                }
              },
              {
                name: "Cottonseed Meal",
                category: "Protein",
                amount: "8",
                unit: "lbs",
                percentage: "21.1%",
                nutritionalValue: {
                  protein: "41%",
                  fat: "5.8%",
                  fiber: "12%",
                  moisture: "10%"
                }
              },
              {
                name: "Wheat Middlings",
                category: "Grain",
                amount: "6",
                unit: "lbs",
                percentage: "15.8%",
                nutritionalValue: {
                  protein: "17%",
                  fat: "4.2%",
                  fiber: "9%",
                  moisture: "12%"
                }
              },
              {
                name: "Limestone",
                category: "Mineral",
                amount: "1.5",
                unit: "lbs",
                percentage: "3.9%"
              },
              {
                name: "Trace Mineral Mix",
                category: "Supplement",
                amount: "0.5",
                unit: "lbs",
                percentage: "1.3%"
              }
            ],
            totalNutrition: {
              protein: "16.8%",
              fat: "4.1%",
              fiber: "18.2%",
              moisture: "45.8%"
            }
          }
        ],
        operatorEmail
      },
      {
        id: "PLAN-003",
        penId: "pen-003",
        penName: "Pen C-3",
        planName: "Finishing Ration Phase 1",
        startDate: formatDate(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)), // Starts in 3 days
        daysToFeed: 30,
        currentDay: 0,
        status: "Upcoming" as const,
        feedType: "Finishing Ration",
        schedules: [
          {
            id: "SCH-003-1",
            time: "8:00 AM",
            totalAmount: "52 lbs",
            ingredients: [
              {
                name: "Rolled Barley",
                category: "Grain",
                amount: "25",
                unit: "lbs",
                percentage: "48.1%",
                nutritionalValue: {
                  protein: "11.5%",
                  fat: "2.1%",
                  fiber: "5.8%",
                  moisture: "12%"
                }
              },
              {
                name: "Canola Meal",
                category: "Protein",
                amount: "15",
                unit: "lbs",
                percentage: "28.8%",
                nutritionalValue: {
                  protein: "36%",
                  fat: "3.5%",
                  fiber: "11%",
                  moisture: "12%"
                }
              },
              {
                name: "Grass Hay",
                category: "Feedstuff",
                amount: "8",
                unit: "lbs",
                percentage: "15.4%",
                nutritionalValue: {
                  protein: "12%",
                  fat: "2.8%",
                  fiber: "30%",
                  moisture: "15%"
                }
              },
              {
                name: "Molasses",
                category: "Supplement",
                amount: "3",
                unit: "lbs",
                percentage: "5.8%",
                nutritionalValue: {
                  protein: "3%",
                  fat: "0.1%",
                  fiber: "0%",
                  moisture: "25%"
                }
              },
              {
                name: "Dicalcium Phosphate",
                category: "Mineral",
                amount: "1",
                unit: "lbs",
                percentage: "1.9%"
              }
            ],
            totalNutrition: {
              protein: "19.5%",
              fat: "2.7%",
              fiber: "12.8%",
              moisture: "14.2%"
            }
          }
        ],
        operatorEmail
      }
    ] as FeedingPlan[];
    
    return plans.filter(plan => plan.operatorEmail === operatorEmail);
  }

  async getUpcomingScheduleChanges(operatorEmail: string): Promise<UpcomingScheduleChange[]> {
    const now = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const getDaysFromNow = (date: Date) => Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    const changes: UpcomingScheduleChange[] = [
      {
        id: "CHANGE-001",
        penId: "pen-001",
        penName: "Pen A-1",
        changeType: "Plan End",
        changeDate: formatDate(new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000)), // 29 days from now
        daysFromNow: 29,
        currentPlan: "High Protein Growth Phase",
        description: "Current feeding plan will end, transition to finishing phase",
        operatorEmail
      },
      {
        id: "CHANGE-002",
        penId: "pen-003",
        penName: "Pen C-3",
        changeType: "Plan Start",
        changeDate: formatDate(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)), // 3 days from now
        daysFromNow: 3,
        newPlan: "Finishing Ration Phase 1",
        description: "Begin new finishing ration feeding plan",
        operatorEmail
      },
      {
        id: "CHANGE-003",
        penId: "pen-002",
        penName: "Pen B-2",
        changeType: "Feed Change",
        changeDate: formatDate(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)), // 2 days from now
        daysFromNow: 2,
        currentPlan: "Standard Growth Program",
        description: "Increase feed amount from 38 lbs to 42 lbs per feeding",
        operatorEmail
      }
    ] as UpcomingScheduleChange[];
    
    return changes.filter(change => change.operatorEmail === operatorEmail && change.daysFromNow <= 5);
  }

  async getDashboardStats(operatorEmail: string): Promise<DashboardStats> {
    const pens = await this.getPensByOperatorEmail(operatorEmail);
    const feedingPlans = await this.getFeedingPlansByOperatorEmail(operatorEmail);
    
    const totalCattle = pens.reduce((sum, pen) => sum + pen.current, 0);
    const activeSchedules = feedingPlans.filter(plan => plan.status === 'Active').length;
    
    return {
      totalPens: pens.length,
      totalCattle,
      activeSchedules,
      avgFeedPerDay: "342 lbs",
      lastSync: "15 minutes ago"
    };
  }

  async createFeedingRecord(record: InsertFeedingRecord): Promise<FeedingRecord> {
    const id = `FEED-${this.feedingRecordId.toString().padStart(3, '0')}`;
    this.feedingRecordId++;

    const feedingRecord: FeedingRecord = {
      id,
      operationId: record.operationId,
      penId: record.penId,
      scheduleId: record.scheduleId,
      plannedAmount: record.plannedAmount,
      actualIngredients: record.actualIngredients,
      feedingTime: new Date().toISOString(),
      operatorEmail: record.operatorEmail,
      createdAt: new Date().toISOString(),
    };

    this.feedingRecords.set(id, feedingRecord);
    return feedingRecord;
  }

  async getFeedingRecordsByOperatorEmail(operatorEmail: string): Promise<FeedingRecord[]> {
    return Array.from(this.feedingRecords.values()).filter(
      record => record.operatorEmail === operatorEmail
    );
  }

  async sellCattle(saleRecord: InsertCattleSale): Promise<CattleSale> {
    const id = `SALE-${this.saleId.toString().padStart(3, '0')}`;
    this.saleId++;

    // Get the pen to extract cattle information
    const pen = this.pens.get(saleRecord.penId);
    if (!pen) {
      throw new Error(`Pen with ID ${saleRecord.penId} not found`);
    }

    // Calculate total revenue (final weight * price per cwt / 100 * cattle count)
    const totalRevenue = (saleRecord.finalWeight * saleRecord.pricePerCwt / 100) * pen.current;

    // Calculate days on feed - find the earliest feeding plan start date for this pen as reference
    // If no feeding plans exist, use a default calculation based on expected 180-day feeding period
    const feedingPlans = await this.getFeedingPlansByOperatorEmail(saleRecord.operatorEmail);
    const penFeedingPlans = feedingPlans.filter(plan => plan.penId === saleRecord.penId);
    
    let startDate: Date;
    if (penFeedingPlans.length > 0) {
      // Use the earliest feeding plan start date
      const earliestPlan = penFeedingPlans.reduce((earliest, current) => 
        new Date(current.startDate) < new Date(earliest.startDate) ? current : earliest
      );
      startDate = new Date(earliestPlan.startDate);
    } else {
      // Fallback: estimate start date as 180 days before sale date (typical feeding period)
      startDate = new Date(new Date(saleRecord.saleDate).getTime() - (180 * 24 * 60 * 60 * 1000));
    }

    const saleDate = new Date(saleRecord.saleDate);
    const daysOnFeed = Math.ceil((saleDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    
    // Calculate average daily gain: (final weight - starting weight) / days on feed
    const weightGain = saleRecord.finalWeight - pen.startingWeight;
    const averageDailyGain = daysOnFeed > 0 ? Math.round((weightGain / daysOnFeed) * 100) / 100 : 0;

    const cattleSale: CattleSale = {
      id,
      operationId: saleRecord.operationId,
      penId: saleRecord.penId,
      penName: pen.name,
      finalWeight: saleRecord.finalWeight,
      pricePerCwt: saleRecord.pricePerCwt,
      totalRevenue,
      cattleCount: pen.current,
      cattleType: pen.cattleType,
      startingWeight: pen.startingWeight,
      averageDailyGain,
      daysOnFeed,
      saleDate: saleRecord.saleDate,
      operatorEmail: saleRecord.operatorEmail,
      createdAt: new Date().toISOString(),
    };

    this.cattleSales.set(id, cattleSale);

    // Update pen to reflect sold cattle (set current to 0 and status to inactive)
    const updatedPen: Pen = {
      ...pen,
      current: 0,
      status: 'Inactive',
      lastFed: 'Cattle Sold'
    };
    this.pens.set(saleRecord.penId, updatedPen);

    return cattleSale;
  }

  async getCattleSalesByOperatorEmail(operatorEmail: string): Promise<CattleSale[]> {
    return Array.from(this.cattleSales.values()).filter(
      sale => sale.operatorEmail === operatorEmail
    );
  }

  async getNutritionistsByOperatorEmail(operatorEmail: string): Promise<Nutritionist[]> {
    return Array.from(this.nutritionists.values()).filter(
      nutritionist => nutritionist.operatorEmail === operatorEmail
    );
  }

  async acceptNutritionistInvitation(request: AcceptInvitationRequest): Promise<Nutritionist | undefined> {
    const nutritionist = this.nutritionists.get(request.nutritionistId);
    
    if (!nutritionist || nutritionist.operatorEmail !== request.operatorEmail) {
      return undefined;
    }

    if (nutritionist.status !== 'Invited') {
      return nutritionist; // Already accepted or different status
    }

    const updatedNutritionist: Nutritionist = {
      ...nutritionist,
      status: 'Active',
      acceptedAt: new Date().toISOString(),
    };

    this.nutritionists.set(request.nutritionistId, updatedNutritionist);
    return updatedNutritionist;
  }

  private initializeNutritionistData() {
    // Sample nutritionist invitations for testing
    const sampleNutritionists: Nutritionist[] = [
      {
        id: "NUT-001",
        personalName: "Dr. Sarah Johnson",
        businessName: "Prairie Nutrition Solutions",
        operatorEmail: "johnrob1880@gmail.com",
        status: "Invited",
        invitedAt: new Date().toISOString(),
      },
      {
        id: "NUT-002", 
        personalName: "Mike Rodriguez",
        businessName: "Cattle Feed Experts Inc.",
        operatorEmail: "johnrob1880@gmail.com",
        status: "Active",
        invitedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        acceptedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      },
      {
        id: "NUT-003",
        personalName: "Dr. Emily Chen",
        businessName: "Advanced Animal Nutrition",
        operatorEmail: "jane.smith@example.com",
        status: "Invited",
        invitedAt: new Date().toISOString(),
      },
    ];

    sampleNutritionists.forEach(nutritionist => {
      this.nutritionists.set(nutritionist.id, nutritionist);
    });
  }
}

export const storage = new MemStorage();
