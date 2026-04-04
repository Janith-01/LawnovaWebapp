import axios from 'axios';
import TrialSession from '../models/TrialSession.js';
import Room from '../models/Room.js';
import { ApiError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { sendDailyAppMessage } from '../utils/aiServiceClient.js';
import { scheduleStageEnd, clearSchedule } from '../services/stageScheduler.js';

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

    // Use Math.floor first, then distribute any remainder to the largest stages
    const stages = STAGE_PERCENTAGES.map(stage => ({
        name: stage.name,
        percentage: stage.percentage,
        allocatedMinutes: Math.floor(totalMinutes * (stage.percentage / 100)),
        status: 'pending'
    }));

    let allocated = stages.reduce((sum, s) => sum + s.allocatedMinutes, 0);
    let remainder = totalMinutes - allocated;
    // Distribute leftover minutes one-at-a-time to the largest stages (by %)
    const byPercentDesc = [...stages].sort((a, b) => b.percentage - a.percentage);
    let idx = 0;
    while (remainder > 0) {
        byPercentDesc[idx % byPercentDesc.length].allocatedMinutes += 1;
        remainder -= 1;
        idx += 1;
    }

    return stages;
};

/**
 * Wraps a Mongoose session document with server-authoritative timing fields.
 * Prevents cross-client clock drift by providing a reference serverTimestamp
 * and a pre-computed currentRemainingSeconds for the active stage.
 */
const withServerTiming = (session) => {
    const data = session.toObject();
    const now = Date.now();
    data.serverTimestamp = now;

    if (session.isActive && session.startedAt) {
        const startedAt = new Date(session.startedAt).getTime();
        let cumulativeMs = 0;
        for (let i = 0; i <= session.currentStageIndex; i++) {
            cumulativeMs += session.stages[i].allocatedMinutes * 60 * 1000;
        }
        const stageEndMs = startedAt + cumulativeMs + (session.totalPausedMs || 0);
        data.stageEndTime = stageEndMs; // Absolute epoch ms — the single source of truth
        data.currentRemainingSeconds = Math.max(0, Math.floor((stageEndMs - now) / 1000));
    } else {
        data.stageEndTime = 0;
        data.currentRemainingSeconds = 0;
    }

    return data;
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
                // Mark the first stage as active
                const now = new Date();
                stages[0].status = 'active';
                stages[0].startedAt = now;

                session = await TrialSession.create({
                    roomId,
                    totalDurationMinutes: totalMinutes,
                    stages,
                    isActive: true,
                    startedAt: now,
                    currentStageIndex: 0
                });
            } else {
                // Full reset: rebuild the session from scratch so stale/timed-out sessions are cleaned up
                const now = new Date();
                stages[0].status = 'active';
                stages[0].startedAt = now;

                session.totalDurationMinutes = totalMinutes;
                session.stages = stages;
                session.currentStageIndex = 0;
                session.isActive = true;
                session.startedAt = now;
                session.totalPausedMs = 0;
                session._lastPenaltyAt = null;
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

            // Schedule the backend stage-end handler (Circuit Breaker)
            const timed = withServerTiming(session);
            const io = req.app.get('io');
            if (timed.stageEndTime) {
                scheduleStageEnd(roomId, timed.stageEndTime, io);
            }

            res.json({
                success: true,
                data: timed
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

            // Mark all stages up to Deliberation as completed
            const nowDate = new Date();
            for (let i = 0; i < deliberationIndex; i++) {
                if (session.stages[i].status !== 'completed') {
                    session.stages[i].status = 'completed';
                    session.stages[i].completedAt = nowDate;
                }
            }
            session.currentStageIndex = deliberationIndex !== -1 ? deliberationIndex : 4;
            session.stages[session.currentStageIndex].status = 'active';
            session.stages[session.currentStageIndex].startedAt = nowDate;
            await session.save();

            // Cancel existing schedule for this room (session forced to Deliberation)
            clearSchedule(session.roomId.toString());

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
     * Requirement 4: Auto-advance to next stage when timer expires AND requirements are met.
     * Returns true if a transition occurred.
     */
    autoAdvanceIfReady: async (session) => {
        if (!session.isActive || !session.startedAt) return false;
        if (session.currentStageIndex >= session.stages.length - 1) return false;

        const currentStage = session.stages[session.currentStageIndex];

        // FSM gate: only auto-advance if requirements are satisfied
        if (!currentStage.isStageRequirementsMet) return false;

        // Check if stage time has expired
        const startedAt = new Date(session.startedAt).getTime();
        let cumulativeMs = 0;
        for (let i = 0; i <= session.currentStageIndex; i++) {
            cumulativeMs += session.stages[i].allocatedMinutes * 60 * 1000;
        }
        const stageEndMs = startedAt + cumulativeMs + (session.totalPausedMs || 0);

        if (Date.now() < stageEndMs) return false; // Stage still has time

        // --- Auto-transition ---
        const now = new Date();
        currentStage.status = 'completed';
        currentStage.completedAt = now;

        session.currentStageIndex += 1;
        session.stages[session.currentStageIndex].status = 'active';
        session.stages[session.currentStageIndex].startedAt = now;
        await session.save();

        // Broadcast stage change to keep Petitioner/Respondent in sync
        const room = await Room.findById(session.roomId);
        if (room?.dailyRoomName) {
            await sendDailyAppMessage(room.dailyRoomName, 'TIMER_STAGE_CHANGE', {
                currentStageIndex: session.currentStageIndex,
                nextStageName: session.stages[session.currentStageIndex].name,
                isStageRequirementsMet: false,
                autoAdvanced: true
            });
        }

        logger.info({ roomId: session.roomId }, `[FSM] Auto-advanced to '${session.stages[session.currentStageIndex].name}'`);
        return true;
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
                        currentStageIndex: 0,
                        serverTimestamp: Date.now(),
                        currentRemainingSeconds: 0
                    }
                });
            }

            // Requirement 4: Check for auto-deliberation timeout
            await trialSessionController.checkSessionTimeout(session);

            // Requirement 4: Auto-advance if stage time expired and requirements met
            await trialSessionController.autoAdvanceIfReady(session);

            res.json({
                success: true,
                data: withServerTiming(session)
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
                // Complete current stage
                const now = new Date();
                currentStage.status = 'completed';
                currentStage.completedAt = now;

                // Advance and activate next stage
                session.currentStageIndex += 1;
                session.stages[session.currentStageIndex].status = 'active';
                session.stages[session.currentStageIndex].startedAt = now;
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

                // Schedule the backend stage-end handler for the new stage
                const nextTimed = withServerTiming(session);
                const io = req.app.get('io');
                if (nextTimed.stageEndTime && session.currentStageIndex < session.stages.length - 1) {
                    scheduleStageEnd(roomId, nextTimed.stageEndTime, io);
                }

                res.json({ success: true, data: nextTimed });
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
            const wasLocked = !currentStage.isStageRequirementsMet;
            if (wasLocked && currentStage.detectedKeywords.length >= 3) {
                currentStage.isStageRequirementsMet = true;

                // UX: Broadcast STAGE_COMPLETE once met (unlocks "Next" button)
                const room = await Room.findById(roomId);
                if (room?.dailyRoomName) {
                    await sendDailyAppMessage(room.dailyRoomName, 'STAGE_COMPLETE', {
                        stageName: currentStage.name,
                        unlocked: true,
                        count: currentStage.detectedKeywords.length
                    });
                }
                logger.info({ roomId }, `[FSM] Stage '${currentStage.name}' UNLOCKED (3+ keywords found)`);
            } else if (wasLocked) {
                // Requirement 5: Broadcast incremental lock progress so all participants stay synced
                const room = await Room.findById(roomId);
                if (room?.dailyRoomName) {
                    await sendDailyAppMessage(room.dailyRoomName, 'TIMER_LOCK_UPDATE', {
                        stageName: currentStage.name,
                        keywordCount: currentStage.detectedKeywords.length,
                        requiredCount: 3,
                        isStageRequirementsMet: false
                    });
                }
            }

            await session.save();

            // Requirement 4: After updating keywords, check if auto-advance should fire
            await trialSessionController.autoAdvanceIfReady(session);

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
     * Cooldown: Only one penalty per 60 seconds per session to prevent spam.
     */
    applyPenalty: async (req, res) => {
        const { roomId } = req.params;
        const { reason } = req.body;

        try {
            const session = await TrialSession.findOne({ roomId });
            if (!session) throw new ApiError(404, 'Trial Session states not found');

            // Penalty cooldown: skip if a penalty was applied within the last 60 seconds
            const lastPenaltyAt = session._lastPenaltyAt ? new Date(session._lastPenaltyAt).getTime() : 0;
            if (Date.now() - lastPenaltyAt < 60000) {
                return res.json({ success: true, message: 'Penalty cooldown active — skipped' });
            }

            // Requirement 4: Safety Rule - Check for complete timeout
            const timedOut = await trialSessionController.checkSessionTimeout(session);
            if (timedOut) {
                return res.json({ success: true, message: 'Session Timeout: Forced to Deliberation' });
            }

            // 1. Time Inflation: Add 1 minute to the current stage's individual allocation
            const currentStage = session.stages[session.currentStageIndex];
                    // 1. Inflate time by 1 minute
            currentStage.allocatedMinutes += 1;
            currentStage.totalPenaltyPoints = (currentStage.totalPenaltyPoints || 0) + 1;
            
            // Calculate new stageEndTime based on startedAt to avoid jump/drift
            // Default to Date.now() if stage hasn't officially started (safety)
            const baseTime = currentStage.startedAt ? new Date(currentStage.startedAt).getTime() : Date.now();
            const stageEndTime = baseTime + (currentStage.allocatedMinutes * 60 * 1000);

            // Save the state immediately
            session._lastPenaltyAt = new Date();
            await session.save();

            logger.info({ roomId, stage: currentStage.name }, 'Penalty applied: +1 min');

            // 2. Broadcast the inflation event 
            const penaltyPayload = {
                roomId,
                totalPenaltyPoints: currentStage.totalPenaltyPoints,
                newStageMinutes: currentStage.allocatedMinutes,
                stageEndTime, // Transmit new absolute end time (epoch ms)
                reason: req.body.reason || 'Legal vocabulary missing',
                serverTimestamp: Date.now()
            };

            // 2a. Broadcast via Socket.io
            const io = req.app.get('io');
            if (io) {
                io.to(`room:${roomId}`).emit('TIME_INFLATED', penaltyPayload);
            }

            // 2b. Broadcast via Daily.co app message so CourtroomTimer receives it
            const room = await Room.findById(roomId);
            if (room?.dailyRoomName) {
                sendDailyAppMessage(room.dailyRoomName, 'TIME_INFLATED', penaltyPayload)
                    .catch(err => logger.debug({ roomId }, `Daily penalty broadcast skipped: ${err.message}`));
            }

            // Reschedule the stage-end timer with the new extended time
            if (stageEndTime) {
                scheduleStageEnd(roomId, stageEndTime, io);
            }

            return res.json({
                success: true,
                message: 'Penalty applied successfully',
                data: penaltyPayload
            });
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to apply penalty');
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message
            });
        }
    },

    /**
     * Requirement 5: Return allocated times as a JSON object for frontend/backend sync.
     * Does NOT start a session — just calculates and returns the time split.
     */
    getAllocations: async (req, res) => {
        const { roomId } = req.params;
        try {
            // If a live session exists, return its current (possibly penalised) allocations
            const session = await TrialSession.findOne({ roomId });
            if (session) {
                return res.json({
                    success: true,
                    data: {
                        totalDurationMinutes: session.totalDurationMinutes,
                        stages: session.stages.map(s => ({
                            name: s.name,
                            percentage: s.percentage,
                            allocatedMinutes: s.allocatedMinutes,
                            status: s.status
                        })),
                        currentStageIndex: session.currentStageIndex,
                        isActive: session.isActive
                    }
                });
            }

            // No session yet — calculate from room duration
            const room = await Room.findById(roomId);
            if (!room) throw new ApiError(404, 'Room not found');

            const totalMinutes = room.duration || 60;
            const stages = calculateStageAllocations(totalMinutes);

            res.json({
                success: true,
                data: {
                    totalDurationMinutes: totalMinutes,
                    stages: stages.map(s => ({
                        name: s.name,
                        percentage: s.percentage,
                        allocatedMinutes: s.allocatedMinutes,
                        status: s.status
                    })),
                    currentStageIndex: 0,
                    isActive: false
                }
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message });
        }
    }
};

export default trialSessionController;
