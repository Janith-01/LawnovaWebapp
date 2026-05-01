import axios from 'axios';
import { getWinProbability } from '../utils/aiJudge.js';
import {
    generateVerdict,
    generateCaseScenario,
    directCourtroomScene,
    generateActorDialogue,
    generateActorDialogueWithRL
} from '../utils/aiOrchestrator.js';
import { getRewardStats } from '../utils/rewardEngine.js';
import { retrieveRelevantLaws } from '../utils/vectorSearch.js';
import RoleplaySession from '../models/RoleplaySession.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { findRelevantLaws } from '../services/lawService.js';

const isExplicitObjectionText = (text = '') =>
    /^(objection\b|objection,\s*your honou?r\b|i object\b)/i.test((text || '').trim());

const hasJudgeRulingMarkers = (text = '') => /\b(sustained|overruled)\b/i.test(text);

// ============================================================
// 1. AI LEGAL CONSULTANT (The Fixed "Bulletproof" Version)
// ============================================================
export const consultLaw = async (req, res) => {
    console.log("\n--- ⚖️  CONSULT LAW REQUEST RECEIVED ---");

    // 1. Declare variable OUTSIDE the try block so it survives errors
    let lawContext = null;

    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        const { query } = req.body;

        if (!query) return res.status(400).json({ error: "Query is required" });

        // 2. Search DB (Wrapped to prevent crash)
        try {
            console.log("🔍 Searching database...");
            lawContext = await findRelevantLaws(query);
            console.log(lawContext ? "✅ Laws found." : "⚠️ No specific laws found.");
        } catch (dbError) {
            console.error("⚠️ DB Error (Non-fatal):", dbError.message);
            lawContext = "Error retrieving laws. Proceeding with general knowledge.";
        }

        // 3. AI Generation
        console.log("🤖 Generating Answer with Gemini 2.0...");

        // Check API Key before trying to use it
        if (!apiKey) throw new Error("API Key not found in .env");

<<<<<<< Updated upstream
=======
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
>>>>>>> Stashed changes
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest"
        }, { apiVersion: "v1beta" });

        const prompt = `
        You are a Sri Lankan Legal Assistant.
        CONTEXT: ${lawContext || "No specific section found."}
        QUESTION: "${query}"
        ANSWER (Cite sections if available):
        `;

        const result = await model.generateContent(prompt);
        const answer = result.response.text();

        console.log("✅ Success!");
        res.json({
            success: true,
            answer: answer,
            source_docs: lawContext
        });

    } catch (error) {
        console.error("❌ FINAL ERROR:", error.message);

        // 4. Safe Fallback Response
        // Since lawContext is declared at the top, this will now WORK instead of crashing
        res.json({
            success: true,
            answer: `**[System Notice]** AI is busy (Rate Limit Reached). Please wait 60 seconds.\n\nHere are the laws I found internally:\n\n${lawContext || "No laws retrieved."}`,
            source_docs: lawContext
        });
    }
};

// ============================================================
// 2. MAIN GAME LOOP (Director Agent Pipeline)
// ============================================================
export const processUserMessage = async (req, res) => {
    try {
        const { message, sessionId } = req.body;

        if (!message || !sessionId) {
            return res.status(400).json({ success: false, error: "Message and SessionID are required" });
        }

        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }

        const explicitObjection = isExplicitObjectionText(message);
        if (explicitObjection && session.pendingObjection) {
            console.log(`[OBJECTION_GATE] Duplicate objection ignored for session ${sessionId}`);
        } else if (explicitObjection) {
            session.pendingObjection = true;
            console.log(`[OBJECTION_GATE] pendingObjection=true (text-trigger) for session ${sessionId}`);
        }

        // Update last user interaction timestamp for heartbeat engine
        session.lastUserInteraction = new Date();

        // Pause the heartbeat engine so it doesn't interrupt while we process
        const io = req.app.get('io');
        if (io) {
            io.to(`session:${sessionId}`).emit('heartbeat-reset');
            try {
                const { pauseHeartbeat } = await import('../engines/courtroomHeartbeat.js');
                pauseHeartbeat(sessionId);
            } catch (e) { /* silent */ }
        }

        // 4. ANALYZE & RAG
        const winProb = await getWinProbability(message);
        const legalContext = await retrieveRelevantLaws(message);

        // 5. DIRECTOR CALL
        const nextSpeaker = await directCourtroomScene(
            session.history,
            session.caseDetails,
            message,
            { pendingObjection: session.pendingObjection }
        );

        // SAFETY CHECK: Ensure we always have a valid speaker
        const speakerRole = nextSpeaker?.nextSpeakerRole || 'Judge';
        const speakerName = nextSpeaker?.speakerName || 'Judge Dissanayake';
        console.log(`[TURN] session=${sessionId} pendingObjection=${session.pendingObjection} speaker=${speakerRole} (${speakerName})`);

        // 6. ACTOR CALL (RL-Enhanced: Best-of-N for Prosecutor/Defense)
        const turnNumber = session.history.filter(h => h.role === 'user').length + 1;
        const { response: actorResponse, rewardEntry } = await generateActorDialogueWithRL(
            speakerRole,
            speakerName,
            session.caseDetails,
            message,
            legalContext,
            session.history,
            nextSpeaker?.instruction || '',
            sessionId,
            turnNumber,
            { pendingObjection: session.pendingObjection }
        );

        // Log RL reward data
        if (rewardEntry) {
            console.log(`🎰 [RL] Turn ${turnNumber}: Reward=${rewardEntry.reward > 0 ? '+1' : rewardEntry.reward < 0 ? '-1' : '0'} Score=${rewardEntry.selectedScore?.toFixed(4)} (${rewardEntry.candidateCount} candidates evaluated)`);
        }

        // SAFETY CHECK: Ensure actorResponse has valid text before saving
        const safeResponse = {
            speaker: actorResponse?.speaker || speakerName,
            speakerRole: actorResponse?.speakerRole || speakerRole,
            text: actorResponse?.text || "The court requests a moment of patience. Please rephrase your statement.",
            mood: actorResponse?.mood || 'Neutral',
            action: actorResponse?.action || 'Waiting',
            icon: actorResponse?.icon || 'gavel',
            borderColor: actorResponse?.borderColor || 'gold'
        };

        // 7. SAVE STATE
        session.addUserMessage(message);
        session.addAIResponse(safeResponse, winProb, legalContext);
        session.lastUserInteraction = new Date(); // Update interaction time

        // 7.1 SAVE REWARD LOG to session (for persistence across restarts)
        if (rewardEntry) {
            if (!session.rewardLog) session.rewardLog = [];
            session.rewardLog.push(rewardEntry);
            session.markModified('rewardLog');
        }

        const shouldClearObjection =
            session.pendingObjection &&
            safeResponse.speakerRole === 'Judge' &&
            hasJudgeRulingMarkers(safeResponse.text);
        if (shouldClearObjection) {
            session.pendingObjection = false;
            console.log(`[OBJECTION_GATE] pendingObjection cleared after Judge ruling for session ${sessionId}`);
        }

        console.log(`[TURN] session=${sessionId} pendingObjection=${session.pendingObjection} rulingAllowed=${speakerRole === 'Judge' && explicitObjection ? 'true' : 'n/a'}`);
        await session.save();

        // 7.5. RESUME HEARTBEAT
        if (io) {
            try {
                const { resumeHeartbeat } = await import('../engines/courtroomHeartbeat.js');
                resumeHeartbeat(sessionId);
            } catch (e) { /* silent */ }
        }

        // 8. RESPONSE (with RL metadata)
        const rewardStats = getRewardStats(sessionId);
        res.status(200).json({
            success: true,
            data: {
                sessionId: session.sessionId,
                ai_reply: safeResponse.text,
                speaker: safeResponse.speaker,
                speakerRole: safeResponse.speakerRole,
                mood: safeResponse.mood,
                action: safeResponse.action,
                win_probability: winProb,
                relevant_laws: legalContext,
                currentDay: session.currentDay,
                // RL Reward Metadata
                rl_reward: rewardEntry ? {
                    reward: rewardEntry.reward,
                    score: rewardEntry.selectedScore,
                    label: rewardEntry.selectedLabel,
                    reason: rewardEntry.selectedReason,
                    rawScores: rewardEntry.selectedRaw || null,
                    candidatesEvaluated: rewardEntry.candidateCount,
                    scoreDelta: rewardEntry.scoreDelta || 0
                } : null,
                rl_stats: rewardStats.totalTurns > 0 ? rewardStats : null
            }
        });

    } catch (error) {
        console.error("❌ processUserMessage Error:", error);

        // Ensure heartbeat resumes if an error occurred during processing
        const io = req.app.get('io');
        if (io) {
            try {
                const { resumeHeartbeat } = await import('../engines/courtroomHeartbeat.js');
                resumeHeartbeat(sessionId);
            } catch (e) { /* silent */ }
        }

        res.status(500).json({ success: false, error: "Internal Server Error", details: error.message });
    }
};

// ============================================================
// 3. SESSION MANAGEMENT
// ============================================================

export const getSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) return res.status(404).json({ success: false, error: "Session not found" });
        res.status(200).json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};

export const createSession = async (req, res) => {
    try {
        const { userId, caseId, caseTitle, caseStage, gameMode } = req.body;
        const newSessionId = RoleplaySession.generateSessionId();
        const session = new RoleplaySession({
            sessionId: newSessionId,
            userId,
            caseId,
            caseTitle,
            caseStage,
            gameMode: gameMode || 'TimeBased',
            history: [],
            status: 'active'
        });
        await session.save();
        res.status(201).json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};

const normalizeRole = (role) => ({
    'Prosecutor': 'Prosecution',
    'Prosecution': 'Prosecution',
    'Defense': 'Defense',
    'Defense Attorney': 'Defense'
}[role] || 'Defense');

const normalizeDifficulty = (difficulty) => ({
    'Easy': 'Easy',
    'Intermediate': 'Medium',
    'Medium': 'Medium',
    'Hard': 'Hard'
}[difficulty] || 'Medium');

const toStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
};

const normalizeCaseDetailsForSchema = (rawCaseDetails, fallbackDifficulty, fallbackTopic, fallbackRole) => {
    const safeRole = normalizeRole(fallbackRole);
    const opponentSide = safeRole === 'Prosecution' ? 'Defense' : 'Prosecution';
    const input = (rawCaseDetails && typeof rawCaseDetails === 'object') ? rawCaseDetails : {};

    const witnesses = Array.isArray(input.witnesses) ? input.witnesses : [];
    const normalizedWitnesses = witnesses.map((witness, index) => {
        const w = (witness && typeof witness === 'object') ? witness : {};
        const safeName = (typeof w.name === 'string' && w.name.trim()) ? w.name.trim() : `Witness ${index + 1}`;
        const safeRoleName = (typeof w.role === 'string' && w.role.trim()) ? w.role.trim() : 'Civilian Witness';
        const safePersonality = (typeof w.personality === 'string' && w.personality.trim()) ? w.personality.trim() : 'Neutral';

        const mappedAffiliation = {
            'User': 'User',
            'Opponent': 'Opponent',
            'Neutral': 'Neutral',
            [safeRole]: 'User',
            [opponentSide]: 'Opponent',
            'Prosecutor': safeRole === 'Prosecution' ? 'User' : 'Opponent',
            'Prosecution': safeRole === 'Prosecution' ? 'User' : 'Opponent',
            'Defense': safeRole === 'Defense' ? 'User' : 'Opponent',
            'State': safeRole === 'Prosecution' ? 'User' : 'Opponent',
            'Plaintiff': safeRole === 'Prosecution' ? 'User' : 'Opponent',
            'Accused': safeRole === 'Defense' ? 'User' : 'Opponent',
            'Defendant': safeRole === 'Defense' ? 'User' : 'Opponent',
        }[w.affiliation] || 'Neutral';

        return {
            name: safeName,
            role: safeRoleName,
            personality: safePersonality,
            affiliation: mappedAffiliation
        };
    });

    if (normalizedWitnesses.length === 0) {
        normalizedWitnesses.push({
            name: 'Primary Witness',
            role: 'Civilian Witness',
            personality: 'Neutral',
            affiliation: 'Neutral'
        });
    }

    return {
        title: (typeof input.title === 'string' && input.title.trim()) ? input.title.trim() : 'State v. Unknown',
        summary: (typeof input.summary === 'string' && input.summary.trim()) ? input.summary.trim() : 'A generated legal scenario for courtroom simulation.',
        difficulty: normalizeDifficulty(input.difficulty || fallbackDifficulty),
        caseStage: (typeof input.caseStage === 'string' && input.caseStage.trim()) ? input.caseStage.trim() : 'Opening Statements',
        relevantLaw: (typeof input.relevantLaw === 'string' && input.relevantLaw.trim()) ? input.relevantLaw.trim() : 'Applicable Sri Lankan Penal Code provisions.',
        topic: (typeof input.topic === 'string' && input.topic.trim()) ? input.topic.trim() : (fallbackTopic || 'Random'),
        userRole: normalizeRole(input.userRole || fallbackRole),
        facts: toStringArray(input.facts),
        userEvidence: toStringArray(input.userEvidence),
        opponentEvidence: toStringArray(input.opponentEvidence),
        witnesses: normalizedWitnesses,
        openingHint: (typeof input.openingHint === 'string' && input.openingHint.trim())
            ? input.openingHint.trim()
            : 'Build a clear timeline and challenge unsupported assertions early.'
    };
};

export const generateCase = async (req, res) => {
    try {
        const payload = (req.body && typeof req.body === 'object') ? req.body : {};
        let { difficulty, topic, userRole, userId } = payload;

        // Normalize input for Mongoose enum validation
        const normalizedDifficulty = normalizeDifficulty(difficulty);
        const normalizedRole = normalizeRole(userRole);
        const caseDetailsRaw = await generateCaseScenario(normalizedDifficulty, topic, normalizedRole);
        const caseDetails = normalizeCaseDetailsForSchema(
            caseDetailsRaw,
            normalizedDifficulty,
            topic,
            normalizedRole
        );

        console.log("Final Normalized Case Details:", {
            title: caseDetails.title,
            difficulty: caseDetails.difficulty,
            userRole: caseDetails.userRole
        });
        const newSessionId = RoleplaySession.generateSessionId();
        const session = new RoleplaySession({
            sessionId: newSessionId,
            userId,
            caseTitle: caseDetails.title,
            caseDetails,
            status: 'active',
            gameMode: 'TimeBased'
        });
        await session.save();
        res.status(201).json({ success: true, data: session });
    } catch (error) {
        const msg = error?.message || '';
        const status = error?.status || error?.httpErrorCode?.status || null;

        // Log with enough detail to diagnose from container logs
        console.error("[GENERATE-CASE] Error:", {
            message: msg,
            status,
            name: error?.name,
            stack: error?.stack?.split('\n').slice(0, 5).join(' | ')
        });

        // Quota / rate-limit from Google AI (HTTP 429)
        if (status === 429 || msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')) {
            return res.status(429).json({
                success: false,
                error: "AI quota exceeded",
                details: "The Gemini API rate limit has been reached. Please try again in a few minutes."
            });
        }

        // Invalid model name / bad request from Google AI (HTTP 400)
        if (status === 400 || msg.includes('400') || msg.toLowerCase().includes('model') || msg.toLowerCase().includes('not found')) {
            return res.status(502).json({
                success: false,
                error: "AI model configuration error",
                details: msg
            });
        }

        // API key missing/invalid
        if (msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('api_key') || status === 401 || status === 403) {
            return res.status(502).json({
                success: false,
                error: "AI service authentication failed",
                details: "GEMINI_API_KEY is missing or invalid."
            });
        }

        // Mongoose validation error
        if (error?.name === 'ValidationError') {
            return res.status(422).json({
                success: false,
                error: "Case data validation failed",
                details: msg
            });
        }

        res.status(500).json({
            success: false,
            error: "Failed to generate case",
            details: msg
        });
    }

};

export const advanceDay = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) return res.status(404).json({ success: false, error: "Session not found" });

        if (session.status === 'completed') {
            return res.status(400).json({ success: false, error: "Trial is already completed" });
        }

        if (session.currentDay >= session.maxDays) {
            return res.status(400).json({ success: false, error: "Already at the final day of the trial" });
        }

        const previousDay = session.currentDay;
        session.currentDay += 1;
        session.timeElapsedCurrentDay = 0;
        session.status = 'active';

        // Add adjournment system message to history
        const adjournMsg = {
            speaker: "Court Clerk",
            speakerRole: "Clerk",
            text: `Court is adjourned for Day ${previousDay}. Day ${session.currentDay} of the trial now commences. All parties, please be seated.`,
            mood: "Neutral",
            action: "ADJOURN"
        };
        session.addAIResponse(adjournMsg, session.currentWinProbability, null);
        await session.save();

        console.log(`[ADVANCE-DAY] Session ${sessionId}: Day ${previousDay} -> Day ${session.currentDay}`);

        res.status(200).json({
            success: true,
            data: {
                sessionId: session.sessionId,
                currentDay: session.currentDay,
                maxDays: session.maxDays,
                timeRemaining: session.timeLimitPerDay,
                status: session.status,
                adjournMessage: adjournMsg.text
            }
        });
    } catch (error) {
        console.error("[ADVANCE-DAY] Error:", error.message);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};

// ============================================================
// 4. COMPLETE SESSION (End Trial Early + Audit + Verdict)
// ============================================================
export const completeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await RoleplaySession.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }

        if (session.status === 'completed') {
            // Return existing verdict and audit if already completed
            return res.status(200).json({
                success: true,
                data: {
                    sessionId: session.sessionId,
                    status: 'finished',
                    verdict_data: session.verdict?.verdict_data || null,
                    auditReport: session.auditReport || [],
                    currentDay: session.currentDay,
                    maxDays: session.maxDays
                }
            });
        }

        console.log(`[COMPLETE] Ending trial early for session ${sessionId} on Day ${session.currentDay}/${session.maxDays}`);

        // --- Step 1: Audit User Arguments ---
        console.log("[COMPLETE] Auditing User Arguments...");
        const auditReport = [];
        try {
            if (session.history.length > 0) {
                console.log("[COMPLETE] Auditing User Arguments via Port 5009...");
                const auditBaseUrl = process.env.AUDIT_SERVICE_URL || 'http://argument-audit-service:5001';
                const auditUrl = `${auditBaseUrl}/api/audit-transcript`;
                const auditResponse = await axios.post(auditUrl, { history: session.history }, { timeout: 120000 });

                if (auditResponse.data?.success) {
                    const results = auditResponse.data.results;
                    results.forEach((r) => {
                        auditReport.push({
                            originalText: r.argument,
                            score: r.score,
                            verdict: r.verdict,
                            reason: r.auditor_comment
                        });
                    });
                    console.log(`[COMPLETE] Dual-Model Audit completed: ${results.length} segments analyzed.`);
                } else {
                    throw new Error(auditResponse.data?.message || 'Audit failed');
                }
            }
        } catch (auditError) {
            console.error("[COMPLETE] Audit Service Error:", auditError.message);
            if (auditError.code === 'ECONNREFUSED' || auditError.code === 'ETIMEDOUT') {
                return res.status(503).json({
                    success: false,
                    message: "Legal Brain is offline"
                });
            }
            // For other errors, return the same standard message as per requirement
            return res.status(500).json({
                success: false,
                message: "Legal Brain is offline",
                details: auditError.message
            });
        }
        session.auditReport = auditReport;

        // --- Step 2: Generate Final Verdict ---
        console.log("[COMPLETE] Generating Final Verdict...");
        const verdictData = await generateVerdict(session.history, session.caseDetails);

        // Map verdict outcome to win/lose
        const sessionOutcome = verdictData.outcome === 'Guilty'
            ? (session.caseDetails?.userRole === 'Prosecution' ? 'win' : 'lose')
            : (session.caseDetails?.userRole === 'Defense' ? 'win' : 'lose');

        // Finalize the session
        session.finalize(sessionOutcome, verdictData.judge_statement);
        session.verdict = {
            outcome: sessionOutcome,
            summary: verdictData.judge_statement,
            verdict_data: verdictData
        };
        session.status = 'completed';
        await session.save();

        console.log(`[COMPLETE] Verdict: ${verdictData.outcome} (${verdictData.confidence_score}% confidence)`);

        return res.status(200).json({
            success: true,
            data: {
                sessionId: session.sessionId,
                ai_reply: verdictData.judge_statement,
                speaker: "Judge Dissanayake",
                speakerRole: "Judge",
                mood: "Authoritative",
                action: "VERDICT",
                status: "finished",
                verdict_data: verdictData,
                auditReport: auditReport,
                currentDay: session.currentDay,
                maxDays: session.maxDays
            }
        });

    } catch (error) {
        console.error("[COMPLETE] Error:", error.message);
        res.status(500).json({ success: false, error: "Failed to complete session", details: error.message });
    }
};

export const resumeSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) return res.status(404).json({ success: false, error: "Session not found" });
        session.status = 'active';
        await session.save();
        res.status(200).json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};
