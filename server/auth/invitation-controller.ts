import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { 
  consultantProducerInvitations, 
  consultantProducerRelationships,
  consultantProfiles,
  users 
} from '@shared/schema';
import { eq, and, desc, count } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Email service import (dynamic to handle testing)
let sendEmail: ((to: string, subject: string, htmlContent: string) => Promise<boolean>) | null = null;
try {
  const emailService = require('../emailService');
  sendEmail = emailService.sendEmail;
} catch {
  // Email service not available (testing or missing config)
  sendEmail = null;
}

// Validation schemas
const createInvitationSchema = z.object({
  producerEmail: z.string().email('Invalid email format'),
  producerName: z.string().min(2, 'Producer name must be at least 2 characters'),
  message: z.string().max(1000, 'Message must be 1000 characters or less').optional()
});

const acceptInvitationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be 20 characters or less'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional()
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

/**
 * Create a new producer invitation
 */
export async function createInvitation(req: Request, res: Response) {
  if (!req.user || req.user.userType !== 'consultant') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Access denied. Consultant role required.',
      },
    });
  }

  const db = getDb();

  try {
    const validatedData = createInvitationSchema.parse(req.body);
    const consultantId = req.user.userId;

    // Check if invitation already exists for this producer
    const existingInvitation = await db
      .select()
      .from(consultantProducerInvitations)
      .where(
        and(
          eq(consultantProducerInvitations.consultantId, consultantId),
          eq(consultantProducerInvitations.producerEmail, validatedData.producerEmail),
          eq(consultantProducerInvitations.status, 'pending')
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'INVITATION_EXISTS',
          message: 'An active invitation already exists for this producer.',
        },
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    
    // Set expiration to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create invitation
    const [invitation] = await db
      .insert(consultantProducerInvitations)
      .values({
        consultantId,
        producerEmail: validatedData.producerEmail,
        producerName: validatedData.producerName,
        message: validatedData.message || '',
        token: tokenHash,
        status: 'pending',
        expiresAt,
        createdAt: new Date()
      })
      .returning({
        id: consultantProducerInvitations.id,
        producerEmail: consultantProducerInvitations.producerEmail,
        producerName: consultantProducerInvitations.producerName,
        message: consultantProducerInvitations.message,
        status: consultantProducerInvitations.status,
        createdAt: consultantProducerInvitations.createdAt
      });

    // Get consultant info for email
    const [consultantInfo] = await db
      .select({
        fullName: consultantProfiles.fullName,
        specialization: consultantProfiles.specialization,
        email: users.email
      })
      .from(consultantProfiles)
      .innerJoin(users, eq(users.id, consultantProfiles.userId))
      .where(eq(consultantProfiles.userId, consultantId))
      .limit(1);

    // Send invitation email
    let emailSent = false;
    if (sendEmail && consultantInfo) {
      try {
        const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invitations/${token}`;
        const subject = `Invitation to work with ${consultantInfo.fullName} - CattleNutrition Pro`;
        
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited to work with a nutrition consultant!</h2>
            
            <p>Hello ${validatedData.producerName},</p>
            
            <p><strong>${consultantInfo.fullName}</strong> (${consultantInfo.specialization}) has invited you to collaborate on CattleNutrition Pro.</p>
            
            ${validatedData.message ? `
              <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
                <p><strong>Personal message:</strong></p>
                <p style="font-style: italic;">"${validatedData.message}"</p>
              </div>
            ` : ''}
            
            <p>CattleNutrition Pro is a specialized platform for cattle operations that connects producers with nutrition and veterinary consultants. By accepting this invitation, you'll gain access to:</p>
            
            <ul>
              <li>Professional consultation on your cattle nutrition programs</li>
              <li>Operational management tools for feeding schedules and records</li>
              <li>Expert guidance tailored to your specific operation</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              This invitation will expire in 7 days. If you have any questions, you can contact ${consultantInfo.fullName} directly at ${consultantInfo.email}.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #888; text-align: center;">
              CattleNutrition Pro - Professional livestock management and consultation platform
            </p>
          </div>
        `;
        
        emailSent = await sendEmail(validatedData.producerEmail, subject, htmlContent);
      } catch (error) {
        console.warn('Failed to send invitation email:', error);
      }
    }

    res.status(201).json({
      success: true,
      invitation: {
        ...invitation,
        token, // Return the plain token for immediate use if needed
      },
      emailSent
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid invitation data',
          details: error.errors,
        },
      });
    }

    console.error('Create invitation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVITATION_CREATION_FAILED',
        message: 'Failed to create invitation',
      },
    });
  }
}

/**
 * Get consultant's invitations with pagination
 */
export async function getInvitations(req: Request, res: Response) {
  if (!req.user || req.user.userType !== 'consultant') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Access denied. Consultant role required.',
      },
    });
  }

  const db = getDb();

  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const consultantId = req.user.userId;
    const offset = (page - 1) * limit;

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(consultantProducerInvitations)
      .where(eq(consultantProducerInvitations.consultantId, consultantId));

    // Get invitations
    const invitations = await db
      .select({
        id: consultantProducerInvitations.id,
        producerEmail: consultantProducerInvitations.producerEmail,
        producerName: consultantProducerInvitations.producerName,
        message: consultantProducerInvitations.message,
        status: consultantProducerInvitations.status,
        createdAt: consultantProducerInvitations.createdAt,
        expiresAt: consultantProducerInvitations.expiresAt,
        acceptedAt: consultantProducerInvitations.acceptedAt,
        declinedAt: consultantProducerInvitations.declinedAt
      })
      .from(consultantProducerInvitations)
      .where(eq(consultantProducerInvitations.consultantId, consultantId))
      .orderBy(desc(consultantProducerInvitations.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      success: true,
      invitations,
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit)
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pagination parameters',
          details: error.errors,
        },
      });
    }

    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVITATIONS_FETCH_FAILED',
        message: 'Failed to fetch invitations',
      },
    });
  }
}

/**
 * Resend invitation email
 */
export async function resendInvitation(req: Request, res: Response) {
  if (!req.user || req.user.userType !== 'consultant') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Access denied. Consultant role required.',
      },
    });
  }

  const db = getDb();

  try {
    const invitationId = parseInt(req.params.id);
    const consultantId = req.user.userId;

    // Get invitation
    const [invitation] = await db
      .select()
      .from(consultantProducerInvitations)
      .where(
        and(
          eq(consultantProducerInvitations.id, invitationId),
          eq(consultantProducerInvitations.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found',
        },
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INVITATION_STATUS',
          message: 'Can only resend pending invitations',
        },
      });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(410).json({
        success: false,
        error: {
          code: 'INVITATION_EXPIRED',
          message: 'Invitation has expired',
        },
      });
    }

    // Generate new token for security
    const newToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = await bcrypt.hash(newToken, 10);

    // Update invitation with new token
    await db
      .update(consultantProducerInvitations)
      .set({ token: newTokenHash })
      .where(eq(consultantProducerInvitations.id, invitationId));

    // Resend email (similar to create invitation)
    let emailSent = false;
    if (sendEmail) {
      try {
        const [consultantInfo] = await db
          .select({
            fullName: consultantProfiles.fullName,
            specialization: consultantProfiles.specialization,
            email: users.email
          })
          .from(consultantProfiles)
          .innerJoin(users, eq(users.id, consultantProfiles.userId))
          .where(eq(consultantProfiles.userId, consultantId))
          .limit(1);

        if (consultantInfo) {
          const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invitations/${newToken}`;
          const subject = `Reminder: Invitation to work with ${consultantInfo.fullName} - CattleNutrition Pro`;
          
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Reminder: You've been invited to work with a nutrition consultant!</h2>
              
              <p>Hello ${invitation.producerName},</p>
              
              <p>This is a friendly reminder that <strong>${consultantInfo.fullName}</strong> (${consultantInfo.specialization}) has invited you to collaborate on CattleNutrition Pro.</p>
              
              ${invitation.message ? `
                <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
                  <p><strong>Personal message:</strong></p>
                  <p style="font-style: italic;">"${invitation.message}"</p>
                </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationUrl}" 
                   style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                This invitation will expire on ${invitation.expiresAt.toLocaleDateString()}. If you have any questions, you can contact ${consultantInfo.fullName} directly at ${consultantInfo.email}.
              </p>
            </div>
          `;
          
          emailSent = await sendEmail(invitation.producerEmail, subject, htmlContent);
        }
      } catch (error) {
        console.warn('Failed to resend invitation email:', error);
      }
    }

    res.json({
      success: true,
      message: 'Invitation resent successfully',
      emailSent
    });

  } catch (error) {
    console.error('Resend invitation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVITATION_RESEND_FAILED',
        message: 'Failed to resend invitation',
      },
    });
  }
}

/**
 * Cancel invitation
 */
export async function cancelInvitation(req: Request, res: Response) {
  if (!req.user || req.user.userType !== 'consultant') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Access denied. Consultant role required.',
      },
    });
  }

  const db = getDb();

  try {
    const invitationId = parseInt(req.params.id);
    const consultantId = req.user.userId;

    // Delete invitation (only pending invitations can be cancelled)
    const [deletedInvitation] = await db
      .delete(consultantProducerInvitations)
      .where(
        and(
          eq(consultantProducerInvitations.id, invitationId),
          eq(consultantProducerInvitations.consultantId, consultantId),
          eq(consultantProducerInvitations.status, 'pending')
        )
      )
      .returning({ id: consultantProducerInvitations.id });

    if (!deletedInvitation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found or cannot be cancelled',
        },
      });
    }

    res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVITATION_CANCEL_FAILED',
        message: 'Failed to cancel invitation',
      },
    });
  }
}

/**
 * Get invitation details by token (public endpoint)
 */
export async function getInvitationByToken(req: Request, res: Response) {
  const db = getDb();

  try {
    const { token } = req.params;

    // Get all pending invitations (we'll verify the token hash)
    const invitations = await db
      .select({
        id: consultantProducerInvitations.id,
        consultantId: consultantProducerInvitations.consultantId,
        producerEmail: consultantProducerInvitations.producerEmail,
        producerName: consultantProducerInvitations.producerName,
        message: consultantProducerInvitations.message,
        status: consultantProducerInvitations.status,
        tokenHash: consultantProducerInvitations.token,
        expiresAt: consultantProducerInvitations.expiresAt,
        createdAt: consultantProducerInvitations.createdAt
      })
      .from(consultantProducerInvitations)
      .where(eq(consultantProducerInvitations.status, 'pending'));

    // Find matching invitation by comparing token hashes
    let invitation = null;
    for (const inv of invitations) {
      const isMatch = await bcrypt.compare(token, inv.tokenHash);
      if (isMatch) {
        invitation = inv;
        break;
      }
    }

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found',
        },
      });
    }

    // Check expiration
    if (new Date() > invitation.expiresAt) {
      return res.status(410).json({
        success: false,
        error: {
          code: 'INVITATION_EXPIRED',
          message: 'Invitation has expired',
        },
      });
    }

    // Get consultant info
    const [consultant] = await db
      .select({
        name: consultantProfiles.fullName,
        specialization: consultantProfiles.specialization
      })
      .from(consultantProfiles)
      .where(eq(consultantProfiles.userId, invitation.consultantId))
      .limit(1);

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        producerEmail: invitation.producerEmail,
        producerName: invitation.producerName,
        message: invitation.message,
        status: invitation.status,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt
      },
      consultant: consultant || null
    });

  } catch (error) {
    console.error('Get invitation by token error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVITATION_FETCH_FAILED',
        message: 'Failed to fetch invitation',
      },
    });
  }
}

/**
 * Accept invitation (public endpoint)
 */
export async function acceptInvitation(req: Request, res: Response) {
  const db = getDb();

  try {
    const { token } = req.params;
    const validatedData = acceptInvitationSchema.parse(req.body);

    // Get invitation (similar to getInvitationByToken)
    const invitations = await db
      .select({
        id: consultantProducerInvitations.id,
        consultantId: consultantProducerInvitations.consultantId,
        producerEmail: consultantProducerInvitations.producerEmail,
        producerName: consultantProducerInvitations.producerName,
        status: consultantProducerInvitations.status,
        tokenHash: consultantProducerInvitations.token,
        expiresAt: consultantProducerInvitations.expiresAt
      })
      .from(consultantProducerInvitations)
      .where(eq(consultantProducerInvitations.status, 'pending'));

    let invitation = null;
    for (const inv of invitations) {
      const isMatch = await bcrypt.compare(token, inv.tokenHash);
      if (isMatch) {
        invitation = inv;
        break;
      }
    }

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found',
        },
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVITATION_ALREADY_PROCESSED',
          message: 'Invitation has already been processed',
        },
      });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(410).json({
        success: false,
        error: {
          code: 'INVITATION_EXPIRED',
          message: 'Invitation has expired',
        },
      });
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, invitation.producerEmail))
      .limit(1);

    let producerUser;
    let isNewUser = false;

    if (existingUser) {
      // Verify credentials for existing user
      const passwordMatch = await bcrypt.compare(validatedData.password, existingUser.passwordHash);
      if (!passwordMatch || existingUser.username !== validatedData.username) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password for existing account',
          },
        });
      }
      producerUser = existingUser;
    } else {
      // Create new producer account
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Check if username is already taken
      const [existingUsername] = await db
        .select()
        .from(users)
        .where(eq(users.username, validatedData.username))
        .limit(1);

      if (existingUsername) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USERNAME_EXISTS',
            message: 'Username is already taken',
          },
        });
      }

      [producerUser] = await db
        .insert(users)
        .values({
          username: validatedData.username,
          email: invitation.producerEmail,
          passwordHash: hashedPassword,
          userType: 'producer',
          emailVerified: true // Auto-verify since they're accepting an invitation
        })
        .returning();
      
      isNewUser = true;
    }

    // Update invitation status
    await db
      .update(consultantProducerInvitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date()
      })
      .where(eq(consultantProducerInvitations.id, invitation.id));

    // Create consultant-producer relationship
    await db
      .insert(consultantProducerRelationships)
      .values({
        consultantId: invitation.consultantId,
        producerId: producerUser.id,
        permissions: { view: true, edit: false, admin: false }, // Default permissions
        status: 'active',
        createdAt: new Date()
      });

    const statusCode = isNewUser ? 201 : 200;
    const message = isNewUser 
      ? 'Invitation accepted and account created successfully'
      : 'Invitation accepted and account linked successfully';

    res.status(statusCode).json({
      success: true,
      message,
      user: {
        id: producerUser.id,
        username: producerUser.username,
        email: producerUser.email,
        userType: producerUser.userType
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid acceptance data',
          details: error.errors,
        },
      });
    }

    console.error('Accept invitation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVITATION_ACCEPT_FAILED',
        message: 'Failed to accept invitation',
      },
    });
  }
}

/**
 * Decline invitation (public endpoint)
 */
export async function declineInvitation(req: Request, res: Response) {
  const db = getDb();

  try {
    const { token } = req.params;

    // Get invitation (similar to getInvitationByToken)
    const invitations = await db
      .select({
        id: consultantProducerInvitations.id,
        status: consultantProducerInvitations.status,
        tokenHash: consultantProducerInvitations.token,
        expiresAt: consultantProducerInvitations.expiresAt
      })
      .from(consultantProducerInvitations)
      .where(eq(consultantProducerInvitations.status, 'pending'));

    let invitation = null;
    for (const inv of invitations) {
      const isMatch = await bcrypt.compare(token, inv.tokenHash);
      if (isMatch) {
        invitation = inv;
        break;
      }
    }

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found',
        },
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVITATION_ALREADY_PROCESSED',
          message: 'Invitation has already been processed',
        },
      });
    }

    // Update invitation status to declined
    await db
      .update(consultantProducerInvitations)
      .set({
        status: 'declined',
        declinedAt: new Date()
      })
      .where(eq(consultantProducerInvitations.id, invitation.id));

    res.json({
      success: true,
      message: 'Invitation declined'
    });

  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVITATION_DECLINE_FAILED',
        message: 'Failed to decline invitation',
      },
    });
  }
}