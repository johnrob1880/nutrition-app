import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { consultantProfiles, users, consultantProducerInvitations, consultantProducerRelationships } from '@shared/schema';
import { eq, count, and } from 'drizzle-orm';

/**
 * Get consultant profile
 */
export async function getConsultantProfile(req: Request, res: Response) {
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
    const profileResult = await db
      .select()
      .from(consultantProfiles)
      .where(eq(consultantProfiles.userId, req.user.userId))
      .limit(1);

    if (profileResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Consultant profile not found',
        },
      });
    }

    res.json({
      success: true,
      profile: profileResult[0],
    });

  } catch (error) {
    console.error('Get consultant profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: 'Failed to fetch consultant profile',
      },
    });
  }
}

/**
 * Update consultant profile
 */
export async function updateConsultantProfile(req: Request, res: Response) {
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
  const { fullName, phone, specialization, credentials, profilePhoto } = req.body;

  try {
    // Validate specialization if provided
    if (specialization && !['nutritionist', 'veterinarian'].includes(specialization)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid specialization. Must be "nutritionist" or "veterinarian"',
        },
      });
    }

    // Update profile
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (fullName) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (specialization) updateData.specialization = specialization;
    if (credentials !== undefined) updateData.credentials = credentials;
    if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;

    // Calculate profile completeness percentage
    const profileFields = {
      fullName: fullName || true, // Always filled during registration
      phone: phone,
      specialization: true, // Always filled during registration
      credentials: credentials,
      profilePhoto: profilePhoto,
    };

    const filledFields = Object.values(profileFields).filter(Boolean).length;
    const totalFields = Object.keys(profileFields).length;
    updateData.profileCompletePercentage = Math.round((filledFields / totalFields) * 100);

    const updatedProfile = await db
      .update(consultantProfiles)
      .set(updateData)
      .where(eq(consultantProfiles.userId, req.user.userId))
      .returning();

    if (updatedProfile.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Consultant profile not found',
        },
      });
    }

    res.json({
      success: true,
      profile: updatedProfile[0],
      completeness: updateData.profileCompletePercentage,
    });

  } catch (error) {
    console.error('Update consultant profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: 'Failed to update consultant profile',
      },
    });
  }
}

/**
 * Get consultant dashboard data
 */
export async function getConsultantDashboard(req: Request, res: Response) {
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
    const consultantId = req.user.userId;

    // Get consultant profile
    const profileResult = await db
      .select()
      .from(consultantProfiles)
      .where(eq(consultantProfiles.userId, consultantId))
      .limit(1);

    const profile = profileResult[0] || null;

    // Get invitation statistics
    const [pendingInvitationsResult] = await db
      .select({ count: count() })
      .from(consultantProducerInvitations)
      .where(
        and(
          eq(consultantProducerInvitations.consultantId, consultantId),
          eq(consultantProducerInvitations.status, 'pending')
        )
      );

    const [acceptedInvitationsResult] = await db
      .select({ count: count() })
      .from(consultantProducerInvitations)
      .where(
        and(
          eq(consultantProducerInvitations.consultantId, consultantId),
          eq(consultantProducerInvitations.status, 'accepted')
        )
      );

    // Get active relationships (clients)
    const [activeClientsResult] = await db
      .select({ count: count() })
      .from(consultantProducerRelationships)
      .where(
        and(
          eq(consultantProducerRelationships.consultantId, consultantId),
          eq(consultantProducerRelationships.status, 'active')
        )
      );

    // Calculate profile completeness
    let profileCompleteness = 0;
    if (profile) {
      const fields = [
        profile.fullName,
        profile.phone,
        profile.specialization,
        profile.credentials
      ];
      const completedFields = fields.filter(field => field && field.trim() !== '').length;
      profileCompleteness = Math.round((completedFields / fields.length) * 100);
    }

    // Get recent invitations for activity
    const recentInvitations = await db
      .select({
        id: consultantProducerInvitations.id,
        producerName: consultantProducerInvitations.producerName,
        status: consultantProducerInvitations.status,
        createdAt: consultantProducerInvitations.createdAt,
        acceptedAt: consultantProducerInvitations.acceptedAt
      })
      .from(consultantProducerInvitations)
      .where(eq(consultantProducerInvitations.consultantId, consultantId))
      .orderBy(consultantProducerInvitations.createdAt)
      .limit(5);

    // Create recent activity from invitations
    const recentActivity = recentInvitations.map(invitation => {
      if (invitation.status === 'accepted' && invitation.acceptedAt) {
        return {
          id: `invitation-accepted-${invitation.id}`,
          type: 'invitation_accepted' as const,
          description: `${invitation.producerName} accepted your invitation`,
          timestamp: invitation.acceptedAt.toISOString()
        };
      } else {
        return {
          id: `invitation-sent-${invitation.id}`,
          type: 'invitation_sent' as const,
          description: `Sent invitation to ${invitation.producerName}`,
          timestamp: invitation.createdAt.toISOString()
        };
      }
    });

    const dashboardData = {
      profile,
      stats: {
        activeClients: Number(activeClientsResult.count),
        pendingInvitations: Number(pendingInvitationsResult.count),
        operationsManaged: Number(activeClientsResult.count), // Same as active clients for now
        profileCompleteness
      },
      recentActivity: recentActivity.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, 5),
      profileComplete: profileCompleteness >= 80
    };

    res.json({
      success: true,
      ...dashboardData,
    });

  } catch (error) {
    console.error('Get consultant dashboard error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_FETCH_FAILED',
        message: 'Failed to fetch dashboard data',
      },
    });
  }
}