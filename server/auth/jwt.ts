import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../db/connection';
import { refreshTokens, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m'; // 15 minutes
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d'; // 30 days

export interface JWTPayload {
  userId: number;
  email: string;
  userType: 'consultant' | 'producer' | 'staff';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
    issuer: 'nutrition-app',
    audience: 'nutrition-app-users',
  });
}

/**
 * Generate JWT refresh token (longer lived, stored in database)
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Generate both access and refresh tokens
 */
export async function generateTokenPair(
  userId: number,
  email: string,
  userType: 'consultant' | 'producer' | 'staff'
): Promise<TokenPair> {
  const accessToken = generateAccessToken({ userId, email, userType });
  const refreshToken = generateRefreshToken();

  // Store refresh token in database
  const db = getDb();
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(refreshTokens).values({
    userId,
    tokenHash: refreshTokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
  };
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'nutrition-app',
      audience: 'nutrition-app-users',
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Verify refresh token and generate new access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const db = getDb();

  try {
    // Get all refresh tokens from database to find matching hash
    const storedTokens = await db
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        tokenHash: refreshTokens.tokenHash,
        expiresAt: refreshTokens.expiresAt,
        user: {
          email: users.email,
          userType: users.userType,
        },
      })
      .from(refreshTokens)
      .innerJoin(users, eq(refreshTokens.userId, users.id))
      .where(eq(refreshTokens.expiresAt, refreshTokens.expiresAt)); // Get all non-expired tokens

    // Find matching token by comparing hashes
    let matchingToken = null;
    for (const storedToken of storedTokens) {
      const isValid = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (isValid && storedToken.expiresAt > new Date()) {
        matchingToken = storedToken;
        break;
      }
    }

    if (!matchingToken) {
      return null;
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: matchingToken.userId,
      email: matchingToken.user.email,
      userType: matchingToken.user.userType as 'consultant' | 'producer' | 'staff',
    });

    return newAccessToken;
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

/**
 * Revoke refresh token (logout)
 */
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const db = getDb();

  try {
    // Get all refresh tokens to find matching hash
    const storedTokens = await db
      .select({
        id: refreshTokens.id,
        tokenHash: refreshTokens.tokenHash,
      })
      .from(refreshTokens);

    // Find matching token by comparing hashes
    let tokenIdToDelete = null;
    for (const storedToken of storedTokens) {
      const isValid = await bcrypt.compare(refreshToken, storedToken.tokenHash);
      if (isValid) {
        tokenIdToDelete = storedToken.id;
        break;
      }
    }

    if (tokenIdToDelete) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, tokenIdToDelete));
      return true;
    }

    return false;
  } catch (error) {
    console.error('Token revocation failed:', error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
export async function revokeAllRefreshTokens(userId: number): Promise<boolean> {
  const db = getDb();

  try {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    return true;
  } catch (error) {
    console.error('Token revocation failed:', error);
    return false;
  }
}

/**
 * Clean up expired refresh tokens (should be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const db = getDb();

  try {
    await db.delete(refreshTokens).where(eq(refreshTokens.expiresAt, new Date()));
    console.log('Expired refresh tokens cleaned up');
  } catch (error) {
    console.error('Token cleanup failed:', error);
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}