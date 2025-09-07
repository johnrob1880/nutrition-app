import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import sgMail from '@sendgrid/mail';
import { getDb } from '../db/connection';
import { emailVerifications, users, consultantProfiles } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@nutrition-app.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Generate email verification token
 */
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create email verification record
 */
export async function createEmailVerification(userId: number): Promise<string> {
  const db = getDb();
  const token = generateVerificationToken();
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Remove any existing verification tokens for this user
  await db.delete(emailVerifications).where(eq(emailVerifications.userId, userId));

  // Create new verification token
  await db.insert(emailVerifications).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  firstName: string,
  verificationToken: string
): Promise<boolean> {
  // In test environment, just return true without sending actual emails
  if (process.env.NODE_ENV === 'test') {
    console.log(`TEST MODE: Would send verification email to ${email}`);
    return true;
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured. Email verification skipped.');
    return false;
  }

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const msg = {
    to: email,
    from: {
      email: FROM_EMAIL,
      name: 'CattleNutrition Pro',
    },
    subject: 'Verify Your Email Address - CattleNutrition Pro',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
            <h1 style="color: #2c3e50; text-align: center; margin-bottom: 30px;">
              Welcome to CattleNutrition Pro!
            </h1>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hello ${firstName},
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for registering with CattleNutrition Pro. To complete your account setup, please verify your email address by clicking the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
              If the button doesn't work, you can copy and paste this link into your browser:
            </p>
            
            <p style="font-size: 14px; color: #666; word-break: break-all; background-color: #f1f1f1; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              This verification link will expire in 24 hours. If you didn't create an account with CattleNutrition Pro, please ignore this email.
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; text-align: center;">
              <p style="font-size: 12px; color: #888; margin: 0;">
                CattleNutrition Pro - Professional Cattle Nutrition Management
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Welcome to CattleNutrition Pro!
      
      Hello ${firstName},
      
      Thank you for registering with CattleNutrition Pro. To complete your account setup, please verify your email address by visiting this link:
      
      ${verificationUrl}
      
      This verification link will expire in 24 hours. If you didn't create an account with CattleNutrition Pro, please ignore this email.
      
      CattleNutrition Pro - Professional Cattle Nutrition Management
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

/**
 * Verify email with token
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; userId?: number; error?: string }> {
  const db = getDb();

  try {
    // Get all verification tokens to find matching hash
    const verificationTokens = await db
      .select({
        id: emailVerifications.id,
        userId: emailVerifications.userId,
        tokenHash: emailVerifications.tokenHash,
        expiresAt: emailVerifications.expiresAt,
        verifiedAt: emailVerifications.verifiedAt,
      })
      .from(emailVerifications)
      .where(eq(emailVerifications.verifiedAt, null)); // Only get unverified tokens

    // Find matching token by comparing hashes
    let matchingToken = null;
    for (const storedToken of verificationTokens) {
      const isValid = await bcrypt.compare(token, storedToken.tokenHash);
      if (isValid) {
        matchingToken = storedToken;
        break;
      }
    }

    if (!matchingToken) {
      return { success: false, error: 'Invalid verification token' };
    }

    // Check if token has expired
    if (matchingToken.expiresAt < new Date()) {
      return { success: false, error: 'Verification token has expired' };
    }

    // Check if already verified
    if (matchingToken.verifiedAt) {
      return { success: false, error: 'Email already verified' };
    }

    // Mark token as verified
    await db
      .update(emailVerifications)
      .set({ verifiedAt: new Date() })
      .where(eq(emailVerifications.id, matchingToken.id));

    // Mark user email as verified
    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, matchingToken.userId));

    return { success: true, userId: matchingToken.userId };
  } catch (error) {
    console.error('Email verification failed:', error);
    return { success: false, error: 'Verification failed' };
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  try {
    // Find user by email
    const userResult = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      return { success: false, message: 'User not found' };
    }

    const user = userResult[0];

    if (user.emailVerified) {
      return { success: false, message: 'Email already verified' };
    }

    // Get user profile for first name
    const profileResult = await db
      .select({
        fullName: consultantProfiles.fullName,
      })
      .from(consultantProfiles)
      .where(eq(consultantProfiles.userId, user.id))
      .limit(1);

    const firstName = profileResult[0]?.fullName?.split(' ')[0] || 'User';

    // Generate new verification token
    const verificationToken = await createEmailVerification(user.id);

    // Send verification email
    const emailSent = await sendVerificationEmail(user.email, firstName, verificationToken);

    if (!emailSent) {
      return { success: false, message: 'Failed to send verification email' };
    }

    return { success: true, message: 'Verification email sent successfully' };
  } catch (error) {
    console.error('Failed to resend verification email:', error);
    return { success: false, message: 'Failed to resend verification email' };
  }
}

/**
 * Clean up expired verification tokens
 */
export async function cleanupExpiredVerificationTokens(): Promise<void> {
  const db = getDb();

  try {
    await db
      .delete(emailVerifications)
      .where(and(
        eq(emailVerifications.expiresAt, new Date()),
        eq(emailVerifications.verifiedAt, null)
      ));
    console.log('Expired verification tokens cleaned up');
  } catch (error) {
    console.error('Verification token cleanup failed:', error);
  }
}