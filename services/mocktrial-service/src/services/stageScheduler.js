/**
 * Stage Scheduler — server-authoritative timer that fires at stage end.
 *
 * WHY: The frontend timer is purely cosmetic. If Socket.IO or Daily.co
 * are down the client never triggers stage transitions, leaving the trial
 * stuck at 0:00. This module is the "Circuit Breaker" — the backend is
 * the master of stage progression.
 *
 * HOW:
 *   scheduleStageEnd(roomId, stageEndMs, io)
 *     → Sets a setTimeout that fires at exactly stageEndMs.
 *     → On fire: checks keyword requirements via the DB.
 *       • Met    → auto-advance to next stage.
 *       • Not met → apply penalty (+60 s), reschedule (max 3 retries),
 *                   then force-advance if still unmet after retries.
 *
 * LIFECYCLE:
 *   Called from startSession / nextStage / applyPenalty.
 *   clearSchedule(roomId) cancels any pending timer (room complete, reset, etc.).
 */

import TrialSession from '../models/TrialSession.js';
import Room from '../models/Room.js';
import { sendDailyAppMessage } from '../utils/aiServiceClient.js';
import logger from '../utils/logger.js';

// In-memory map: roomId → { timer, retries }
const schedules = new Map();

const MAX_PENALTY_RETRIES = 3;

/**
 * Compute absolute epoch ms when the current stage ends.
 */
function computeStageEndMs(session) {
    if (!session.isActive || !session.startedAt) return 0;
    const startedAt = new Date(session.startedAt).getTime();
    let cumulativeMs = 0;
    for (let i = 0; i <= session.currentStageIndex; i++) {
        cumulativeMs += session.stages[i].allocatedMinutes * 60 * 1000;
    }
    return startedAt + cumulativeMs + (session.totalPausedMs || 0);
}

/**
 * Build the standard server-timing envelope for broadcasts.
 */
function buildTimingPayload(session) {
    const now = Date.now();
    const stageEndMs = computeStageEndMs(session);
    return {
        serverTimestamp: now,
        stageEndTime: stageEndMs,
        currentRemainingSeconds: Math.max(0, Math.floor((stageEndMs - now) / 1000))
    };
}

/**
 * Schedule the callback that fires when the current stage's time runs out.
 */
export function scheduleStageEnd(roomId, stageEndMs, io) {
    // Clear any existing schedule for this room
    clearSchedule(roomId);

    const delayMs = Math.max(0, stageEndMs - Date.now());

    const timer = setTimeout(() => handleStageEnd(roomId, io), delayMs);

    schedules.set(roomId, { timer, retries: 0 });
    logger.info({ roomId, firesInMs: delayMs }, '[StageScheduler] Scheduled stage-end');
}

/**
 * Cancel a pending schedule (room completed, session reset, etc.).
 */
export function clearSchedule(roomId) {
    const entry = schedules.get(roomId);
    if (entry) {
        clearTimeout(entry.timer);
        schedules.delete(roomId);
        logger.debug({ roomId }, '[StageScheduler] Cleared');
    }
}

/**
 * Core handler that runs when a stage's time expires.
 */
async function handleStageEnd(roomId, io) {
    try {
        const session = await TrialSession.findOne({ roomId });
        if (!session || !session.isActive) {
            schedules.delete(roomId);
            return;
        }

        // Already at last stage — nothing to advance to
        if (session.currentStageIndex >= session.stages.length - 1) {
            schedules.delete(roomId);
            return;
        }

        const currentStage = session.stages[session.currentStageIndex];
        const entry = schedules.get(roomId) || { retries: 0 };

        // ── PATH A: Requirements Met → Auto-Advance ──
        if (currentStage.isStageRequirementsMet) {
            await advanceStage(session, roomId, io);
            schedules.delete(roomId);
            return;
        }

        // ── PATH B: Requirements NOT Met ──
        if (entry.retries < MAX_PENALTY_RETRIES) {
            // Apply penalty (+60 s) and reschedule
            await applyScheduledPenalty(session, currentStage, roomId, io, entry);
        } else {
            // Force-advance after max retries (Circuit Breaker)
            logger.warn({ roomId, stage: currentStage.name },
                '[StageScheduler] Max penalty retries reached — force-advancing');
            currentStage.isStageRequirementsMet = true; // Override the lock
            await session.save();
            await advanceStage(session, roomId, io);
            schedules.delete(roomId);
        }
    } catch (err) {
        logger.error({ roomId, err: err.message }, '[StageScheduler] handleStageEnd error');
        schedules.delete(roomId);
    }
}

/**
 * Advance to the next stage and broadcast.
 */
async function advanceStage(session, roomId, io) {
    const now = new Date();
    const currentStage = session.stages[session.currentStageIndex];
    currentStage.status = 'completed';
    currentStage.completedAt = now;

    session.currentStageIndex += 1;
    const nextStage = session.stages[session.currentStageIndex];
    nextStage.status = 'active';
    nextStage.startedAt = now;
    await session.save();

    const timing = buildTimingPayload(session);

    const stageChangePayload = {
        currentStageIndex: session.currentStageIndex,
        nextStageName: nextStage.name,
        isStageRequirementsMet: false,
        autoAdvanced: true,
        ...timing
    };

    // Broadcast via Socket.IO
    if (io) {
        io.to(`room:${roomId}`).emit('TIMER_STAGE_CHANGE', stageChangePayload);
    }

    // Broadcast via Daily.co
    const room = await Room.findById(roomId);
    if (room?.dailyRoomName) {
        sendDailyAppMessage(room.dailyRoomName, 'TIMER_STAGE_CHANGE', stageChangePayload)
            .catch(e => logger.debug({ roomId }, `Daily stage broadcast skipped: ${e.message}`));
    }

    logger.info({ roomId }, `[StageScheduler] Auto-advanced to '${nextStage.name}'`);

    // Schedule the next stage's end
    const nextEndMs = computeStageEndMs(session);
    scheduleStageEnd(roomId, nextEndMs, io);
}

/**
 * Apply a +60 s penalty, broadcast, and reschedule.
 */
async function applyScheduledPenalty(session, currentStage, roomId, io, entry) {
    // Cooldown check (match controller logic)
    const lastPenaltyAt = session._lastPenaltyAt ? new Date(session._lastPenaltyAt).getTime() : 0;
    if (Date.now() - lastPenaltyAt < 60000) {
        // Re-check in 10 seconds
        const timer = setTimeout(() => handleStageEnd(roomId, io), 10000);
        schedules.set(roomId, { timer, retries: entry.retries });
        return;
    }

    currentStage.allocatedMinutes += 1;
    session._lastPenaltyAt = new Date();
    await session.save();

    const timing = buildTimingPayload(session);

    const penaltyPayload = {
        roomId,
        stageName: currentStage.name,
        addedSeconds: 60,
        newStageMinutes: currentStage.allocatedMinutes,
        ...timing,
        reason: 'Stage requirements not met — penalty applied by server'
    };

    // Broadcast via Socket.IO
    if (io) {
        io.to(`room:${roomId}`).emit('TIME_INFLATED', penaltyPayload);
    }

    // Broadcast via Daily.co
    const room = await Room.findById(roomId);
    if (room?.dailyRoomName) {
        sendDailyAppMessage(room.dailyRoomName, 'TIME_INFLATED', penaltyPayload)
            .catch(e => logger.debug({ roomId }, `Daily penalty broadcast skipped: ${e.message}`));
    }

    logger.info({ roomId, retry: entry.retries + 1 },
        `[StageScheduler] Penalty +60s applied for '${currentStage.name}'`);

    // Reschedule with incremented retry count
    const newEndMs = computeStageEndMs(session);
    const delayMs = Math.max(0, newEndMs - Date.now());
    const timer = setTimeout(() => handleStageEnd(roomId, io), delayMs);
    schedules.set(roomId, { timer, retries: entry.retries + 1 });
}

export default { scheduleStageEnd, clearSchedule };
