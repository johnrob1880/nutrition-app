import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import { Request, Response, NextFunction } from 'express';
import { body, validationResult, ValidationError } from 'express-validator';
import crypto from 'crypto';

/**
 * Security headers middleware using Helmet
 * Configures various security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: process.env.NODE_ENV === 'development' 
        ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Allow inline scripts in development for Vite
        : ["'self'"],
      connectSrc: process.env.NODE_ENV === 'development'
        ? ["'self'", "ws:", "wss:"] // Allow WebSocket connections for Vite HMR
        : ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Compression middleware
 */
export const compressionMiddleware = compression({
  level: 6,
  threshold: 1000,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
});

/**
 * Data sanitization middleware
 * Removes potentially dangerous characters from user input
 */
export const sanitizeInput = [
  mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ key, req }: { key: string, req: Request }) => {
      console.warn(`Sanitized potentially malicious input in field: ${key}`);
    }
  }),
  xss()
];

/**
 * CSRF Protection middleware
 * Generates and validates CSRF tokens
 */
class CSRFProtection {
  private static tokens = new Map<string, { token: string; expires: number }>();

  static generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour
    
    this.tokens.set(sessionId, { token, expires });
    return token;
  }

  static validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    if (!stored || stored.expires < Date.now()) {
      this.tokens.delete(sessionId);
      return false;
    }
    return stored.token === token;
  }

  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for GET, HEAD, OPTIONS
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Skip CSRF for API endpoints that use JWT (they have their own protection)
      if (req.path.startsWith('/api/jwt-auth/') || req.headers.authorization) {
        return next();
      }

      const sessionId = req.sessionID || req.headers['x-session-id'] as string;
      const token = req.headers['x-csrf-token'] as string || req.body._csrf;

      if (!sessionId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CSRF_NO_SESSION',
            message: 'Session required for CSRF protection'
          }
        });
      }

      if (!this.validateToken(sessionId, token)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CSRF_INVALID_TOKEN',
            message: 'Invalid or expired CSRF token'
          }
        });
      }

      next();
    };
  }
}

export const csrfProtection = CSRFProtection.middleware();

/**
 * Get CSRF token endpoint
 */
export const getCSRFToken = (req: Request, res: Response) => {
  const sessionId = req.sessionID || req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NO_SESSION',
        message: 'Session required to generate CSRF token'
      }
    });
  }

  const token = CSRFProtection.generateToken(sessionId);
  res.json({
    success: true,
    csrfToken: token
  });
};

/**
 * Input validation schemas using express-validator
 */
export const validationSchemas = {
  // User registration validation
  consultantRegistration: [
    body('username')
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-20 characters, alphanumeric with underscores only'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email address required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
    body('fullName')
      .isLength({ min: 2, max: 100 })
      .matches(/^[a-zA-Z\s\-'\.]+$/)
      .withMessage('Full name must contain only letters, spaces, hyphens, apostrophes, and periods'),
    body('specialization')
      .isIn(['nutritionist', 'veterinarian'])
      .withMessage('Specialization must be either nutritionist or veterinarian'),
    body('phone')
      .optional()
      .matches(/^\+?[\d\s\-\(\)]+$/)
      .isLength({ max: 20 })
      .withMessage('Invalid phone number format'),
    body('credentials')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Credentials must be less than 1000 characters')
  ],

  // Login validation
  login: [
    body('username')
      .optional()
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_@\.\-]+$/)
      .withMessage('Invalid username format'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    body('password')
      .isLength({ min: 1, max: 128 })
      .withMessage('Password required')
  ],

  // Profile update validation
  profileUpdate: [
    body('fullName')
      .optional()
      .isLength({ min: 2, max: 100 })
      .matches(/^[a-zA-Z\s\-'\.]+$/)
      .withMessage('Full name must contain only letters, spaces, hyphens, apostrophes, and periods'),
    body('phone')
      .optional()
      .matches(/^\+?[\d\s\-\(\)]+$/)
      .isLength({ max: 20 })
      .withMessage('Invalid phone number format'),
    body('credentials')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Credentials must be less than 1000 characters'),
    body('profilePhoto')
      .optional()
      .custom((value) => {
        if (value && !value.startsWith('data:image/')) {
          throw new Error('Profile photo must be a valid base64 image');
        }
        if (value && value.length > 3000000) { // ~2MB base64
          throw new Error('Profile photo must be less than 2MB');
        }
        return true;
      })
  ],

  // Producer invitation validation
  producerInvitation: [
    body('producerEmail')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email address required'),
    body('producerName')
      .isString()
      .isLength({ min: 3, max: 100 })
      .withMessage('Producer name must be between 3 and 100 characters'),
    body('message')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Message must be less than 500 characters')
  ],

  // Invitation validation
  invitation: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email address required'),
    body('message')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Message must be less than 500 characters')
  ],

  // Email verification validation
  emailVerification: [
    body('token')
      .isLength({ min: 32, max: 128 })
      .matches(/^[a-zA-Z0-9]+$/)
      .withMessage('Invalid verification token format')
  ]
};

/**
 * Validation error handler middleware
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((error: ValidationError) => ({
      field: 'field' in error ? error.field : 'unknown',
      message: error.msg,
      value: 'value' in error ? error.value : undefined
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        details: errorDetails
      }
    });
  }

  next();
};

/**
 * Activity logging middleware
 * Logs security-relevant activities
 */
export const createActivityLogger = (activityType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.json;
    
    res.json = function (data: any) {
      // Log the activity
      const logData = {
        timestamp: new Date().toISOString(),
        activityType,
        method: req.method,
        path: req.path,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        userId: req.user?.userId,
        userType: req.user?.userType,
        statusCode: res.statusCode,
        success: res.statusCode >= 200 && res.statusCode < 300,
        body: req.method !== 'GET' ? req.body : undefined,
        params: req.params,
        query: req.query
      };

      // In production, this should go to a proper logging service
      console.log(`[SECURITY_LOG] ${JSON.stringify(logData)}`);

      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Security middleware for JSON payload size limiting
 */
export const jsonSizeLimit = (limit: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const maxBytes = parseFloat(limit) * (limit.includes('mb') ? 1024 * 1024 : 1024);
      if (parseInt(contentLength) > maxBytes) {
        return res.status(413).json({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request payload exceeds maximum size of ${limit}`
          }
        });
      }
    }

    next();
  };
};

/**
 * IP whitelist middleware (for admin endpoints)
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.socket.remoteAddress || '';
    
    if (!allowedIPs.includes(clientIP) && !allowedIPs.includes('*')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied from this IP address'
        }
      });
    }

    next();
  };
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout'
          }
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};