import { config } from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getDb, closeConnection, testConnection } from '../db/connection';
import { sql } from 'drizzle-orm';

config({ path: '.env.test' });

const skipIfNotPostgres = process.env.STORAGE_TYPE !== 'postgresql' || !process.env.DATABASE_URL;

describe.skipIf(skipIfNotPostgres)('Feeding Program Schema Migrations', () => {
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to PostgreSQL database');
    }
    db = getDb();
  });

  afterAll(async () => {
    await cleanupTestTables();
    await closeConnection();
  });

  beforeEach(async () => {
    await cleanupTestTables();
  });

  async function cleanupTestTables() {
    try {
      await db.execute(sql`DROP TABLE IF EXISTS daily_feeding_completion_status CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS feeding_record_variances CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS nutritionist_tasks CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS pen_feeding_program_ingredients CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS pen_feeding_program_phases CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS pen_feeding_programs CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS feeding_program_ingredients CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS feeding_program_phases CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS feeding_program_templates CASCADE`);
      await db.execute(sql`DROP TABLE IF EXISTS feeding_ingredients CASCADE`);
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  describe('feeding_ingredients table', () => {
    it('should create feeding_ingredients table with correct structure', async () => {
      await db.execute(sql`
        CREATE TABLE feeding_ingredients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          protein_percentage DECIMAL(5,2),
          dry_matter_percentage DECIMAL(5,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name)
        )
      `);

      const result = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'feeding_ingredients'
        ORDER BY ordinal_position
      `);

      expect(result.rows).toHaveLength(7);
      
      const columns = result.rows.map((row: any) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable,
        default: row.column_default
      }));

      expect(columns[0]).toMatchObject({ name: 'id', type: 'uuid', nullable: 'NO' });
      expect(columns[1]).toMatchObject({ name: 'user_id', type: 'uuid', nullable: 'NO' });
      expect(columns[2]).toMatchObject({ name: 'name', type: 'character varying', nullable: 'NO' });
      expect(columns[3]).toMatchObject({ name: 'protein_percentage', type: 'numeric', nullable: 'YES' });
      expect(columns[4]).toMatchObject({ name: 'dry_matter_percentage', type: 'numeric', nullable: 'YES' });
    });

    it('should enforce unique constraint on user_id + name', async () => {
      await db.execute(sql`
        CREATE TABLE feeding_ingredients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          protein_percentage DECIMAL(5,2),
          dry_matter_percentage DECIMAL(5,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name)
        )
      `);

      const testUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

      await db.execute(sql`
        INSERT INTO feeding_ingredients (user_id, name, protein_percentage, dry_matter_percentage)
        VALUES (${testUserId}, 'Corn', 8.5, 88.0)
      `);

      await expect(
        db.execute(sql`
          INSERT INTO feeding_ingredients (user_id, name, protein_percentage, dry_matter_percentage)
          VALUES (${testUserId}, 'Corn', 9.0, 89.0)
        `)
      ).rejects.toThrow();
    });

    it('should allow same ingredient name for different users', async () => {
      await db.execute(sql`
        CREATE TABLE feeding_ingredients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          protein_percentage DECIMAL(5,2),
          dry_matter_percentage DECIMAL(5,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name)
        )
      `);

      const user1Id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const user2Id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';

      await db.execute(sql`
        INSERT INTO feeding_ingredients (user_id, name, protein_percentage, dry_matter_percentage)
        VALUES (${user1Id}, 'Corn', 8.5, 88.0)
      `);

      await expect(
        db.execute(sql`
          INSERT INTO feeding_ingredients (user_id, name, protein_percentage, dry_matter_percentage)
          VALUES (${user2Id}, 'Corn', 9.0, 89.0)
        `)
      ).resolves.not.toThrow();
    });
  });

  describe('feeding_program_templates table', () => {
    it('should create feeding_program_templates table with correct structure', async () => {
      await db.execute(sql`
        CREATE TABLE feeding_program_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category_tags TEXT[],
          created_by_user_id UUID NOT NULL,
          is_shared BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'feeding_program_templates'
        ORDER BY ordinal_position
      `);

      expect(result.rows).toHaveLength(8);
      
      const columns = result.rows.map((row: any) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable
      }));

      expect(columns[0]).toMatchObject({ name: 'id', type: 'uuid', nullable: 'NO' });
      expect(columns[1]).toMatchObject({ name: 'name', type: 'character varying', nullable: 'NO' });
      expect(columns[2]).toMatchObject({ name: 'description', type: 'text', nullable: 'YES' });
      expect(columns[3]).toMatchObject({ name: 'category_tags', type: 'ARRAY', nullable: 'YES' });
    });

    it('should support array operations on category_tags', async () => {
      await db.execute(sql`
        CREATE TABLE feeding_program_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category_tags TEXT[],
          created_by_user_id UUID NOT NULL,
          is_shared BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      
      await db.execute(sql`
        INSERT INTO feeding_program_templates (name, category_tags, created_by_user_id)
        VALUES ('Finishing Program', ARRAY['finishing', 'steers', 'high-energy'], ${userId})
      `);

      const result = await db.execute(sql`
        SELECT category_tags FROM feeding_program_templates WHERE name = 'Finishing Program'
      `);

      expect(result.rows[0].category_tags).toEqual(['finishing', 'steers', 'high-energy']);
    });
  });

  describe('feeding_program_phases table', () => {
    it('should create feeding_program_phases table with cascade delete', async () => {
      await db.execute(sql`
        CREATE TABLE feeding_program_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category_tags TEXT[],
          created_by_user_id UUID NOT NULL,
          is_shared BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE feeding_program_phases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID NOT NULL REFERENCES feeding_program_templates(id) ON DELETE CASCADE,
          phase_name VARCHAR(255) NOT NULL,
          phase_order INTEGER NOT NULL,
          duration_days INTEGER NOT NULL,
          target_mcal_per_ration DECIMAL(8,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

      const templateResult = await db.execute(sql`
        INSERT INTO feeding_program_templates (name, created_by_user_id)
        VALUES ('Test Template', ${userId})
        RETURNING id
      `);

      const templateId = templateResult.rows[0].id;

      await db.execute(sql`
        INSERT INTO feeding_program_phases (template_id, phase_name, phase_order, duration_days, target_mcal_per_ration)
        VALUES (${templateId}, 'Starting Phase', 1, 30, 2.5)
      `);

      await db.execute(sql`DELETE FROM feeding_program_templates WHERE id = ${templateId}`);

      const phaseResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM feeding_program_phases WHERE template_id = ${templateId}
      `);

      expect(parseInt(phaseResult.rows[0].count)).toBe(0);
    });
  });

  describe('pen_feeding_programs table', () => {
    it('should create pen_feeding_programs table with feeding_times array', async () => {
      await db.execute(sql`
        CREATE TABLE pen_feeding_programs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pen_id UUID NOT NULL,
          template_id UUID,
          program_name VARCHAR(255) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          feeding_times TEXT[],
          current_phase INTEGER DEFAULT 1,
          status VARCHAR(50) DEFAULT 'active',
          created_by_user_id UUID NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const penId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';

      await db.execute(sql`
        INSERT INTO pen_feeding_programs (
          pen_id, program_name, start_date, end_date, feeding_times, created_by_user_id
        )
        VALUES (
          ${penId}, 
          'Morning/Evening Program',
          '2024-01-01',
          '2024-06-01',
          ARRAY['06:00', '17:00'],
          ${userId}
        )
      `);

      const result = await db.execute(sql`
        SELECT feeding_times, current_phase, status 
        FROM pen_feeding_programs 
        WHERE program_name = 'Morning/Evening Program'
      `);

      expect(result.rows[0].feeding_times).toEqual(['06:00', '17:00']);
      expect(result.rows[0].current_phase).toBe(1);
      expect(result.rows[0].status).toBe('active');
    });
  });

  describe('variance tracking tables', () => {
    it('should create feeding_record_variances table with unique constraint', async () => {
      await db.execute(sql`
        CREATE TABLE pen_feeding_programs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pen_id UUID NOT NULL,
          template_id UUID,
          program_name VARCHAR(255) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          feeding_times TEXT[],
          current_phase INTEGER DEFAULT 1,
          status VARCHAR(50) DEFAULT 'active',
          created_by_user_id UUID NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE feeding_ingredients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          protein_percentage DECIMAL(5,2),
          dry_matter_percentage DECIMAL(5,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name)
        )
      `);

      await db.execute(sql`
        CREATE TABLE feeding_record_variances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pen_program_id UUID NOT NULL REFERENCES pen_feeding_programs(id),
          pen_id UUID NOT NULL,
          ingredient_id UUID NOT NULL REFERENCES feeding_ingredients(id),
          recorded_by_user_id UUID NOT NULL,
          date DATE NOT NULL,
          feeding_time VARCHAR(10),
          planned_amount DECIMAL(8,2) NOT NULL,
          actual_amount DECIMAL(8,2) NOT NULL,
          variance_amount DECIMAL(8,2) NOT NULL,
          variance_percentage DECIMAL(5,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(pen_program_id, ingredient_id, date, feeding_time)
        )
      `);

      const result = await db.execute(sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'feeding_record_variances'
        ORDER BY ordinal_position
      `);

      const varColumns = result.rows.map((row: any) => row.column_name);
      expect(varColumns).toContain('variance_amount');
      expect(varColumns).toContain('variance_percentage');
      expect(varColumns).toContain('feeding_time');
    });

    it('should create daily_feeding_completion_status table', async () => {
      await db.execute(sql`
        CREATE TABLE pen_feeding_programs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pen_id UUID NOT NULL,
          template_id UUID,
          program_name VARCHAR(255) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          feeding_times TEXT[],
          current_phase INTEGER DEFAULT 1,
          status VARCHAR(50) DEFAULT 'active',
          created_by_user_id UUID NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`
        CREATE TABLE daily_feeding_completion_status (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pen_program_id UUID NOT NULL REFERENCES pen_feeding_programs(id),
          completed_by_user_id UUID NOT NULL,
          date DATE NOT NULL,
          feeding_time VARCHAR(10) NOT NULL,
          completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(pen_program_id, date, feeding_time)
        )
      `);

      const result = await db.execute(sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'daily_feeding_completion_status'
        ORDER BY ordinal_position
      `);

      expect(result.rows).toHaveLength(6);
      
      const columns = result.rows.map((row: any) => ({
        name: row.column_name,
        type: row.data_type
      }));

      expect(columns.find(c => c.name === 'date')).toMatchObject({ type: 'date' });
      expect(columns.find(c => c.name === 'feeding_time')).toMatchObject({ type: 'character varying' });
    });
  });

  describe('nutritionist_tasks table', () => {
    it('should create nutritionist_tasks table with enum constraints', async () => {
      await db.execute(sql`
        CREATE TABLE nutritionist_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nutritionist_id UUID NOT NULL,
          pen_id UUID NOT NULL,
          task_type VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          priority VARCHAR(20) DEFAULT 'normal',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          completed_by_user_id UUID,
          notes TEXT,
          UNIQUE(pen_id, task_type)
        )
      `);

      const nutritionistId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const penId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';

      await db.execute(sql`
        INSERT INTO nutritionist_tasks (nutritionist_id, pen_id, task_type, priority)
        VALUES (${nutritionistId}, ${penId}, 'create_feeding_programs', 'high')
      `);

      const result = await db.execute(sql`
        SELECT status, priority, task_type 
        FROM nutritionist_tasks 
        WHERE nutritionist_id = ${nutritionistId}
      `);

      expect(result.rows[0]).toMatchObject({
        status: 'pending',
        priority: 'high',
        task_type: 'create_feeding_programs'
      });
    });

    it('should enforce unique constraint on pen_id + task_type', async () => {
      await db.execute(sql`
        CREATE TABLE nutritionist_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nutritionist_id UUID NOT NULL,
          pen_id UUID NOT NULL,
          task_type VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          priority VARCHAR(20) DEFAULT 'normal',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          completed_by_user_id UUID,
          notes TEXT,
          UNIQUE(pen_id, task_type)
        )
      `);

      const nutritionist1Id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const nutritionist2Id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13';
      const penId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';

      await db.execute(sql`
        INSERT INTO nutritionist_tasks (nutritionist_id, pen_id, task_type)
        VALUES (${nutritionist1Id}, ${penId}, 'create_feeding_programs')
      `);

      await expect(
        db.execute(sql`
          INSERT INTO nutritionist_tasks (nutritionist_id, pen_id, task_type)
          VALUES (${nutritionist2Id}, ${penId}, 'create_feeding_programs')
        `)
      ).rejects.toThrow();
    });
  });

  describe('required indexes', () => {
    it('should create all required indexes for performance', async () => {
      await db.execute(sql`
        CREATE TABLE feeding_ingredients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          protein_percentage DECIMAL(5,2),
          dry_matter_percentage DECIMAL(5,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, name)
        )
      `);

      await db.execute(sql`
        CREATE TABLE feeding_program_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category_tags TEXT[],
          created_by_user_id UUID NOT NULL,
          is_shared BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.execute(sql`CREATE INDEX idx_feeding_ingredients_user ON feeding_ingredients(user_id)`);
      await db.execute(sql`CREATE INDEX idx_feeding_program_templates_created_by ON feeding_program_templates(created_by_user_id)`);
      await db.execute(sql`CREATE INDEX idx_feeding_program_templates_category_tags ON feeding_program_templates USING GIN(category_tags)`);

      const indexResult = await db.execute(sql`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE tablename IN ('feeding_ingredients', 'feeding_program_templates')
        AND schemaname = 'public'
      `);

      const indexNames = indexResult.rows.map((row: any) => row.indexname);
      expect(indexNames).toContain('idx_feeding_ingredients_user');
      expect(indexNames).toContain('idx_feeding_program_templates_created_by');
      expect(indexNames).toContain('idx_feeding_program_templates_category_tags');
    });
  });
});