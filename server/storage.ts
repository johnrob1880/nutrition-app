import { operations, type Operation, type InsertOperation, type Pen, type FeedingSchedule, type DashboardStats, type FeedIngredient } from "@shared/schema";

export interface IStorage {
  getOperation(id: number): Promise<Operation | undefined>;
  getOperationByEmail(email: string): Promise<Operation | undefined>;
  createOperation(operation: InsertOperation): Promise<Operation>;
  updateOperation(id: number, operation: Partial<InsertOperation>): Promise<Operation | undefined>;
  // External system simulation
  getPensByOperatorEmail(operatorEmail: string): Promise<Pen[]>;
  getSchedulesByOperatorEmail(operatorEmail: string): Promise<FeedingSchedule[]>;
  getDashboardStats(operatorEmail: string): Promise<DashboardStats>;
}

export class MemStorage implements IStorage {
  private operations: Map<number, Operation>;
  private currentId: number;

  constructor() {
    this.operations = new Map();
    this.currentId = 1;
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

  // Simulate external system data
  async getPensByOperatorEmail(operatorEmail: string): Promise<Pen[]> {
    // Simulate external system data based on operator email
    return [
      {
        id: "pen-001",
        name: "Pen A-1",
        capacity: 25,
        current: 23,
        status: "Active",
        feedType: "High Protein Mix",
        lastFed: "7:15 AM Today",
        operatorEmail
      },
      {
        id: "pen-002",
        name: "Pen B-2",
        capacity: 30,
        current: 28,
        status: "Active",
        feedType: "Standard Grain Mix",
        lastFed: "8:45 AM Today",
        operatorEmail
      },
      {
        id: "pen-003",
        name: "Pen C-1",
        capacity: 20,
        current: 0,
        status: "Maintenance",
        feedType: "N/A",
        lastFed: "N/A",
        operatorEmail
      }
    ];
  }

  async getSchedulesByOperatorEmail(operatorEmail: string): Promise<FeedingSchedule[]> {
    return [
      {
        id: "SCH-001",
        penId: "pen-001",
        penName: "Pen A-1",
        time: "7:00 AM Daily",
        totalAmount: "45 lbs",
        feedType: "High Protein Mix",
        status: "Active",
        ingredients: [
          {
            name: "Corn Grain",
            category: "Grain",
            amount: "20",
            unit: "lbs",
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
            category: "Protein",
            amount: "12",
            unit: "lbs",
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
              fiber: "32%",
              moisture: "15%"
            }
          },
          {
            name: "Calcium Carbonate",
            category: "Mineral",
            amount: "2",
            unit: "lbs",
            percentage: "4.4%"
          },
          {
            name: "Vitamin E Supplement",
            category: "Supplement",
            amount: "1",
            unit: "lbs",
            percentage: "2.2%"
          }
        ],
        totalNutrition: {
          protein: "18%",
          fat: "4.5%",
          fiber: "12%",
          moisture: "14.2%"
        },
        lastUpdated: "2 hours ago",
        operatorEmail
      },
      {
        id: "SCH-002",
        penId: "pen-002",
        penName: "Pen B-2",
        time: "8:30 AM Daily",
        totalAmount: "38 lbs",
        feedType: "Standard Grain Mix",
        status: "Active",
        ingredients: [
          {
            name: "Barley Grain",
            category: "Grain",
            amount: "18",
            unit: "lbs",
            percentage: "47.4%",
            nutritionalValue: {
              protein: "11%",
              fat: "2.3%",
              fiber: "5.4%",
              moisture: "12%"
            }
          },
          {
            name: "Wheat Middlings",
            category: "Feedstuff",
            amount: "10",
            unit: "lbs",
            percentage: "26.3%",
            nutritionalValue: {
              protein: "16%",
              fat: "4.2%",
              fiber: "8.5%",
              moisture: "11%"
            }
          },
          {
            name: "Cottonseed Meal",
            category: "Protein",
            amount: "6",
            unit: "lbs",
            percentage: "15.8%",
            nutritionalValue: {
              protein: "41%",
              fat: "6.8%",
              fiber: "12%",
              moisture: "10%"
            }
          },
          {
            name: "Salt Mix",
            category: "Mineral",
            amount: "2.5",
            unit: "lbs",
            percentage: "6.6%"
          },
          {
            name: "Molasses",
            category: "Supplement",
            amount: "1.5",
            unit: "lbs",
            percentage: "3.9%",
            nutritionalValue: {
              protein: "3%",
              fat: "0.1%",
              fiber: "0%",
              moisture: "25%"
            }
          }
        ],
        totalNutrition: {
          protein: "14%",
          fat: "3.2%",
          fiber: "15%",
          moisture: "12.8%"
        },
        lastUpdated: "1 day ago",
        operatorEmail
      }
    ];
  }

  async getDashboardStats(operatorEmail: string): Promise<DashboardStats> {
    const pens = await this.getPensByOperatorEmail(operatorEmail);
    const schedules = await this.getSchedulesByOperatorEmail(operatorEmail);
    
    const totalCattle = pens.reduce((sum, pen) => sum + pen.current, 0);
    const activeSchedules = schedules.filter(s => s.status === 'Active').length;
    
    return {
      totalPens: pens.length,
      totalCattle,
      activeSchedules,
      avgFeedPerDay: "342 lbs",
      lastSync: "15 minutes ago"
    };
  }
}

export const storage = new MemStorage();
