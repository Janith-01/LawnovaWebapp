import express from 'express';
import {
    processUserMessage,
    getSession,
    createSession,
    generateCase,
    advanceDay,
    resumeSession,
    consultLaw // 👈 NEW: Import the new controller function
} from '../controllers/chatController.js';

const router = express.Router();

// Chat endpoint - Main Director Agent pipeline
router.post('/chat', processUserMessage);

// Session management
router.post('/session', createSession);
router.get('/session/:sessionId', getSession);

// Case generation
router.post('/generate-case', generateCase);

// Day/Time management (Phase 3)
router.post('/session/:sessionId/advance-day', advanceDay);
router.post('/session/:sessionId/resume', resumeSession);

// --- NEW RAG FEATURE ---
// Endpoint to search the Penal Code specifically
router.post('/consult-law', consultLaw);

export default router;