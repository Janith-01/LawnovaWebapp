import { getWinProbability } from '../utils/aiJudge.js';
import {
    generateVerdict,
    generateCaseScenario,
    directCourtroomScene,
    generateActorDialogue
} from '../utils/aiOrchestrator.js';
import { retrieveRelevantLaws } from '../utils/vectorSearch.js';
import RoleplaySession from '../models/RoleplaySession.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { findRelevantLaws } from '../services/lawService.js';

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

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest"
        });

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

        // 1. CALCULATE TIME COST
        const wordCount = message.trim().split(/\s+/).length;
        const timeCost = Math.max(wordCount / 2, 30); // Minimum 30 seconds per turn
        console.log(`⏱️ Time Cost for turn: ${timeCost}s`);

        // 2. UPDATE SESSION TIME
        session.timeElapsedCurrentDay += timeCost;
        session.timeElapsed += timeCost;

        // 3. CHECK DAY END
        if (session.timeElapsedCurrentDay >= session.timeLimitPerDay) {
            const previousDay = session.currentDay;

            // Move to Next Day
            session.currentDay += 1;
            session.timeElapsedCurrentDay = 0;

            console.log(`📅 End of Day ${previousDay} reached! Moving to Day ${session.currentDay}`);

            // Check for Game Over (exceeded max days - Trial Complete!)
            if (session.currentDay > session.maxDays) {
                console.log("⚖️ TRIAL CONCLUDED - Day 3 Complete - Generating Final Verdict...");

                // Save the user's final message
                session.addUserMessage(message);

                // Generate the final verdict with full case analysis
                const verdictData = await generateVerdict(session.history, session.caseDetails);

                // Map verdict outcome to win/lose for session finalization
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

                console.log(`✅ Verdict: ${verdictData.outcome} (${verdictData.confidence_score}% confidence)`);

                return res.json({
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
                        currentDay: session.maxDays,
                        maxDays: session.maxDays
                    }
                });
            }

            // Force Adjournment - Add the user's message first
            session.addUserMessage(message);

            // Add the adjournment as an AI response so it shows in chat
            const adjournmentMessage = {
                speaker: "Judge Dissanayake",
                speakerRole: "Judge",
                text: `*The gavel bangs loudly* Court is adjourned for Day ${previousDay}! We will reconvene tomorrow morning for Day ${session.currentDay}. All parties are dismissed.`,
                mood: "Stern",
                action: "ADJOURN"
            };
            session.addAIResponse(adjournmentMessage, session.currentWinProbability, null);

            // IMPORTANT: Save the session before responding!
            await session.save();

            return res.json({
                success: true,
                data: {
                    sessionId: session.sessionId,
                    ai_reply: adjournmentMessage.text,
                    speaker: adjournmentMessage.speaker,
                    speakerRole: adjournmentMessage.speakerRole,
                    mood: adjournmentMessage.mood,
                    action: "ADJOURN",
                    status: "active", // Keep active so they can continue playing
                    currentDay: session.currentDay, // The NEW day (e.g., 2)
                    maxDays: session.maxDays,
                    previousDay: previousDay,
                    timeRemaining: session.timeLimitPerDay // Full time for new day
                }
            });
        }

        // 4. ANALYZE & RAG
        const winProb = await getWinProbability(message);
        const legalContext = await retrieveRelevantLaws(message);

        // 5. DIRECTOR CALL
        const nextSpeaker = await directCourtroomScene(session.history, session.caseDetails, message);

        // SAFETY CHECK: Ensure we always have a valid speaker
        const speakerRole = nextSpeaker?.nextSpeakerRole || 'Judge';
        const speakerName = nextSpeaker?.speakerName || 'Judge Dissanayake';
        console.log("Director selected:", speakerRole, `(${speakerName})`);

        // 6. ACTOR CALL
        const actorResponse = await generateActorDialogue(
            speakerRole,
            speakerName,
            session.caseDetails,
            message,
            legalContext,
            session.history,
            nextSpeaker?.instruction || ''
        );

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
        await session.save();

        // 8. RESPONSE
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
                timeRemaining: session.timeLimitPerDay - session.timeElapsedCurrentDay
            }
        });

    } catch (error) {
        console.error("❌ processUserMessage Error:", error);
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

export const generateCase = async (req, res) => {
    try {
        const { difficulty, topic, userRole, userId } = req.body;
        const caseDetails = await generateCaseScenario(difficulty, topic, userRole);
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
        console.error("Generate Case Error:", error);
        res.status(500).json({ success: false, error: "Failed to generate case" });
    }
};

export const advanceDay = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await RoleplaySession.findOne({ sessionId });
        if (!session) return res.status(404).json({ success: false, error: "Session not found" });
        session.currentDay += 1;
        session.timeElapsedCurrentDay = 0;
        session.status = 'active';
        await session.save();
        res.status(200).json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: "Internal Server Error" });
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