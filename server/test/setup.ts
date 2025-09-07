// Test setup file for vitest
import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Set default test environment variables
  process.env.NODE_ENV = 'test';
  if (!process.env.STORAGE_TYPE) {
    process.env.STORAGE_TYPE = 'memory';
  }
});

afterAll(() => {
  // Cleanup after tests
});