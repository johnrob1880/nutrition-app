import { operations, type Operation, type InsertOperation, type Pen, type FeedingSchedule, type DashboardStats } from "@shared/schema";

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
        amount: "45 lbs",
        feedType: "High Protein Mix",
        status: "Active",
        protein: "18%",
        fat: "4.5%",
        fiber: "12%",
        lastUpdated: "2 hours ago",
        operatorEmail
      },
      {
        id: "SCH-002",
        penId: "pen-002",
        penName: "Pen B-2",
        time: "8:30 AM Daily",
        amount: "38 lbs",
        feedType: "Standard Grain Mix",
        status: "Active",
        protein: "14%",
        fat: "3.2%",
        fiber: "15%",
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
