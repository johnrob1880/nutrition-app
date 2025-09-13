import type {
  Operation,
  InsertOperation,
  Pen,
  CreatePenRequest,
  DashboardStats,
  UpdateWeightRequest,
  UpcomingScheduleChange,
  FeedingRecord,
  InsertFeedingRecord,
  CattleSale,
  InsertCattleSale,
  DeathLoss,
  InsertDeathLoss,
  TreatmentRecord,
  InsertTreatmentRecord,
  PartialSale,
  InsertPartialSale,
  StaffMember,
  InsertStaffMember,
  StaffInvitation,
  InsertStaffInvitation,
  UserNotification,
  InsertUserNotification,
  NutritionistTask,
  InsertNutritionistTask
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
  /** @deprecated Use getPensByOperationId instead */
  getPensByOperatorEmail(operatorEmail: string): Promise<Pen[]>;
  getPensByOperationId(operationId: number): Promise<Pen[]>;
  createPen(penData: CreatePenRequest): Promise<Pen>;
  updatePenWeight(request: UpdateWeightRequest): Promise<Pen | undefined>;

  // Feeding Management
  createFeedingRecord(record: InsertFeedingRecord): Promise<FeedingRecord>;
  /** @deprecated Use getFeedingRecordsByOperationId instead */
  getFeedingRecordsByOperatorEmail(operatorEmail: string): Promise<FeedingRecord[]>;
  getFeedingRecordsByOperationId(operationId: number): Promise<FeedingRecord[]>;
  /** @deprecated Use getFeedingPlansByOperationId instead */
  getFeedingPlansByOperatorEmail(operatorEmail: string): Promise<any[]>;
  getFeedingPlansByOperationId(operationId: number): Promise<any[]>;
  /** @deprecated Use getUpcomingScheduleChangesByOperationId instead */
  getUpcomingScheduleChanges(operatorEmail: string): Promise<UpcomingScheduleChange[]>;
  getUpcomingScheduleChangesByOperationId(operationId: number): Promise<UpcomingScheduleChange[]>;

  // Dashboard and Analytics
  /** @deprecated Use getDashboardStatsByOperationId instead */
  getDashboardStats(operatorEmail: string): Promise<DashboardStats>;
  getDashboardStatsByOperationId(operationId: number): Promise<DashboardStats>;

  // Cattle Sales
  sellCattle(saleRecord: InsertCattleSale): Promise<CattleSale>;
  /** @deprecated Use getCattleSalesByOperationId instead */
  getCattleSalesByOperatorEmail(operatorEmail: string): Promise<CattleSale[]>;
  getCattleSalesByOperationId(operationId: number): Promise<CattleSale[]>;


  // Health Tracking - Death Loss
  recordDeathLoss(record: InsertDeathLoss): Promise<DeathLoss>;
  /** @deprecated Use getDeathLossByOperationId instead */
  getDeathLossByOperatorEmail(operatorEmail: string): Promise<DeathLoss[]>;
  getDeathLossByOperationId(operationId: number): Promise<DeathLoss[]>;

  // Health Tracking - Treatments
  recordTreatment(record: InsertTreatmentRecord): Promise<TreatmentRecord>;
  /** @deprecated Use getTreatmentsByOperationId instead */
  getTreatmentsByOperatorEmail(operatorEmail: string): Promise<TreatmentRecord[]>;
  getTreatmentsByOperationId(operationId: number): Promise<TreatmentRecord[]>;

  // Partial Sales
  recordPartialSale(record: InsertPartialSale): Promise<PartialSale>;
  /** @deprecated Use getPartialSalesByOperationId instead */
  getPartialSalesByOperatorEmail(operatorEmail: string): Promise<PartialSale[]>;
  getPartialSalesByOperationId(operationId: number): Promise<PartialSale[]>;

  // Staff Management
  inviteStaffMember(invitation: InsertStaffInvitation): Promise<StaffInvitation>;
  getStaffMembersByOperationId(operationId: number): Promise<StaffMember[]>;
  acceptStaffInvitation(token: string): Promise<StaffMember | undefined>;
  getStaffMemberByEmail(email: string): Promise<StaffMember | undefined>;
  getUserRole(email: string): Promise<{ role: 'owner' | 'staff', operationId: number } | undefined>;

  // Notification Management
  createNotification(notification: InsertUserNotification): Promise<UserNotification>;
  getNotificationsByUserId(userId: number, isRead?: boolean, limit?: number): Promise<UserNotification[]>;
  markNotificationAsRead(notificationId: string): Promise<UserNotification | undefined>;
  getUnreadNotificationCount(userId: number): Promise<number>;

  // Nutritionist Task Management
  createNutritionistTask(task: InsertNutritionistTask): Promise<NutritionistTask>;
  getNutritionistTasksByUserId(userId: number, status?: string): Promise<NutritionistTask[]>;
  getNutritionistTasksByPenId(penId: number): Promise<NutritionistTask[]>;
  updateNutritionistTask(taskId: string, updates: Partial<InsertNutritionistTask>): Promise<NutritionistTask | undefined>;
  completeNutritionistTask(taskId: string, completedByUserId: number, notes?: string): Promise<NutritionistTask | undefined>;

  // Atomic Transaction Methods
  createPenWithTask(penData: any, nutritionistId: number, operationId: number): Promise<{ pen: any, task: NutritionistTask, notification: any }>;
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