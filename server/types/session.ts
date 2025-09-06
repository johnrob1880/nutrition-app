import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
    operationId?: number;
    role?: string;
    lastActivity?: string;
    customData?: any;
  }
}