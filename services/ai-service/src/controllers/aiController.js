import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicTool } from "@langchain/core/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createToolCallingAgent, AgentExecutor } from "@langchain/classic/agents";
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import transcriptIngestion from '../services/transcriptIngestionService.js';
import { cleanLegalTranscript } from '../utils/cleanLegalTranscript.js';

// Load environment variables
dotenv.config();

const primaryGeminiKey = process.env.GEMINI_API_KEY;
const secondaryGeminiKey = process.env.GEMINI_API_KEY1 || process.env.GEMINI_API_KEY_ALT;
console.log('[AI Service] Gemini primary key:', primaryGeminiKey ? `Loaded (${primaryGeminiKey.substring(0, 15)}...)` : 'MISSING!');
console.log('[AI Service] Gemini secondary key:', secondaryGeminiKey ? `Loaded (${secondaryGeminiKey.substring(0, 15)}...)` : 'MISSING!');

const buildModel = (apiKey) => new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-flash-latest",
    streaming: true,
    maxOutputTokens: 2048,
    apiVersion: "v1beta"
});

// Initialize default model with primary key for non-streaming paths.
const model = buildModel(primaryGeminiKey);

const getGeminiKeys = () => [...new Set([primaryGeminiKey, secondaryGeminiKey].filter(Boolean))];

const isQuotaError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('429') || message.includes('too many requests') || message.includes('spending cap');
};

const streamWithGroq = async ({ messages, res }) => {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
        throw new Error('Groq fallback is not configured. Set GROQ_API_KEY.');
    }

    const groqModel = process.env.GROQ_CHAT_MODEL || 'llama-3.1-8b-instant';
    const payloadMessages = (messages || []).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
    }));

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
            model: groqModel,
            messages: payloadMessages,
            stream: true,
            temperature: 0.2
        })
    });

    if (!groqResponse.ok || !groqResponse.body) {
        const errText = await groqResponse.text().catch(() => '');
        throw new Error(`Groq stream failed (${groqResponse.status}): ${errText || 'No response body'}`);
    }

    const decoder = new TextDecoder();
    const reader = groqResponse.body.getReader();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') continue;

            try {
                const parsed = JSON.parse(data);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (delta) {
                    res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
                }
            } catch {
                // Ignore malformed line and continue stream
            }
        }
    }
};

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

const buildFallbackLearningMaterials = (transcriptText, topic) => {
    const text = String(transcriptText || '').toLowerCase();
    const legalHints = [];

    if (text.includes('penal code')) legalHints.push('Penal Code');
    if (text.includes('section')) legalHints.push('Statutory Section Interpretation');
    if (text.includes('evidence')) legalHints.push('Law of Evidence');
    if (text.includes('objection')) legalHints.push('Courtroom Objection Standards');
    if (text.includes('mens rea')) legalHints.push('Mens Rea and Criminal Intent');
    if (text.includes('actus reus')) legalHints.push('Actus Reus and Conduct Elements');

    const coreTopic = legalHints[0] || topic || 'Sri Lankan Criminal Law';

    return {
        summary: {
            title: `Foundational Review: ${coreTopic}`,
            keyTopics: legalHints.length > 0 ? legalHints : [coreTopic, 'Legal Argument Structure'],
            recommendations: [
                'Cite at least one relevant Act and section for each argument.',
                'Link facts to statutory elements before concluding liability.',
                'Address likely objections proactively in oral submissions.'
            ]
        },
        flashcards: [
            {
                front: 'What is the first step when citing a legal rule in court?',
                back: 'Identify the exact Act and section, then explain how the facts satisfy each legal element.',
                citation: 'Foundational Advocacy Practice'
            },
            {
                front: `How should counsel use ${coreTopic} in submissions?`,
                back: `Use ${coreTopic} as a framework: define the rule, map facts to elements, then state the legal consequence.`,
                citation: 'Lawnova Learning Fallback'
            },
            {
                front: 'How do you strengthen a courtroom argument?',
                back: 'State the legal issue clearly, cite authority, apply facts logically, and rebut the opposing interpretation.',
                citation: 'Structured Legal Reasoning'
            }
        ],
        quizzes: [
            {
                question: 'Which sequence is strongest for legal argumentation?',
                options: [
                    'Conclusion only, then facts',
                    'Issue -> Rule -> Application -> Conclusion',
                    'Facts only without legal authority',
                    'Rule only without applying to facts'
                ],
                answer: 'Issue -> Rule -> Application -> Conclusion',
                explanation: 'IRAC-style flow ensures legal authority is tied to evidence and outcome.'
            },
            {
                question: 'What most improves credibility in oral submissions?',
                options: [
                    'Avoiding section references',
                    'Using emotional language only',
                    'Citing precise legal provisions and applying them to evidence',
                    'Repeating the same point without structure'
                ],
                answer: 'Citing precise legal provisions and applying them to evidence',
                explanation: 'Courts evaluate argument quality based on legal grounding and factual linkage.'
            }
        ]
    };
};

const getAgentExecutor = (sessionId, overrideApiKey) => {
    const llm = overrideApiKey ? buildModel(overrideApiKey) : model;
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
        llm,
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
    const { messages, sessionId, trialId } = req.body;
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
    res.flushHeaders?.();

    let keepAlive = null;

    try {
        const lastUserMessage = messages[messages.length - 1].content;
        const chatHistory = messages.slice(0, -1).map(m => m.role === 'assistant' ? ["assistant", m.content] : ["user", m.content]);
        const geminiKeys = getGeminiKeys();

        if (geminiKeys.length === 0) {
            throw new Error('Gemini API key is not configured.');
        }

        // Send early packet so reverse proxies do not idle-timeout before first token.
        res.write(`data: ${JSON.stringify({ type: 'status', content: 'Processing request...' })}\n\n`);

        keepAlive = setInterval(() => {
            try {
                res.write(': ping\n\n');
            } catch (e) {
                // no-op
            }
        }, 15000);

        req.on('close', () => {
            console.log('[AI Service] Client disconnected');
            if (keepAlive) clearInterval(keepAlive);
            res.end();
        });

        let streamedSuccessfully = false;

        for (let i = 0; i < geminiKeys.length; i++) {
            try {
                const executor = getAgentExecutor(activeSessionId, geminiKeys[i]);
                const eventStream = await executor.streamEvents({
                    input: lastUserMessage,
                    chat_history: chatHistory
                }, { version: "v2" });

                if (i > 0) {
                    res.write(`data: ${JSON.stringify({ type: 'warning', content: 'Primary AI key quota exceeded. Switched to backup key.' })}\n\n`);
                }

                for await (const event of eventStream) {
                    const eventType = event.event;

                    if (eventType === "on_chat_model_stream") {
                        const chunk = event.data.chunk;
                        if (chunk.content) {
                            res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
                        }
                    } else if (eventType === "on_tool_start") {
                        const toolName = event.name === 'search_sri_lankan_law' ? 'Legal Database' : 'Trial Transcript';
                        res.write(`data: ${JSON.stringify({ type: 'thought', content: `Searching ${toolName}...` })}\n\n`);
                    }
                }

                streamedSuccessfully = true;
                break;
            } catch (attemptError) {
                if (!isQuotaError(attemptError) || i === geminiKeys.length - 1) {
                    throw attemptError;
                }
            }
        }

        if (!streamedSuccessfully) {
            throw new Error('AI stream failed to complete.');
        }

        if (keepAlive) clearInterval(keepAlive);
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        if (keepAlive) clearInterval(keepAlive);
        console.error('[AI Service] LangChain Agent Error:', error.message);

        if (isQuotaError(error)) {
            try {
                res.write(`data: ${JSON.stringify({ type: 'warning', content: 'Gemini quota exceeded. Switching to Groq fallback...' })}\n\n`);
                await streamWithGroq({ messages, res });
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            } catch (fallbackError) {
                console.error('[AI Service] Groq fallback error:', fallbackError.message);
            }
        }

        const friendlyError = isQuotaError(error)
            ? 'AI service temporarily unavailable: Gemini spending cap reached and fallback failed.'
            : error.message;
        if (!res.headersSent) res.status(500).json({ error: friendlyError });
        else {
            res.write(`data: ${JSON.stringify({ error: friendlyError })}\n\n`);
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

        let learningMaterials = response.data?.data || {};
        const backendSuccess = !!response.data?.success;

        console.log(`[AI Service] Learning materials received from Python for ${sessionId}`);

        const hasFlashcards = Array.isArray(learningMaterials.flashcards) && learningMaterials.flashcards.length > 0;
        const hasQuizzes = Array.isArray(learningMaterials.quizzes) && learningMaterials.quizzes.length > 0;

        if (!backendSuccess || (!hasFlashcards && !hasQuizzes)) {
            console.warn(`[AI Service] Empty/failed learning payload for ${sessionId}. Using deterministic fallback materials.`);
            learningMaterials = buildFallbackLearningMaterials(transcriptText, topic);
        }

        if (!Array.isArray(learningMaterials.flashcards)) {
            learningMaterials.flashcards = [];
        }
        if (!Array.isArray(learningMaterials.quizzes)) {
            learningMaterials.quizzes = [];
        }

        // Adapt format if necessary (Python returns 'answer' instead of 'correctAnswer')
        learningMaterials.quizzes = learningMaterials.quizzes.map(q => ({
                ...q,
                correctAnswer: q.options.indexOf(q.answer) !== -1 ? q.options.indexOf(q.answer) : (typeof q.answer === 'number' ? q.answer : 0)
            }));

        res.json({
            success: true,
            data: learningMaterials
        });

    } catch (error) {
        console.error('[AI Service] Proxy to Python Error:', error.message);
        const fallback = buildFallbackLearningMaterials('', topic);
        res.json({
            success: true,
            data: fallback,
            warning: `Primary generator failed: ${error.message}`
        });
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

        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            return res.status(503).json({
                success: false,
                error: 'Voice transcription service is not configured.'
            });
        }

        const localTranscript = String(rawTranscript || '').trim();
        let groqTranscript = '';

        try {
            const audioBuffer = await fs.readFile(audioFile.path);
            const formData = new FormData();
            const audioBlob = new Blob([audioBuffer], { type: audioFile.mimetype || 'audio/webm' });

            formData.append('file', audioBlob, audioFile.originalname || 'voice.webm');
            formData.append('model', 'whisper-large-v3');
            formData.append('language', 'en');

            const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${groqApiKey}`
                },
                body: formData
            });

            const groqData = await groqRes.json().catch(() => ({}));
            if (!groqRes.ok) {
                const errMsg = groqData?.error?.message || `Groq transcription failed (${groqRes.status})`;
                throw new Error(errMsg);
            }

            groqTranscript = String(groqData?.text || '').trim();
        } catch (transcriptionError) {
            console.error('[AI Service] voice-input transcription error:', transcriptionError.message);
            if (!localTranscript) {
                return res.status(502).json({
                    success: false,
                    error: 'Voice transcription failed. Please try again.'
                });
            }
        }

        const transcript = groqTranscript || localTranscript;
        const cleanedText = cleanLegalTranscript(transcript);
        const finalText = cleanedText || transcript || '[Voice input captured: transcript unavailable]';

        return res.json({
            success: true,
            data: {
                transcript: finalText,
                cleanedText: cleanedText || finalText,
                cleanedTranscript: cleanedText || finalText,
                finalText,
                rawTranscript: localTranscript,
                audioLogPath: audioFile.path,
                sessionId,
                turnNumber,
                notes: cleanedText
                    ? 'Audio transcribed via secure backend and cleaned for legal context.'
                    : 'Audio captured, but transcript is unavailable.'
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

