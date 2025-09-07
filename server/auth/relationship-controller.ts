import { Request, Response } from 'express';
import { getDb } from '../db/connection';
import { sql } from 'drizzle-orm';
import { 
  createRelationshipSchema, 
  updateRelationshipSchema, 
  relationshipPermissionsSchema,
  type CreateRelationship,
  type UpdateRelationship 
} from '@shared/schema';
import { AuthRequest } from '../middleware/jwtAuth';
import { RelationshipAuthRequest, getUserRelationships } from '../middleware/relationshipAuth';

/**
 * Create a new consultant-producer relationship from an accepted invitation
 */
export async function createRelationship(req: AuthRequest, res: Response) {
  try {
    const db = getDb();
    const { user } = req;
    
    if (!user || user.userType !== 'producer') {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only producers can create relationships'
        }
      });
    }

    // Validate request data
    const validation = createRelationshipSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.error.errors
        }
      });
    }

    const { invitationId, operationId, permissions } = validation.data;

    // Verify the invitation exists and is accepted
    const invitationResult = await db.execute(sql`
      SELECT 
        consultant_id,
        producer_id,
        producer_email,
        status,
        accepted_at
      FROM consultant_producer_invitations
      WHERE id = ${invitationId} 
      AND producer_id = ${user.id}
      AND status = 'accepted'
    `);

    if (invitationResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Accepted invitation not found'
        }
      });
    }

    const invitation = invitationResult.rows[0];

    // Verify the operation belongs to the producer
    const operationResult = await db.execute(sql`
      SELECT id FROM operations 
      WHERE id = ${operationId} AND user_id = ${user.id}
    `);

    if (operationResult.rows.length === 0) {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Operation not found or access denied'
        }
      });
    }

    // Check if relationship already exists
    const existingResult = await db.execute(sql`
      SELECT id FROM consultant_producer_relationships
      WHERE consultant_id = ${invitation.consultant_id}
      AND producer_id = ${user.id}
      AND operation_id = ${operationId}
    `);

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: 'RELATIONSHIP_EXISTS',
          message: 'Relationship already exists'
        }
      });
    }

    // Create the relationship
    const relationshipResult = await db.execute(sql`
      INSERT INTO consultant_producer_relationships (
        consultant_id,
        producer_id,
        operation_id,
        permissions,
        status
      )
      VALUES (
        ${invitation.consultant_id},
        ${user.id},
        ${operationId},
        ${JSON.stringify(permissions)},
        'active'
      )
      RETURNING id, consultant_id, producer_id, operation_id, permissions, status, established_at
    `);

    const relationship = relationshipResult.rows[0];

    res.status(201).json({
      success: true,
      relationship: {
        id: relationship.id,
        consultantId: relationship.consultant_id,
        producerId: relationship.producer_id,
        operationId: relationship.operation_id,
        permissions: JSON.parse(relationship.permissions),
        status: relationship.status,
        establishedAt: relationship.established_at
      }
    });

  } catch (error) {
    console.error('Create relationship error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create relationship'
      }
    });
  }
}

/**
 * Get user's relationships
 */
export async function getRelationships(req: AuthRequest, res: Response) {
  try {
    const { user } = req;
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const relationships = await getUserRelationships(user.id, user.userType);

    res.json({
      success: true,
      relationships
    });

  } catch (error) {
    console.error('Get relationships error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get relationships'
      }
    });
  }
}

/**
 * Update relationship permissions
 */
export async function updateRelationshipPermissions(req: RelationshipAuthRequest, res: Response) {
  try {
    const db = getDb();
    const { user } = req;
    const relationshipId = req.params.id;
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    // Validate request data
    const validation = updateRelationshipSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.error.errors
        }
      });
    }

    const { permissions } = validation.data;

    // Verify relationship exists and user is the producer
    const relationshipResult = await db.execute(sql`
      SELECT consultant_id, producer_id, operation_id
      FROM consultant_producer_relationships
      WHERE id = ${relationshipId}
    `);

    if (relationshipResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'RELATIONSHIP_NOT_FOUND',
          message: 'Relationship not found'
        }
      });
    }

    const relationship = relationshipResult.rows[0];
    
    // Only the producer can modify permissions
    if (user.userType !== 'producer' || user.id !== relationship.producer_id) {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only the producer can modify relationship permissions'
        }
      });
    }

    // Update permissions
    const updateResult = await db.execute(sql`
      UPDATE consultant_producer_relationships
      SET permissions = ${JSON.stringify(permissions)}
      WHERE id = ${relationshipId}
      RETURNING id, consultant_id, producer_id, operation_id, permissions, status
    `);

    const updatedRelationship = updateResult.rows[0];

    res.json({
      success: true,
      relationship: {
        id: updatedRelationship.id,
        consultantId: updatedRelationship.consultant_id,
        producerId: updatedRelationship.producer_id,
        operationId: updatedRelationship.operation_id,
        permissions: JSON.parse(updatedRelationship.permissions),
        status: updatedRelationship.status
      }
    });

  } catch (error) {
    console.error('Update relationship permissions error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update relationship permissions'
      }
    });
  }
}

/**
 * Suspend relationship
 */
export async function suspendRelationship(req: RelationshipAuthRequest, res: Response) {
  try {
    const db = getDb();
    const { user } = req;
    const relationshipId = req.params.id;
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    // Update relationship status
    const updateResult = await db.execute(sql`
      UPDATE consultant_producer_relationships
      SET status = 'suspended'
      WHERE id = ${relationshipId}
      AND (consultant_id = ${user.id} OR producer_id = ${user.id})
      RETURNING id
    `);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'RELATIONSHIP_NOT_FOUND',
          message: 'Relationship not found or access denied'
        }
      });
    }

    res.json({
      success: true,
      message: 'Relationship suspended successfully'
    });

  } catch (error) {
    console.error('Suspend relationship error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to suspend relationship'
      }
    });
  }
}

/**
 * Reactivate suspended relationship
 */
export async function reactivateRelationship(req: RelationshipAuthRequest, res: Response) {
  try {
    const db = getDb();
    const { user } = req;
    const relationshipId = req.params.id;
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    // Update relationship status
    const updateResult = await db.execute(sql`
      UPDATE consultant_producer_relationships
      SET status = 'active'
      WHERE id = ${relationshipId}
      AND (consultant_id = ${user.id} OR producer_id = ${user.id})
      AND status = 'suspended'
      RETURNING id
    `);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'RELATIONSHIP_NOT_FOUND',
          message: 'Relationship not found, access denied, or not suspended'
        }
      });
    }

    res.json({
      success: true,
      message: 'Relationship reactivated successfully'
    });

  } catch (error) {
    console.error('Reactivate relationship error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reactivate relationship'
      }
    });
  }
}

/**
 * Delete relationship (permanent removal)
 */
export async function deleteRelationship(req: RelationshipAuthRequest, res: Response) {
  try {
    const db = getDb();
    const { user } = req;
    const relationshipId = req.params.id;
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    // Delete relationship (both parties can delete)
    const deleteResult = await db.execute(sql`
      DELETE FROM consultant_producer_relationships
      WHERE id = ${relationshipId}
      AND (consultant_id = ${user.id} OR producer_id = ${user.id})
      RETURNING id
    `);

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'RELATIONSHIP_NOT_FOUND',
          message: 'Relationship not found or access denied'
        }
      });
    }

    res.json({
      success: true,
      message: 'Relationship deleted successfully'
    });

  } catch (error) {
    console.error('Delete relationship error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete relationship'
      }
    });
  }
}

/**
 * Get relationship details
 */
export async function getRelationshipDetails(req: RelationshipAuthRequest, res: Response) {
  try {
    const db = getDb();
    const { user } = req;
    const relationshipId = req.params.id;
    
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    // Get relationship with related data
    const relationshipResult = await db.execute(sql`
      SELECT 
        cpr.id,
        cpr.permissions,
        cpr.status,
        cpr.established_at,
        cu.id as consultant_id,
        cu.username as consultant_username,
        cu.email as consultant_email,
        cp.full_name as consultant_name,
        cp.specialization,
        pu.id as producer_id,
        pu.username as producer_username,
        pu.email as producer_email,
        o.id as operation_id,
        o.name as operation_name,
        o.location as operation_location
      FROM consultant_producer_relationships cpr
      JOIN users cu ON cpr.consultant_id = cu.id
      JOIN consultant_profiles cp ON cu.id = cp.user_id
      JOIN users pu ON cpr.producer_id = pu.id
      JOIN operations o ON cpr.operation_id = o.id
      WHERE cpr.id = ${relationshipId}
      AND (cpr.consultant_id = ${user.id} OR cpr.producer_id = ${user.id})
    `);

    if (relationshipResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'RELATIONSHIP_NOT_FOUND',
          message: 'Relationship not found or access denied'
        }
      });
    }

    const row = relationshipResult.rows[0];

    res.json({
      success: true,
      relationship: {
        id: row.id,
        permissions: JSON.parse(row.permissions),
        status: row.status,
        establishedAt: row.established_at,
        consultant: {
          id: row.consultant_id,
          username: row.consultant_username,
          email: row.consultant_email,
          fullName: row.consultant_name,
          specialization: row.specialization
        },
        producer: {
          id: row.producer_id,
          username: row.producer_username,
          email: row.producer_email
        },
        operation: {
          id: row.operation_id,
          name: row.operation_name,
          location: row.operation_location
        }
      }
    });

  } catch (error) {
    console.error('Get relationship details error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get relationship details'
      }
    });
  }
}