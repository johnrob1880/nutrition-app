/**
 * Storage Module Exports
 * 
 * This module exports all storage-related functionality including
 * interfaces, providers, and factory methods.
 */

// Core interfaces and types
export type { IStorageProvider, StorageConfig } from './IStorageProvider';

// Storage providers
export { InMemoryStorageProvider } from './InMemoryStorageProvider';

// Factory and utilities
export { StorageFactory } from './StorageFactory';

// Default provider instance (environment-based)
export const defaultStorageProvider = StorageFactory.getProvider();