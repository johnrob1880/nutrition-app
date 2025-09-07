// Test setup file for vitest
import { beforeAll, afterAll, vi } from 'vitest';

// Mock SendGrid for tests at the top level
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
  MailService: vi.fn().mockImplementation(() => ({
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  })),
  setApiKey: vi.fn(),
  send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

beforeAll(() => {
  // Set default test environment variables
  process.env.NODE_ENV = 'test';
  if (!process.env.STORAGE_TYPE) {
    process.env.STORAGE_TYPE = 'memory';
  }
});

afterAll(() => {
  // Cleanup after tests
  vi.restoreAllMocks();
});