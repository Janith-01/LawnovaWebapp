import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import connectDB from './config/database.js';
import trialRoutes from './routes/trialRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 10005;

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
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    res.json({
        success: true,
        service: 'roleplay-service',
        status: 'healthy',
        features: {
            aiEnabled: openaiConfigured,
            model: process.env.OPENAI_MODEL || 'gpt-4'
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
        version: '1.0.0',
        description: 'AI-Powered Interactive Legal Role-Playing Tool for Sri Lankan Law Students',
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
            }
        },
        documentation: {
            initTrial: {
                method: 'POST',
                path: '/api/trials/init-trial',
                description: 'Initialize a new AI-powered roleplay trial session',
                body: {
                    userId: 'MongoDB ObjectId (required)',
                    role: '"Lawyer" | "Opposition" (required)',
                    caseStage: 'Pre-Trial | Opening Statements | Prosecution Evidence | Defense Evidence | Cross-Examination | Closing Arguments | Verdict | Full Trial (required)'
                },
                response: {
                    sessionId: 'MongoDB ObjectId of created session',
                    scenario: 'AI-generated case scenario with Sri Lankan law context'
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

        // Check OpenAI configuration
        if (!process.env.OPENAI_API_KEY) {
            logger.warn('⚠️  OPENAI_API_KEY not configured - AI features will fail');
        } else {
            logger.info('✅ OpenAI API configured');
            logger.info(`🤖 Using model: ${process.env.OPENAI_MODEL || 'gpt-4'}`);
        }

        app.listen(PORT, '127.0.0.1', () => {
            logger.info(`🚀 Roleplay Service running on http://127.0.0.1:${PORT}`);
            logger.info(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🔗 Health check: http://127.0.0.1:${PORT}/health`);
            logger.info(`⚖️  AI Legal Roleplay Engine: v1.0.0`);
            logger.info(`🇱🇰 Jurisdiction: Sri Lankan Law`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;