import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicTool } from "@langchain/core/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createToolCallingAgent, AgentExecutor } from "@langchain/classic/agents";
import dotenv from 'dotenv';
import axios from 'axios';
import transcriptIngestion from '../services/transcriptIngestionService.js';

// Load environment variables
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('[AI Service] Gemini API Key:', apiKey ? `Loaded (${apiKey.substring(0, 15)}...)` : 'MISSING!');

// Initialize LangChain Model
const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.5-flash",
    streaming: true,
    maxOutputTokens: 2048,
    convertSystemInstructionToMember: true,
});

// System instruction for the Legal Agent
const SYSTEM_INSTRUCTION = `You are a Senior Sri Lankan Legal AI Agent for the LAWNOVA platform.
Your objective is to provide high-fidelity legal assistance to law students by leveraging real-time trial data and the Sri Lankan legal corpus.

Capabilities:
1. Search Law: Use the 'search_sri_lankan_law' tool to find specific statutes, sections, and case law. ALWAYS cite your sources.
2. Trial Context: Use 'get_trial_transcript' to stay informed about what's currently happening in the courtroom.

Guidelines:
- If a user asks about court procedures, ALWAYS check the latest transcript to see the context of the trial.
- When explaining laws, include section numbers and simplified summaries.
- Be strictly professional and educational.
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
            model: 'gemini-2.5-flash (via LangChain)'
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
            console.log(`[AI Service] No transcript found for session ${sessionId}.`);
            return res.status(404).json({ success: false, error: 'No transcript found for this session to generate learning materials' });
        }

        // 2. Delegate to Python Backend for RAG and specialized generation
        const pythonBackendUrl = process.env.PYTHON_AI_BACKEND_URL || 'http://localhost:5009/generate-study-material';

        console.log(`[AI Service] Delegating to Python Backend: ${pythonBackendUrl}`);

        const response = await axios.post(pythonBackendUrl, {
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
