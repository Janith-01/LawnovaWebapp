import chatService from '../services/chatService.js';

/**
 * POST /api/chat/ask
 * Generate a chat response from the AI Legal Assistant
 */
export const askQuestion = async (req, res) => {
    try {
        const { question, trialId } = req.body;
        const userId = req.headers['user-id'];

        if (!question || typeof question !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Question is required and must be a string'
            });
        }

        if (!trialId) {
            return res.status(400).json({
                success: false,
                message: 'Trial ID is required for context'
            });
        }

        console.log(`[ChatController] Question from user ${userId} in trial ${trialId}`);

        const result = await chatService.generateChatResponse(question, trialId, userId);

        res.json(result);
    } catch (error) {
        console.error('[ChatController] Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * POST /api/chat/ask/stream
 * Generate a streaming chat response (SSE)
 */
export const askQuestionStream = async (req, res) => {
    try {
        const { question, trialId } = req.body;
        const userId = req.headers['user-id'];

        if (!question || typeof question !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Question is required and must be a string'
            });
        }

        if (!trialId) {
            return res.status(400).json({
                success: false,
                message: 'Trial ID is required for context'
            });
        }

        console.log(`[ChatController] Streaming question from user ${userId} in trial ${trialId}`);

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Stream the response
        await chatService.generateStreamingResponse(
            question,
            trialId,
            userId,
            (chunk) => {
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }
        );

        // End the stream
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    } catch (error) {
        console.error('[ChatController] Streaming Error:', error);

        // If headers not sent, send error response
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        } else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    }
};

/**
 * DELETE /api/chat/:trialId/history
 * Clear conversation history for a trial
 */
export const clearHistory = (req, res) => {
    try {
        const { trialId } = req.params;

        if (!trialId) {
            return res.status(400).json({
                success: false,
                message: 'Trial ID is required'
            });
        }

        const result = chatService.clearHistory(trialId);
        res.json(result);
    } catch (error) {
        console.error('[ChatController] Clear History Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export default {
    askQuestion,
    askQuestionStream,
    clearHistory
};
