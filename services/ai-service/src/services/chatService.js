import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();

if (!GEMINI_API_KEY) {
    console.error('[ChatService] GEMINI_API_KEY not configured!');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// System prompt for the Legal Assistant
const SYSTEM_PROMPT = `You are an AI Legal Assistant for **Lawnova**, an educational platform for law students in Sri Lanka.

Your role is to:
- Help students understand court procedures and legal terminology
- Explain concepts from Sri Lankan law, including the Matrimonial Rights Act, Penal Code, and Evidence Ordinance
- Provide guidance on mock trial preparation and courtroom etiquette
- Be concise, professional, and educational

Guidelines:
- Always be factually accurate about Sri Lankan law.
- Use a smooth, conversational narrative style. Avoid robotic bulleted lists.
- Avoid unnecessary markdown symbols like '###' or '***'.
- Use plain text for readability, with minimal bolding only for key legal terms.
- Keep responses focused and under 500 words unless detail is necessary.`;

// In-memory conversation history (for demo; use Redis/DB in production)
const conversationHistory = new Map();

/**
 * Get or create a conversation history for a trial
 */
const getHistory = (trialId) => {
    if (!conversationHistory.has(trialId)) {
        conversationHistory.set(trialId, []);
    }
    return conversationHistory.get(trialId);
};

/**
 * Add a message to conversation history
 */
const addToHistory = (trialId, role, content) => {
    const history = getHistory(trialId);
    history.push({ role, parts: [{ text: content }] });

    // Keep only last 20 messages to prevent context overflow
    if (history.length > 20) {
        history.splice(0, history.length - 20);
    }
};

/**
 * Generate a chat response (non-streaming)
 */
export const generateChatResponse = async (question, trialId, userId) => {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-flash-latest',
            systemInstruction: SYSTEM_PROMPT
        }, { apiVersion: 'v1' });


        const history = getHistory(trialId);

        const chat = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.7,
            }
        });

        // Add user message to history
        addToHistory(trialId, 'user', question);

        const result = await chat.sendMessage(question);
        const response = result.response.text();

        // Add assistant response to history
        addToHistory(trialId, 'model', response);

        return {
            success: true,
            response,
            trialId,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[ChatService] Error generating response:', error);
        throw new Error(`Chat generation failed: ${error.message}`);
    }
};

/**
 * Generate a streaming chat response
 */
export const generateStreamingResponse = async (question, trialId, userId, onChunk) => {
    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-flash-latest',
            systemInstruction: SYSTEM_PROMPT
        }, { apiVersion: 'v1' });


        const history = getHistory(trialId);

        const chat = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.7,
            }
        });

        // Add user message to history
        addToHistory(trialId, 'user', question);

        const result = await chat.sendMessageStream(question);

        let fullResponse = '';

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullResponse += chunkText;
            onChunk(chunkText);
        }

        // Add complete response to history
        addToHistory(trialId, 'model', fullResponse);

        return fullResponse;
    } catch (error) {
        console.error('[ChatService] Streaming error:', error);
        throw new Error(`Streaming chat failed: ${error.message}`);
    }
};

/**
 * Clear conversation history for a trial
 */
export const clearHistory = (trialId) => {
    conversationHistory.delete(trialId);
    return { success: true, message: 'Conversation history cleared' };
};

export default {
    generateChatResponse,
    generateStreamingResponse,
    clearHistory
};
