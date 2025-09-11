import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { createSessionConfig } from '../config/session';
import { sql } from 'drizzle-orm';
import { users, feedingIngredients } from '@shared/schema';

config({ path: '.env.test' });

const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('Feeding Ingredient API', () => {
  let app: express.Application;
  let db: ReturnType<typeof getDb>;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    
    db = getDb();
    
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(createSessionConfig());
    
    await registerRoutes(app);
    
    await cleanupTestData();
    await setupTestUser();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeConnection();
  });

  beforeEach(async () => {
    await cleanupFeedingIngredients();
  });

  async function cleanupTestData() {
    try {
      await db.execute(sql`DELETE FROM feeding_ingredients WHERE user_id LIKE 'test-%'`);
      await db.execute(sql`DELETE FROM users WHERE username LIKE 'test-%'`);
    } catch (error) {
      console.warn('Error during test cleanup:', error);
    }
  }

  async function cleanupFeedingIngredients() {
    try {
      await db.execute(sql`DELETE FROM feeding_ingredients WHERE user_id = ${testUserId}`);
    } catch (error) {
      console.warn('Error during ingredient cleanup:', error);
    }
  }

  async function setupTestUser() {
    testUserId = `test-user-${Date.now()}`;
    
    await db.insert(users).values({
      id: testUserId,
      username: `test-consultant-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      passwordHash: 'hashed-password',
      userType: 'consultant',
      emailVerified: true
    });

    // Create a valid JWT token for the test user
    const jwt = require('jsonwebtoken');
    const secretKey = process.env.JWT_SECRET_KEY || 'test-secret-key';
    
    authToken = jwt.sign(
      { 
        id: testUserId,
        email: `test-${Date.now()}@example.com`,
        userType: 'consultant'
      },
      secretKey,
      { expiresIn: '1h' }
    );
  }

  describe('GET /api/feeding-ingredients', () => {
    it('should return empty array when user has no ingredients', async () => {
      const response = await request(app)
        .get('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return user ingredients with nutritional data', async () => {
      // Insert test ingredients
      await db.insert(feedingIngredients).values([
        {
          id: 'test-ingredient-1',
          userId: testUserId,
          name: 'Corn',
          proteinPercentage: '8.5',
          dryMatterPercentage: '88.0'
        },
        {
          id: 'test-ingredient-2',
          userId: testUserId,
          name: 'Soybean Meal',
          proteinPercentage: '48.0',
          dryMatterPercentage: '90.0'
        }
      ]);

      const response = await request(app)
        .get('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toMatchObject({
        name: 'Corn',
        proteinPercentage: '8.5',
        dryMatterPercentage: '88.0'
      });
      expect(response.body[1]).toMatchObject({
        name: 'Soybean Meal',
        proteinPercentage: '48.0',
        dryMatterPercentage: '90.0'
      });
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .get('/api/feeding-ingredients')
        .expect(401);
    });
  });

  describe('POST /api/feeding-ingredients', () => {
    it('should create new ingredient with valid data', async () => {
      const ingredientData = {
        name: 'Corn Silage',
        proteinPercentage: 7.2,
        dryMatterPercentage: 35.5
      };

      const response = await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ingredientData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Corn Silage',
        proteinPercentage: '7.2',
        dryMatterPercentage: '35.5'
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ proteinPercentage: 8.5 })
        .expect(400);

      expect(response.body.error).toContain('name');
    });

    it('should return 409 for duplicate ingredient name', async () => {
      const ingredientData = {
        name: 'Corn',
        proteinPercentage: 8.5,
        dryMatterPercentage: 88.0
      };

      // Create first ingredient
      await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ingredientData)
        .expect(201);

      // Try to create duplicate
      await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ingredientData)
        .expect(409);
    });

    it('should allow same ingredient name for different users', async () => {
      const otherUserId = `test-user-other-${Date.now()}`;
      await db.insert(users).values({
        id: otherUserId,
        username: `test-other-${Date.now()}`,
        email: `test-other-${Date.now()}@example.com`,
        passwordHash: 'hashed-password',
        userType: 'consultant',
        emailVerified: true
      });

      const ingredientData = {
        name: 'Corn',
        proteinPercentage: 8.5,
        dryMatterPercentage: 88.0
      };

      // Create ingredient for first user
      await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ingredientData)
        .expect(201);

      // Create ingredient for second user (should succeed)
      await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer other-token`)
        .send(ingredientData)
        .expect(201);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .post('/api/feeding-ingredients')
        .send({ name: 'Corn' })
        .expect(401);
    });
  });

  describe('PUT /api/feeding-ingredients/:ingredientId', () => {
    let ingredientId: string;

    beforeEach(async () => {
      const result = await db.insert(feedingIngredients).values({
        id: 'test-ingredient-update',
        userId: testUserId,
        name: 'Original Name',
        proteinPercentage: '8.0',
        dryMatterPercentage: '85.0'
      }).returning();
      ingredientId = result[0].id;
    });

    it('should update ingredient with valid data', async () => {
      const updateData = {
        name: 'Updated Name',
        proteinPercentage: 9.5,
        dryMatterPercentage: 87.0
      };

      const response = await request(app)
        .put(`/api/feeding-ingredients/${ingredientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Updated Name',
        proteinPercentage: '9.5',
        dryMatterPercentage: '87.0'
      });
    });

    it('should return 404 for non-existent ingredient', async () => {
      await request(app)
        .put('/api/feeding-ingredients/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test' })
        .expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .put(`/api/feeding-ingredients/${ingredientId}`)
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should prevent updating ingredients owned by other users', async () => {
      const otherUserId = `test-user-other-${Date.now()}`;
      await db.insert(users).values({
        id: otherUserId,
        username: `test-other-${Date.now()}`,
        email: `test-other-${Date.now()}@example.com`,
        passwordHash: 'hashed-password',
        userType: 'consultant',
        emailVerified: true
      });

      const otherIngredientResult = await db.insert(feedingIngredients).values({
        id: 'other-ingredient',
        userId: otherUserId,
        name: 'Other User Ingredient',
        proteinPercentage: '10.0',
        dryMatterPercentage: '90.0'
      }).returning();

      await request(app)
        .put(`/api/feeding-ingredients/${otherIngredientResult[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Hacked' })
        .expect(404);
    });
  });

  describe('DELETE /api/feeding-ingredients/:ingredientId', () => {
    let ingredientId: string;

    beforeEach(async () => {
      const result = await db.insert(feedingIngredients).values({
        id: 'test-ingredient-delete',
        userId: testUserId,
        name: 'To Delete',
        proteinPercentage: '8.0',
        dryMatterPercentage: '85.0'
      }).returning();
      ingredientId = result[0].id;
    });

    it('should delete ingredient successfully', async () => {
      const response = await request(app)
        .delete(`/api/feeding-ingredients/${ingredientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify ingredient is deleted
      const ingredients = await db.select()
        .from(feedingIngredients)
        .where(sql`id = ${ingredientId}`);
      expect(ingredients).toHaveLength(0);
    });

    it('should return 404 for non-existent ingredient', async () => {
      await request(app)
        .delete('/api/feeding-ingredients/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app)
        .delete(`/api/feeding-ingredients/${ingredientId}`)
        .expect(401);
    });

    it('should prevent deleting ingredients owned by other users', async () => {
      const otherUserId = `test-user-other-${Date.now()}`;
      await db.insert(users).values({
        id: otherUserId,
        username: `test-other-${Date.now()}`,
        email: `test-other-${Date.now()}@example.com`,
        passwordHash: 'hashed-password',
        userType: 'consultant',
        emailVerified: true
      });

      const otherIngredientResult = await db.insert(feedingIngredients).values({
        id: 'other-ingredient-delete',
        userId: otherUserId,
        name: 'Other User Ingredient',
        proteinPercentage: '10.0',
        dryMatterPercentage: '90.0'
      }).returning();

      await request(app)
        .delete(`/api/feeding-ingredients/${otherIngredientResult[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    // This test would be added once we implement the constraint checking
    it.skip('should return 409 when ingredient is in use by templates', async () => {
      // TODO: Implement after template system is in place
      await request(app)
        .delete(`/api/feeding-ingredients/${ingredientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);
    });
  });

  describe('Input validation', () => {
    it('should validate protein percentage range', async () => {
      const response = await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Protein',
          proteinPercentage: 150, // Invalid: > 100%
          dryMatterPercentage: 85.0
        })
        .expect(400);

      expect(response.body.error).toContain('protein');
    });

    it('should validate dry matter percentage range', async () => {
      const response = await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Dry Matter',
          proteinPercentage: 8.5,
          dryMatterPercentage: -5 // Invalid: negative
        })
        .expect(400);

      expect(response.body.error).toContain('dry matter');
    });

    it('should validate ingredient name length', async () => {
      const longName = 'a'.repeat(300); // Exceeds 255 character limit

      const response = await request(app)
        .post('/api/feeding-ingredients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: longName,
          proteinPercentage: 8.5,
          dryMatterPercentage: 85.0
        })
        .expect(400);

      expect(response.body.error).toContain('name');
    });
  });
});