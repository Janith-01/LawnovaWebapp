import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicTool } from "@langchain/core/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createToolCallingAgent, AgentExecutor } from "@langchain/classic/agents";
import dotenv from 'dotenv';
import axios from 'axios';
import transcriptIngestion from '../services/transcriptIngestionService.js';
import { cleanLegalTranscript } from '../utils/cleanLegalTranscript.js';

// Load environment variables
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('[AI Service] Gemini API Key:', apiKey ? `Loaded (${apiKey.substring(0, 15)}...)` : 'MISSING!');

// Initialize LangChain Model
const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-flash-latest",
    streaming: true,
    maxOutputTokens: 2048,
    apiVersion: "v1beta"
});

// System instruction for the Legal Agent
const SYSTEM_INSTRUCTION = `You are a Senior Sri Lankan Legal AI Agent for the LAWNOVA platform.
Your objective is to provide high-fidelity legal assistance to law students by leveraging real-time trial data and the Sri Lankan legal corpus.

Capabilities:
1. Search Law: Use the 'search_sri_lankan_law' tool to find specific statutes, sections, and case law. ALWAYS cite your sources.
2. Trial Context: Use 'get_trial_transcript' to stay informed about what's currently happening in the courtroom.

Guidelines:
- Use a smooth, conversational narrative style. Avoid robotic list-heavy formats.
- REMOVE unnecessary markdown symbols. Do NOT use headers (###). Use plain text or subtle bolding ONLY on critical terms.
- If a user asks about court procedures, ALWAYS check the latest transcript to see the context of the trial.
- When explaining laws, include section numbers naturally within the flow of the text.
- Be strictly professional and educational, providing guidance like a helpful mentor.
- Do NOT provide definitive legal advice; clarify that you are an educational resource.`;


/**
 * Test endpoint to verify Gemini connection
 * GET /ai/test
 */
export const testConnection = async (req, res) => {
    try {
        const response = await model.invoke("Reply with exactly: 'LangChain AI Agent connected successfully!'");
        const text = response.content;
        console.log('[AI Service] Test successful:', text);
        res.json({
            success: true,
            message: text,
            model: 'gemini-2.0-flash-lite-latest (via LangChain)'
        });
    } catch (error) {
        console.error('[AI Service] Test failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * LangChain Agent Execution Helper
 */
const pythonBackendUrl = process.env.PYTHON_AI_BACKEND_URL || 'http://localhost:5009';

const getAgentExecutor = (sessionId) => {
    const tools = [
        new DynamicTool({
            name: "search_sri_lankan_law",
            description: "Search for specific Sri Lankan legal acts, sections, and case law from the official database. Use this for grounding legal claims.",
            func: async (query) => {
                try {
                    const response = await axios.post(`${pythonBackendUrl}/search-legal-context`, { query });
                    return response.data.context || "No context found.";
                } catch (err) {
                    return `Error searching law: ${err.message}`;
                }
            }
        }),
        new DynamicTool({
            name: "get_current_trial_transcript",
            description: "Retrieve the latest transcript messages from the ACTIVE session. Call this to see what arguments were made during the trial.",
            func: async () => {
                try {
                    // Use the scoped sessionId from closure
                    const context = transcriptIngestion.getContext(sessionId, 40);
                    if (!context || !context.messages || context.messages.length === 0) {
                        return "No live transcript messages found for this session.";
                    }
                    return context.formatted;
                } catch (err) {
                    return `Error getting transcript: ${err.message}`;
                }
            }
        })
    ];

    const promptTemplate = ChatPromptTemplate.fromMessages([
        ["system", SYSTEM_INSTRUCTION],
        ["human", "{input}"],
        new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = createToolCallingAgent({
        llm: model,
        tools,
        prompt: promptTemplate,
    });

    return new AgentExecutor({
        agent,
        tools,
    });
};

/**
 * Non-streaming agent call for standard API requests
 * POST /ai/chat/ask
 */
export const askAgent = async (req, res) => {
    const { question, trialId, sessionId } = req.body;
    const activeSessionId = sessionId || trialId;

    console.log('[AI Service] Agent Invoke request:', question, 'Session:', activeSessionId);

    try {
        const executor = getAgentExecutor(activeSessionId);
        const result = await executor.invoke({
            input: question,
            chat_history: []
        });

        res.json({
            success: true,
            response: result.output
        });
    } catch (error) {
        console.error('[AI Service] Agent Invoke Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Stream chat completions via LangChain Agent
 * POST /ai/chat/stream
 */
export const streamChat = async (req, res) => {
    const { messages, context, sessionId, trialId } = req.body;
    const activeSessionId = sessionId || trialId;

    console.log('[AI Service] LangChain Agent request - session:', activeSessionId);

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    req.socket.setTimeout(0);

    try {
        const lastUserMessage = messages[messages.length - 1].content;
        const executor = getAgentExecutor(activeSessionId);

        const eventStream = await executor.streamEvents({
            input: lastUserMessage,
            chat_history: messages.slice(0, -1).map(m => m.role === 'assistant' ? ["assistant", m.content] : ["user", m.content])
        }, { version: "v2" });

        req.on('close', () => {
            console.log('[AI Service] Client disconnected');
            res.end();
        });

        for await (const event of eventStream) {
            const eventType = event.event;

            if (eventType === "on_chat_model_stream") {
                const chunk = event.data.chunk;
                if (chunk.content) {
                    res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
                }
            } else if (eventType === "on_tool_start") {
                // Inform frontend that agent is using a tool
                const toolName = event.name === 'search_sri_lankan_law' ? 'Legal Database' : 'Trial Transcript';
                res.write(`data: ${JSON.stringify({ type: 'thought', content: `🔍 Searching ${toolName}...` })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('[AI Service] LangChain Agent Error:', error.message);
        if (!res.headersSent) res.status(500).json({ error: error.message });
        else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }
};

/**
 * Generate Learning Materials using Gemini 2.5 Flash from the trial transcript
 * POST /ai/generate-learning
 */
export const generateLearningMaterials = async (req, res) => {
    const { sessionId, topic } = req.body;

    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
    }

    try {
        console.log(`[AI Service] Generating learning materials for session: ${sessionId}`);

        // 1. Get context (up to 50 latest messages to construct learning materials)
        const context = transcriptIngestion.getContext(sessionId, 50);

        let transcriptText = "";
        if (context && context.messages && context.messages.length > 0) {
            transcriptText = context.messages.map(m => `[${m.speakerRole}] ${m.speakerName}: ${m.text}`).join('\n');
        } else {
            // No live transcript available (mic blocked, no audio captured, etc.)
            // Fall back to generating materials from the topic alone.
            console.log(`[AI Service] No transcript found for session ${sessionId} — using topic-only generation.`);
            transcriptText = `Mock trial session on the topic: ${topic || 'General Legal Practice'}. No live transcript was captured during this session.`;
        }

        // 2. Delegate to Python Backend for RAG and specialized generation
        const generateUrl = `${pythonBackendUrl}/generate-study-material`;

        console.log(`[AI Service] Delegating to Python Backend: ${generateUrl}`);

        const response = await axios.post(generateUrl, {
            transcript: transcriptText,
            topic: topic || 'General Legal Practice'
        });

        if (!response.data || !response.data.success) {
            throw new Error(response.data?.error || "Python backend failed to generate results");
        }

        const learningMaterials = response.data.data;

        console.log(`[AI Service] Learning materials received from Python for ${sessionId}`);

        // 3. Adapt format if necessary (Python returns 'answer' instead of 'correctAnswer')
        if (learningMaterials.quizzes) {
            learningMaterials.quizzes = learningMaterials.quizzes.map(q => ({
                ...q,
                correctAnswer: q.options.indexOf(q.answer) !== -1 ? q.options.indexOf(q.answer) : (typeof q.answer === 'number' ? q.answer : 0)
            }));
        }

        res.json({
            success: true,
            data: learningMaterials
        });

    } catch (error) {
        console.error('[AI Service] Proxy to Python Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Handle courtroom voice input payloads.
 * POST /ai/voice-input
 */
export const handleVoiceInput = async (req, res) => {
    try {
        const { rawTranscript = '', sessionId = '', turnNumber = '' } = req.body || {};
        const audioFile = req.file;

        if (!audioFile) {
            return res.status(400).json({
                success: false,
                error: 'audioFile is required'
            });
        }

        if (!sessionId || turnNumber === '' || turnNumber === null) {
            return res.status(400).json({
                success: false,
                error: 'sessionId and turnNumber are required'
            });
        }

        const transcript = String(rawTranscript || '').trim();
        const cleanedText = cleanLegalTranscript(transcript);
        const finalText = cleanedText || transcript || '[Voice input captured: transcript unavailable]';

        const roleplayUrl =
            process.env.ROLEPLAY_CHAT_URL ||
            'http://roleplay-service:10005/api/roleplay/chat';

        let aiResponse = null;
        let aiSpeaker = null;
        let aiSpeakerRole = null;

        try {
            const roleplayResponse = await axios.post(
                roleplayUrl,
                {
                    message: finalText,
                    sessionId,
                    turnNumber,
                    source: 'voice-input'
                },
                { timeout: 30000 }
            );

            const payload = roleplayResponse?.data?.data || {};
            aiResponse = payload.ai_reply || null;
            aiSpeaker = payload.speaker || null;
            aiSpeakerRole = payload.speakerRole || null;
        } catch (roleplayError) {
            console.error('[AI Service] voice-input roleplay handoff failed:', roleplayError.message);
        }

        return res.json({
            success: true,
            data: {
                transcript: finalText,
                cleanedText: cleanedText || finalText,
                cleanedTranscript: cleanedText || finalText,
                finalText,
                rawTranscript: transcript,
                audioLogPath: audioFile.path,
                sessionId,
                turnNumber,
                aiResponse,
                aiSpeaker,
                aiSpeakerRole,
                notes: aiResponse
                    ? (cleanedText
                        ? 'Voice input cleaned and forwarded to roleplay loop.'
                        : 'Voice input forwarded with fallback text because transcript was unavailable.')
                    : (cleanedText
                        ? 'Voice input cleaned and logged; roleplay handoff unavailable.'
                        : 'Audio logged; transcript unavailable and roleplay handoff unavailable.')
            }
        });
    } catch (error) {
        console.error('[AI Service] voice-input error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to process voice input'
        });
    }
};
