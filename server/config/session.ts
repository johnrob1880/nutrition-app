import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import { StorageFactory } from '../storage/StorageFactory';

const PgSession = ConnectPgSimple(session);

// Session configuration factory
export function createSessionConfig() {
  const storageConfig = StorageFactory.getStorageConfig();
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (storageConfig.type === 'postgresql' && process.env.DATABASE_URL) {
    // PostgreSQL session store
    return session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'session',
        createTableIfMissing: false, // We already created the table with Drizzle
        ttl: 24 * 60 * 60 // 24 hours in seconds
      }),
      secret: process.env.SESSION_SECRET || 'nutrition-app-session-secret-dev-only',
      resave: false,
      saveUninitialized: false,
      name: 'nutrition.sid', // Custom session name
      cookie: {
        secure: isProduction, // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks
        maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        sameSite: 'strict' // CSRF protection
      },
      // Force session save on each request to extend session lifetime
      rolling: true
    });
  } else {
    // In-memory session store (development/test)
    const MemoryStore = require('memorystore')(session);
    
    return session({
      store: new MemoryStore({
        checkPeriod: 86400000 // Prune expired entries every 24h
      }),
      secret: process.env.SESSION_SECRET || 'nutrition-app-session-secret-dev-only',
      resave: false,
      saveUninitialized: false,
      name: 'nutrition.sid',
      cookie: {
        secure: false, // Can't use HTTPS in development
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict'
      },
      rolling: true
    });
  }
}

// Session store configuration
export function getSessionStoreConfig() {
  const storageConfig = StorageFactory.getStorageConfig();
  
  return {
    type: storageConfig.type === 'postgresql' ? 'postgresql' : 'memory',
    persistent: storageConfig.type === 'postgresql',
    database: storageConfig.type === 'postgresql' ? 'PostgreSQL' : 'Memory'
  };
}