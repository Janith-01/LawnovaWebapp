import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DAILY_API_KEY = process.env.DAILY_API_KEY?.trim();
const DAILY_API_URL = 'https://api.daily.co/v1';

const dailyClient = axios.create({
    baseURL: DAILY_API_URL,
    headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
        'Content-Type': 'application/json',
    },
});

/**
 * Create a Daily room for a trial
 * @param {string} trialId 
 */
export const createDailyRoom = async (trialId) => {
    const roomName = `trial-${trialId}`;
    try {
        // Check if exists
        try {
            const existing = await dailyClient.get(`/rooms/${roomName}`);
            if (existing.data) return existing.data;
        } catch (e) {
            if (e.response?.status !== 404) throw e;
        }

        const response = await dailyClient.post('/rooms', {
            name: roomName,
            privacy: 'private',
            properties: {
                enable_chat: true,
                start_audio_off: true,
                start_video_off: false,
                enable_recording: 'cloud',
                enable_transcription: true,
                exp: Math.floor(Date.now() / 1000) + 86400,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Daily API Error (createDailyRoom):', error.response?.data || error.message);
        throw new Error('Failed to create Daily room');
    }
};

/**
 * Generate a meeting token
 * @param {string} roomName 
 * @param {Object} user - { userId, role }
 */
export const generateMeetingToken = async (roomName, user) => {
    const { userId, role, userName } = user;

    // logic: Set is_owner to true if the user is the Defendant (Trial Creator)
    // In this context, we'll check if role is 'Defendant' or if they were explicitly marked
    const isOwner = role === 'Defendant' || role === 'Owner';

    try {
        const payload = {
            properties: {
                room_name: roomName,
                is_owner: isOwner,
                // Embedding role in user_name for immediate identification
                user_name: `${role}|${userName || userId || 'anonymous'}`,
                exp: Math.floor(Date.now() / 1000) + 7200,
            },
        };

        const response = await dailyClient.post('/meeting-tokens', payload);
        return response.data.token;
    } catch (error) {
        console.error('Daily API Error (generateMeetingToken):', error.response?.data || error.message);
        throw new Error('Failed to generate Daily meeting token');
    }
};

/**
 * Send an app message to all participants in a Daily room
 * @param {string} roomName 
 * @param {Object} messageBody - { type, data }
 */
export const sendAppMessage = async (roomName, messageBody) => {
    try {
        const payload = {
            recipient: '*',
            data: JSON.stringify(messageBody)
        };

        const response = await dailyClient.post(`/rooms/${roomName}/send-app-message`, payload);
        console.log(`[VideoService] App message sent to room ${roomName}`);
        return response.data;
    } catch (error) {
        console.error('Daily API Error (sendAppMessage):', error.response?.data || error.message);
        throw new Error('Failed to send Daily app message');
    }
};

/**
 * Delete a Daily room
 * @param {string} roomName 
 */
export const deleteDailyRoom = async (roomName) => {
    try {
        const response = await dailyClient.delete(`/rooms/${roomName}`);
        return response.data;
    } catch (error) {
        console.error('Daily API Error (deleteDailyRoom):', error.response?.data || error.message);
        // If it's already deleted (404), we can ignore
        if (error.response?.status === 404) return { deleted: true, message: 'Room not found' };
        throw new Error('Failed to delete Daily room');
    }
};

export default {
    createDailyRoom,
    generateMeetingToken,
    deleteDailyRoom,
    sendAppMessage,
};
