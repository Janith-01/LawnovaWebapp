import { GoogleGenerativeAI } from '@google/generative-ai';
import TrialSession from '../models/TrialSession.js';
import RoleplaySession from '../models/RoleplaySession.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import { generateVerdict } from '../utils/aiOrchestrator.js';

/**
 * Gemini client instance (lazy-loaded)
 */
let geminiClient = null;

/**
 * Initialize Gemini client
 */
const getGeminiClient = () => {
    if (!geminiClient) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY1;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY (or GEMINI_API_KEY1) is not configured in environment variables');
        }
        geminiClient = new GoogleGenerativeAI(apiKey);
    }
    return geminiClient;
};

const parseGeminiJson = (responseText) => {
    const cleaned = (responseText || '')
        .trim()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '');
    return JSON.parse(cleaned);
};

/**
 * System prompt template for Sri Lankan legal case generation
 */
const generateSystemPrompt = (role, caseStage) => {
    return `You are an expert Sri Lankan legal case strategist and legal educator specializing in training law students. Your expertise covers:

1. Sri Lankan Criminal Law (Penal Code of Sri Lanka - Act No. 2 of 1883)
2. Sri Lankan Civil Law (Civil Procedure Code)
3. Evidence Ordinance of Sri Lanka
4. Constitution of Sri Lanka
5. Common Law principles as applied in Sri Lanka
6. Court procedures of District Courts, High Courts, Court of Appeal, and Supreme Court of Sri Lanka

TASK: Generate a realistic criminal case scenario for a mock trial roleplay.

CONTEXT:
- The student will play the role of: ${role}
- The current case stage is: ${caseStage}
- This is for educational purposes to train Sri Lankan law students

REQUIREMENTS:
1. Create an original, engaging case scenario relevant to Sri Lanka
2. Include specific facts that present clear legal issues
3. Reference relevant Sri Lankan statutes and their specific sections
4. The scenario should be appropriate for the selected case stage
5. Provide clear objectives for the student's role

RESPONSE FORMAT: You MUST respond with a valid JSON object in the following structure:
{
    "title": "Case title (e.g., The State v. [Defendant Name])",
    "facts": "Detailed description of the case facts, background, and circumstances (3-4 paragraphs)",
    "legalIssues": ["Array of specific legal issues to be resolved"],
    "goal": "Clear objective for the ${role} in this case stage",
    "relevantStatutes": [
        {
            "name": "Name of the Sri Lankan law/act",
            "sections": ["Specific sections applicable"],
            "description": "Brief description of how this statute applies"
        }
    ],
    "caseType": "Criminal",
    "difficulty": "Intermediate",
    "parties": {
        "prosecution": "The State",
        "defense": "Name of defendant and their description",
        "victim": "Name and description of victim if applicable",
        "witnesses": ["List of potential witnesses"]
    }
}

IMPORTANT: 
- Use ONLY Sri Lankan Law. Do NOT reference US, UK, or any other jurisdiction's laws.
- The facts should be detailed enough to support meaningful legal arguments.
- Include at least 2-3 relevant Sri Lankan statutes with specific sections.`;
};

/**
 * @desc    Initialize a new trial session
 * @route   POST /api/trials/init-trial
 * @access  Private
 */
export const initTrial = async (req, res) => {
    const { userId, role, caseStage } = req.body;

    // Validate required fields
    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'userId is required'
        });
    }

    if (!role || !['Lawyer', 'Opposition'].includes(role)) {
        return res.status(400).json({
            success: false,
            message: 'role is required and must be either "Lawyer" or "Opposition"'
        });
    }

    const validStages = [
        'Pre-Trial',
        'Opening Statements',
        'Prosecution Evidence',
        'Defense Evidence',
        'Cross-Examination',
        'Closing Arguments',
        'Verdict',
        'Full Trial'
    ];

    if (!caseStage || !validStages.includes(caseStage)) {
        return res.status(400).json({
            success: false,
            message: `caseStage is required and must be one of: ${validStages.join(', ')}`
        });
    }

    try {
        logger.info({ userId, role, caseStage }, 'Initializing new trial session');

        // Generate system prompt
        const systemPrompt = generateSystemPrompt(role, caseStage);

        // Get Gemini model
        const gemini = getGeminiClient();
        const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
        const generationModel = gemini.getGenerativeModel(
            { model },
            { apiVersion: 'v1' }
        );

        logger.info({ model }, 'Calling Gemini API for scenario generation');

        // Call Gemini API with JSON output
        const completion = await generationModel.generateContent({
            contents: [{
                role: 'user',
                parts: [{
                    text: `${systemPrompt}\n\nGenerate a ${caseStage} stage case scenario for a ${role} in a Sri Lankan criminal trial. Make it challenging but educational for law students. Return JSON only.`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
                responseMimeType: 'application/json'
            }
        });

        // Parse the generated scenario
        const generatedContent = completion.response.text();
        let scenario;

        try {
            scenario = parseGeminiJson(generatedContent);
        } catch (parseError) {
            logger.error({ error: parseError, content: generatedContent }, 'Failed to parse Gemini response');
            return res.status(500).json({
                success: false,
                message: 'Failed to parse AI-generated scenario',
                error: 'Invalid JSON response from AI'
            });
        }

        // Validate required scenario fields
        if (!scenario.title || !scenario.facts || !scenario.legalIssues || !scenario.goal) {
            logger.error({ scenario }, 'Incomplete scenario generated');
            return res.status(500).json({
                success: false,
                message: 'AI generated an incomplete scenario',
                error: 'Missing required fields in scenario'
            });
        }

        // Ensure legalIssues is an array
        if (!Array.isArray(scenario.legalIssues)) {
            scenario.legalIssues = [scenario.legalIssues];
        }

        // Set default values for optional fields
        scenario.jurisdiction = 'Sri Lanka';
        scenario.caseType = scenario.caseType || 'Criminal';
        scenario.difficulty = scenario.difficulty || 'Intermediate';

        // Create new trial session
        const trialSession = new TrialSession({
            userId,
            role,
            caseStage,
            status: 'Active',
            scenario: {
                title: scenario.title,
                facts: scenario.facts,
                legalIssues: scenario.legalIssues,
                goal: scenario.goal,
                relevantStatutes: scenario.relevantStatutes || [],
                jurisdiction: scenario.jurisdiction,
                caseType: scenario.caseType,
                difficulty: scenario.difficulty,
                parties: scenario.parties || {
                    prosecution: 'The State',
                    defense: '',
                    victim: '',
                    witnesses: []
                }
            },
            dayCount: 3, // Default 3-day trial
            currentDay: 1,
            dayProgress: [{
                dayNumber: 1,
                stage: 'Opening',
                startedAt: new Date()
            }],
            transcript: [{
                role: 'System',
                content: `Trial session initialized. You are playing as ${role} in the case: ${scenario.title}. Current stage: ${caseStage}.`,
                timestamp: new Date()
            }],
            aiConfig: {
                model: model,
                temperature: 0.7,
                maxTokens: 2000
            }
        });

        // Save to database
        await trialSession.save();

        logger.info({
            sessionId: trialSession._id,
            scenario: scenario.title
        }, 'Trial session created successfully');

        // Return response
        return res.status(201).json({
            success: true,
            message: 'Trial session initialized successfully',
            data: {
                sessionId: trialSession._id,
                scenario: {
                    title: scenario.title,
                    facts: scenario.facts,
                    legalIssues: scenario.legalIssues,
                    goal: scenario.goal,
                    relevantStatutes: scenario.relevantStatutes,
                    caseType: scenario.caseType,
                    difficulty: scenario.difficulty,
                    parties: scenario.parties
                },
                session: {
                    role: trialSession.role,
                    caseStage: trialSession.caseStage,
                    status: trialSession.status,
                    dayCount: trialSession.dayCount,
                    currentDay: trialSession.currentDay,
                    createdAt: trialSession.createdAt
                }
            }
        });

    } catch (error) {
        logger.error({ error: error.message, stack: error.stack }, 'Failed to initialize trial');

        // Handle specific Gemini errors
        const errorText = `${error.code || ''} ${error.message || ''}`;
        if (/RESOURCE_EXHAUSTED|quota|429/i.test(errorText)) {
            return res.status(503).json({
                success: false,
                message: 'Gemini API quota exceeded. Please try again later.',
                error: 'API quota exceeded'
            });
        }

        if (/api key|invalid|permission/i.test(errorText)) {
            return res.status(500).json({
                success: false,
                message: 'Gemini API configuration error',
                error: 'Invalid API key'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to initialize trial session',
            error: error.message
        });
    }
};

/**
 * @desc    Get trial session by ID
 * @route   GET /api/trials/:sessionId
 * @access  Private
 */
export const getTrialSession = async (req, res) => {
    const { sessionId } = req.params;

    try {
        const session = await TrialSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Trial session not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: session
        });

    } catch (error) {
        logger.error({ error: error.message, sessionId }, 'Failed to get trial session');
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve trial session',
            error: error.message
        });
    }
};

/**
 * @desc    Get all trial sessions for a user
 * @route   GET /api/trials/user/:userId
 * @access  Private
 */
export const getUserTrials = async (req, res) => {
    const { userId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    try {
        const query = { userId };
        if (status) {
            query.status = status;
        }

        const sessions = await TrialSession.find(query)
            .sort({ lastActivityAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .select('-transcript'); // Exclude transcript for list view

        const total = await TrialSession.countDocuments(query);

        return res.status(200).json({
            success: true,
            data: {
                sessions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        logger.error({ error: error.message, userId }, 'Failed to get user trials');
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve user trials',
            error: error.message
        });
    }
};

/**
 * @desc    Get user trial statistics
 * @route   GET /api/trials/user/:userId/stats
 * @access  Private
 */
export const getUserStats = async (req, res) => {
    const { userId } = req.params;

    try {
        const stats = await TrialSession.getUserStats(userId);

        return res.status(200).json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error({ error: error.message, userId }, 'Failed to get user stats');
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve user statistics',
            error: error.message
        });
    }
};

/**
 * @desc    Add message to trial transcript
 * @route   POST /api/trials/:sessionId/message
 * @access  Private
 */
export const addMessage = async (req, res) => {
    const { sessionId } = req.params;
    const { role, content } = req.body;

    if (!role || !content) {
        return res.status(400).json({
            success: false,
            message: 'role and content are required'
        });
    }

    try {
        const session = await TrialSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Trial session not found'
            });
        }

        if (session.status !== 'Active') {
            return res.status(400).json({
                success: false,
                message: 'Cannot add messages to a non-active session'
            });
        }

        await session.addTranscriptEntry(role, content);

        return res.status(200).json({
            success: true,
            message: 'Message added to transcript',
            data: {
                messageCount: session.transcript.length,
                lastActivityAt: session.lastActivityAt
            }
        });

    } catch (error) {
        logger.error({ error: error.message, sessionId }, 'Failed to add message');
        return res.status(500).json({
            success: false,
            message: 'Failed to add message',
            error: error.message
        });
    }
};

/**
 * @desc    Complete a trial session
 * @route   POST /api/trials/:sessionId/complete
 * @access  Private
 */
export const completeSession = async (req, res) => {
    const { sessionId } = req.params;
    const { performance } = req.body;

    try {
        const session = await TrialSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Trial session not found'
            });
        }

        if (session.status === 'Completed') {
            return res.status(400).json({
                success: false,
                message: 'Session is already completed'
            });
        }

        await session.completeSession(performance || {});

        return res.status(200).json({
            success: true,
            message: 'Trial session completed',
            data: {
                sessionId: session._id,
                status: session.status,
                completedAt: session.completedAt,
                totalDuration: session.totalDuration,
                performance: session.performance
            }
        });

    } catch (error) {
        logger.error({ error: error.message, sessionId }, 'Failed to complete session');
        return res.status(500).json({
            success: false,
            message: 'Failed to complete session',
            error: error.message
        });
    }
};

/**
 * @desc    Advance to next trial day
 * @route   POST /api/trials/:sessionId/advance-day
 * @access  Private
 */
export const advanceDay = async (req, res) => {
    const { sessionId } = req.params;

    try {
        const session = await TrialSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Trial session not found'
            });
        }

        if (session.status !== 'Active') {
            return res.status(400).json({
                success: false,
                message: 'Cannot advance day on a non-active session'
            });
        }

        if (session.currentDay >= session.dayCount) {
            return res.status(400).json({
                success: false,
                message: 'Already at the final day of the trial'
            });
        }

        await session.advanceDay();

        // Add system message for day advancement
        await session.addTranscriptEntry(
            'System',
            `Day ${session.currentDay} of the trial has begun.`
        );

        return res.status(200).json({
            success: true,
            message: `Advanced to Day ${session.currentDay}`,
            data: {
                currentDay: session.currentDay,
                dayCount: session.dayCount,
                dayProgress: session.dayProgress
            }
        });

    } catch (error) {
        logger.error({ error: error.message, sessionId }, 'Failed to advance day');
        return res.status(500).json({
            success: false,
            message: 'Failed to advance day',
            error: error.message
        });
    }
};

/**
 * @desc    Finalize a trial by auditing user arguments
 * @route   POST /api/trials/:sessionId/finalize
 * @access  Private
 */
export const finalizeTrial = async (req, res) => {
    const { sessionId } = req.params;

    try {
        // 1. Fetch the complete history from the RoleplaySession MongoDB.
        const session = await RoleplaySession.findOne({ sessionId: sessionId });
        if (!session) {
            return res.status(404).json({ success: false, message: 'RoleplaySession not found' });
        }

        // 2. Send the user's segments to the Python Audit Service.
        let auditReport = [];
        let auditServiceStatus = 'online';

        try {
            console.log(`[FINALIZE] Session ${sessionId}: Auditing ${session.history.length} items via Python Audit Service (Port 5009)...`);
            const auditBaseUrl = process.env.AUDIT_SERVICE_URL || 'http://argument-audit-service:5001';
            const auditUrl = `${auditBaseUrl}/api/audit-transcript`;

            // WAIT for Python service to finish (up to 2 minutes)
            const auditResponse = await axios.post(auditUrl, {
                history: session.history
            }, {
                timeout: 120000,
                validateStatus: (status) => status < 500 // Don't throw for 4xx
            });

            const auditOk =
                auditResponse?.data?.success === true ||
                auditResponse?.data?.status === 'success';

            if (auditOk) {
                const results = Array.isArray(auditResponse.data.results) ? auditResponse.data.results : [];
                results.forEach((r) => {
                    auditReport.push({
                        originalText: r.argument,
                        score: r.score,
                        verdict: r.verdict,
                        reason: r.auditor_comment
                    });
                });
                console.log(`[FINALIZE] Audit successful: ${auditReport.length} results received.`);
            } else {
                throw new Error(auditResponse?.data?.message || auditResponse?.data?.error || 'Audit failed');
            }
        } catch (auditError) {
            console.error(`[FINALIZE] Audit Service Error: ${auditError.message}`);
            // If the service is down (ECONNREFUSED) or timed out
            if (auditError.code === 'ECONNREFUSED' || auditError.code === 'ETIMEDOUT') {
                return res.status(503).json({
                    success: false,
                    message: "Legal Brain is offline"
                });
            }
            // For other non-fatal errors, we might continue or return error
            // Request says: "If Port 5009 is down, return a clean JSON error"
            return res.status(500).json({
                success: false,
                message: "Legal Brain is offline",
                details: auditError.message
            });
        }


        // 3.5 Generate FINAL VERDICT using AI Orchestrator
        let verdict_data = null;
        try {
            console.log(`[FINALIZE] Session ${sessionId}: Generating final verdict based on 3-day transcript...`);
            verdict_data = await generateVerdict(session.history, session.caseDetails);
        } catch (verdictError) {
            console.error(`[FINALIZE] Verdict Generation Error (Non-fatal): ${verdictError.message}`);
        }

        // 4. Update the session status to 'COMPLETED' and save the results
        await RoleplaySession.updateOne(
            { sessionId: sessionId },
            {
                $set: {
                    status: 'finished',
                    auditReport: auditReport,
                    'verdict.verdict_data': verdict_data,
                    'verdict.outcome': verdict_data?.outcome || 'Not Guilty',
                    'verdict.summary': verdict_data?.reasoning || 'Trial ended early.'
                }
            }
        );

        // 5. Redirect the frontend to the /results/:sessionId page
        // But first, check if we were in maintenance mode
        if (auditServiceStatus === 'maintenance') {
            return res.status(200).json({
                success: true,
                status: 'maintenance',
                message: 'Audit report is currently unavailable (System Maintenance). Judgment was generated without deep audit.',
                redirectUrl: `/results/${sessionId}`,
                data: {
                    auditReport: [],
                    isMaintenance: true
                }
            });
        }

        return res.status(200).json({
            success: true,
            status: 'success',
            message: 'Trial finalized successfully',
            redirectUrl: `/results/${sessionId}`,
            data: {
                auditReport,
                status: session.status
            }
        });

    } catch (error) {
        logger.error({ error: error.message, sessionId }, 'Failed to finalize trial');
        return res.status(500).json({
            success: false,
            message: 'Failed to finalize trial',
            error: error.message
        });
    }
};

export default {
    initTrial,
    getTrialSession,
    getUserTrials,
    getUserStats,
    addMessage,
    completeSession,
    advanceDay,
    finalizeTrial
};
