import { IStorageProvider, StorageConfig } from './IStorageProvider';
import { InMemoryStorageProvider } from './InMemoryStorageProvider';
import { validateDatabaseConfig } from '../config/database.config';

/**
 * Storage Factory
 * 
 * Responsible for creating and managing storage provider instances
 * based on environment configuration.
 */
export class StorageFactory {
  private static instance: IStorageProvider | null = null;

  /**
   * Create a storage provider based on environment configuration
   * Uses singleton pattern to ensure only one provider instance exists
   */
  static async createProvider(): Promise<IStorageProvider> {
    if (this.instance) {
      return this.instance;
    }

    const config = validateDatabaseConfig();
    
    switch (config.storageType) {
      case 'memory':
        this.instance = new InMemoryStorageProvider();
        break;
        
      case 'postgresql':
        // Lazy import to avoid loading PostgreSQL dependencies when not needed
        const { PostgreSQLStorageProvider } = await import('./PostgreSQLStorageProvider');
        this.instance = new PostgreSQLStorageProvider();
        break;
        
      default:
        throw new Error(`Unsupported storage type: ${config.storageType}`);
    }

    return this.instance;
  }

  /**
   * Get the current storage provider instance
   * Creates one if it doesn't exist
   */
  static async getProvider(): Promise<IStorageProvider> {
    return this.createProvider();
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Get storage configuration from environment
   */
  static getStorageConfig(): StorageConfig {
    const config = validateDatabaseConfig();
    
    return {
      type: config.storageType,
      connectionString: config.databaseUrl,
      poolConfig: {
        min: config.poolMin,
        max: config.poolMax
      }
    };
  }
}