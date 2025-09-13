import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { users, consultantProfiles } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { 
  generateTokenPair, 
  revokeRefreshToken, 
  refreshAccessToken, 
  hashPassword, 
  comparePassword,
  validatePassword
} from './jwt';
import { 
  createEmailVerification, 
  sendVerificationEmail, 
  verifyEmailToken, 
  resendVerificationEmail 
} from './email-verification';
import { consultantRegistrationSchema, loginSchema } from '@shared/schema';
import { z } from 'zod';

/**
 * Register a new consultant
 */
export async function registerConsultant(req: Request, res: Response) {
  const db = getDb();

  try {
    // Validate request body
    const validationResult = consultantRegistrationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validationResult.error.format(),
        },
      });
    }

    const { username, email, password, fullName, company, specialization } = validationResult.data;

    // Additional password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password does not meet requirements',
          details: { password: passwordValidation.errors },
        },
      });
    }

    // Check if username already exists
    const existingUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USERNAME_EXISTS',
          message: 'Username already exists',
        },
      });
    }

    // Check if email already exists
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already exists',
        },
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUserResult = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
        userType: 'consultant',
        emailVerified: false,
      })
      .returning({ id: users.id });

    const userId = newUserResult[0].id;

    // Create consultant profile
    await db.insert(consultantProfiles).values({
      userId,
      fullName,
      company: company || null,
      specialization,
      profileCompletePercentage: company ? 70 : 60, // Add 10% if company is provided
    });

    // Create email verification token
    const verificationToken = await createEmailVerification(userId);

    // Send verification email
    const firstName = fullName.split(' ')[0];
    await sendVerificationEmail(email, firstName, verificationToken);

    // Log verification details in development for easy testing
    if (process.env.NODE_ENV === 'development') {
      console.log('\n🎯 CONSULTANT REGISTRATION SUCCESSFUL - DEVELOPMENT:');
      console.log('══════════════════════════════════════════════════');
      console.log(`👨‍⚕️ Consultant: ${fullName} (${email})`);
      console.log(`🏢 Company: ${company || 'Not specified'}`);
      console.log(`🔬 Specialization: ${specialization}`);
      console.log(`🔗 Verification URL: http://localhost:5173/verify-email?token=${verificationToken}`);
      console.log(`🎫 Plain Token: ${verificationToken}`);
      console.log(`📱 Username: ${username}`);
      console.log(`⏰ Token expires in 24 hours`);
      console.log('══════════════════════════════════════════════════\n');
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification.',
      userId,
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Registration failed. Please try again.',
      },
    });
  }
}

/**
 * Login user (consultant, producer, or staff)
 */
export async function login(req: Request, res: Response) {
  const db = getDb();

  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login credentials format',
        },
      });
    }

    const { username, email, password } = validationResult.data;

    // Find user by username or email
    const userResult = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        passwordHash: users.passwordHash,
        userType: users.userType,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(
        username 
          ? eq(users.username, username)
          : eq(users.email, email!)
      )
      .limit(1);

    if (userResult.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        },
      });
    }

    const user = userResult[0];

    // Check password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
        },
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before logging in',
        },
      });
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id,
      user.email,
      user.userType as 'consultant' | 'producer' | 'staff'
    );

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.userType,
      },
      accessToken,
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Login failed. Please try again.',
      },
    });
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(req: Request, res: Response) {
  try {
    const refreshTokenValue = req.cookies.refreshToken;

    if (!refreshTokenValue) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token required',
        },
      });
    }

    const newAccessToken = await refreshAccessToken(refreshTokenValue);

    if (!newAccessToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        },
      });
    }

    res.json({
      success: true,
      accessToken: newAccessToken,
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Token refresh failed. Please login again.',
      },
    });
  }
}

/**
 * Logout user (revoke refresh token)
 */
export async function logout(req: Request, res: Response) {
  try {
    const refreshTokenValue = req.cookies.refreshToken;

    if (refreshTokenValue) {
      await revokeRefreshToken(refreshTokenValue);
    }

    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully',
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Logout failed',
      },
    });
  }
}

/**
 * Verify email address
 */
export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Verification token required',
        },
      });
    }

    const result = await verifyEmailToken(token);

    console.log('Email verification result:', result);

    if (!result.success) {
      const statusCode = result.error === 'Verification token has expired' ? 410 : 400;
      const errorCode = result.error === 'Verification token has expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      
      return res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: result.error,
        },
      });
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_FAILED',
        message: 'Email verification failed',
      },
    });
  }
}

/**
 * Resend email verification
 */
export async function resendEmailVerification(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EMAIL',
          message: 'Email address required',
        },
      });
    }

    const result = await resendVerificationEmail(email);

    if (!result.success) {
      const statusCode = result.message === 'User not found' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: 'RESEND_FAILED',
          message: result.message,
        },
      });
    }

    res.json({
      success: true,
      message: result.message,
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESEND_FAILED',
        message: 'Failed to resend verification email',
      },
    });
  }
}