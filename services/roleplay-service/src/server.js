import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import connectDB from './config/database.js';
import trialRoutes from './routes/trialRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import {
    initHeartbeatEngine,
    startHeartbeat,
    stopHeartbeat,
    resetIdleTimer,
    handleObjection,
    getHeartbeatStats
} from './engines/courtroomHeartbeat.js';

const app = express();
const PORT = process.env.PORT || 10005;
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', 1);

// Create HTTP server (shared between Express + Socket.IO)
const httpServer = http.createServer(app);

// Security middleware
app.use(helmet());

// CORS Configuration - Handle multiple origins from env
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// ============================================================
// SOCKET.IO SERVER — Real-Time Autonomous Courtroom
// ============================================================
const io = new SocketIOServer(httpServer, {
    path: '/roleplay-socket',
    cors: {
        origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Keep heartbeat alive across transient disconnects
const DISCONNECT_GRACE_MS = 5 * 60 * 1000;
const pendingHeartbeatStops = new Map(); // Map<sessionId, Timeout>

// Initialize heartbeat engine with Socket.IO reference
initHeartbeatEngine(io);

// Socket.IO connection handler
io.on('connection', (socket) => {
    logger.info(`[SOCKET] Client connected: ${socket.id}`);

    // --- JOIN SESSION ROOM ---
    socket.on('join-session', (sessionId) => {
        if (!sessionId) return;

        const pendingStop = pendingHeartbeatStops.get(sessionId);
        if (pendingStop) {
            clearTimeout(pendingStop);
            pendingHeartbeatStops.delete(sessionId);
            logger.info(`[SOCKET] Cleared pending heartbeat stop for session: ${sessionId}`);
        }

        socket.join(`session:${sessionId}`);
        socket.sessionId = sessionId;

        logger.info(`[SOCKET] Client ${socket.id} joined session: ${sessionId}`);

        // Start the autonomous heartbeat for this session
        startHeartbeat(sessionId);

        socket.emit('session-joined', {
            sessionId,
            autonomousMode: true,
            heartbeatInterval: 40
        });
    });

    // Optional explicit leave event from client
    socket.on('leave-session', (sessionId) => {
        if (!sessionId) return;
        socket.leave(`session:${sessionId}`);
        logger.info(`[SOCKET] Client ${socket.id} left session: ${sessionId}`);
    });

    // --- USER MESSAGE (resets idle timer) ---
    socket.on('user-active', (sessionId) => {
        if (sessionId) {
            resetIdleTimer(sessionId);
        }
    });

    // --- OBJECTION! ---
    socket.on('objection', async ({ sessionId, objectionText }) => {
        if (!sessionId) return;

        logger.info(`[SOCKET] OBJECTION raised in session ${sessionId}: "${objectionText?.substring(0, 50)}..."`);

        // Emit "objection-raised" to all clients so they know an objection is pending
        io.to(`session:${sessionId}`).emit('objection-raised', {
            text: objectionText,
            timestamp: new Date()
        });

        // Handle the objection (pauses heartbeat, generates Judge ruling)
        const ruling = await handleObjection(sessionId, objectionText || 'I object!');

        if (ruling) {
            io.to(`session:${sessionId}`).emit('objection-ruling', ruling);
        }
    });

    // --- PAUSE/RESUME HEARTBEAT ---
    socket.on('pause-heartbeat', (sessionId) => {
        if (sessionId) {
            // Use dynamic import since we're in ESM
            import('./engines/courtroomHeartbeat.js').then(m => m.pauseHeartbeat(sessionId));
        }
    });

    socket.on('resume-heartbeat', (sessionId) => {
        if (sessionId) {
            import('./engines/courtroomHeartbeat.js').then(m => m.resumeHeartbeat(sessionId));
        }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        const sessionId = socket.sessionId;
        logger.info(`[SOCKET] Client disconnected: ${socket.id} (session: ${sessionId || 'none'})`);

        if (sessionId) {
            // Check if any clients are still in this session room
            const room = io.sockets.adapter.rooms.get(`session:${sessionId}`);
            if (!room || room.size === 0) {
                const timer = setTimeout(() => {
                    stopHeartbeat(sessionId);
                    pendingHeartbeatStops.delete(sessionId);
                    logger.info(`[SOCKET] No clients rejoined within grace period. Heartbeat stopped for session ${sessionId}.`);
                }, DISCONNECT_GRACE_MS);

                pendingHeartbeatStops.set(sessionId, timer);
                logger.info(`[SOCKET] Room empty for session ${sessionId}. Scheduled heartbeat stop in ${DISCONNECT_GRACE_MS / 1000}s.`);
            }
        }
    });
});

// Make io accessible to route handlers
app.set('io', io);

// Rate limiting for API endpoints
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    }
});
app.use('/api', limiter);

// Stricter rate limit for AI endpoints (expensive operations)
const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit each IP to 20 AI requests per hour
    message: {
        success: false,
        message: 'AI request limit reached. Please try again later.'
    }
});
app.use('/api/trials/init-trial', aiLimiter);

// Body parsing
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging
app.use((req, res, next) => {
    logger.info({
        method: req.method,
        path: req.path,
        userId: req.headers['user-id'] || 'anonymous'
    }, 'Incoming request');
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    const geminiConfigured = !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1);
    res.json({
        success: true,
        service: 'roleplay-service',
        status: 'healthy',
        features: {
            aiEnabled: geminiConfigured,
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
            autonomousMode: true,
            heartbeatStats: getHeartbeatStats()
        },
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/trials', trialRoutes);
app.use('/api/roleplay', chatRoutes);

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        service: 'roleplay-service',
        version: '2.0.0',
        description: 'AI-Powered Autonomous Courtroom Simulation for Sri Lankan Law Students',
        features: {
            autonomousMode: 'Real-time AI-to-AI courtroom dialogue via Socket.IO',
            objectionSystem: 'User can raise objections to interrupt autonomous dialogue',
            heartbeat: '40-second idle detection triggers autonomous AI turns'
        },
        endpoints: {
            trials: {
                initTrial: 'POST /api/trials/init-trial',
                getSession: 'GET /api/trials/:sessionId',
                getUserTrials: 'GET /api/trials/user/:userId',
                getUserStats: 'GET /api/trials/user/:userId/stats',
                addMessage: 'POST /api/trials/:sessionId/message',
                advanceDay: 'POST /api/trials/:sessionId/advance-day',
                completeSession: 'POST /api/trials/:sessionId/complete'
            },
            roleplay: {
                chat: 'POST /api/roleplay/chat - Send argument to AI Judge'
            },
            socketIO: {
                connect: 'ws://localhost:10005',
                events: {
                    'join-session': 'Join a session room & start heartbeat',
                    'user-active': 'Reset idle timer on user interaction',
                    'objection': 'Raise an objection (pauses heartbeat)',
                    'ai-dialogue': 'Receive autonomous AI dialogue (server → client)',
                    'objection-ruling': 'Receive Judge ruling on objection (server → client)'
                }
            }
        }
    });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Check Gemini configuration
        if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY1) {
            logger.warn('GEMINI_API_KEY not configured - AI features will fail');
        } else {
            logger.info('Gemini API configured');
            logger.info(`Using model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'}`);
        }

        httpServer.listen(PORT, HOST, () => {
            logger.info(`Roleplay Service running on http://${HOST}:${PORT}`);
            logger.info(`Socket.IO server ready on ws://${HOST}:${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Health check: http://${HOST}:${PORT}/health`);
            logger.info(`Autonomous Courtroom Engine: v2.0.0`);
            logger.info(`Jurisdiction: Sri Lankan Law`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
