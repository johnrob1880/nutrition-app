import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateDatabaseConfig, DatabaseConfig } from './database.config';

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateDatabaseConfig', () => {
    it('should return valid config when DATABASE_URL is provided', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      delete process.env.STORAGE_TYPE; // Ensure it uses the default
      
      const config = validateDatabaseConfig();
      
      expect(config).toBeDefined();
      expect(config.databaseUrl).toBe('postgresql://user:pass@localhost:5432/testdb');
      expect(config.storageType).toBe('memory'); // default
    });

    it('should use memory storage by default when STORAGE_TYPE is not set', () => {
      delete process.env.STORAGE_TYPE; // Ensure it's not set
      const config = validateDatabaseConfig();
      
      expect(config.storageType).toBe('memory');
    });

    it('should use postgresql storage when STORAGE_TYPE is set', () => {
      process.env.STORAGE_TYPE = 'postgresql';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      
      const config = validateDatabaseConfig();
      
      expect(config.storageType).toBe('postgresql');
    });

    it('should throw error when postgresql storage is selected without DATABASE_URL', () => {
      process.env.STORAGE_TYPE = 'postgresql';
      delete process.env.DATABASE_URL;
      
      expect(() => validateDatabaseConfig()).toThrow('DATABASE_URL is required when using PostgreSQL storage');
    });

    it('should validate connection pool settings', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      process.env.DB_POOL_MAX = '10';
      process.env.DB_POOL_MIN = '2';
      
      const config = validateDatabaseConfig();
      
      expect(config.poolMax).toBe(10);
      expect(config.poolMin).toBe(2);
    });

    it('should use default pool settings when not provided', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      
      const config = validateDatabaseConfig();
      
      expect(config.poolMax).toBe(10);
      expect(config.poolMin).toBe(2);
    });

    it('should validate Docker environment settings', () => {
      process.env.POSTGRES_USER = 'testuser';
      process.env.POSTGRES_PASSWORD = 'testpass';
      process.env.POSTGRES_DB = 'cattlerxdb';
      process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:5432/cattlerxdb';
      
      const config = validateDatabaseConfig();
      
      expect(config).toBeDefined();
      expect(config.databaseUrl).toContain('cattlerxdb');
    });
  });

  describe('Docker Configuration', () => {
    it('should detect when running in Docker environment', () => {
      process.env.DOCKER_ENV = 'true';
      process.env.DATABASE_URL = 'postgresql://user:pass@db:5432/cattlerxdb';
      
      const config = validateDatabaseConfig();
      
      expect(config.isDocker).toBe(true);
      expect(config.databaseUrl).toContain('db:5432'); // Docker service name
    });

    it('should use localhost when not in Docker environment', () => {
      delete process.env.DOCKER_ENV;
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/cattlerxdb';
      
      const config = validateDatabaseConfig();
      
      expect(config.isDocker).toBe(false);
      expect(config.databaseUrl).toContain('localhost:5432');
    });
  });
});