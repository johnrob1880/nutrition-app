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
  InsertStaffMember, 
  StaffInvitation, 
  InsertStaffInvitation 
} from '@shared/schema';

/**
 * Storage Provider Interface
 * 
 * This interface defines all storage operations that must be implemented
 * by any storage backend (in-memory, PostgreSQL, etc.)
 */
export interface IStorageProvider {
  // Operation Management
  getOperation(id: number): Promise<Operation | undefined>;
  getOperationByEmail(email: string): Promise<Operation | undefined>;
  createOperation(operation: InsertOperation): Promise<Operation>;
  updateOperation(id: number, operation: Partial<InsertOperation>): Promise<Operation | undefined>;
  validateInviteCode(inviteCode: string, operatorEmail: string): Promise<boolean>;

  // Pen Management
  getPensByOperatorEmail(operatorEmail: string): Promise<Pen[]>;
  createPen(penData: CreatePenRequest): Promise<Pen>;
  updatePenWeight(request: UpdateWeightRequest): Promise<Pen | undefined>;

  // Feeding Management
  createFeedingRecord(record: InsertFeedingRecord): Promise<FeedingRecord>;
  getFeedingRecordsByOperatorEmail(operatorEmail: string): Promise<FeedingRecord[]>;
  getFeedingPlansByOperatorEmail(operatorEmail: string): Promise<FeedingPlan[]>;
  getUpcomingScheduleChanges(operatorEmail: string): Promise<UpcomingScheduleChange[]>;

  // Dashboard and Analytics
  getDashboardStats(operatorEmail: string): Promise<DashboardStats>;

  // Cattle Sales
  sellCattle(saleRecord: InsertCattleSale): Promise<CattleSale>;
  getCattleSalesByOperatorEmail(operatorEmail: string): Promise<CattleSale[]>;

  // Nutritionist Management
  getNutritionistsByOperatorEmail(operatorEmail: string): Promise<Nutritionist[]>;
  acceptNutritionistInvitation(request: AcceptInvitationRequest): Promise<Nutritionist | undefined>;

  // Health Tracking - Death Loss
  recordDeathLoss(record: InsertDeathLoss): Promise<DeathLoss>;
  getDeathLossByOperatorEmail(operatorEmail: string): Promise<DeathLoss[]>;

  // Health Tracking - Treatments
  recordTreatment(record: InsertTreatmentRecord): Promise<TreatmentRecord>;
  getTreatmentsByOperatorEmail(operatorEmail: string): Promise<TreatmentRecord[]>;

  // Partial Sales
  recordPartialSale(record: InsertPartialSale): Promise<PartialSale>;
  getPartialSalesByOperatorEmail(operatorEmail: string): Promise<PartialSale[]>;

  // Staff Management
  inviteStaffMember(invitation: InsertStaffInvitation): Promise<StaffInvitation>;
  getStaffMembersByOperationId(operationId: number): Promise<StaffMember[]>;
  acceptStaffInvitation(token: string): Promise<StaffMember | undefined>;
  getStaffMemberByEmail(email: string): Promise<StaffMember | undefined>;
  getUserRole(email: string): Promise<{ role: 'owner' | 'staff', operationId: number } | undefined>;
}

/**
 * Storage Provider Configuration
 */
export interface StorageConfig {
  type: 'memory' | 'postgresql';
  connectionString?: string;
  poolConfig?: {
    min: number;
    max: number;
  };
}