import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOperationSchema, type UpdateWeightRequest } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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
  app.get("/api/pens/:operatorEmail", async (req, res) => {
    try {
      const pens = await storage.getPensByOperatorEmail(req.params.operatorEmail);
      res.json(pens);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pens" });
    }
  });

  // Get schedules for operation
  app.get("/api/schedules/:operatorEmail", async (req, res) => {
    try {
      const schedules = await storage.getSchedulesByOperatorEmail(req.params.operatorEmail);
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to get schedules" });
    }
  });

  // Get dashboard stats
  app.get("/api/dashboard/:operatorEmail", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats(req.params.operatorEmail);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  // Update pen weight
  app.patch("/api/pens/:penId/weight", async (req, res) => {
    try {
      const updateWeightSchema = z.object({
        newWeight: z.number().positive(),
        operatorEmail: z.string().email()
      });

      const validatedData = updateWeightSchema.parse(req.body);
      const request: UpdateWeightRequest = {
        penId: req.params.penId,
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

  const httpServer = createServer(app);
  return httpServer;
}
