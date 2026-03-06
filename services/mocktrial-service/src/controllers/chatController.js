import Room from '../models/Room.js';
import axios from 'axios';
import logger from '../utils/logger.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5008';

/**
 * Chat Controller - Handles AI chat with persistence and socket broadcast
 */
const chatController = {
    /**
     * POST /api/rooms/:roomId/chat
     * Send a message to the AI Legal Assistant
     */
    sendMessage: async (req, res) => {
        const { roomId } = req.params;
        const { message } = req.body;
        const userId = req.headers['user-id'];
        const userEmail = req.headers['user-email'];
        const userName = req.headers['user-name'] || userEmail?.split('@')[0] || 'Student';

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        try {
            const room = await Room.findById(roomId);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Trial room not found'
                });
            }

            // 1. Save user message to DB
            const userMessage = {
                sender: 'User',
                userId,
                userName,
                message,
                timestamp: new Date()
            };
            room.chatHistory.push(userMessage);

            // 2. Broadcast user message via Socket.io
            const io = req.io;
            if (io) {
                io.to(`room:${roomId}`).emit('chat:message', {
                    ...userMessage,
                    roomId
                });
            }

            // 3. Call AI Service for response
            let aiResponse = '';
            try {
                const aiResult = await axios.post(`${AI_SERVICE_URL}/api/chat/ask`, {
                    question: message,
                    trialId: roomId
                }, {
                    headers: {
                        'user-id': userId,
                        'x-internal-service-auth': process.env.INTERNAL_SERVICE_SECRET
                    },
                    timeout: 30000
                });

                aiResponse = aiResult.data?.response || 'I apologize, I could not generate a response.';
            } catch (aiError) {
                logger.error('[ChatController] AI Service error:', aiError.message);
                aiResponse = 'I apologize, the AI service is temporarily unavailable. Please try again.';
            }

            // 4. Save AI response to DB
            const aiMessage = {
                sender: 'AI',
                userId: null,
                userName: 'AI Legal Assistant',
                message: aiResponse,
                timestamp: new Date()
            };
            room.chatHistory.push(aiMessage);
            await room.save();

            // 5. Broadcast AI response via Socket.io
            if (io) {
                io.to(`room:${roomId}`).emit('chat:message', {
                    ...aiMessage,
                    roomId
                });
            }

            res.json({
                success: true,
                data: {
                    userMessage,
                    aiMessage
                }
            });
        } catch (error) {
            logger.error('[ChatController] Error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    /**
     * GET /api/rooms/:roomId/chat
     * Get chat history for a room
     */
    getChatHistory: async (req, res) => {
        const { roomId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        try {
            const room = await Room.findById(roomId)
                .select('chatHistory')
                .lean();

            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Trial room not found'
                });
            }

            // Return last N messages
            const history = room.chatHistory?.slice(-limit) || [];

            res.json({
                success: true,
                data: {
                    roomId,
                    messages: history,
                    total: room.chatHistory?.length || 0
                }
            });
        } catch (error) {
            logger.error('[ChatController] Get history error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    /**
     * DELETE /api/rooms/:roomId/chat
     * Clear chat history for a room (owner only)
     */
    clearChatHistory: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];

        try {
            const room = await Room.findById(roomId);
            if (!room) {
                return res.status(404).json({
                    success: false,
                    message: 'Trial room not found'
                });
            }

            // Check ownership
            if (room.ownerId.toString() !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Only the trial owner can clear chat history'
                });
            }

            room.chatHistory = [];
            await room.save();

            // Broadcast clear event
            const io = req.io;
            if (io) {
                io.to(`room:${roomId}`).emit('chat:cleared', { roomId });
            }

            res.json({
                success: true,
                message: 'Chat history cleared'
            });
        } catch (error) {
            logger.error('[ChatController] Clear history error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

export default chatController;
