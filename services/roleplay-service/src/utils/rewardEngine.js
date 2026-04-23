/**
 * ============================================================
 * REWARD ENGINE — Reinforcement Learning Reward Loop
 * ============================================================
 * 
 * Implements a Best-of-N (N=3) sampling policy for courtroom
 * AI agents. Generates multiple candidate responses, scores
 * them via the Dual-Model Audit Engine (Port 5009), and selects
 * the candidate with the highest Substantive Density Score.
 * 
 * Architecture:
 *   1. Multi-Candidate Generation: Actor generates 3 candidates
 *   2. Reward Function: Each candidate is scored by the Audit Engine
 *   3. Policy Selection: Highest-scoring candidate is chosen
 *   4. Feedback Loop: Scores are logged and used to dynamically
 *      adjust the Agent's system prompt for future turns
 * 
 * ============================================================
 */

import axios from 'axios';

// --- Configuration ---
const AUDIT_BASE_URL = process.env.AUDIT_SERVICE_URL || 'http://argument-audit-service:5001';
const AUDIT_ENGINE_URL = `${AUDIT_BASE_URL}/api/audit-transcript`;
const NUM_CANDIDATES = 3;
const REWARD_HISTORY_WINDOW = 5;  // Track last N reward scores for prompt adjustment

// Reward thresholds
const REWARD_POSITIVE_THRESHOLD = 0.7;   // Score > 0.7 → Reward +1
const REWARD_NEGATIVE_THRESHOLD = 0.4;   // Score < 0.4 → Reward -1

/**
 * Per-session reward log — tracks the RL reward signal for each turn.
 * Map<sessionId, Array<{ turn, speaker, candidates, selectedIndex, reward, score }>>
 */
const rewardLogs = new Map();

/**
 * Score a single candidate argument using the Dual-Model Audit Engine (Port 5009).
 * Returns the Substantive Density Score (0.0 – 1.0).
 * 
 * @param {string} candidateText - The candidate response text
 * @returns {Promise<{score: number, label: string, status: string, reason: string}>}
 */
async function scoreCandidate(candidateText) {
    try {
        const response = await axios.post(AUDIT_ENGINE_URL, {
            history: [{ role: 'user', content: candidateText }]
        }, { timeout: 15000 });

        if (response.data?.status === 'success' && response.data.results?.length > 0) {
            const result = response.data.results[0];

            // --- Dual-Model Format (audit_engine.py on Port 5009) ---
            // Returns: evidence_density, legal_grounding, classification, auditor_comment
            if (result.evidence_density !== undefined) {
                const evidenceDensity = result.evidence_density ?? 0.5;
                const legalGrounding = result.legal_grounding ?? 0.5;

                // Composite Substantive Density Score:
                // 60% Evidence Density (Model A) + 40% Legal Grounding (Model B)
                const compositeScore = (evidenceDensity * 0.6) + (legalGrounding * 0.4);

                return {
                    score: compositeScore,
                    label: result.classification ?? 'Unknown',
                    status: compositeScore >= REWARD_POSITIVE_THRESHOLD ? 'Strong' : compositeScore <= REWARD_NEGATIVE_THRESHOLD ? 'Weak' : 'Moderate',
                    reason: result.auditor_comment ?? 'No reasoning provided',
                    raw: { evidenceDensity, legalGrounding }
                };
            }

            // --- Single-Model Fallback Format (app.py legacy) ---
            // Returns: score, label, status, reason
            return {
                score: result.score ?? 0.5,
                label: result.label ?? 'Unknown',
                status: result.status ?? 'Scored',
                reason: result.reason ?? 'No reasoning provided'
            };
        }

        // Fallback: Audit engine returned no results (e.g. message too short)
        return { score: 0.5, label: 'Unknown', status: 'Unscored', reason: 'No audit data returned' };

    } catch (error) {
        console.error(`[REWARD] Audit Engine error: ${error.message}`);
        // Graceful degradation: return neutral score so pipeline continues
        return { score: 0.5, label: 'Fallback', status: 'Error', reason: `Audit unavailable: ${error.message}` };
    }
}

/**
 * Compute the discrete RL reward signal from a continuous score.
 * 
 * @param {number} score - The Substantive Density Score (0.0 – 1.0)
 * @returns {number} - Reward: +1 (strong), 0 (neutral), -1 (weak)
 */
function computeReward(score) {
    if (score >= REWARD_POSITIVE_THRESHOLD) return +1;
    if (score <= REWARD_NEGATIVE_THRESHOLD) return -1;
    return 0;
}

/**
 * Get the reward history for a session.
 * @param {string} sessionId
 * @returns {Array}
 */
function getRewardLog(sessionId) {
    if (!rewardLogs.has(sessionId)) {
        rewardLogs.set(sessionId, []);
    }
    return rewardLogs.get(sessionId);
}

/**
 * Log a reward entry for a session turn.
 */
function logReward(sessionId, entry) {
    const log = getRewardLog(sessionId);
    log.push({
        ...entry,
        timestamp: new Date().toISOString()
    });
    // Keep only the most recent entries to prevent memory bloat
    if (log.length > 50) {
        log.splice(0, log.length - 50);
    }
}

/**
 * Generate a dynamic system prompt adjustment based on recent reward history.
 * This implements the Feedback Loop — telling the Agent how its recent
 * arguments performed and what to improve.
 * 
 * @param {string} sessionId - The session ID
 * @param {string} speakerRole - The role of the speaker (Prosecutor, DefenseAttorney, etc.)
 * @returns {string} - A prompt fragment to inject into the Actor's system prompt
 */
export function generatePromptAdjustment(sessionId, speakerRole) {
    const log = getRewardLog(sessionId);
    
    if (log.length === 0) {
        return ''; // No history yet — no adjustment needed
    }

    // Filter to this speaker's recent entries
    const speakerEntries = log
        .filter(e => e.speakerRole === speakerRole)
        .slice(-REWARD_HISTORY_WINDOW);

    if (speakerEntries.length === 0) {
        return '';
    }

    // Compute statistics
    const rewards = speakerEntries.map(e => e.reward);
    const scores = speakerEntries.map(e => e.selectedScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const weakCount = rewards.filter(r => r === -1).length;
    const strongCount = rewards.filter(r => r === +1).length;

    // Build adaptive instructions
    const lines = [];

    lines.push(`\n--- ⚡ PERFORMANCE FEEDBACK (Last ${speakerEntries.length} turns) ---`);
    lines.push(`Average Substantive Density: ${(avgScore * 100).toFixed(1)}%`);
    lines.push(`Strong arguments: ${strongCount}/${speakerEntries.length} | Weak arguments: ${weakCount}/${speakerEntries.length}`);

    if (weakCount >= 2) {
        lines.push(`⚠️ WARNING: Your last ${weakCount} arguments were rated WEAK by the Legal Audit Engine.`);
        lines.push(`ACTION REQUIRED: Increase usage of Section-based citations from the Sri Lankan Penal Code.`);
        lines.push(`Use IRAC structure (Issue → Rule → Application → Conclusion) in every response.`);
        lines.push(`Reference specific case facts, dates, and witness names to boost evidentiary density.`);
    } else if (weakCount === 1) {
        lines.push(`📉 One recent argument was weak. Ensure every claim is backed by a specific law section or case fact.`);
    }

    if (strongCount >= 3) {
        lines.push(`✅ EXCELLENT: Your argument strategy is highly effective. Maintain the current citation density.`);
    } else if (strongCount >= 1 && weakCount === 0) {
        lines.push(`👍 GOOD: Arguments are substantive. Continue citing specific Penal Code sections and evidence.`);
    }

    // Show recent labels (Law vs Fact classification)
    const recentLabels = speakerEntries.map(e => e.selectedLabel).filter(Boolean);
    if (recentLabels.length > 0) {
        const lawCount = recentLabels.filter(l => l === 'Law').length;
        const factCount = recentLabels.filter(l => l === 'Fact').length;
        if (factCount > lawCount * 2) {
            lines.push(`📊 Your arguments lean heavily toward FACTUAL assertions. Balance with statutory citations (Section references).`);
        } else if (lawCount > factCount * 2) {
            lines.push(`📊 Your arguments lean heavily toward LEGAL citations. Ground them with specific case facts and witness testimony.`);
        }
    }

    return lines.join('\n');
}

/**
 * CORE RL FUNCTION: Best-of-N Policy Selection
 * 
 * Generates N candidate responses from the Actor, scores each via the
 * Audit Engine, and selects the one with the highest Substantive Density Score.
 * 
 * @param {Function} generateFn - The Actor generation function (called N times)
 * @param {string} sessionId - Session ID for reward logging
 * @param {string} speakerRole - Role of the speaking agent
 * @param {number} turnNumber - Current turn number
 * @returns {Promise<{selected: Object, candidates: Array, rewardEntry: Object}>}
 */
export async function bestOfNSelection(generateFn, sessionId, speakerRole, turnNumber) {
    console.log(`\n🎰 [REWARD ENGINE] Best-of-${NUM_CANDIDATES} selection for ${speakerRole} (Turn ${turnNumber})`);

    // --- Step 1: Multi-Candidate Generation ---
    const candidatePromises = [];
    for (let i = 0; i < NUM_CANDIDATES; i++) {
        candidatePromises.push(
            generateFn().catch(err => {
                console.error(`[REWARD] Candidate ${i + 1} generation failed: ${err.message}`);
                return null;
            })
        );
    }

    const rawCandidates = await Promise.all(candidatePromises);
    const candidates = rawCandidates.filter(c => c !== null && c?.text);

    if (candidates.length === 0) {
        console.error('[REWARD] All candidates failed to generate. No selection possible.');
        return null;
    }

    console.log(`[REWARD] Generated ${candidates.length}/${NUM_CANDIDATES} valid candidates`);

    // --- Step 2: Reward Function — Score each candidate via Dual-Model Audit Engine (Port 5009) ---
    const scoredCandidates = await Promise.all(
        candidates.map(async (candidate, idx) => {
            const auditResult = await scoreCandidate(candidate.text);
            const rawInfo = auditResult.raw ? ` [ED=${auditResult.raw.evidenceDensity.toFixed(3)} LG=${auditResult.raw.legalGrounding.toFixed(3)}]` : '';
            console.log(`  Candidate ${idx + 1}: score=${auditResult.score.toFixed(4)} label=${auditResult.label}${rawInfo} | "${candidate.text.substring(0, 60)}..."`);
            return {
                ...candidate,
                auditScore: auditResult.score,
                auditLabel: auditResult.label,
                auditStatus: auditResult.status,
                auditReason: auditResult.reason,
                auditRaw: auditResult.raw || null,
                reward: computeReward(auditResult.score)
            };
        })
    );

    // --- Step 3: Policy Selection — Pick highest Substantive Density Score ---
    scoredCandidates.sort((a, b) => b.auditScore - a.auditScore);
    const selected = scoredCandidates[0];
    const rejected = scoredCandidates.slice(1);

    const rewardSymbol = selected.reward > 0 ? '+1' : selected.reward < 0 ? '-1' : '0';
    console.log(`[REWARD] ✅ Selected Candidate: score=${selected.auditScore.toFixed(4)} reward=${rewardSymbol} label=${selected.auditLabel}`);
    if (rejected.length > 0) {
        console.log(`[REWARD]    Rejected: ${rejected.map(c => c.auditScore.toFixed(4)).join(', ')}`);
    }

    // --- Step 4: Feedback Loop — Log the reward for prompt adjustment ---
    const rewardEntry = {
        turn: turnNumber,
        speakerRole: speakerRole,
        speaker: selected.speaker,
        candidateCount: candidates.length,
        allScores: scoredCandidates.map(c => ({
            score: c.auditScore,
            label: c.auditLabel,
            reward: c.reward,
            reason: c.auditReason,
            rawScores: c.auditRaw || null,
            textPreview: c.text.substring(0, 80)
        })),
        selectedScore: selected.auditScore,
        selectedLabel: selected.auditLabel,
        selectedReason: selected.auditReason,
        selectedRaw: selected.auditRaw || null,
        selectedReward: selected.reward,
        reward: selected.reward,
        scoreDelta: rejected.length > 0
            ? +(selected.auditScore - rejected[0].auditScore).toFixed(4)
            : 0
    };

    logReward(sessionId, rewardEntry);

    return {
        selected,
        candidates: scoredCandidates,
        rewardEntry
    };
}

/**
 * Check if a speaker role should use the RL reward loop.
 * Only Prosecutor and DefenseAttorney generate substantive legal arguments
 * that benefit from Best-of-N selection. Judge, Witness, and Clerk are excluded.
 * 
 * @param {string} speakerRole
 * @returns {boolean}
 */
export function shouldUseRewardLoop(speakerRole) {
    const RL_ELIGIBLE_ROLES = ['Prosecutor', 'DefenseAttorney'];
    return RL_ELIGIBLE_ROLES.includes(speakerRole);
}

/**
 * Get the full reward log for a session (for debugging/analytics).
 * @param {string} sessionId
 * @returns {Array}
 */
export function getSessionRewardLog(sessionId) {
    return getRewardLog(sessionId);
}

/**
 * Get summary statistics for a session's reward history.
 * @param {string} sessionId
 * @returns {Object}
 */
export function getRewardStats(sessionId) {
    const log = getRewardLog(sessionId);
    if (log.length === 0) {
        return { totalTurns: 0, avgScore: 0, totalReward: 0, strongCount: 0, weakCount: 0 };
    }

    const scores = log.map(e => e.selectedScore);
    const rewards = log.map(e => e.reward);

    return {
        totalTurns: log.length,
        avgScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4),
        totalReward: rewards.reduce((a, b) => a + b, 0),
        strongCount: rewards.filter(r => r === +1).length,
        weakCount: rewards.filter(r => r === -1).length,
        neutralCount: rewards.filter(r => r === 0).length,
        recentTrend: rewards.slice(-5)
    };
}

/**
 * Clear reward log for a session (e.g., when session ends).
 * @param {string} sessionId
 */
export function clearRewardLog(sessionId) {
    rewardLogs.delete(sessionId);
}

export default {
    bestOfNSelection,
    shouldUseRewardLoop,
    generatePromptAdjustment,
    getSessionRewardLog,
    getRewardStats,
    clearRewardLog
};
