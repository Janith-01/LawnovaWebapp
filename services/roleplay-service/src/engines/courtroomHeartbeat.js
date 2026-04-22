/**
 * ============================================================
 * COURTROOM HEARTBEAT ENGINE
 * ============================================================
 * 
 * The autonomous simulation engine that drives AI-to-AI dialogue
 * when the user is silent. Uses Socket.IO to push real-time
 * updates to the frontend.
 * 
 * Architecture:
 *   - Each active session gets its own heartbeat timer
 *   - Every 30 seconds of user silence → Director picks next speaker → Actor generates dialogue
 *   - User interaction resets the idle timer
 *   - Objections pause the heartbeat and trigger immediate Judge ruling
 * 
 * ============================================================
 */

import RoleplaySession from '../models/RoleplaySession.js';
import {
    directCourtroomScene,
    generateActorDialogue,
    generateActorDialogueWithRL
} from '../utils/aiOrchestrator.js';
import { retrieveRelevantLaws } from '../utils/vectorSearch.js';

const hasJudgeRulingMarkers = (text = '') => /\b(sustained|overruled)\b/i.test(text);

// Configuration
const HEARTBEAT_INTERVAL_MS = 30000;  // 30 seconds of silence before auto-dialogue
const MAX_CONSECUTIVE_AUTO = 25;      // Allow 25 consecutive AI turns before pausing
const COOLDOWN_AFTER_USER_MS = 10000;  // Wait 10s after user interaction before resuming autonomous flow

/**
 * Active session heartbeats tracker
 * Map<sessionId, { timer, isPaused, consecutiveCount, isProcessing }>
 */
const activeHeartbeats = new Map();

/**
 * Reference to the Socket.IO server instance
 */
let io = null;

/**
 * Initialize the heartbeat engine with Socket.IO instance
 */
export function initHeartbeatEngine(socketIO) {
    io = socketIO;
    console.log('[HEARTBEAT] Courtroom Heartbeat Engine initialized');
}

/**
 * Start the autonomous heartbeat for a session.
 * Called when a user connects to a session via Socket.IO.
 */
export function startHeartbeat(sessionId) {
    // Don't double-start
    if (activeHeartbeats.has(sessionId)) {
        console.log(`[HEARTBEAT] Already running for session ${sessionId}`);
        return;
    }

    const heartbeat = {
        timer: null,
        isPaused: false,
        consecutiveCount: 0,
        isProcessing: false,
        sessionId
    };

    // Start the interval
    heartbeat.timer = setInterval(() => {
        tickHeartbeat(heartbeat);
    }, HEARTBEAT_INTERVAL_MS);

    activeHeartbeats.set(sessionId, heartbeat);
    console.log(`[HEARTBEAT] Started for session ${sessionId} (every ${HEARTBEAT_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the autonomous heartbeat for a session.
 * Called when session ends or user disconnects.
 */
export function stopHeartbeat(sessionId) {
    const heartbeat = activeHeartbeats.get(sessionId);
    if (heartbeat) {
        clearInterval(heartbeat.timer);
        activeHeartbeats.delete(sessionId);
        console.log(`[HEARTBEAT] Stopped for session ${sessionId}`);
    }
}

/**
 * Pause the heartbeat (e.g., when user raises an objection).
 */
export function pauseHeartbeat(sessionId) {
    const heartbeat = activeHeartbeats.get(sessionId);
    if (heartbeat) {
        heartbeat.isPaused = true;
        console.log(`[HEARTBEAT] Paused for session ${sessionId}`);
    }
}

/**
 * Resume the heartbeat after an objection is resolved.
 */
export function resumeHeartbeat(sessionId) {
    const heartbeat = activeHeartbeats.get(sessionId);
    if (heartbeat) {
        heartbeat.isPaused = false;
        heartbeat.consecutiveCount = 0; // Reset counter

        // Reset the interval to ensure a predictable 10s gap before the next AI agent speaks
        clearInterval(heartbeat.timer);
        heartbeat.timer = setInterval(() => {
            tickHeartbeat(heartbeat);
        }, HEARTBEAT_INTERVAL_MS);

        console.log(`[HEARTBEAT] Resumed (timer reset to ${HEARTBEAT_INTERVAL_MS / 1000}s) for session ${sessionId}`);
    }
}

/**
 * Reset the idle timer when the user sends a message.
 * This prevents autonomous dialogue from firing right after user input.
 */
export function resetIdleTimer(sessionId) {
    const heartbeat = activeHeartbeats.get(sessionId);
    if (heartbeat) {
        // Reset the consecutive count — user is active
        heartbeat.consecutiveCount = 0;
        heartbeat.isPaused = false;

        // Restart the interval to give full 15s from now
        clearInterval(heartbeat.timer);
        heartbeat.timer = setInterval(() => {
            tickHeartbeat(heartbeat);
        }, HEARTBEAT_INTERVAL_MS);
    }
}

/**
 * Core heartbeat tick — runs every 15 seconds.
 * Decides if we should trigger autonomous dialogue.
 */
async function tickHeartbeat(heartbeat) {
    const { sessionId, isPaused, isProcessing, consecutiveCount } = heartbeat;

    // Skip if paused, already processing, or hit max consecutive
    if (isPaused || isProcessing || consecutiveCount >= MAX_CONSECUTIVE_AUTO) {
        return;
    }

    // Check session is still active
    try {
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session || session.status === 'completed' || session.status === 'finished') {
            console.log(`[HEARTBEAT] Session ${sessionId} is not active. Stopping heartbeat.`);
            stopHeartbeat(sessionId);
            return;
        }

        // Check if enough time has passed since last user interaction
        const timeSinceUser = Date.now() - (session.lastUserInteraction?.getTime() || 0);
        if (timeSinceUser < COOLDOWN_AFTER_USER_MS) {
            return; // User recently interacted, wait longer
        }

        // Mark as processing to prevent overlapping calls
        heartbeat.isProcessing = true;

        console.log(`[HEARTBEAT] Session ${sessionId}: Generating autonomous dialogue (turn ${consecutiveCount + 1}/${MAX_CONSECUTIVE_AUTO})`);

        // Generate autonomous dialogue
        const result = await generateAutonomousTurn(session);

        if (result) {
            heartbeat.consecutiveCount += 1;

            // Emit to all clients in this session room
            if (io) {
                io.to(`session:${sessionId}`).emit('ai-dialogue', {
                    id: Date.now(),
                    type: 'ai',
                    speaker: result.speaker,
                    speakerRole: result.speakerRole,
                    content: result.text,
                    mood: result.mood,
                    action: result.action,
                    relevantLaws: result.relevantLaws || null,
                    winProbability: session.currentWinProbability,
                    isAutonomous: true,
                    timestamp: new Date()
                });
            }
        }

    } catch (error) {
        console.error(`[HEARTBEAT] Error for session ${sessionId}:`, error.message);
    } finally {
        heartbeat.isProcessing = false;
    }
}

/**
 * Generate a single autonomous turn using the Director → Actor pipeline.
 * This is the same pipeline as user-triggered turns, but without user input.
 */
async function generateAutonomousTurn(session) {
    try {
        // Build context for the Director
        const lastEntries = session.history.slice(-6);
        const lastSpeaker = session.lastSpeaker;

        // Ask Director: "The user is silent. Who should speak next?"
        const autonomousContext = buildAutonomousContext(lastEntries, lastSpeaker, session.caseDetails);

        const directorDecision = await directCourtroomScene(
            session.history,
            session.caseDetails,
            autonomousContext, // Pass context instead of user message
            { pendingObjection: session.pendingObjection }
        );

        if (!directorDecision) {
            console.log('[HEARTBEAT] Director returned no decision');
            return null;
        }

        const speakerRole = directorDecision.nextSpeakerRole;
        const speakerName = directorDecision.speakerName;

        // Retrieve legal context for richer dialogue
        let legalContext = null;
        try {
            const lastUserMsg = session.history.filter(h => h.role === 'user').pop();
            if (lastUserMsg) {
                legalContext = await retrieveRelevantLaws(lastUserMsg.content);
            }
        } catch (ragErr) {
            // Non-fatal — continue without RAG
        }

        // Generate the actual dialogue (RL-Enhanced: Best-of-N for Prosecutor/Defense)
        const turnNumber = session.history.length + 1;
        const { response: actorResponse, rewardEntry } = await generateActorDialogueWithRL(
            speakerRole,
            speakerName,
            session.caseDetails,
            autonomousContext,
            legalContext,
            session.history,
            directorDecision.instruction || 'Continue the proceedings autonomously.',
            session.sessionId,
            turnNumber,
            { pendingObjection: session.pendingObjection }
        );

        if (!actorResponse || !actorResponse.text) {
            console.log('[HEARTBEAT] Actor returned no dialogue');
            return null;
        }

        // Log RL reward data for autonomous turns
        if (rewardEntry) {
            console.log(`🎰 [HEARTBEAT-RL] Reward=${rewardEntry.reward > 0 ? '+1' : rewardEntry.reward < 0 ? '-1' : '0'} Score=${rewardEntry.selectedScore?.toFixed(4)}`);
        }

        // Save to MongoDB with isAutonomous flag
        const aiResponse = {
            speaker: actorResponse.speaker || speakerName,
            speakerRole: actorResponse.speakerRole || speakerRole,
            text: actorResponse.text,
            mood: actorResponse.mood || 'Neutral',
            action: actorResponse.action || 'Continue'
        };

        // Save to session history
        session.history.push({
            role: 'model',
            content: actorResponse.text,
            speaker: aiResponse.speaker,
            speakerRole: aiResponse.speakerRole,
            action: aiResponse.action,
            mood: aiResponse.mood,
            relevantLaws: legalContext || null,
            isAutonomous: true,
            timestamp: new Date()
        });

        // Save reward log for autonomous turns
        if (rewardEntry) {
            if (!session.rewardLog) session.rewardLog = [];
            session.rewardLog.push({ ...rewardEntry, isAutonomous: true });
            session.markModified('rewardLog');
        }

        // Update session state
        session.lastSpeaker = {
            name: aiResponse.speaker,
            role: aiResponse.speakerRole
        };
        if (session.pendingObjection && aiResponse.speakerRole === 'Judge' && hasJudgeRulingMarkers(aiResponse.text)) {
            session.pendingObjection = false;
            console.log(`[OBJECTION_GATE] pendingObjection cleared by autonomous Judge ruling for session ${session.sessionId}`);
        }
        session.autonomousTurnCount += 1;
        session.markModified('history');
        await session.save();

        console.log(`[HEARTBEAT] Generated: ${aiResponse.speakerRole} (${aiResponse.speaker}) — "${actorResponse.text.substring(0, 80)}..."`);

        return {
            ...aiResponse,
            relevantLaws: legalContext
        };

    } catch (error) {
        console.error('[HEARTBEAT] Autonomous turn generation error:', error.message);
        return null;
    }
}

/**
 * Build contextual prompt for autonomous Director decisions.
 * Tells the Director that the user is silent and an AI persona should continue.
 */
function buildAutonomousContext(lastEntries, lastSpeaker, caseDetails) {
    const lastRole = lastSpeaker?.role || 'Unknown';
    const lastContent = lastEntries.length > 0
        ? lastEntries[lastEntries.length - 1].content?.substring(0, 200)
        : 'No recent dialogue';

    // Build natural continuation hints based on who spoke last
    let hint = '';
    switch (lastRole) {
        case 'Prosecutor':
        case 'Opponent':
            hint = 'The Prosecutor just finished. If they asked a question, the Witness must answer. If not, the Judge should prompt the Defense to respond or move the trial forward.';
            break;
        case 'DefenseAttorney':
            hint = 'The Defense just finished. The Judge should prompt the next step (e.g., asking the prosecution for their witness or cross-examination).';
            break;
        case 'Witness':
            hint = 'The Witness just finished answering. Either the examining attorney should follow up, or the Judge should thank the witness and ask for the next stage.';
            break;
        case 'Judge':
            hint = 'The Judge just made a direction. The appropriate counsel (Prosecutor or Defense) should now follow that direction immediately.';
            break;
        case 'Clerk':
            hint = 'The Clerk just called the court to order or introduced a witness. The Judge should now take over and direct the witness or counsel.';
            break;
        default:
            hint = 'The courtroom is silent. The Judge should speak to prompt the appropriate counsel or witness to proceed, ensuring the trial does not stall.';
    }

    return `[AUTONOMOUS MODE - CONTINUOUS COURTROOM]
The user (${caseDetails?.userRole || 'Defense'} Counsel) is observing or preparing their next move. 
${hint}
CRITICAL INSTRUCTION: You must keep the trial moving forward without inventing objections. Do not wait for the user. Proceed to the next logical step in the trial (e.g., ask the next question, prompt counsel, make procedural direction, or continue testimony).
Last speaker was ${lastRole}. Recent context: "${lastContent}"`;
}

/**
 * Handle "OBJECTION!" from the user.
 * Pauses heartbeat, generates immediate Judge ruling, then resumes.
 */
export async function handleObjection(sessionId, objectionText) {
    const heartbeat = activeHeartbeats.get(sessionId);

    // Pause the heartbeat during objection handling
    if (heartbeat) {
        heartbeat.isPaused = true;
        heartbeat.isProcessing = true;
    }

    try {
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) return null;
        if (session.pendingObjection) {
            console.log(`[OBJECTION_GATE] Duplicate socket objection ignored for session ${sessionId}`);
            return null;
        }
        session.pendingObjection = true;
        console.log(`[OBJECTION_GATE] pendingObjection=true (socket-trigger) for session ${sessionId}`);

        // Save the user's objection
        session.history.push({
            role: 'user',
            content: `OBJECTION! ${objectionText}`,
            timestamp: new Date(),
            isAutonomous: false
        });
        session.lastUserInteraction = new Date();

        // Generate Judge's ruling on the objection
        const judgeResponse = await generateActorDialogue(
            'Judge',
            'Judge Dissanayake',
            session.caseDetails,
            `OBJECTION! ${objectionText}`,
            null,
            session.history,
            'The user has raised an objection! You must immediately rule on it. Say "Sustained" if the objection has legal merit, or "Overruled" if it does not. Briefly explain your ruling.',
            '',
            { pendingObjection: true }
        );

        if (judgeResponse && judgeResponse.text) {
            // Save Judge's ruling
            session.history.push({
                role: 'model',
                content: judgeResponse.text,
                speaker: 'Judge Dissanayake',
                speakerRole: 'Judge',
                action: 'Ruling',
                mood: judgeResponse.mood || 'Stern',
                isAutonomous: false,
                timestamp: new Date()
            });

            session.lastSpeaker = { name: 'Judge Dissanayake', role: 'Judge' };
            session.pendingObjection = false;
            console.log(`[OBJECTION_GATE] pendingObjection cleared after socket ruling for session ${sessionId}`);
            session.markModified('history');
            await session.save();

            return {
                id: Date.now(),
                type: 'ai',
                speaker: 'Judge Dissanayake',
                speakerRole: 'Judge',
                content: judgeResponse.text,
                mood: judgeResponse.mood || 'Stern',
                action: 'Ruling',
                isObjectionRuling: true,
                timestamp: new Date()
            };
        }

        // Safety: if no ruling generated, clear pending objection to avoid deadlock.
        session.pendingObjection = false;
        await session.save();
        console.warn(`[OBJECTION_GATE] No Judge ruling generated; pendingObjection cleared for session ${sessionId}`);

        return null;

    } catch (error) {
        console.error('[HEARTBEAT] Objection handling error:', error.message);
        try {
            await RoleplaySession.updateOne({ sessionId }, { $set: { pendingObjection: false } });
        } catch {
            // noop
        }
        return null;
    } finally {
        // Resume heartbeat after a short delay
        if (heartbeat) {
            heartbeat.isProcessing = false;
            setTimeout(() => {
                heartbeat.isPaused = false;
                heartbeat.consecutiveCount = 0;
            }, COOLDOWN_AFTER_USER_MS);
        }
    }
}

/**
 * Get stats for all active heartbeats (for monitoring)
 */
export function getHeartbeatStats() {
    const stats = {};
    for (const [sessionId, hb] of activeHeartbeats) {
        stats[sessionId] = {
            isPaused: hb.isPaused,
            isProcessing: hb.isProcessing,
            consecutiveCount: hb.consecutiveCount
        };
    }
    return stats;
}

export default {
    initHeartbeatEngine,
    startHeartbeat,
    stopHeartbeat,
    pauseHeartbeat,
    resumeHeartbeat,
    resetIdleTimer,
    handleObjection,
    getHeartbeatStats
};
