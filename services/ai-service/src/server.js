import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import aiRoutes from './routes/aiRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import chatRoutes from './routes/chatRoutes.js';

const app = express();
const PORT = process.env.PORT || 5008; // Default to 5008 for ai-service

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', aiRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/chat', chatRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'ai-service', port: PORT });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[AI Service Error]', err.stack);
    res.status(500).json({ success: false, error: err.message });
});

// Unhandled rejection handler - prevents clean exit
process.on('unhandledRejection', (reason, promise) => {
    console.error('[AI Service] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[AI Service] Uncaught Exception:', error);
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`AI Service running on port ${PORT}`);
    console.log(`========================================`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`AI API: http://localhost:${PORT}/api/*`);
    console.log(`========================================\n`);
});

// Keep server alive
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

