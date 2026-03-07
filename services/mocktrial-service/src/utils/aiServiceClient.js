import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AI Service Client - Handles communication with ai-service
 */
const aiServiceClient = axios.create({
    baseURL: process.env.AI_SERVICE_URL || 'http://localhost:5008',
    headers: {
        'x-internal-service-auth': process.env.INTERNAL_SERVICE_SECRET,
    },
});

// Retry Interceptor: Retry once on failure
aiServiceClient.interceptors.response.use(undefined, async (err) => {
    const { config, response } = err;

    // Don't retry on 4xx errors
    if (response && response.status < 500) {
        return Promise.reject(err);
    }

    if (!config || !config.retryCount) {
        config.retryCount = 0;
    }

    if (config.retryCount < 1) { // Retry once
        config.retryCount += 1;
        console.warn(`[AI Service] Request failed, retrying... (${config.url})`);
        return new Promise(resolve => setTimeout(() => resolve(aiServiceClient(config)), 500));
    }

    return Promise.reject(err);
});

/**
 * Create a Daily.co room via AI-Service
 */
export const createDailyRoom = async (trialId) => {
    try {
        const response = await aiServiceClient.post('/api/video/rooms', { trialId });
        return response.data; // { success: true, data: { name, url } }
    } catch (error) {
        const apiError = error.response?.data?.message || error.message;
        console.error(`[AI Service Client] Room Creation Failed: ${apiError}`);
        throw new Error(apiError);
    }
};

export const getMeetingToken = async (roomName, role, userId) => {
    try {
        const response = await aiServiceClient.get(`/api/video/token/${roomName}`, {
            params: { role },
            headers: {
                'user-id': userId
            }
        });
        return response.data; // { success: true, data: { token } }
    } catch (error) {
        const apiError = error.response?.data?.message || error.message;
        console.error(`[AI Service Client] Token Fetch Failed: ${apiError}`);
        throw new Error(apiError);
    }
};

/**
 * Delete/Close a Daily.co room via AI-Service
 */
export const deleteDailyRoom = async (roomName) => {
    try {
        const response = await aiServiceClient.delete(`/api/video/rooms/${roomName}`);
        return response.data;
    } catch (error) {
        const apiError = error.response?.data?.message || error.message;
        console.error(`[AI Service Client] Room Deletion Failed: ${apiError}`);
        // Don't throw - room might already be deleted
        return { success: false, error: apiError };
    }
};

/**
 * Send a Daily.co app message via AI-Service
 */
export const sendDailyAppMessage = async (roomName, type, data) => {
    try {
        const response = await aiServiceClient.post(`/api/video/rooms/${roomName}/message`, {
            type,
            data
        });
        return response.data;
    } catch (error) {
        const apiError = error.response?.data?.message || error.message;
        console.error(`[AI Service Client] App Message Send Failed: ${apiError}`);
        // Don't throw for broadcast failures
        return { success: false, error: apiError };
    }
};

export default aiServiceClient;
