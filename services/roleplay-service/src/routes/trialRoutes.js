import { Router } from 'express';
import trialController from '../controllers/trialController.js';
import { validate, trialSchemas } from '../middleware/validate.js';

const router = Router();

// ============================================
// TRIAL INITIALIZATION ENDPOINTS
// ============================================

/**
 * @route   POST /api/trials/init-trial
 * @desc    Initialize a new roleplay trial session with AI-generated scenario
 * @access  Private
 * @body    { userId: ObjectId, role: 'Lawyer'|'Opposition', caseStage: String }
 * @returns { sessionId, scenario }
 */
router.post(
    '/init-trial',
    validate(trialSchemas.initTrial),
    trialController.initTrial
);

// ============================================
// SESSION MANAGEMENT ENDPOINTS
// ============================================

/**
 * @route   GET /api/trials/:sessionId
 * @desc    Get a specific trial session by ID
 * @access  Private
 */
router.get(
    '/:sessionId',
    validate(trialSchemas.sessionIdParam, 'params'),
    trialController.getTrialSession
);

/**
 * @route   GET /api/trials/user/:userId
 * @desc    Get all trial sessions for a user
 * @access  Private
 * @query   { status?: 'Active'|'Completed'|'Paused', page?: number, limit?: number }
 */
router.get(
    '/user/:userId',
    trialController.getUserTrials
);

/**
 * @route   GET /api/trials/user/:userId/stats
 * @desc    Get trial statistics for a user
 * @access  Private
 */
router.get(
    '/user/:userId/stats',
    trialController.getUserStats
);

// ============================================
// TRIAL INTERACTION ENDPOINTS
// ============================================

/**
 * @route   POST /api/trials/:sessionId/message
 * @desc    Add a message to the trial transcript
 * @access  Private
 * @body    { role: String, content: String }
 */
router.post(
    '/:sessionId/message',
    validate(trialSchemas.sessionIdParam, 'params'),
    validate(trialSchemas.addMessage),
    trialController.addMessage
);

/**
 * @route   POST /api/trials/:sessionId/advance-day
 * @desc    Advance to the next trial day
 * @access  Private
 */
router.post(
    '/:sessionId/advance-day',
    validate(trialSchemas.sessionIdParam, 'params'),
    trialController.advanceDay
);

/**
 * @route   POST /api/trials/:sessionId/complete
 * @desc    Mark a trial session as completed
 * @access  Private
 * @body    { performance?: { overallScore, legalAccuracy, argumentation, feedback } }
 */
router.post(
    '/:sessionId/complete',
    validate(trialSchemas.sessionIdParam, 'params'),
    trialController.completeSession
);

/**
 * @route   POST /api/trials/:sessionId/finalize
 * @desc    Finalize a trial and fetch Audit report
 * @access  Private
 */
router.post(
    '/:sessionId/finalize',
    validate(trialSchemas.sessionIdParam, 'params'),
    trialController.finalizeTrial
);

export default router;
