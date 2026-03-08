import axios from 'axios';
import Room from '../models/Room.js';
import { ApiError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { sendDailyAppMessage } from '../utils/aiServiceClient.js';

/**
 * Controller to orchestrate AI Study Material generation and Delivery.
 * Triggered by the Judge/Owner in the courtroom.
 */
export const broadcastStudySuite = async (req, res) => {
    const { roomId } = req.params;
    const userId = req.headers['user-id'];

    try {
        logger.info({ roomId, userId }, '[Delivery] Starting AI Delivery orchestration');

        // 1. Authorization: Verify requester is Judge or Owner
        const room = await Room.findById(roomId);
        if (!room) throw new ApiError(404, 'Room not found');

        const isOwner = userId && room.ownerId.toString() === userId;
        const participant = room.participants.find(p => p.userId?.toString() === userId);
        const isJudge = participant?.assignedRole?.toLowerCase() === 'judge';

        if (!isOwner && !isJudge) {
            throw new ApiError(403, 'Unauthorized: Only the Judge or Owner can trigger study material generation.');
        }

        // 2. Fetch Transcript context from Node AI Service
        const aiNodeUrl = process.env.AI_SERVICE_URL || 'http://localhost:5008';
        const transcriptResp = await axios.get(`${aiNodeUrl}/api/transcript/${roomId}/context`, {
            params: { maxMessages: 100 }
        });

        const messages = transcriptResp.data?.data?.messages || [];
        if (messages.length === 0) {
            throw new ApiError(400, 'Transcript is empty. AI needs speech to generate learning materials.');
        }

        const transcriptText = messages.map(m => `[${m.speakerRole}] ${m.speakerName}: ${m.text}`).join('\n');

        // 3. Request Suite from Python AI Service
        // User specified port 5001. System default is 5009. We follow Instruction 1.
        const pythonBackendUrl = 'http://localhost:5001/generate-study-material';

        const genResponse = await axios.post(pythonBackendUrl, {
            transcript: transcriptText,
            topic: room.topic
        }).catch(err => {
            // Fallback to 5009 if 5001 fails to be helpful
            logger.warn(`[Delivery] Python Service on 5001 failed, trying 5009 fallback: ${err.message}`);
            return axios.post('http://localhost:5009/generate-study-material', {
                transcript: transcriptText,
                topic: room.topic
            });
        });

        const aiData = genResponse.data?.data;

        // 4. Data Validation: Verify JSON structure (Flashcards & Quizzes)
        if (!aiData || !Array.isArray(aiData.flashcards) || !Array.isArray(aiData.quizzes)) {
            logger.error('[Delivery] Invalid AI format received:', aiData);
            throw new ApiError(500, 'AI returned invalid data structure. Expected flashcards and quizzes.');
        }

        // 5. Global Synchronization (Daily.co SDK)
        // Push the data to EVERYONE in the room with the specific requested payload structure
        if (room.dailyRoomName) {
            await sendDailyAppMessage(room.dailyRoomName, 'STUDY_MATERIAL_AVAILABLE', {
                payload: aiData
            });
            logger.info({ roomId }, '[Delivery] Successfully broadcasted Study Suite via payload synchronization');
        }

        res.json({
            success: true,
            data: aiData
        });

    } catch (error) {
        logger.error('[Delivery] Failed to broadcast Study Suite:', error.message);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

export default {
    broadcastStudySuite
};
