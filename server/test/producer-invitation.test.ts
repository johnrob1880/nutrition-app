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

describe.skipIf(skipIfNotPostgres)('Producer Invitation System', () => {
  let app: express.Application;
  let db: ReturnType<typeof getDb>;
  let consultantToken: string;
  let consultantUserId: number;
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
    
    // Create test consultant and get auth token by logging in
    const consultant = await createTestConsultant();
    consultantUserId = consultant.id;
    
    // Login to get real JWT token
    const loginResponse = await request(app)
      .post('/api/jwt-auth/login')
      .send({
        username: 'testconsultant',
        password: 'TestPassword123'
      });
    
    if (loginResponse.status === 200) {
      consultantToken = loginResponse.body.accessToken;
    } else {
      throw new Error('Failed to get consultant auth token: ' + JSON.stringify(loginResponse.body));
    }
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeConnection();
  });

  beforeEach(async () => {
    // Clean invitation data before each test for isolation
    await cleanupInvitations();
  });

  async function cleanupTestData() {
    try {
      // Clean up test data in dependency order
      await db.execute(sql`DELETE FROM consultant_producer_relationships`);
      await db.execute(sql`DELETE FROM consultant_producer_invitations`);
      await db.execute(sql`DELETE FROM refresh_tokens`);
      await db.execute(sql`DELETE FROM email_verifications`);
      await db.execute(sql`DELETE FROM consultant_profiles`);
      await db.execute(sql`DELETE FROM users WHERE email LIKE '%@test.com'`);
    } catch (error) {
      console.log('Cleanup skipped (tables may not exist)');
    }
  }

  async function cleanupInvitations() {
    try {
      await db.execute(sql`DELETE FROM consultant_producer_invitations WHERE consultant_id = ${consultantUserId}`);
    } catch (error) {
      console.log('Invitation cleanup skipped');
    }
  }

  async function createTestConsultant() {
    const hashedPassword = await bcrypt.hash('TestPassword123', 10);
    const userResult = await db.execute(sql`
      INSERT INTO users (username, email, password_hash, user_type, email_verified)
      VALUES ('testconsultant', 'consultant@test.com', ${hashedPassword}, 'consultant', true)
      RETURNING id, username, email, user_type
    `);
    
    const user = userResult.rows[0];
    
    // Create consultant profile
    await db.execute(sql`
      INSERT INTO consultant_profiles (user_id, full_name, specialization)
      VALUES (${user.id}, 'Test Consultant', 'nutritionist')
    `);
    
    return user;
  }

  describe('Invitation Creation', () => {
    it('should create a producer invitation successfully', async () => {
      const invitationData = {
        producerEmail: 'producer@test.com',
        producerName: 'Test Producer',
        message: 'I would like to help you manage your cattle nutrition program.'
      };

      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send(invitationData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.invitation).toBeDefined();
      expect(response.body.invitation.id).toBeDefined();
      expect(response.body.invitation.token).toBeDefined();
      expect(response.body.invitation.status).toBe('pending');
      expect(response.body.invitation.producerEmail).toBe('producer@test.com');
      expect(response.body.invitation.producerName).toBe('Test Producer');

      // Verify invitation was created in database
      const invitationResult = await db.execute(sql`
        SELECT * FROM consultant_producer_invitations 
        WHERE producer_email = 'producer@test.com' AND consultant_id = ${consultantUserId}
      `);
      expect(invitationResult.rows).toHaveLength(1);
      expect(invitationResult.rows[0].status).toBe('pending');
      expect(invitationResult.rows[0].message).toBe(invitationData.message);
    });

    it('should reject invitation with invalid email format', async () => {
      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send({
          producerEmail: 'invalid-email',
          producerName: 'Test Producer',
          message: 'Test message'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate invitation to same producer', async () => {
      const invitationData = {
        producerEmail: 'producer@test.com',
        producerName: 'Test Producer',
        message: 'First invitation'
      };

      // Create first invitation
      await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send(invitationData);

      // Attempt duplicate invitation
      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send({
          ...invitationData,
          message: 'Duplicate invitation'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVITATION_EXISTS');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/consultant/invitations')
        .send({
          producerEmail: 'producer@test.com',
          producerName: 'Test Producer',
          message: 'Test message'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should require consultant role', async () => {
      // Create producer user and login to get token
      const hashedPassword = await bcrypt.hash('ProducerPass123', 10);
      await db.execute(sql`
        INSERT INTO users (username, email, password_hash, user_type, email_verified)
        VALUES ('testproducer', 'testproducer@test.com', ${hashedPassword}, 'producer', true)
      `);

      const loginResponse = await request(app)
        .post('/api/jwt-auth/login')
        .send({
          username: 'testproducer',
          password: 'ProducerPass123'
        });

      const producerToken = loginResponse.body.accessToken;

      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${producerToken}`)
        .send({
          producerEmail: 'producer@test.com',
          producerName: 'Test Producer',
          message: 'Test message'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Invitation Management', () => {
    let invitationId: number;
    let invitationToken: string;

    beforeEach(async () => {
      // Create test invitation for management tests
      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send({
          producerEmail: 'manage@test.com',
          producerName: 'Management Test Producer',
          message: 'Test invitation for management'
        });
      
      invitationId = response.body.invitation.id;
      invitationToken = response.body.invitation.token;
    });

    it('should list consultant invitations with pagination', async () => {
      const response = await request(app)
        .get('/api/consultant/invitations')
        .set('Authorization', `Bearer ${consultantToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invitations).toBeDefined();
      expect(Array.isArray(response.body.invitations)).toBe(true);
      expect(response.body.invitations.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });

    it('should resend pending invitation', async () => {
      const response = await request(app)
        .put(`/api/consultant/invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation resent successfully');

      // Verify invitation still exists and is pending
      const invitationResult = await db.execute(sql`
        SELECT * FROM consultant_producer_invitations WHERE id = ${invitationId}
      `);
      expect(invitationResult.rows[0].status).toBe('pending');
    });

    it('should cancel pending invitation', async () => {
      const response = await request(app)
        .delete(`/api/consultant/invitations/${invitationId}`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation cancelled successfully');

      // Verify invitation no longer exists
      const invitationResult = await db.execute(sql`
        SELECT * FROM consultant_producer_invitations WHERE id = ${invitationId}
      `);
      expect(invitationResult.rows).toHaveLength(0);
    });

    it('should not allow resending non-pending invitation', async () => {
      // Mark invitation as accepted
      await db.execute(sql`
        UPDATE consultant_producer_invitations 
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = ${invitationId}
      `);

      const response = await request(app)
        .put(`/api/consultant/invitations/${invitationId}/resend`)
        .set('Authorization', `Bearer ${consultantToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INVITATION_STATUS');
    });
  });

  describe('Invitation Acceptance Flow', () => {
    let invitationToken: string;

    beforeEach(async () => {
      // Create test invitation for acceptance tests
      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send({
          producerEmail: 'accept@test.com',
          producerName: 'Acceptance Test Producer',
          message: 'Test invitation for acceptance'
        });
      
      invitationToken = response.body.invitation.token;
    });

    it('should retrieve invitation details with valid token', async () => {
      const response = await request(app)
        .get(`/api/invitations/${invitationToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.invitation).toBeDefined();
      expect(response.body.invitation.producerEmail).toBe('accept@test.com');
      expect(response.body.invitation.producerName).toBe('Acceptance Test Producer');
      expect(response.body.invitation.message).toBe('Test invitation for acceptance');
      expect(response.body.invitation.status).toBe('pending');
      expect(response.body.consultant).toBeDefined();
      expect(response.body.consultant.name).toBe('Test Consultant');
      expect(response.body.consultant.specialization).toBe('nutritionist');
    });

    it('should accept invitation for new producer (creates account)', async () => {
      const acceptanceData = {
        username: 'newproducer',
        password: 'ProducerPass123',
        fullName: 'New Producer Name'
      };

      const response = await request(app)
        .post(`/api/invitations/${invitationToken}/accept`)
        .send(acceptanceData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation accepted and account created successfully');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('newproducer');
      expect(response.body.user.email).toBe('accept@test.com');
      expect(response.body.user.userType).toBe('producer');

      // Verify user was created
      const userResult = await db.execute(sql`
        SELECT * FROM users WHERE email = 'accept@test.com'
      `);
      expect(userResult.rows).toHaveLength(1);
      expect(userResult.rows[0].user_type).toBe('producer');

      // Verify invitation status updated
      const invitationResult = await db.execute(sql`
        SELECT * FROM consultant_producer_invitations WHERE token = ${invitationToken}
      `);
      expect(invitationResult.rows[0].status).toBe('accepted');
      expect(invitationResult.rows[0].accepted_at).toBeDefined();

      // Verify relationship was created
      const relationshipResult = await db.execute(sql`
        SELECT * FROM consultant_producer_relationships 
        WHERE consultant_id = ${consultantUserId} AND producer_id = ${userResult.rows[0].id}
      `);
      expect(relationshipResult.rows).toHaveLength(1);
      expect(relationshipResult.rows[0].permissions).toBeDefined();
    });

    it('should accept invitation for existing producer (links account)', async () => {
      // Create existing producer user
      const hashedPassword = await bcrypt.hash('ExistingPass123', 10);
      const existingUserResult = await db.execute(sql`
        INSERT INTO users (username, email, password_hash, user_type, email_verified)
        VALUES ('existingproducer', 'accept@test.com', ${hashedPassword}, 'producer', true)
        RETURNING id
      `);
      const existingUserId = existingUserResult.rows[0].id;

      const response = await request(app)
        .post(`/api/invitations/${invitationToken}/accept`)
        .send({
          username: 'existingproducer',
          password: 'ExistingPass123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation accepted and account linked successfully');

      // Verify invitation status updated
      const invitationResult = await db.execute(sql`
        SELECT * FROM consultant_producer_invitations WHERE token = ${invitationToken}
      `);
      expect(invitationResult.rows[0].status).toBe('accepted');

      // Verify relationship was created with existing user
      const relationshipResult = await db.execute(sql`
        SELECT * FROM consultant_producer_relationships 
        WHERE consultant_id = ${consultantUserId} AND producer_id = ${existingUserId}
      `);
      expect(relationshipResult.rows).toHaveLength(1);
    });

    it('should decline invitation', async () => {
      const response = await request(app)
        .post(`/api/invitations/${invitationToken}/decline`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Invitation declined');

      // Verify invitation status updated
      const invitationResult = await db.execute(sql`
        SELECT * FROM consultant_producer_invitations WHERE token = ${invitationToken}
      `);
      expect(invitationResult.rows[0].status).toBe('declined');
      expect(invitationResult.rows[0].declined_at).toBeDefined();

      // Verify no relationship was created
      const relationshipResult = await db.execute(sql`
        SELECT * FROM consultant_producer_relationships 
        WHERE consultant_id = ${consultantUserId}
      `);
      expect(relationshipResult.rows).toHaveLength(0);
    });

    it('should reject invalid invitation token', async () => {
      const response = await request(app)
        .get('/api/invitations/invalid-token');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should reject expired invitation token', async () => {
      // Update invitation to be expired
      await db.execute(sql`
        UPDATE consultant_producer_invitations 
        SET expires_at = ${new Date(Date.now() - 1000)}
        WHERE token = ${invitationToken}
      `);

      const response = await request(app)
        .get(`/api/invitations/${invitationToken}`);

      expect(response.status).toBe(410);
      expect(response.body.error.code).toBe('INVITATION_EXPIRED');
    });

    it('should reject already processed invitation', async () => {
      // Accept invitation first
      await request(app)
        .post(`/api/invitations/${invitationToken}/accept`)
        .send({
          username: 'firstaccept',
          password: 'AcceptPass123',
          fullName: 'First Accept'
        });

      // Try to accept again
      const response = await request(app)
        .post(`/api/invitations/${invitationToken}/accept`)
        .send({
          username: 'secondaccept',
          password: 'AcceptPass123',
          fullName: 'Second Accept'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVITATION_ALREADY_PROCESSED');
    });
  });

  describe('Email Integration', () => {
    it('should send email when invitation is created', async () => {
      // This would test SendGrid integration
      // For now, just verify the invitation creation includes email sending attempt
      const response = await request(app)
        .post('/api/consultant/invitations')
        .set('Authorization', `Bearer ${consultantToken}`)
        .send({
          producerEmail: 'email@test.com',
          producerName: 'Email Test Producer',
          message: 'Test invitation with email'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.emailSent).toBeDefined();
      // In production, this would be true if SendGrid is configured
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on invitation creation', async () => {
      // Create multiple invitations rapidly to test rate limiting
      const promises = [];
      for (let i = 0; i < 6; i++) {
        promises.push(
          request(app)
            .post('/api/consultant/invitations')
            .set('Authorization', `Bearer ${consultantToken}`)
            .send({
              producerEmail: `ratelimit${i}@test.com`,
              producerName: `Rate Limit Test ${i}`,
              message: 'Rate limit test invitation'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // First 5 should succeed, 6th should be rate limited
      const successfulResponses = responses.filter(r => r.status === 201);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(successfulResponses.length).toBeLessThanOrEqual(5);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});