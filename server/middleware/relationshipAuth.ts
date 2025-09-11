import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection';
import { sql, eq, and, desc } from 'drizzle-orm';
// import { AuthRequest } from './jwtAuth';
import { consultantProducerRelationships, users, operations, consultantProfiles } from '@shared/schema';

// Extend the AuthRequest interface to include relationship permissions
export interface RelationshipAuthRequest extends Request {
  relationship?: {
    id: number;
    consultantId: number;
    producerId: number;
    operationId: number;
    permissions: {
      view: boolean;
      edit: boolean;
      admin: boolean;
    };
    status: string;
  };
}

// Permission levels for easier checking
export type PermissionLevel = 'view' | 'edit' | 'admin';

/**
 * Middleware to check if a consultant has access to a producer's operation
 * and what level of permissions they have
 */
export function requireRelationshipAuth(requiredPermission: PermissionLevel = 'view') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const { user } = req;

      if (!user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required'
          }
        });
      }

      // Extract operation ID from params, body, or query
      const operationId = req.params.operationId || req.body.operationId || req.query.operationId;
      
      if (!operationId) {
        return res.status(400).json({
          error: {
            code: 'OPERATION_ID_REQUIRED',
            message: 'Operation ID is required'
          }
        });
      }

      // If user is a producer, check if they own the operation
      if (user.userType === 'producer') {
        const operationResult = await db.execute(sql`
          SELECT id FROM operations 
          WHERE id = ${operationId} AND user_id = ${user.userId}
        `);

        if (operationResult.rows.length === 0) {
          return res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'Access denied to this operation'
            }
          });
        }

        // Producer has full access to their own operation
        (req as any).relationship = {
          id: 0, // Not applicable for producer
          consultantId: 0,
          producerId: user.userId,
          operationId: parseInt(operationId),
          permissions: { view: true, edit: true, admin: true },
          status: 'owner'
        };

        return next();
      }

      // If user is a consultant, check relationship permissions
      if (user.userType === 'consultant') {
        const relationshipResult = await db.execute(sql`
          SELECT 
            cpr.id,
            cpr.consultant_id,
            cpr.producer_id,
            cpr.operation_id,
            cpr.permissions,
            cpr.status
          FROM consultant_producer_relationships cpr
          WHERE cpr.consultant_id = ${user.userId} 
          AND cpr.operation_id = ${operationId}
          AND cpr.status = 'active'
        `);

        if (relationshipResult.rows.length === 0) {
          return res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'No active relationship found for this operation'
            }
          });
        }

        const relationship = relationshipResult.rows[0];
        const permissions = typeof relationship.permissions === 'string' 
          ? JSON.parse(relationship.permissions)
          : relationship.permissions;

        // Check if relationship is active
        if (relationship.status !== 'active') {
          return res.status(403).json({
            error: {
              code: 'RELATIONSHIP_INACTIVE',
              message: 'Relationship is not active'
            }
          });
        }

        // Check required permission level
        if (!hasPermission(permissions, requiredPermission)) {
          return res.status(403).json({
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `${requiredPermission} permission required`
            }
          });
        }

        // Add relationship info to request
        (req as any).relationship = {
          id: relationship.id,
          consultantId: relationship.consultant_id,
          producerId: relationship.producer_id,
          operationId: relationship.operation_id,
          permissions,
          status: relationship.status
        };

        return next();
      }

      // Staff members have access based on their operation membership
      if (user.userType === 'staff') {
        const staffResult = await db.execute(sql`
          SELECT sm.operation_id, sm.role
          FROM staff_members sm
          JOIN operations o ON sm.operation_id = o.id
          WHERE sm.email = ${user.email} 
          AND sm.status = 'active'
          AND o.id = ${operationId}
        `);

        if (staffResult.rows.length === 0) {
          return res.status(403).json({
            error: {
              code: 'ACCESS_DENIED',
              message: 'No staff access to this operation'
            }
          });
        }

        const staff = staffResult.rows[0];
        const isOwner = staff.role === 'owner';

        // Staff have view/edit permissions, owners have admin
        (req as any).relationship = {
          id: 0, // Not applicable for staff
          consultantId: 0,
          producerId: 0,
          operationId: parseInt(operationId),
          permissions: { 
            view: true, 
            edit: true, 
            admin: isOwner 
          },
          status: 'staff'
        };

        // Check if staff member has required permission
        if (requiredPermission === 'admin' && !isOwner) {
          return res.status(403).json({
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'Owner permission required'
            }
          });
        }

        return next();
      }

      // Unknown user type
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Invalid user type'
        }
      });

    } catch (error) {
      console.error('Relationship auth middleware error:', error);
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  };
}

/**
 * Check if user has the required permission level
 */
function hasPermission(permissions: any, required: PermissionLevel): boolean {
  switch (required) {
    case 'view':
      return permissions.view === true;
    case 'edit':
      return permissions.view === true && permissions.edit === true;
    case 'admin':
      return permissions.view === true && permissions.edit === true && permissions.admin === true;
    default:
      return false;
  }
}

/**
 * Middleware to check if user can manage relationships (consultant or producer only)
 */
export function requireRelationshipManagement() {
  return (req: RelationshipAuthRequest, res: Response, next: NextFunction) => {
    const { user } = req;

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    if (user.userType !== 'consultant' && user.userType !== 'producer') {
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only consultants and producers can manage relationships'
        }
      });
    }

    next();
  };
}

/**
 * Middleware to verify relationship ownership before modification
 */
export function requireRelationshipOwnership() {
  return async (req: RelationshipAuthRequest, res: Response, next: NextFunction) => {
    try {
      const db = getDb();
      const { user } = req;
      const relationshipId = req.params.relationshipId || req.params.id;

      if (!user || !relationshipId) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'User and relationship ID required'
          }
        });
      }

      const relationshipResult = await db.execute(sql`
        SELECT consultant_id, producer_id
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
      
      // Check if user is either the consultant or producer in this relationship
      const isConsultant = user.userType === 'consultant' && user.userId === relationship.consultant_id;
      const isProducer = user.userType === 'producer' && user.userId === relationship.producer_id;

      if (!isConsultant && !isProducer) {
        return res.status(403).json({
          error: {
            code: 'ACCESS_DENIED',
            message: 'Only relationship participants can modify this relationship'
          }
        });
      }

      next();
    } catch (error) {
      console.error('Relationship ownership middleware error:', error);
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      });
    }
  };
}

/**
 * Get user's relationships (for consultants)
 */
export async function getUserRelationships(userId: number, userType: string) {
  const db = getDb();

  if (userType === 'consultant') {
    const result = await db
      .select({
        id: consultantProducerRelationships.id,
        permissions: consultantProducerRelationships.permissions,
        status: consultantProducerRelationships.status,
        establishedAt: consultantProducerRelationships.establishedAt,
        producerId: users.id,
        producerUsername: users.username,
        producerEmail: users.email,
        operationId: operations.id,
        operationName: operations.name,
        operationLocation: operations.location
      })
      .from(consultantProducerRelationships)
      .innerJoin(users, eq(consultantProducerRelationships.producerId, users.id))
      .innerJoin(operations, eq(consultantProducerRelationships.operationId, operations.id))
      .where(eq(consultantProducerRelationships.consultantId, userId))
      .orderBy(desc(consultantProducerRelationships.establishedAt));

    return result.map(row => ({
      id: row.id,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      status: row.status,
      establishedAt: row.establishedAt,
      producer: {
        id: row.producerId,
        username: row.producerUsername,
        email: row.producerEmail
      },
      operation: {
        id: row.operationId,
        name: row.operationName,
        location: row.operationLocation
      }
    }));
  }

  if (userType === 'producer') {
    const result = await db
      .select({
        id: consultantProducerRelationships.id,
        permissions: consultantProducerRelationships.permissions,
        status: consultantProducerRelationships.status,
        establishedAt: consultantProducerRelationships.establishedAt,
        consultantId: users.id,
        consultantUsername: users.username,
        consultantEmail: users.email,
        consultantName: consultantProfiles.fullName,
        specialization: consultantProfiles.specialization,
        operationId: operations.id,
        operationName: operations.name
      })
      .from(consultantProducerRelationships)
      .innerJoin(users, eq(consultantProducerRelationships.consultantId, users.id))
      .innerJoin(consultantProfiles, eq(users.id, consultantProfiles.userId))
      .innerJoin(operations, eq(consultantProducerRelationships.operationId, operations.id))
      .where(eq(consultantProducerRelationships.producerId, userId))
      .orderBy(desc(consultantProducerRelationships.establishedAt));

    return result.map(row => ({
      id: row.id,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      status: row.status,
      establishedAt: row.establishedAt,
      consultant: {
        id: row.consultantId,
        username: row.consultantUsername,
        email: row.consultantEmail,
        fullName: row.consultantName,
        specialization: row.specialization
      },
      operation: {
        id: row.operationId,
        name: row.operationName
      }
    }));
  }

  return [];
}