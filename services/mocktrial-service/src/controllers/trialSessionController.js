import axios from 'axios';
import TrialSession from '../models/TrialSession.js';
import Room from '../models/Room.js';
import { ApiError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { sendDailyAppMessage } from '../utils/aiServiceClient.js';

/**
 * Time Allocation Engine logic
 * Splits time into 5 stages defined by the legal mock trial procedure.
 */
export const calculateStageAllocations = (totalMinutes) => {
    const STAGE_PERCENTAGES = [
        { name: 'Opening Statements', percentage: 15 },
        { name: 'Direct Examination', percentage: 30 },
        { name: 'Cross Examination', percentage: 30 },
        { name: 'Closing Arguments', percentage: 15 },
        { name: 'Deliberation', percentage: 10 }
    ];

    return STAGE_PERCENTAGES.map(stage => ({
        name: stage.name,
        percentage: stage.percentage,
        allocatedMinutes: Math.floor(totalMinutes * (stage.percentage / 100)),
        status: 'pending'
    }));
};

/**
 * Controller for managing runtime Trial Sessions
 */
const trialSessionController = {
    /**
     * Start/Initialize a trial session for a room
     */
    startSession: async (req, res) => {
        const { roomId } = req.params;
        const userId = req.headers['user-id'];

        try {
            const room = await Room.findById(roomId);
            if (!room) throw new ApiError(404, 'Room not found');

            // 1. Calculate time allocations
            const totalMinutes = room.duration || 60;
            const stages = calculateStageAllocations(totalMinutes);

            // 2. State Management: Create or find existing session
            let session = await TrialSession.findOne({ roomId });

            if (!session) {
                session = await TrialSession.create({
                    roomId,
                    totalDurationMinutes: totalMinutes,
                    stages,
                    isActive: true,
                    startedAt: new Date(),
                    currentStageIndex: 0
                });
            } else {
                // Restart existing if needed or just start it
                session.isActive = true;
                if (!session.startedAt) session.startedAt = new Date();
                await session.save();
            }

            // Sync with all participants via Daily.co
            if (room.dailyRoomName) {
                await sendDailyAppMessage(room.dailyRoomName, 'TIMER_START', {
                    totalMinutes: session.totalDurationMinutes,
                    stages: session.stages,
                    currentStageIndex: session.currentStageIndex,
                    startedAt: session.startedAt,
                    isActive: session.isActive
                });
            }

            res.json({
                success: true,
                data: session
            });

        } catch (error) {
            logger.error(`[TrialSession] Error starting session ${roomId}:`, error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message
            });
        }
    },

    /**
     * Requirement 4: Safety Rule - Session timeout auto-move to Deliberation
     */
    checkSessionTimeout: async (session) => {
        if (!session.isActive || !session.startedAt) return false;

        const startTime = new Date(session.startedAt).getTime();
        const now = Date.now();
        const elapsedMins = (now - startTime) / 60000;

        // If current stage is not Deliberation and time exceeded 1.5x total
        const deliberationIndex = session.stages.findIndex(s => s.name === 'Deliberation');
        if (session.currentStageIndex < deliberationIndex && elapsedMins > (session.totalDurationMinutes * 1.5)) {
            console.log(`[Safety Rule] Session Timeout for ${session.roomId}. Forcing to Deliberation.`);
            session.currentStageIndex = deliberationIndex !== -1 ? deliberationIndex : 4;
            await session.save();

            const room = await Room.findById(session.roomId);
            if (room.dailyRoomName) {
                await sendDailyAppMessage(room.dailyRoomName, 'TIMER_STAGE_CHANGE', {
                    currentStageIndex: session.currentStageIndex,
                    nextStageName: 'Deliberation',
                    forced: true
                });
            }
            return true;
        }
        return false;
    },

    /**
     * Get trial session status for synchronization
     */
    getSessionStatus: async (req, res) => {
        const { roomId } = req.params;
        try {
            const session = await TrialSession.findOne({ roomId });
            if (!session) {
                const room = await Room.findById(roomId);
                const totalMinutes = room?.duration || 60;
                return res.json({
                    success: true,
                    data: {
                        isActive: false,
                        totalDurationMinutes: totalMinutes,
                        stages: calculateStageAllocations(totalMinutes),
                        currentStageIndex: 0
                    }
                });
            }

            // Requirement 4: Check for auto-deliberation timeout
            await trialSessionController.checkSessionTimeout(session);

            res.json({
                success: true,
                data: session
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Move to next stage manually (Judge/Owner only)
     * Requirement 1: Finite State Machine - Progression allowed only if requirements met.
     */
    nextStage: async (req, res) => {
        const { roomId } = req.params;
        try {
            const session = await TrialSession.findOne({ roomId });
            if (!session) throw new ApiError(404, 'Session not found');

            const currentStage = session.stages[session.currentStageIndex];

            // Logic: TrialState machine rule (Requirement 1)
            // Progression is only allowed if requirements are met (3+ unique keywords found)
            if (!currentStage.isStageRequirementsMet) {
                return res.status(403).json({
                    success: false,
                    message: `Cannot move to next stage. Legal requirements for '${currentStage.name}' not yet satisfied.`
                });
            }

            if (session.currentStageIndex < session.stages.length - 1) {
                session.currentStageIndex += 1;
                await session.save();

                // Requirement 5: Sync state with Daily.co to ensure Petitioner/Respondent are aligned
                const room = await Room.findById(roomId);
                if (room.dailyRoomName) {
                    await sendDailyAppMessage(room.dailyRoomName, 'TIMER_STAGE_CHANGE', {
                        currentStageIndex: session.currentStageIndex,
                        nextStageName: session.stages[session.currentStageIndex].name,
                        isStageRequirementsMet: false // New stage starts locked
                    });
                }

                // Sync with AI Service
                try {
                    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:5008';
                    await axios.post(`${aiUrl}/api/ai/transcript/ingest`, {
                        roomId: roomId,
                        type: 'METADATA_UPDATE',
                        metadata: { currentStage: session.stages[session.currentStageIndex].name }
                    });
                } catch (metaErr) {
                    logger.debug({ roomId }, 'AI Metadata Sync skipped');
                }

                res.json({ success: true, data: session });
            } else {
                res.status(400).json({ success: false, message: 'Already at final stage' });
            }
        } catch (error) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    },

    /**
     * Requirement 2: Backend-side stage content validator update.
     * Called by the AI service when keyword thresholds are reached.
     */
    updateStageRequirements: async (req, res) => {
        const { roomId } = req.params;
        const { foundKeywords, isMet } = req.body;

        try {
            const session = await TrialSession.findOne({ roomId });
            if (!session) throw new ApiError(404, 'Session not found');

            const currentStage = session.stages[session.currentStageIndex];

            // 1. Unique keyword aggregation (Requirement 2)
            // We combine previously found words with new ones to reach the "3 unique" threshold
            const currentList = new Set([...currentStage.detectedKeywords, ...foundKeywords]);
            currentStage.detectedKeywords = Array.from(currentList);

            // 2. Threshold Check: Unlock only if 3+ unique keywords are found (Requirement 2)
            if (!currentStage.isStageRequirementsMet && currentStage.detectedKeywords.length >= 3) {
                currentStage.isStageRequirementsMet = true;

                // UX: Broadcast STAGE_COMPLETE once met
                const room = await Room.findById(roomId);
                if (room.dailyRoomName) {
                    await sendDailyAppMessage(room.dailyRoomName, 'STAGE_COMPLETE', {
                        stageName: currentStage.name,
                        unlocked: true,
                        count: currentStage.detectedKeywords.length
                    });
                }
                logger.info({ roomId }, `[FSM] Stage '${currentStage.name}' UNLOCKED (3+ keywords found)`);
            }

            await session.save();
            res.json({
                success: true,
                isStageRequirementsMet: currentStage.isStageRequirementsMet,
                count: currentStage.detectedKeywords.length
            });

        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Requirement 3: Apply Time Inflation penalty
     * Adds 60 seconds to the current stage's timer and broadcasts to all users.
     */
    applyPenalty: async (req, res) => {
        const { roomId } = req.params;
        const { reason } = req.body;

        try {
            const session = await TrialSession.findOne({ roomId });
            if (!session) throw new ApiError(404, 'Trial Session states not found');

            // Requirement 4: Safety Rule - Check for complete timeout
            const timedOut = await trialSessionController.checkSessionTimeout(session);
            if (timedOut) {
                return res.json({ success: true, message: 'Session Timeout: Forced to Deliberation' });
            }

            // 1. Time Inflation: Add 1 minute to the current stage's individual allocation
            const currentStage = session.stages[session.currentStageIndex];
            currentStage.allocatedMinutes += 1;

            await session.save();

            // 2. Broadcast TIME_INFLATED event via Socket.io (Requirement 3)
            // Access IO instance from app
            const io = req.app.get('io');
            if (io) {
                const roomChannel = `room:${roomId}`;
                io.to(roomChannel).emit('TIME_INFLATED', {
                    roomId,
                    stageName: currentStage.name,
                    addedSeconds: 60,
                    newStageMinutes: currentStage.allocatedMinutes,
                    reason: reason || 'Legal vocabulary missing from argument'
                });
                logger.info({ roomId }, `[Penalty Engine] Time Inflated by 60s for ${currentStage.name}`);
            }

            res.json({
                success: true,
                message: 'Penalty Applied: +1:00',
                data: {
                    stage: currentStage.name,
                    newAllocatedMinutes: currentStage.allocatedMinutes
                }
            });

        } catch (error) {
            logger.error(`[Penalty Engine] Error applying inflation to ${roomId}:`, error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message
            });
        }
    }
};

export default trialSessionController;
