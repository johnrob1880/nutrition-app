import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { verifyAccessToken, extractBearerToken, JWTPayload } from './jwt';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT Authentication middleware
 * Verifies JWT token and adds user info to request
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authentication token required',
      },
    });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
      },
    });
  }

  req.user = payload;
  next();
}

/**
 * Optional JWT Authentication middleware
 * Adds user info to request if token is present and valid, but doesn't require authentication
 */
export function optionalAuthenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

/**
 * User type authorization middleware factory
 * Creates middleware that checks if user has required user type
 */
export function requireUserType(...allowedTypes: Array<'consultant' | 'producer' | 'staff'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
    }

    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Required user type: ${allowedTypes.join(' or ')}`,
        },
      });
    }

    next();
  };
}

/**
 * Consultant-only middleware
 */
export const requireConsultant = requireUserType('consultant');

/**
 * Producer-only middleware
 */
export const requireProducer = requireUserType('producer');

/**
 * Staff-only middleware
 */
export const requireStaff = requireUserType('staff');

/**
 * Consultant or Producer middleware
 */
export const requireConsultantOrProducer = requireUserType('consultant', 'producer');

/**
 * Rate limiting middleware for authentication endpoints
 */

// Login rate limiter - 10 requests per 15 minutes per IP
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Registration rate limiter - 5 requests per hour per IP
export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 registration requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Email verification rate limiter - 3 requests per hour per IP
export const emailVerificationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 email verification requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many email verification attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Invitation rate limiter - 20 requests per day per authenticated user
export const invitationRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20, // Limit each user to 20 invitation requests per day
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many invitation attempts. Please try again tomorrow.',
    },
  },
  keyGenerator: (req) => {
    // Use user ID for authenticated requests, IP for unauthenticated
    if (req.user?.userId) {
      return `user-${req.user.userId}`;
    }
    return ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter - 1000 requests per hour per authenticated user
export const apiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each user to 1000 API requests per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many API requests. Please try again later.',
    },
  },
  keyGenerator: (req) => {
    // Use user ID for authenticated requests, IP for unauthenticated
    if (req.user?.userId) {
      return `user-${req.user.userId}`;
    }
    return ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and static assets
    return req.path === '/health' || req.path.startsWith('/assets/');
  },
});

/**
 * Error handler for authentication middleware
 */
export function authErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Authentication error:', err);

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      },
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
      },
    });
  }

  if (err.name === 'NotBeforeError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_NOT_ACTIVE',
        message: 'Authentication token is not active yet',
      },
    });
  }

  // Pass other errors to the default error handler
  next(err);
}

/**
 * CORS middleware for authentication endpoints
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative dev port
    process.env.FRONTEND_URL, // Production frontend URL
  ].filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}