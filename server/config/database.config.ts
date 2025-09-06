export interface DatabaseConfig {
  storageType: 'memory' | 'postgresql';
  databaseUrl?: string;
  poolMax: number;
  poolMin: number;
  isDocker: boolean;
}

export function validateDatabaseConfig(): DatabaseConfig {
  const rawStorageType = process.env.STORAGE_TYPE || 'memory';
  
  // Validate storage type
  if (rawStorageType !== 'memory' && rawStorageType !== 'postgresql') {
    throw new Error(`Unsupported storage type: ${rawStorageType}. Supported types: memory, postgresql`);
  }
  
  const storageType = rawStorageType as 'memory' | 'postgresql';
  const databaseUrl = process.env.DATABASE_URL;
  const isDocker = process.env.DOCKER_ENV === 'true';

  // Validate that DATABASE_URL is provided when using PostgreSQL
  if (storageType === 'postgresql' && !databaseUrl) {
    throw new Error('DATABASE_URL is required when using PostgreSQL storage');
  }

  // Parse pool settings with defaults
  const poolMax = parseInt(process.env.DB_POOL_MAX || '10', 10);
  const poolMin = parseInt(process.env.DB_POOL_MIN || '2', 10);

  return {
    storageType,
    databaseUrl,
    poolMax,
    poolMin,
    isDocker
  };
}

export function getDatabaseUrl(): string {
  const config = validateDatabaseConfig();
  
  if (config.storageType === 'memory') {
    return '';
  }

  if (!config.databaseUrl) {
    // Build URL from individual components if not provided
    const user = process.env.POSTGRES_USER || 'postgres';
    const password = process.env.POSTGRES_PASSWORD || 'postgres';
    const host = config.isDocker ? 'db' : (process.env.POSTGRES_HOST || 'localhost');
    const port = process.env.POSTGRES_PORT || '5432';
    const database = process.env.POSTGRES_DB || 'nutritiondb';
    
    return `postgresql://${user}:${password}@${host}:${port}/${database}`;
  }

  return config.databaseUrl;
}