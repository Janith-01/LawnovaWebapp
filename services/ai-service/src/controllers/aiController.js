import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('[AI Service] Gemini API Key:', apiKey ? `Loaded (${apiKey.substring(0, 15)}...)` : 'MISSING!');

// Initialize Gemini with the new @google/genai package
const ai = new GoogleGenAI({ apiKey });

// System instruction for the legal assistant
const SYSTEM_INSTRUCTION = `You are a Sri Lankan Legal Assistant for the LAWNOVA platform.
Your role is to assist law students in understanding legal concepts, specifically focusing on Sri Lankan Law.

Guidelines:
- Always cite specific sections of the Sri Lankan Penal Code or relevant statutes where applicable
- Format your responses clearly using Markdown with headers and bullet points
- Keep responses informative but concise
- When discussing legal provisions, include the section number, summary, key elements, and relevant case law
- Be accurate and educational in nature`;

/**
 * Test endpoint to verify Gemini connection
 * GET /ai/test
 */
export const testConnection = async (req, res) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'Reply with exactly: "Gemini AI connected successfully!"',
        });

        const text = response.text;
        console.log('[AI Service] Test successful:', text);
        res.json({
            success: true,
            message: text,
            model: 'gemini-2.0-flash'
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
 * Stream chat completions via Server-Sent Events (SSE)
 * POST /ai/chat/stream
 */
export const streamChat = async (req, res) => {
    const { messages, context } = req.body;

    console.log('[AI Service] Chat request - messages:', messages?.length, 'context:', context?.substring?.(0, 50));

    // Validate request
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        // Build the prompt
        let prompt = SYSTEM_INSTRUCTION + '\n\n';

        if (context) {
            prompt += `The user is currently viewing this legal context: "${context}"\n\n`;
        }

        // Add message history
        prompt += 'Conversation:\n';
        for (const msg of messages) {
            const role = msg.role === 'assistant' ? 'Assistant' : 'User';
            prompt += `${role}: ${msg.content}\n`;
        }
        prompt += '\nAssistant:';

        console.log('[AI Service] Sending to Gemini...');

        // Stream the response
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.0-flash',
            contents: prompt,
        });

        // Handle client disconnect
        req.on('close', () => {
            console.log('[AI Service] Client disconnected');
            res.end();
        });

        let chunkCount = 0;
        for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
                chunkCount++;
                res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
            }
        }

        console.log('[AI Service] Stream completed with', chunkCount, 'chunks');
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('[AI Service] Gemini API Error:', error.message);

        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }
};
