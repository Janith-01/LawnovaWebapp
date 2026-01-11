import express from 'express';
import chatController from '../controllers/chatController.js';

const router = express.Router();

/**
 * @route   POST /api/chat/ask
 * @desc    Ask the AI Legal Assistant a question
 * @access  Private (JWT protected via Gateway)
 */
router.post('/ask', chatController.askQuestion);

/**
 * @route   POST /api/chat/ask/stream
 * @desc    Ask the AI Legal Assistant with streaming response (SSE)
 * @access  Private (JWT protected via Gateway)
 */
router.post('/ask/stream', chatController.askQuestionStream);

/**
 * @route   DELETE /api/chat/:trialId/history
 * @desc    Clear conversation history for a trial
 * @access  Private (JWT protected via Gateway)
 */
router.delete('/:trialId/history', chatController.clearHistory);

export default router;
