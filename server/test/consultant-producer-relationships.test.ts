import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Load test environment variables
config({ path: '.env.test' });

// Skip these tests if not in PostgreSQL mode
const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('Consultant-Producer Relationship Management', () => {
  let app: express.Application;
  let db: ReturnType<typeof getDb>;
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

  beforeAll(async () => {
    // Ensure database is accessible
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    
    db = getDb();
    
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Register routes
    await registerRoutes(app);
    
    // Clean up any existing test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeConnection();
  });

  beforeEach(async () => {
    // Clean data before each test for isolation
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      // Clean up test data in dependency order
      await db.execute(sql`DELETE FROM consultant_producer_relationships`);
      await db.execute(sql`DELETE FROM consultant_producer_invitations`);
      await db.execute(sql`DELETE FROM operations WHERE operator_email LIKE '%@test.com'`);
      await db.execute(sql`DELETE FROM consultant_profiles`);
      await db.execute(sql`DELETE FROM refresh_tokens`);
      await db.execute(sql`DELETE FROM email_verifications`);
      await db.execute(sql`DELETE FROM users WHERE email LIKE '%@test.com'`);
    } catch (error) {
      console.log('Cleanup skipped (tables may not exist)');
    }
  }

  async function createTestUser(username: string, email: string, userType: 'consultant' | 'producer' | 'staff' = 'consultant', emailVerified: boolean = true) {
    const hashedPassword = await bcrypt.hash('TestPassword123', 10);
    const result = await db.execute(sql`
      INSERT INTO users (username, email, password_hash, user_type, email_verified)
      VALUES (${username}, ${email}, ${hashedPassword}, ${userType}, ${emailVerified})
      RETURNING id, username, email, user_type
    `);
    return result.rows[0];
  }

  async function createTestConsultantProfile(userId: number) {
    await db.execute(sql`
      INSERT INTO consultant_profiles (user_id, full_name, specialization)
      VALUES (${userId}, 'Test Consultant', 'nutritionist')
    `);
  }

  async function createTestOperation(producerId: number, operatorEmail: string) {
    const result = await db.execute(sql`
      INSERT INTO operations (name, operator_email, first_name, last_name, location, invite_code, user_id)
      VALUES ('Test Operation', ${operatorEmail}, 'Test', 'Producer', 'Test Location', 'TEST123', ${producerId})
      RETURNING id
    `);
    return result.rows[0];
  }

  async function getAuthToken(userId: number, userType: string) {
    return jwt.sign({ 
      userId, 
      userType,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }, JWT_SECRET, { algorithm: 'HS256' });
  }

  async function createAcceptedInvitation(consultantId: number, producerId: number, operationId: number) {
    const result = await db.execute(sql`
      INSERT INTO consultant_producer_invitations (
        consultant_id, producer_email, producer_name, producer_id, 
        token, status, expires_at, accepted_at
      )
      VALUES (
        ${consultantId}, 'producer@test.com', 'Test Producer', ${producerId},
        'test-token', 'accepted', ${new Date(Date.now() + 86400000)}, ${new Date()}
      )
      RETURNING id
    `);
    return result.rows[0];
  }

  describe('Relationship Establishment', () => {
    it('should establish relationship when producer accepts invitation', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      const invitation = await createAcceptedInvitation(consultant.id, producer.id, operation.id);

      // Create relationship via API
      const token = await getAuthToken(producer.id, 'producer');
      
      const response = await request(app)
        .post(`/api/consultant/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          invitationId: invitation.id,
          operationId: operation.id,
          permissions: {
            view: true,
            edit: false,
            admin: false
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.relationship).toBeDefined();
      expect(response.body.relationship.status).toBe('active');

      // Verify relationship exists in database
      const relationshipResult = await db.execute(sql`
        SELECT * FROM consultant_producer_relationships 
        WHERE consultant_id = ${consultant.id} AND producer_id = ${producer.id}
      `);
      expect(relationshipResult.rows).toHaveLength(1);
      expect(relationshipResult.rows[0].status).toBe('active');
    });

    it('should prevent duplicate relationships', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create existing relationship
      await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": false, "admin": false}', 'active')
      `);

      const invitation = await createAcceptedInvitation(consultant.id, producer.id, operation.id);
      const token = await getAuthToken(producer.id, 'producer');
      
      const response = await request(app)
        .post(`/api/consultant/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          invitationId: invitation.id,
          operationId: operation.id,
          permissions: {
            view: true,
            edit: true,
            admin: false
          }
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('RELATIONSHIP_EXISTS');
    });

    it('should require valid accepted invitation', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      const token = await getAuthToken(producer.id, 'producer');
      
      const response = await request(app)
        .post(`/api/consultant/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          invitationId: 999999,
          operationId: operation.id,
          permissions: {
            view: true,
            edit: false,
            admin: false
          }
        });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('INVITATION_NOT_FOUND');
    });
  });

  describe('Permission-Based Access Control', () => {
    it('should enforce view-only permissions', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create relationship with view-only permissions
      await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": false, "admin": false}', 'active')
      `);

      const consultantToken = await getAuthToken(consultant.id, 'consultant');
      
      // Should be able to view operation data
      const viewResponse = await request(app)
        .get(`/api/operations/${operation.id}`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(viewResponse.status).toBe(200);

      // Should not be able to edit operation data
      const editResponse = await request(app)
        .put(`/api/operations/${operation.id}`)
        .set('Authorization', `Bearer ${consultantToken}`)
        .send({ name: 'Updated Operation' });

      expect(editResponse.status).toBe(403);
      expect(editResponse.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should enforce edit permissions', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create relationship with edit permissions
      await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": true, "admin": false}', 'active')
      `);

      const consultantToken = await getAuthToken(consultant.id, 'consultant');
      
      // Should be able to edit operation data
      const editResponse = await request(app)
        .put(`/api/operations/${operation.id}`)
        .set('Authorization', `Bearer ${consultantToken}`)
        .send({ name: 'Updated Operation' });

      expect(editResponse.status).toBe(200);

      // Should not be able to perform admin actions (like deleting operation)
      const adminResponse = await request(app)
        .delete(`/api/operations/${operation.id}`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(adminResponse.status).toBe(403);
      expect(adminResponse.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should enforce admin permissions', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create relationship with admin permissions
      await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": true, "admin": true}', 'active')
      `);

      const consultantToken = await getAuthToken(consultant.id, 'consultant');
      
      // Should be able to perform admin actions
      const adminResponse = await request(app)
        .post(`/api/operations/${operation.id}/admin/reset`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(adminResponse.status).toBe(200);
    });

    it('should deny access with no relationship', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);

      const consultantToken = await getAuthToken(consultant.id, 'consultant');
      
      // Should not be able to access operation without relationship
      const response = await request(app)
        .get(`/api/operations/${operation.id}`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should deny access with inactive relationship', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create inactive relationship
      await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": true, "admin": false}', 'inactive')
      `);

      const consultantToken = await getAuthToken(consultant.id, 'consultant');
      
      const response = await request(app)
        .get(`/api/operations/${operation.id}`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('RELATIONSHIP_INACTIVE');
    });
  });

  describe('Relationship Management APIs', () => {
    it('should list consultant relationships', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer1 = await createTestUser('producer1', 'producer1@test.com', 'producer');
      const producer2 = await createTestUser('producer2', 'producer2@test.com', 'producer');
      const operation1 = await createTestOperation(producer1.id, 'producer1@test.com');
      const operation2 = await createTestOperation(producer2.id, 'producer2@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create multiple relationships
      await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES 
          (${consultant.id}, ${producer1.id}, ${operation1.id}, '{"view": true, "edit": false, "admin": false}', 'active'),
          (${consultant.id}, ${producer2.id}, ${operation2.id}, '{"view": true, "edit": true, "admin": false}', 'active')
      `);

      const consultantToken = await getAuthToken(consultant.id, 'consultant');
      
      const response = await request(app)
        .get('/api/consultant/relationships')
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.relationships).toHaveLength(2);
      expect(response.body.relationships[0].producer).toBeDefined();
      expect(response.body.relationships[0].operation).toBeDefined();
      expect(response.body.relationships[0].permissions).toBeDefined();
    });

    it('should update relationship permissions', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create relationship
      const relationshipResult = await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": false, "admin": false}', 'active')
        RETURNING id
      `);
      const relationshipId = relationshipResult.rows[0].id;

      const producerToken = await getAuthToken(producer.id, 'producer');
      
      // Update permissions
      const response = await request(app)
        .put(`/api/consultant/relationships/${relationshipId}`)
        .set('Authorization', `Bearer ${producerToken}`)
        .send({
          permissions: {
            view: true,
            edit: true,
            admin: false
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.relationship.permissions.edit).toBe(true);

      // Verify in database
      const updatedResult = await db.execute(sql`
        SELECT permissions FROM consultant_producer_relationships WHERE id = ${relationshipId}
      `);
      expect(JSON.parse(updatedResult.rows[0].permissions).edit).toBe(true);
    });

    it('should suspend relationship', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create relationship
      const relationshipResult = await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": true, "admin": false}', 'active')
        RETURNING id
      `);
      const relationshipId = relationshipResult.rows[0].id;

      const producerToken = await getAuthToken(producer.id, 'producer');
      
      // Suspend relationship
      const response = await request(app)
        .patch(`/api/consultant/relationships/${relationshipId}/suspend`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify relationship is suspended
      const suspendedResult = await db.execute(sql`
        SELECT status FROM consultant_producer_relationships WHERE id = ${relationshipId}
      `);
      expect(suspendedResult.rows[0].status).toBe('suspended');

      // Verify consultant can no longer access operation
      const consultantToken = await getAuthToken(consultant.id, 'consultant');
      const accessResponse = await request(app)
        .get(`/api/operations/${operation.id}`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(accessResponse.status).toBe(403);
    });

    it('should reactivate suspended relationship', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create suspended relationship
      const relationshipResult = await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": true, "admin": false}', 'suspended')
        RETURNING id
      `);
      const relationshipId = relationshipResult.rows[0].id;

      const producerToken = await getAuthToken(producer.id, 'producer');
      
      // Reactivate relationship
      const response = await request(app)
        .patch(`/api/consultant/relationships/${relationshipId}/reactivate`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify relationship is active
      const activeResult = await db.execute(sql`
        SELECT status FROM consultant_producer_relationships WHERE id = ${relationshipId}
      `);
      expect(activeResult.rows[0].status).toBe('active');
    });

    it('should delete relationship', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create relationship
      const relationshipResult = await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": true, "admin": false}', 'active')
        RETURNING id
      `);
      const relationshipId = relationshipResult.rows[0].id;

      const producerToken = await getAuthToken(producer.id, 'producer');
      
      // Delete relationship
      const response = await request(app)
        .delete(`/api/consultant/relationships/${relationshipId}`)
        .set('Authorization', `Bearer ${producerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify relationship is deleted
      const deletedResult = await db.execute(sql`
        SELECT * FROM consultant_producer_relationships WHERE id = ${relationshipId}
      `);
      expect(deletedResult.rows).toHaveLength(0);
    });
  });

  describe('Security and Validation', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/consultant/relationships' },
        { method: 'post', path: '/api/consultant/relationships' },
        { method: 'put', path: '/api/consultant/relationships/1' },
        { method: 'patch', path: '/api/consultant/relationships/1/suspend' },
        { method: 'delete', path: '/api/consultant/relationships/1' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
      }
    });

    it('should validate permission structure', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      const invitation = await createAcceptedInvitation(consultant.id, producer.id, operation.id);
      
      const token = await getAuthToken(producer.id, 'producer');
      
      // Test invalid permission structure
      const response = await request(app)
        .post(`/api/consultant/relationships`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          invitationId: invitation.id,
          operationId: operation.id,
          permissions: {
            invalid: true
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent unauthorized relationship modifications', async () => {
      const consultant = await createTestUser('consultant', 'consultant@test.com', 'consultant');
      const producer = await createTestUser('producer', 'producer@test.com', 'producer');
      const otherProducer = await createTestUser('other', 'other@test.com', 'producer');
      const operation = await createTestOperation(producer.id, 'producer@test.com');
      
      await createTestConsultantProfile(consultant.id);
      
      // Create relationship
      const relationshipResult = await db.execute(sql`
        INSERT INTO consultant_producer_relationships (consultant_id, producer_id, operation_id, permissions, status)
        VALUES (${consultant.id}, ${producer.id}, ${operation.id}, '{"view": true, "edit": false, "admin": false}', 'active')
        RETURNING id
      `);
      const relationshipId = relationshipResult.rows[0].id;

      // Try to modify relationship with wrong producer token
      const otherToken = await getAuthToken(otherProducer.id, 'producer');
      
      const response = await request(app)
        .put(`/api/consultant/relationships/${relationshipId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          permissions: {
            view: true,
            edit: true,
            admin: true
          }
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });
  });
});