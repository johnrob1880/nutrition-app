import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { StorageFactory } from "./storage/StorageFactory";
import { createSessionConfig, getSessionStoreConfig } from "./config/session";
import {
  securityHeaders,
  compressionMiddleware,
  sanitizeInput,
  jsonSizeLimit,
  requestTimeout
} from "./security/security";
import { notificationWS } from "./services/websocket";

const app = express();

// Security middleware - only apply CSP to API routes, not frontend
app.use('/api', securityHeaders);
app.use(compressionMiddleware);
app.use(requestTimeout(30000)); // 30 second timeout
app.use(jsonSizeLimit('10mb'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Input sanitization middleware - only for API routes
app.use('/api', sanitizeInput);

// Session configuration
app.use(createSessionConfig());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize storage and log which provider is being used
  const storageConfig = StorageFactory.getStorageConfig();
  log(`🗄️  Storage: ${storageConfig.type.toUpperCase()} ${storageConfig.type === 'postgresql' ? '(PostgreSQL)' : '(In-Memory)'}`);
  
  // Log session store configuration
  const sessionConfig = getSessionStoreConfig();
  log(`🔐 Sessions: ${sessionConfig.database} ${sessionConfig.persistent ? '(Persistent)' : '(Memory)'}`);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
