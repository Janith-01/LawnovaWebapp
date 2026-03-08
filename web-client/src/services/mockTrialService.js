import api from './api';

/**
 * Mock Trial Service - Handles all mock trial room operations
 * Routes through API Gateway to mocktrial-service
 */
const mockTrialService = {
    // ============================================
    // ROOM CRUD OPERATIONS
    // ============================================

    /**
     * Create a new mock trial room
     * @param {Object} roomData - Room creation data
     */
    createRoom: async (roomData) => {
        const response = await api.post('/api/mock-trials/rooms/create', roomData);
        return response.data;
    },

    /**
     * Get all rooms for the current user
     */
    getMyTrials: async () => {
        const response = await api.get('/api/mock-trials/rooms/my-trials');
        return response.data;
    },

    /**
     * Get a single room by ID
     * @param {string} roomId - Room ID
     */
    getRoomById: async (roomId) => {
        const response = await api.get(`/api/mock-trials/rooms/${roomId}`);
        return response.data;
    },

    /**
     * Update room details
     * @param {string} roomId - Room ID
     * @param {Object} updates - Fields to update
     */
    updateRoom: async (roomId, updates) => {
        const response = await api.put(`/api/mock-trials/rooms/${roomId}`, updates);
        return response.data;
    },

    /**
     * Delete a room
     * @param {string} roomId - Room ID
     */
    deleteRoom: async (roomId) => {
        const response = await api.delete(`/api/mock-trials/rooms/${roomId}`);
        return response.data;
    },

    // ============================================
    // INVITATION OPERATIONS
    // ============================================

    /**
     * Invite participants to a room
     * @param {string} roomId - Room ID
     * @param {Array} participants - Array of { email, role }
     */
    inviteParticipants: async (roomId, participants) => {
        const response = await api.post(`/api/mock-trials/rooms/invite/${roomId}`, {
            participants,
        });
        return response.data;
    },

    /**
     * Accept invitation to a room
     * @param {string} roomId - Room ID
     */
    acceptInvitation: async (roomId) => {
        const response = await api.post(`/api/mock-trials/rooms/${roomId}/accept`);
        return response.data;
    },

    /**
     * Decline invitation to a room
     * @param {string} roomId - Room ID
     */
    declineInvitation: async (roomId) => {
        const response = await api.post(`/api/mock-trials/rooms/${roomId}/decline`);
        return response.data;
    },

    /**
     * Get all pending invitations for the current user
     */
    getMyInvitations: async () => {
        const response = await api.get('/api/mock-trials/rooms/my-invitations');
        return response.data;
    },

    // ============================================
    // STATUS MANAGEMENT
    // ============================================

    /**
     * Update room status
     * @param {string} roomId - Room ID
     * @param {string} status - New status (Scheduled, RolesAssigned, Completed)
     */
    updateStatus: async (roomId, status) => {
        const response = await api.patch(`/api/mock-trials/rooms/${roomId}/status`, {
            status,
        });
        return response.data;
    },

    /**
     * Complete a trial session (Owner only)
     * @param {string} roomId - Room ID
     */
    completeSession: async (roomId) => {
        const response = await api.patch(`/api/mock-trials/rooms/${roomId}/complete`);
        return response.data;
    },

    /**
     * Trigger learning generation (Owner only)
     * @param {string} roomId - Room ID
     */
    triggerLearning: async (roomId) => {
        const response = await api.post(`/api/mock-trials/rooms/${roomId}/trigger-learning`);
        return response.data;
    },

    // ============================================
    // FAIR ROLE ROTATION ENGINE
    // ============================================

    /**
     * Trigger Fair Role Rotation Algorithm
     * @param {string} roomId - Room ID
     * @param {boolean} force - Force reassignment if already locked
     */
    assignRoles: async (roomId, force = false) => {
        const response = await api.patch(`/api/mock-trials/rooms/${roomId}/assign-roles`, {
            force,
        });
        return response.data;
    },

    /**
     * Preview role assignments without saving
     * @param {string} roomId - Room ID
     */
    previewRoles: async (roomId) => {
        const response = await api.get(`/api/mock-trials/rooms/${roomId}/preview-roles`);
        return response.data;
    },

    /**
     * Unlock roles for reassignment
     * @param {string} roomId - Room ID
     */
    unlockRoles: async (roomId) => {
        const response = await api.patch(`/api/mock-trials/rooms/${roomId}/unlock-roles`);
        return response.data;
    },

    /**
     * Get role assignment history
     * @param {string} roomId - Room ID
     */
    getRoleHistory: async (roomId) => {
        const response = await api.get(`/api/mock-trials/rooms/${roomId}/role-history`);
        return response.data;
    },

    // ============================================
    // PARTICIPANT MANAGEMENT
    // ============================================

    /**
     * Update participant role
     * @param {string} roomId - Room ID
     * @param {string} participantId - Participant ID
     * @param {string} role - New role
     */
    updateParticipantRole: async (roomId, participantId, role) => {
        const response = await api.patch(
            `/api/mock-trials/rooms/${roomId}/participants/${participantId}/role`,
            { role }
        );
        return response.data;
    },

    // ============================================
    // USER SEARCH
    // ============================================

    /**
     * Search users in the directory
     * @param {string} query - Search query
     * @param {string} type - Filter type (all, student, faculty)
     * @param {number} limit - Max results
     */
    searchUsers: async (query = '', type = 'all', limit = 20) => {
        const response = await api.get('/api/users/search', {
            params: { q: query, type, limit }
        });
        return response.data;
    },
    /**
     * Get video meeting token for a room
     * @param {string} roomId - Room ID
     */
    getVideoToken: async (roomId) => {
        const response = await api.get(`/api/mock-trials/rooms/${roomId}/token`);
        return response.data;
    },

    // ============================================
    // AI CHAT OPERATIONS
    // ============================================

    /**
     * Send a message to the AI Legal Assistant
     * @param {string} roomId - Room ID
     * @param {string} message - User's question
     */
    sendChatMessage: async (roomId, message, skipAi = false) => {
        const response = await api.post(`/api/mock-trials/rooms/${roomId}/chat`, { message, skipAi });
        return response.data;
    },

    /**
     * Save an AI message to history
     */
    saveAiMessage: async (roomId, message) => {
        const response = await api.post(`/api/mock-trials/rooms/${roomId}/chat/save-ai`, { message });
        return response.data;
    },

    /**
     * Get chat history for a room
     * @param {string} roomId - Room ID
     * @param {number} limit - Max messages to return
     */
    getChatHistory: async (roomId, limit = 50) => {
        const response = await api.get(`/api/mock-trials/rooms/${roomId}/chat`, {
            params: { limit }
        });
        return response.data;
    },

    /**
     * Clear chat history (owner only)
     * @param {string} roomId - Room ID
     */
    clearChatHistory: async (roomId) => {
        const response = await api.delete(`/api/mock-trials/rooms/${roomId}/chat`);
        return response.data;
    },

    // ============================================
    // TRIAL SESSION & TIMER OPERATIONS
    // ============================================

    /**
     * Start/Initialize a trial session timer
     * @param {string} roomId - Room ID
     */
    startTrialSession: async (roomId) => {
        const response = await api.post(`/api/mock-trials/rooms/${roomId}/session/start`);
        return response.data;
    },

    /**
     * Get current session status/time allocations
     * @param {string} roomId - Room ID
     */
    getTrialSessionStatus: async (roomId) => {
        const response = await api.get(`/api/mock-trials/rooms/${roomId}/session/status`);
        return response.data;
    },

    /**
     * Move trial to next stage (Opening -> Direct -> Cross etc.)
     * @param {string} roomId - Room ID
     */
    nextTrialStage: async (roomId) => {
        const response = await api.patch(`/api/mock-trials/rooms/${roomId}/session/next`);
        return response.data;
    },
};

export default mockTrialService;
