/**
 * Storage Module
 * 
 * This module provides a unified interface for all storage operations
 * using the storage abstraction layer. It automatically selects the
 * appropriate storage provider based on environment configuration.
 */

import { StorageFactory } from './storage/StorageFactory';
import type { IStorageProvider } from './storage/IStorageProvider';

// Export the interface for backward compatibility
export type { IStorageProvider as IStorage } from './storage/IStorageProvider';

// For backward compatibility, we'll maintain the MemStorage export
// but it will now use the abstraction layer
export class MemStorage {
  private provider: IStorageProvider | null = null;

  private async getProvider(): Promise<IStorageProvider> {
    if (!this.provider) {
      this.provider = await StorageFactory.getProvider();
    }
    return this.provider;
  }

  // Delegate all methods to the provider
  async getOperation(id: number) {
    const provider = await this.getProvider();
    return provider.getOperation(id);
  }

  async getOperationByEmail(email: string) {
    const provider = await this.getProvider();
    return provider.getOperationByEmail(email);
  }

  async createOperation(operation: any) {
    const provider = await this.getProvider();
    return provider.createOperation(operation);
  }

  async updateOperation(id: number, operation: any) {
    const provider = await this.getProvider();
    return provider.updateOperation(id, operation);
  }

  async validateInviteCode(inviteCode: string, operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.validateInviteCode(inviteCode, operatorEmail);
  }

  async getPensByOperatorEmail(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getPensByOperatorEmail(operatorEmail);
  }

  async createPen(penData: any) {
    const provider = await this.getProvider();
    return provider.createPen(penData);
  }

  async getFeedingPlansByOperatorEmail(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getFeedingPlansByOperatorEmail(operatorEmail);
  }

  async getUpcomingScheduleChanges(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getUpcomingScheduleChanges(operatorEmail);
  }

  async getDashboardStats(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getDashboardStats(operatorEmail);
  }

  async updatePenWeight(request: any) {
    const provider = await this.getProvider();
    return provider.updatePenWeight(request);
  }

  async createFeedingRecord(record: any) {
    const provider = await this.getProvider();
    return provider.createFeedingRecord(record);
  }

  async getFeedingRecordsByOperatorEmail(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getFeedingRecordsByOperatorEmail(operatorEmail);
  }

  async sellCattle(saleRecord: any) {
    const provider = await this.getProvider();
    return provider.sellCattle(saleRecord);
  }

  async getCattleSalesByOperatorEmail(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getCattleSalesByOperatorEmail(operatorEmail);
  }

  async getNutritionistsByOperatorEmail(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getNutritionistsByOperatorEmail(operatorEmail);
  }

  async acceptNutritionistInvitation(request: any) {
    const provider = await this.getProvider();
    return provider.acceptNutritionistInvitation(request);
  }

  async recordDeathLoss(record: any) {
    const provider = await this.getProvider();
    return provider.recordDeathLoss(record);
  }

  async getDeathLossByOperatorEmail(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getDeathLossByOperatorEmail(operatorEmail);
  }

  async recordTreatment(record: any) {
    const provider = await this.getProvider();
    return provider.recordTreatment(record);
  }

  async getTreatmentsByOperatorEmail(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getTreatmentsByOperatorEmail(operatorEmail);
  }

  async recordPartialSale(record: any) {
    const provider = await this.getProvider();
    return provider.recordPartialSale(record);
  }

  async getPartialSalesByOperatorEmail(operatorEmail: string) {
    const provider = await this.getProvider();
    return provider.getPartialSalesByOperatorEmail(operatorEmail);
  }

  async inviteStaffMember(invitation: any) {
    const provider = await this.getProvider();
    return provider.inviteStaffMember(invitation);
  }

  async getStaffMembersByOperationId(operationId: number) {
    const provider = await this.getProvider();
    return provider.getStaffMembersByOperationId(operationId);
  }

  async acceptStaffInvitation(token: string) {
    const provider = await this.getProvider();
    return provider.acceptStaffInvitation(token);
  }

  async getStaffMemberByEmail(email: string) {
    const provider = await this.getProvider();
    return provider.getStaffMemberByEmail(email);
  }

  async getUserRole(email: string) {
    const provider = await this.getProvider();
    return provider.getUserRole(email);
  }
}

// Create and export the storage instance
export const storage = new MemStorage();