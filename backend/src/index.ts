import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config } from './config';
import { logger } from './shared/logger';
import { errorHandler, notFoundHandler, AppError } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { generalLimiter } from './middleware/rateLimiter';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from './config/database';
import { seedSatellites } from './config/seed';

// Module Routers
import { satelliteRouter } from './modules/satellites/satelliteRoutes';
import { telemetryRouter } from './modules/telemetry/telemetryRoutes';
import { anomalyRouter } from './modules/anomalies/anomalyRoutes';
import { healthRouter } from './modules/health/healthRoutes';
import { evidenceRouter } from './modules/evidence/evidenceRoutes';
import { assessmentRouter } from './modules/assessments/assessmentRoutes';
import { simulationRouter } from './modules/simulation/simulationRoutes';
import { spaceWeatherRouter } from './modules/space-weather/spaceWeatherRoutes';
import { orbitalRouter } from './modules/orbital/orbitalRoutes';
import { correlationRouter } from './modules/correlation/correlationRoutes';

// Services for WebSocket broadcasting and lifecycle
import { TelemetryService } from './modules/telemetry/telemetryService';
import { AnomalyService } from './modules/anomalies/anomalyService';
import { SimulationService } from './modules/simulation/simulationService';

const app = express();
const httpServer = createServer(app);

// --- Socket.IO with Security & Abuse Protection ---
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        config.cors.allowedOrigins.includes(origin) ||
        config.cors.allowedOrigins.includes('*');
      if (isAllowed) return callback(null, true);
      return callback(new Error('Origin not allowed by WebSocket CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Broadcast telemetry and anomalies in real-time over WebSocket (single emission)
TelemetryService.onTelemetry((reading, anomaly) => {
  io.emit('telemetry:reading', reading);
  if (anomaly) {
    io.emit('anomaly:detected', anomaly);
  }
});

AnomalyService.onAnomaly((anomaly) => {
  io.emit('anomaly:alert', anomaly);
});

SimulationService.onStatusChange((status) => {
  io.emit('simulation:status', status);
});

// --- Middleware Pipeline ---
app.use(requestIdMiddleware);

// Security Headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: false, // Preserves local Vite and WebSocket connectivity
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// CORS Policy
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., server-to-server, curl, testing)
      if (!origin) return callback(null, true);
      const isAllowed =
        config.cors.allowedOrigins.includes(origin) ||
        config.cors.allowedOrigins.includes('*');
      if (isAllowed) return callback(null, true);
      return callback(new AppError('Not allowed by CORS', 403, 'FORBIDDEN'));
    },
    credentials: true,
  })
);

// Bounded Request Body Sizes (prevents memory exhaustion DOS attacks)
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// Logging with Request Correlation ID
app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms [req: :req[x-request-id]]', {
    stream: { write: (message: string) => logger.info(message.trim()) },
  })
);

// General Read Rate Limiting across all /api/ routes
app.use('/api/', generalLimiter);

// --- Health Check (Liveness & Readiness) ---
app.get('/api/system/health', (_req, res) => {
  const dbConnected = isDatabaseConnected();
  const uptimeSec = process.uptime();

  res.json({
    status: 'ok',
    ready: true, // Application is ready to serve operations (with in-memory fallback if db is down)
    service: 'spaceguard-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: uptimeSec,
    dependencies: {
      database: {
        status: dbConnected ? 'connected' : 'degraded_in_memory',
        required: false,
      },
      mlService: {
        status: 'ready',
        required: false,
      },
      geminiAi: {
        status: config.gemini.apiKey ? 'configured' : 'offline_fallback',
        required: false,
      },
    },
  });
});

// --- Data Source Status ---
app.get('/api/system/data-sources', (_req, res) => {
  res.json({
    sources: [
      {
        name: 'MongoDB',
        status: isDatabaseConnected() ? 'connected' : 'degraded_in_memory',
        type: 'database',
      },
      { name: 'In-Memory Buffer', status: 'active', type: 'realtime_buffer' },
      { name: 'ML Service', status: 'ready', type: 'internal' },
      { name: 'NOAA SWPC', status: 'active', type: 'external' },
      { name: 'NASA DONKI', status: 'active', type: 'external' },
      { name: 'CelesTrak', status: 'active', type: 'external' },
      { name: 'SatNOGS', status: 'active', type: 'external' },
      { name: 'Gemini AI', status: config.gemini.apiKey ? 'configured' : 'offline_fallback', type: 'ai' },
    ],
  });
});

// --- API Routes ---
app.use('/api/satellites', satelliteRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/anomalies', anomalyRouter);
app.use('/api/health', healthRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/assessments', assessmentRouter);
app.use('/api/simulation', simulationRouter);
app.use('/api/space-weather', spaceWeatherRouter);
app.use('/api/orbital', orbitalRouter);
app.use('/api/correlation', correlationRouter);

// --- WebSocket Connection & Room Subscription Security ---
const SATELLITE_ID_REGEX = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_ROOMS_PER_SOCKET = 10;
const ipConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 25;

io.on('connection', (socket) => {
  const clientIp = socket.handshake.address || 'unknown';
  const currentCount = ipConnections.get(clientIp) || 0;

  if (currentCount >= MAX_CONNECTIONS_PER_IP) {
    logger.warn('Socket connection limit exceeded for IP', { clientIp, count: currentCount });
    socket.disconnect(true);
    return;
  }

  ipConnections.set(clientIp, currentCount + 1);
  logger.info('WebSocket client connected', { socketId: socket.id, clientIp });

  socket.on('subscribe:telemetry', (data: { satelliteId?: string }) => {
    const satId = data?.satelliteId;

    if (!satId || typeof satId !== 'string' || !SATELLITE_ID_REGEX.test(satId)) {
      logger.warn('Rejected invalid telemetry subscription payload', { socketId: socket.id, satId });
      socket.emit('error:subscription', { message: 'Invalid satellite identifier format' });
      return;
    }

    if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) {
      logger.warn('Socket exceeded maximum room subscription limit', { socketId: socket.id });
      socket.emit('error:subscription', { message: 'Room subscription limit exceeded' });
      return;
    }

    const roomName = `telemetry:${satId}`;
    socket.join(roomName);
    logger.info('Client subscribed to telemetry room', { socketId: socket.id, room: roomName });
  });

  socket.on('unsubscribe:telemetry', (data: { satelliteId?: string }) => {
    const satId = data?.satelliteId;
    if (satId && typeof satId === 'string' && SATELLITE_ID_REGEX.test(satId)) {
      socket.leave(`telemetry:${satId}`);
    }
  });

  socket.on('disconnect', () => {
    const active = ipConnections.get(clientIp) || 1;
    if (active <= 1) {
      ipConnections.delete(clientIp);
    } else {
      ipConnections.set(clientIp, active - 1);
    }
    logger.info('WebSocket client disconnected', { socketId: socket.id });
  });
});

// --- Error Handling ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Graceful Shutdown Handler ---
export async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out (5s limit), force exiting');
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      process.exit(1);
    }
  }, 5000);

  try {
    SimulationService.stop();
    await TelemetryService.flushQueue();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await disconnectDatabase();
    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown completed cleanly');
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      process.exit(0);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Error during graceful shutdown', { error: message });
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      process.exit(1);
    }
  }
}

// --- Start Server if executed directly ---
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    const dbOk = await connectDatabase();
    if (dbOk) {
      await seedSatellites();
    } else {
      logger.warn(
        'MongoDB connection unavailable at startup. SpaceGuard initialized in degraded mode: in-memory ring buffer is active.'
      );
    }

    httpServer.listen(config.port, () => {
      logger.info(`SpaceGuard Backend running on port ${config.port}`, {
        port: config.port,
        env: config.env,
        database: dbOk ? 'connected' : 'degraded_in_memory',
        cors: config.cors.allowedOrigins,
      });
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  })();
}

export { app, io, httpServer };
