import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import connectDB from './config/database.js';
import roomRoutes from './routes/roomRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import emailService from './services/emailService.js';
import serviceClient from './services/serviceClient.js';
import logger from './utils/logger.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { initCronJobs } from './services/cronService.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3004;
const HOST = process.env.HOST || '0.0.0.0';

// Security middleware
app.use(helmet());

// CORS - Only apply for direct requests (not via API Gateway)
app.use((req, res, next) => {
    if (req.headers['user-id'] || req.headers['x-forwarded-by']) {
        return next();
    }
    cors({
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true
    })(req, res, next);
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        message: 'Too many requests, please try again later.'
    },
    skip: (req) => req.path.startsWith('/api/webhooks')
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging
app.use((req, res, next) => {
    if (!req.path.includes('/webhooks')) {
        logger.info({
            method: req.method,
            path: req.path,
            userId: req.headers['user-id'] || 'anonymous'
        }, 'Incoming request');
    }
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'mocktrial-service',
        status: 'healthy',
        features: {
            emailEnabled: emailService.initialized || false
        },
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/rooms', roomRoutes);
app.use('/sessions', sessionRoutes);

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        success: true,
        service: 'mocktrial-service',
        version: '4.0.0',
        description: 'Mock Trial Service - Room Management & Role Assignment',
        endpoints: {
            rooms: {
                create: 'POST /api/rooms/create',
                myTrials: 'GET /api/rooms/my-trials',
                getById: 'GET /api/rooms/:roomId',
                update: 'PUT /api/rooms/:roomId',
                delete: 'DELETE /api/rooms/:roomId',
                invite: 'POST /api/rooms/invite/:roomId',
                updateStatus: 'PATCH /api/rooms/:roomId/status',
                acceptInvitation: 'POST /api/rooms/:roomId/accept',
                assignRoles: 'PATCH /api/rooms/:roomId/assign-roles',
                previewRoles: 'GET /api/rooms/:roomId/preview-roles',
                unlockRoles: 'PATCH /api/rooms/:roomId/unlock-roles',
                roleHistory: 'GET /api/rooms/:roomId/role-history'
            },
            socketEvents: {
                joinRoom: 'join:room { roomId }',
                leaveRoom: 'leave:room { roomId }',
                joinUser: 'join:user { userId, email }'
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

        // Initialize Scheduled Jobs
        initCronJobs();

        // Initialize email service
        try {
            await emailService.init();
        } catch (emailError) {
            logger.warn('Email service not available - invitations will be logged only');
        }

        // Initialize service client for inter-service communication
        serviceClient.init();
        logger.info('Service clients initialized');

        // Initialize Socket.IO
        const io = new Server(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
                methods: ["GET", "POST"],
                credentials: true
            },
            path: '/socket.io',
            transports: ["polling", "websocket"],
            perMessageDeflate: false,
            pingTimeout: 60000,
            pingInterval: 25000
        });

        // Socket.IO Authentication Middleware
        io.use((socket, next) => {
            const token = socket.handshake.auth?.token;

            if (token) {
                try {
                    const secret = process.env.JWT_SECRET;
                    if (!secret) {
                        logger.error('JWT_SECRET not configured for socket auth');
                        return next(new Error('Server configuration error'));
                    }

                    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });

                    socket.user = {
                        id: decoded.sub || decoded.id || decoded._id,
                        _id: decoded.sub || decoded.id || decoded._id,
                        email: decoded.email,
                        role: decoded.role,
                        name: decoded.name || decoded.fullName
                    };

                    logger.info({
                        socketId: socket.id,
                        userId: socket.user.id,
                        email: socket.user.email
                    }, 'Socket authenticated via JWT');

                    return next();
                } catch (err) {
                    logger.warn({ err: err.message, socketId: socket.id }, 'Socket JWT verification failed');
                    if (process.env.NODE_ENV === 'production') {
                        return next(new Error('Authentication error'));
                    }
                    socket.user = null;
                    return next();
                }
            }

            if (process.env.NODE_ENV === 'production') {
                logger.warn({ socketId: socket.id }, 'Socket connection rejected - no token');
                return next(new Error('Authentication required'));
            }

            logger.debug({ socketId: socket.id }, 'Socket connected without auth (dev mode)');
            next();
        });

        // Store io instance
        app.set('io', io);

        // Helper to broadcast lobby state
        const broadcastLobbyUpdate = async (roomId) => {
            try {
                const roomChannel = `room:${roomId}`;
                const sockets = await io.in(roomChannel).fetchSockets();

                const participants = sockets.map(s => ({
                    socketId: s.id,
                    userId: s.user?.id || s.user?._id,
                    email: s.user?.email,
                    name: s.user?.name,
                    role: s.user?.role
                })).filter(u => u.email);

                io.to(roomChannel).emit('LOBBY_UPDATE', {
                    roomId,
                    participants,
                    count: participants.length,
                    timestamp: new Date()
                });
            } catch (err) {
                logger.error({ err }, 'Failed to broadcast lobby update');
            }
        };

        // Socket.IO Connection Handler
        io.on('connection', (socket) => {
            logger.info({ socketId: socket.id }, 'Socket connected');

            socket.on('join:room', async ({ roomId }) => {
                const roomChannel = `room:${roomId}`;
                socket.join(roomChannel);
                logger.info({ socketId: socket.id, roomId }, 'Joined room channel');

                if (socket.user && socket.user.email) {
                    socket.to(roomChannel).emit('room:participant:joined', {
                        email: socket.user.email,
                        userId: socket.user.id || socket.user._id,
                        timestamp: new Date()
                    });
                }
                await broadcastLobbyUpdate(roomId);
            });

            socket.on('disconnecting', () => {
                const rooms = [...socket.rooms];
                rooms.forEach((room) => {
                    if (room.startsWith('room:')) {
                        const roomId = room.split(':')[1];
                        if (socket.user && socket.user.email) {
                            socket.to(room).emit('room:participant:left', {
                                email: socket.user.email,
                                timestamp: new Date()
                            });
                        }
                        setTimeout(() => broadcastLobbyUpdate(roomId), 1000);
                    }
                });
            });

            socket.on('leave:room', async ({ roomId }) => {
                const roomChannel = `room:${roomId}`;
                socket.leave(roomChannel);
                logger.info({ socketId: socket.id, roomId }, 'Left room channel');

                if (socket.user && socket.user.email) {
                    socket.to(roomChannel).emit('room:participant:left', {
                        email: socket.user.email,
                        timestamp: new Date()
                    });
                }
                await broadcastLobbyUpdate(roomId);
            });

            socket.on('join:user', ({ userId, email }) => {
                if (userId) socket.join(`user:${userId}`);
                if (email) socket.join(`user:${email.toLowerCase()}`);
                logger.info({ socketId: socket.id, userId, email }, 'Joined user channel');
            });

            socket.on('disconnect', () => {
                logger.info({ socketId: socket.id }, 'Socket disconnected');
            });
        });

        // Attach io to request object
        app.use((req, res, next) => {
            req.io = io;
            next();
        });

        httpServer.listen(PORT, HOST, () => {
            logger.info(`🚀 Mock Trial Service running on http://${HOST}:${PORT}`);
            logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🔗 Health check: http://${HOST}:${PORT}/health`);
            logger.info(`⚖️  Fair Role Rotation Engine: v1.0.0`);
            logger.info(`🔌 Socket.IO: Enabled`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
