import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';

interface Client {
  ws: WebSocket;
  userId: number;
  operationId?: number;
  lastPing: number;
}

class NotificationWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Client> = new Map();
  private connectionLimits: Map<number, number> = new Map(); // userId -> connection count
  private isInitialized: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server) {
    if (this.isInitialized) {
      console.log('WebSocket server already initialized');
      return;
    }

    try {
      this.wss = new WebSocketServer({
        server,
        path: '/ws/notifications',
        clientTracking: true,
        maxPayload: 16 * 1024, // 16KB max payload
        perMessageDeflate: false, // Disable compression to reduce CPU
        verifyClient: (info) => {
          const url = parse(info.req.url || '', true);

          // Only allow connections to the notifications path
          if (url.pathname !== '/ws/notifications') {
            console.log('WebSocket: Rejecting connection to wrong path:', url.pathname);
            return false;
          }

          return true;
        }
      });

      this.wss.on('connection', (ws: WebSocket, request) => {
        try {
          // Validate that this is a proper WebSocket connection
          if (!request.headers.upgrade || request.headers.upgrade.toLowerCase() !== 'websocket') {
            console.log('Rejecting non-WebSocket connection');
            ws.close(1002, 'Protocol error');
            return;
          }

          this.handleConnection(ws, request);
        } catch (error) {
          console.error('Error handling WebSocket connection:', error);
          ws.terminate();
        }
      });

      this.wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
      });

      this.isInitialized = true;
      console.log('WebSocket server initialized at /ws/notifications');
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: any) {
    const url = parse(request.url || '', true);
    const userId = url.query.userId ? parseInt(url.query.userId as string) : null;
    const operationId = url.query.operationId ? parseInt(url.query.operationId as string) : undefined;

    if (!userId) {
      ws.send(JSON.stringify({ error: 'userId is required' }));
      ws.close();
      return;
    }

    // Limit connections per user to prevent flooding
    const currentConnections = this.connectionLimits.get(userId) || 0;
    if (currentConnections >= 3) {
      ws.send(JSON.stringify({ error: 'Too many connections for this user' }));
      ws.close();
      return;
    }

    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const client: Client = { ws, userId, operationId, lastPing: Date.now() };
    this.clients.set(clientId, client);
    this.connectionLimits.set(userId, currentConnections + 1);

    console.log(`Client connected: userId=${userId}, operationId=${operationId} (${currentConnections + 1}/3)`);

    // Send connection confirmation with minimal data
    try {
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to notification service',
        clientId
      }));
    } catch (error) {
      console.error('Failed to send connection confirmation:', error);
    }

    // Handle ping/pong for keepalive
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = Date.now();
      }
    });

    // Handle client messages with rate limiting
    let messageCount = 0;
    const messageResetTime = Date.now() + 60000; // Reset every minute

    ws.on('message', (data: Buffer) => {
      try {
        // Simple rate limiting: max 60 messages per minute
        if (Date.now() > messageResetTime) {
          messageCount = 0;
        }
        if (messageCount++ > 60) {
          console.warn(`Rate limit exceeded for userId=${userId}`);
          return;
        }

        const message = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        console.error('Invalid message from client:', error);
      }
    });

    // Handle disconnection
    ws.on('close', (code, reason) => {
      this.removeClient(clientId, userId);
      console.log(`Client disconnected: userId=${userId}, code=${code}, reason=${reason || 'none'}`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for userId=${userId}:`, error);
      this.removeClient(clientId, userId);
    });
  }

  /**
   * Remove client and update connection limits
   */
  private removeClient(clientId: string, userId: number) {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      const currentConnections = this.connectionLimits.get(userId) || 0;
      this.connectionLimits.set(userId, Math.max(0, currentConnections - 1));
    }
  }

  /**
   * Handle messages from clients
   */
  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'subscribe':
        // Handle subscription to specific notification types
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Send notification to specific user
   */
  sendToUser(userId: number, notification: any) {
    let sent = false;
    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
        sent = true;
      }
    });
    return sent;
  }

  /**
   * Send notification to all users in an operation
   */
  sendToOperation(operationId: number, notification: any) {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.operationId === operationId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
        count++;
      }
    });
    return count;
  }

  /**
   * Broadcast notification to all connected clients
   */
  broadcast(notification: any) {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'notification',
          data: notification
        }));
        count++;
      }
    });
    return count;
  }

  /**
   * Send task assignment notification
   */
  sendTaskAssigned(userId: number, taskData: any) {
    return this.sendToUser(userId, {
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: taskData.message || 'You have been assigned a new task',
      taskId: taskData.taskId,
      penId: taskData.penId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send feeding program ready notification
   */
  sendFeedingProgramReady(userId: number, operationId: number, programData: any) {
    const notification = {
      type: 'feeding_program_ready',
      title: 'Feeding Program Ready',
      message: programData.message || 'A feeding program has been completed',
      programId: programData.programId,
      penId: programData.penId,
      timestamp: new Date().toISOString()
    };

    // Send to specific user
    this.sendToUser(userId, notification);

    // Also send to all users in the operation
    this.sendToOperation(operationId, notification);
  }

  /**
   * Send task completed notification
   */
  sendTaskCompleted(userId: number, taskData: any) {
    return this.sendToUser(userId, {
      type: 'task_completed',
      title: 'Task Completed',
      message: taskData.message || 'A task has been completed',
      taskId: taskData.taskId,
      penId: taskData.penId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start keepalive interval
   */
  startKeepalive() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, 30000); // Cleanup every 30 seconds
  }

  /**
   * Stop keepalive and cleanup
   */
  shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1000, 'Server shutting down');
        }
      } catch (error) {
        console.error('Error closing client connection:', error);
      }
    });

    this.clients.clear();
    this.connectionLimits.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.isInitialized = false;
    console.log('WebSocket server shut down');
  }

  /**
   * Clean up dead connections
   */
  private cleanupDeadConnections() {
    if (!this.isInitialized || !this.wss) return;

    const deadClients: string[] = [];
    const now = Date.now();
    const PING_TIMEOUT = 60000; // 60 seconds

    this.clients.forEach((client, clientId) => {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          // Check if client hasn't responded to ping in a while
          if (now - client.lastPing > PING_TIMEOUT) {
            deadClients.push(clientId);
          } else {
            client.ws.ping();
          }
        } else {
          deadClients.push(clientId);
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
        deadClients.push(clientId);
      }
    });

    // Remove dead clients
    deadClients.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client) {
        this.removeClient(clientId, client.userId);
      }
    });

    if (deadClients.length > 0) {
      console.log(`Cleaned up ${deadClients.length} dead WebSocket connections`);
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients by user ID
   */
  getClientsByUserId(userId: number): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        count++;
      }
    });
    return count;
  }
}

// Export singleton instance
export const notificationWS = new NotificationWebSocketService();