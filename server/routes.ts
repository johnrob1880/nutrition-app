import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOperationSchema, type UpdateWeightRequest, type InsertFeedingRecord, type InsertPen, inviteStaffSchema, acceptStaffInvitationSchema } from "@shared/schema";
import { notificationWS } from "./services/websocket";
import { z } from "zod";
// Email service is imported dynamically to avoid SENDGRID_API_KEY requirement during testing

// JWT Authentication imports
import { 
  registerConsultant, 
  login, 
  refreshToken, 
  logout, 
  verifyEmail, 
  resendEmailVerification 
} from "./auth/controller";
import { 
  getConsultantProfile,
  updateConsultantProfile,
  getConsultantDashboard 
} from "./auth/consultant-controller";
import {
  createInvitation,
  getInvitations,
  resendInvitation,
  cancelInvitation,
  getInvitationByToken,
  acceptInvitation,
  declineInvitation,
  createTestInvitation
} from "./auth/invitation-controller";
import {
  createRelationship,
  getRelationships,
  updateRelationshipPermissions,
  suspendRelationship,
  reactivateRelationship,
  deleteRelationship,
  getRelationshipDetails
} from "./auth/relationship-controller";
import { getUserRelationships } from "./middleware/relationshipAuth";
import { getDb } from "./db/connection";
import { sql } from "drizzle-orm";
import { 
  registrationRateLimit, 
  loginRateLimit, 
  emailVerificationRateLimit, 
  corsMiddleware,
  authenticateJWT,
  requireConsultant,
  invitationRateLimit,
  apiRateLimit 
} from "./auth/middleware";
import { FeedingIngredientController } from "./controllers/feeding-ingredient-controller";
import { FeedingProgramTemplateController } from "./controllers/feeding-program-template-controller";
import { PenFeedingProgramController } from "./controllers/pen-feeding-program-controller";
import { NutritionistTaskController } from "./controllers/nutritionist-task-controller";
import { 
  validationSchemas, 
  handleValidationErrors, 
  createActivityLogger,
  csrfProtection,
  getCSRFToken 
} from "./security/security";
import {
  requireRelationshipManagement,
  requireRelationshipOwnership
} from "./middleware/relationshipAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (no authentication required)
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version
    });
  });

  // API Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version
    });
  });

  // Authentication middleware
  function requireAuth(req: any, res: any, next: any) {
    if (!req.session || !req.session.email) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    next();
  }

  // Session-based authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Verify the user exists (either as operation owner or staff member)
      const userRole = await storage.getUserRole(email);
      if (!userRole) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Store user info in session
      req.session.email = email;
      req.session.userId = userRole.operationId.toString();
      req.session.operationId = userRole.operationId;
      req.session.role = userRole.role;

      // Force save session
      req.session.save((err: any) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ message: 'Failed to create session' });
        }
        
        res.json({
          success: true,
          user: {
            email: email,
            role: userRole.role,
            operationId: userRole.operationId
          },
          sessionId: req.sessionID
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req: any, res: any) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.clearCookie('nutrition.sid');
      res.json({ success: true });
    });
  });

  app.get('/api/auth/session', (req: any, res: any) => {
    if (req.session && req.session.email) {
      res.json({
        isAuthenticated: true,
        user: {
          email: req.session.email,
          role: req.session.role,
          operationId: req.session.operationId
        },
        sessionId: req.sessionID
      });
    } else {
      res.json({
        isAuthenticated: false,
        user: null,
        sessionId: req.sessionID
      });
    }
  });

  // Check session validity
  app.get('/api/auth/check', requireAuth, (req: any, res: any) => {
    res.json({
      valid: true,
      user: {
        email: req.session.email,
        role: req.session.role,
        operationId: req.session.operationId
      }
    });
  });

  // CSRF Token endpoint
  app.get('/api/csrf-token', getCSRFToken);

  // JWT Authentication Routes (with CORS, rate limiting, validation, and logging)
  app.use('/api/jwt-auth', corsMiddleware);
  
  // Consultant registration
  app.post('/api/jwt-auth/register/consultant', 
    registrationRateLimit,
    validationSchemas.consultantRegistration,
    handleValidationErrors,
    createActivityLogger('CONSULTANT_REGISTRATION'),
    registerConsultant
  );
  
  // JWT User login
  app.post('/api/jwt-auth/login', 
    loginRateLimit,
    validationSchemas.login,
    handleValidationErrors,
    createActivityLogger('USER_LOGIN'),
    login
  );
  
  // Token refresh
  app.post('/api/jwt-auth/refresh', 
    createActivityLogger('TOKEN_REFRESH'),
    refreshToken
  );
  
  // JWT Logout (revoke refresh token)
  app.post('/api/jwt-auth/logout', 
    createActivityLogger('USER_LOGOUT'),
    logout
  );
  
  // Email verification
  app.post('/api/jwt-auth/verify-email', 
    emailVerificationRateLimit,
    validationSchemas.emailVerification,
    handleValidationErrors,
    createActivityLogger('EMAIL_VERIFICATION'),
    verifyEmail
  );
  
  // Resend email verification
  app.post('/api/jwt-auth/resend-verification', 
    emailVerificationRateLimit,
    createActivityLogger('RESEND_EMAIL_VERIFICATION'),
    resendEmailVerification
  );

  // Consultant Profile Routes (with API rate limiting and logging)
  app.use('/api/consultant', apiRateLimit);
  
  app.get('/api/consultant/profile', 
    authenticateJWT, 
    requireConsultant, 
    createActivityLogger('PROFILE_VIEW'),
    getConsultantProfile
  );
  
  app.put('/api/consultant/profile', 
    authenticateJWT, 
    requireConsultant,
    validationSchemas.profileUpdate,
    handleValidationErrors,
    createActivityLogger('PROFILE_UPDATE'),
    updateConsultantProfile
  );
  
  app.get('/api/consultant/dashboard', 
    authenticateJWT, 
    requireConsultant, 
    createActivityLogger('DASHBOARD_VIEW'),
    getConsultantDashboard
  );

  // Consultant Invitation Management Routes
  app.post('/api/consultant/invitations', 
    authenticateJWT, 
    requireConsultant,
    invitationRateLimit,
    validationSchemas.producerInvitation,
    handleValidationErrors,
    createActivityLogger('INVITATION_CREATED'),
    createInvitation
  );
  
  app.get('/api/consultant/invitations', 
    authenticateJWT, 
    requireConsultant,
    createActivityLogger('INVITATIONS_VIEWED'),
    getInvitations
  );
  
  app.put('/api/consultant/invitations/:id/resend', 
    authenticateJWT, 
    requireConsultant,
    invitationRateLimit,
    createActivityLogger('INVITATION_RESENT'),
    resendInvitation
  );
  
  app.delete('/api/consultant/invitations/:id', 
    authenticateJWT, 
    requireConsultant,
    createActivityLogger('INVITATION_CANCELLED'),
    cancelInvitation
  );

  // Public Invitation Routes (for producers) - with logging
  app.get('/api/invitations/:token', 
    createActivityLogger('INVITATION_VIEWED'),
    getInvitationByToken
  );
  
  app.post('/api/invitations/:token/accept', 
    createActivityLogger('INVITATION_ACCEPTED'),
    acceptInvitation
  );
  
  app.post('/api/invitations/:token/decline', 
    createActivityLogger('INVITATION_DECLINED'),
    declineInvitation
  );

  // Test endpoint for development
  app.post('/api/test/create-invitation', 
    createTestInvitation
  );

  // Consultant-Producer Relationship Management Routes
  app.post('/api/consultant/relationships', authenticateJWT, createRelationship);
  app.get('/api/consultant/relationships', authenticateJWT, requireRelationshipManagement(), getRelationships);
  app.get('/api/consultant/relationships/:id', authenticateJWT, requireRelationshipOwnership(), getRelationshipDetails);
  app.put('/api/consultant/relationships/:id', authenticateJWT, requireRelationshipOwnership(), updateRelationshipPermissions);
  app.patch('/api/consultant/relationships/:id/suspend', authenticateJWT, requireRelationshipOwnership(), suspendRelationship);
  app.patch('/api/consultant/relationships/:id/reactivate', authenticateJWT, requireRelationshipOwnership(), reactivateRelationship);
  app.delete('/api/consultant/relationships/:id', authenticateJWT, requireRelationshipOwnership(), deleteRelationship);

  // Producer-side relationship routes (using operationId for consistency)
  app.get('/api/producer/consultants/:operationId', async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      
      if (isNaN(operationId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid operation ID' 
        });
      }

      // Find the producer user by operation
      const db = getDb();
      const producerResult = await db.execute(sql`
        SELECT u.id as user_id
        FROM operations o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ${operationId} AND u.user_type = 'producer'
      `);

      if (producerResult.rows.length === 0) {
        return res.json({ success: true, relationships: [] });
      }

      const producerId = producerResult.rows[0].user_id as number;
      
      // Get relationships using the existing function
      const relationships = await getUserRelationships(producerId, 'producer');
      
      res.json({
        success: true,
        relationships
      });

    } catch (error) {
      console.error('Error fetching producer consultants:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch consultants' 
      });
    }
  });

  // Get operation by email
  app.get("/api/operation/:email", async (req, res) => {
    try {
      const operation = await storage.getOperationByEmail(req.params.email);
      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }
      res.json(operation);
    } catch (error) {
      res.status(500).json({ message: "Failed to get operation" });
    }
  });

  // Create operation
  app.post("/api/operations", async (req, res) => {
    try {
      const validatedData = insertOperationSchema.parse(req.body);
      
      // Check if operation with this email already exists
      const existing = await storage.getOperationByEmail(validatedData.operatorEmail);
      if (existing) {
        return res.status(400).json({ message: "Operation with this email already exists" });
      }

      // Validate invite code
      const isValidInvite = await storage.validateInviteCode(validatedData.inviteCode, validatedData.operatorEmail);
      if (!isValidInvite) {
        return res.status(400).json({ message: "Invalid invite code or email combination" });
      }

      const operation = await storage.createOperation(validatedData);
      res.status(201).json(operation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create operation" });
    }
  });

  // Update operation
  app.patch("/api/operations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = insertOperationSchema.partial().parse(req.body);
      
      const operation = await storage.updateOperation(id, updateData);
      if (!operation) {
        return res.status(404).json({ message: "Operation not found" });
      }
      
      res.json(operation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update operation" });
    }
  });

  // Get pens for operation
  app.get("/api/pens/:operationId", async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }
      const pens = await storage.getPensByOperationId(operationId);
      res.json(pens);
    } catch (error) {
      console.error("Failed to get pens:", error);
      res.status(500).json({ message: "Failed to get pens" });
    }
  });

  // Create new pen
  app.post("/api/pens", async (req, res) => {
    try {
      const penData: InsertPen = req.body;

      // Validate required fields
      if (!penData.name || !penData.operationId || !penData.capacity || !penData.cattleType || !penData.startingWeight || !penData.marketWeight) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Set default feed type if not provided
      if (!penData.feedType) {
        penData.feedType = "Pending";
      }

      // Validate capacity and current cattle count
      if (penData.current > penData.capacity) {
        return res.status(400).json({ message: "Current cattle count cannot exceed pen capacity" });
      }

      // If nutritionist is assigned, use atomic transaction
      if (penData.nutritionistId) {
        try {
          // Create pen, task, and notification in atomic transaction
          const result = await storage.createPenWithTask(
            penData,
            penData.nutritionistId,
            penData.operationId
          );

          // Send real-time WebSocket notification
          notificationWS.sendTaskAssigned(penData.nutritionistId, {
            taskId: result.task.id,
            penId: result.pen.id,
            penName: result.pen.name,
            message: `You have been assigned to create a feeding program for pen "${result.pen.name}"`
          });

          // Return pen with task creation success info
          res.status(201).json({
            ...result.pen,
            taskCreated: true,
            taskId: result.task.id,
            notificationId: result.notification.id
          });

        } catch (error) {
          console.error("Error in atomic pen creation:", error);
          res.status(500).json({
            message: "Failed to create pen with task assignment",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      } else {
        // No nutritionist assigned, create pen normally
        const pen = await storage.createPen(penData);
        res.status(201).json(pen);
      }

    } catch (error) {
      console.error("Error creating pen:", error);
      res.status(500).json({ message: "Failed to create pen" });
    }
  });


  // Get upcoming schedule changes
  app.get("/api/upcoming-changes/:operationId", async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }
      const changes = await storage.getUpcomingScheduleChangesByOperationId(operationId);
      res.json(changes);
    } catch (error) {
      console.error("Failed to get upcoming changes:", error);
      res.status(500).json({ message: "Failed to get upcoming changes" });
    }
  });

  // Get dashboard stats
  app.get("/api/dashboard/:operationId", async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }
      const stats = await storage.getDashboardStatsByOperationId(operationId);
      res.json(stats);
    } catch (error) {
      console.error("Failed to get dashboard stats:", error);
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  // Update pen weight
  app.patch("/api/pens/:penId/weight", async (req, res) => {
    try {
      const updateWeightSchema = z.object({
        newWeight: z.number().positive(),
        operatorEmail: z.string().email(),
        operationId: z.number().positive()
      });

      const validatedData = updateWeightSchema.parse(req.body);
      const request: UpdateWeightRequest = {
        penId: Number(req.params.penId),
        operationId: validatedData.operationId,
        newWeight: validatedData.newWeight,
        operatorEmail: validatedData.operatorEmail
      };

      const updatedPen = await storage.updatePenWeight(request);
      if (!updatedPen) {
        return res.status(404).json({ message: "Pen not found or access denied" });
      }

      res.json(updatedPen);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(400).json({ message: error.message || "Failed to update pen weight" });
    }
  });

  // Create feeding record
  app.post("/api/feeding-records", async (req, res) => {
    try {
      const feedingRecordSchema = z.object({
        operationId: z.number(),
        penId: z.string(),
        scheduleId: z.string(),
        plannedAmount: z.string(),
        actualIngredients: z.array(z.object({
          name: z.string(),
          plannedAmount: z.string(),
          actualAmount: z.string(),
          unit: z.string(),
          category: z.string(),
        })),
        operatorEmail: z.string().email(),
      });

      const validatedData = feedingRecordSchema.parse(req.body);
      const feedingRecord = await storage.createFeedingRecord(validatedData);
      
      res.status(201).json(feedingRecord);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create feeding record" });
    }
  });

  // Get feeding records by operation ID
  app.get("/api/feeding-records/:operationId", async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }
      const feedingRecords = await storage.getFeedingRecordsByOperationId(operationId);
      res.json(feedingRecords);
    } catch (error) {
      console.error("Failed to get feeding records:", error);
      res.status(500).json({ message: "Failed to get feeding records" });
    }
  });

  // Sell cattle
  app.post("/api/cattle-sales", async (req, res) => {
    try {
      const cattleSaleSchema = z.object({
        operationId: z.number(),
        penId: z.string(),
        finalWeight: z.number().positive(),
        pricePerCwt: z.number().positive(),
        saleDate: z.string(),
        operatorEmail: z.string().email(),
      });

      const validatedData = cattleSaleSchema.parse(req.body);
      const cattleSale = await storage.sellCattle(validatedData);
      
      res.status(201).json(cattleSale);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(400).json({ message: error.message || "Failed to sell cattle" });
    }
  });

  // Get cattle sales by operation ID
  app.get("/api/cattle-sales/:operationId", async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }
      const cattleSales = await storage.getCattleSalesByOperationId(operationId);
      res.json(cattleSales);
    } catch (error) {
      console.error("Failed to get cattle sales:", error);
      res.status(500).json({ message: "Failed to get cattle sales" });
    }
  });


  // Death Loss endpoints
  app.post("/api/death-loss", async (req, res) => {
    try {
      const deathLoss = await storage.recordDeathLoss(req.body);
      res.status(201).json(deathLoss);
    } catch (error) {
      console.error("Error recording death loss:", error);
      res.status(500).json({ message: "Failed to record death loss" });
    }
  });

  app.get("/api/death-loss/:operationId", async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }
      const deathLosses = await storage.getDeathLossByOperationId(operationId);
      res.json(deathLosses);
    } catch (error) {
      console.error("Error fetching death losses:", error);
      res.status(500).json({ message: "Failed to fetch death losses" });
    }
  });

  // Treatment Record endpoints
  app.post("/api/treatments", async (req, res) => {
    try {
      const treatment = await storage.recordTreatment(req.body);
      res.status(201).json(treatment);
    } catch (error) {
      console.error("Error recording treatment:", error);
      res.status(500).json({ message: "Failed to record treatment" });
    }
  });

  app.get("/api/treatments/:operationId", async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }
      const treatments = await storage.getTreatmentsByOperationId(operationId);
      res.json(treatments);
    } catch (error) {
      console.error("Error fetching treatments:", error);
      res.status(500).json({ message: "Failed to fetch treatments" });
    }
  });

  // Partial Sales endpoints
  app.post('/api/partial-sales', async (req, res) => {
    try {
      const partialSaleSchema = z.object({
        operationId: z.number(),
        penId: z.string(),
        saleDate: z.string(),
        cattleCount: z.number().positive(),
        finalWeight: z.number().positive(),
        pricePerCwt: z.number().positive(),
        totalRevenue: z.number(),
        tagNumbers: z.string().optional(),
        buyer: z.string().optional(),
        notes: z.string().optional(),
        operatorEmail: z.string().email(),
      });

      const validatedData = partialSaleSchema.parse(req.body);
      const partialSale = await storage.recordPartialSale(validatedData);
      res.status(201).json(partialSale);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error('Error recording partial sale:', error);
      res.status(500).json({ message: error.message || 'Failed to record partial sale' });
    }
  });

  app.get('/api/partial-sales/:operationId', async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }
      const partialSales = await storage.getPartialSalesByOperationId(operationId);
      res.json(partialSales);
    } catch (error) {
      console.error('Error fetching partial sales:', error);
      res.status(500).json({ message: 'Failed to fetch partial sales' });
    }
  });

  // Staff Management endpoints
  
  // Invite staff member
  app.post('/api/staff/invite', async (req, res) => {
    try {
      const validatedData = inviteStaffSchema.parse(req.body);
      const { operatorEmail } = req.body; // Current user's email
      
      // Verify the current user is the operation owner
      const operation = await storage.getOperationByEmail(operatorEmail);
      if (!operation) {
        return res.status(404).json({ message: 'Operation not found' });
      }

      // Check if staff member already exists
      const existingStaff = await storage.getStaffMemberByEmail(validatedData.email);
      if (existingStaff) {
        return res.status(400).json({ message: 'Staff member with this email already exists' });
      }

      const invitation = await storage.inviteStaffMember({
        operationId: operation.id,
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        invitedBy: operatorEmail,
      });
      
      // Send invitation email
      const { sendStaffInvitationEmail } = await import("./emailService");
      const emailSent = await sendStaffInvitationEmail({
        to: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        operationName: operation.name,
        invitedBy: operatorEmail,
        invitationToken: invitation.token,
      });
      
      if (!emailSent) {
        console.warn('Failed to send invitation email, but invitation was created');
      }
      
      res.status(201).json({ ...invitation, emailSent });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      console.error('Error inviting staff member:', error);
      res.status(500).json({ message: 'Failed to invite staff member' });
    }
  });

  // Get staff members for operation
  app.get('/api/staff/:operationId', async (req, res) => {
    try {
      const operationId = Number(req.params.operationId);
      if (isNaN(operationId)) {
        return res.status(400).json({ message: "Invalid operation ID" });
      }

      const staffMembers = await storage.getStaffMembersByOperationId(operationId);
      res.json(staffMembers);
    } catch (error) {
      console.error('Error fetching staff members:', error);
      res.status(500).json({ message: 'Failed to fetch staff members' });
    }
  });

  // Accept staff invitation
  app.post('/api/staff/accept-invitation', async (req, res) => {
    try {
      const validatedData = acceptStaffInvitationSchema.parse(req.body);
      
      const staffMember = await storage.acceptStaffInvitation(validatedData.token);
      if (!staffMember) {
        return res.status(400).json({ message: 'Invalid or expired invitation token' });
      }
      
      res.json(staffMember);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      console.error('Error accepting staff invitation:', error);
      res.status(500).json({ message: 'Failed to accept invitation' });
    }
  });

  // Get user role and operation access
  app.get('/api/user-role/:email', async (req, res) => {
    try {
      const { email } = req.params;
      const userRole = await storage.getUserRole(email);
      
      if (!userRole) {
        return res.status(404).json({ message: 'User not found or no access' });
      }
      
      res.json(userRole);
    } catch (error) {
      console.error('Error fetching user role:', error);
      res.status(500).json({ message: 'Failed to fetch user role' });
    }
  });

  // Feeding Ingredient Management Routes
  app.get('/api/feeding-ingredients', authenticateJWT, FeedingIngredientController.getIngredients);
  app.post('/api/feeding-ingredients', authenticateJWT, FeedingIngredientController.createIngredient);
  app.put('/api/feeding-ingredients/:ingredientId', authenticateJWT, FeedingIngredientController.updateIngredient);
  app.delete('/api/feeding-ingredients/:ingredientId', authenticateJWT, FeedingIngredientController.deleteIngredient);

  // Feeding Program Template Management Routes
  app.get('/api/feeding-program-templates', authenticateJWT, FeedingProgramTemplateController.getTemplates);
  app.post('/api/feeding-program-templates', authenticateJWT, FeedingProgramTemplateController.createTemplate);
  app.put('/api/feeding-program-templates/:templateId', authenticateJWT, FeedingProgramTemplateController.updateTemplate);
  app.delete('/api/feeding-program-templates/:templateId', authenticateJWT, FeedingProgramTemplateController.deleteTemplate);

  // Pen Feeding Program Management Routes
  app.get('/api/pens/:penId/feeding-programs', authenticateJWT, PenFeedingProgramController.getPenPrograms);
  app.post('/api/pens/:penId/feeding-programs', authenticateJWT, PenFeedingProgramController.assignProgram);
  app.put('/api/pen-feeding-programs/:programId', authenticateJWT, PenFeedingProgramController.updateProgram);
  app.get('/api/pen-feeding-programs/:programId/variances', authenticateJWT, PenFeedingProgramController.getVariances);
  app.post('/api/pen-feeding-programs/:programId/variances', authenticateJWT, PenFeedingProgramController.recordVariances);
  app.post('/api/pen-feeding-programs/:programId/completion', authenticateJWT, PenFeedingProgramController.markCompletion);

  // Nutritionist Task Management Routes
  app.get('/api/nutritionist-tasks', authenticateJWT, NutritionistTaskController.getTasks);
  app.get('/api/nutritionist-tasks/summary', authenticateJWT, NutritionistTaskController.getTaskSummary);
  app.put('/api/nutritionist-tasks/:taskId', authenticateJWT, NutritionistTaskController.updateTaskStatus);
  app.post('/api/pens/:penId/request-feeding-programs', authenticateJWT, NutritionistTaskController.createTask);

  // ==========================================
  // User Notification Management Routes
  // ==========================================

  // Get notifications for a user
  app.get('/api/notifications', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);
      const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const notifications = await storage.getNotificationsByUserId(userId, isRead, limit);
      res.json(notifications);
    } catch (error) {
      console.error('Failed to get notifications:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  // Mark notification as read
  app.put('/api/notifications/:notificationId/read', async (req, res) => {
    try {
      const { notificationId } = req.params;
      const notification = await storage.markNotificationAsRead(notificationId);

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json(notification);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Get unread notification count
  app.get('/api/notifications/unread-count', async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Failed to get unread count:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  });

  // Migration endpoint for consultant relationships (admin only)
  app.post('/api/admin/migrate-consultant-relationships', async (req, res) => {
    try {
      // Simple admin check - in production, you'd want proper admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { migrateConsultantRelationships } = await import('./utils/migrate-consultant-relationships');
      const result = await migrateConsultantRelationships();
      
      res.json({
        success: true,
        message: 'Migration completed successfully',
        result
      });
    } catch (error) {
      console.error('Migration endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);

  // Initialize WebSocket server for real-time notifications
  try {
    notificationWS.initialize(httpServer);
    notificationWS.startKeepalive();
    console.log('WebSocket server ready at ws://localhost:5000/ws/notifications');
  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error);
  }

  return httpServer;
}
