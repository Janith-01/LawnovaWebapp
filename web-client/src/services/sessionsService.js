import api from './api';

const sessionsService = {
  listSessions: async (params = {}) => {
    const response = await api.get('/api/sessions', { params });
    return response.data.data;
  },

  /**
   * Get upcoming sessions for the current user
   * Returns sessions that are in the future, ongoing, or within grace period
   * @param {Object} params - { page, limit, sort, order }
   * @returns {Promise<{ sessions: Array, serverTime: string, pagination: Object }>}
   */
  getUpcomingSessions: async (params = {}) => {
    const response = await api.get('/api/sessions/upcoming', { params });
    return {
      sessions: response.data.data.sessions,
      serverTime: response.data.data.serverTime,
      pagination: response.data.meta?.pagination,
    };
  },

  /**
   * Get recent (past) sessions for the current user
   * Returns sessions that have ended or are completed/cancelled
   * @param {Object} params - { page, limit, sort, order }
   * @returns {Promise<{ sessions: Array, serverTime: string, pagination: Object }>}
   */
  getRecentSessions: async (params = {}) => {
    const response = await api.get('/api/sessions/recent', { params });
    return {
      sessions: response.data.data.sessions,
      serverTime: response.data.data.serverTime,
      pagination: response.data.meta?.pagination,
    };
  },

  getSessionMeta: async () => {
    const response = await api.get('/api/sessions/meta');
    return response.data.data;
  },

  getSessionById: async (sessionId) => {
    const response = await api.get(`/api/sessions/${sessionId}`);
    return response.data.data;
  },

  getSessionParticipants: async (sessionId, params = {}) => {
    const response = await api.get(`/api/sessions/${sessionId}/participants`, { params });
    return response.data.data;
  },

  getSessionRoles: async (sessionId) => {
    const response = await api.get(`/api/sessions/${sessionId}/roles`);
    return response.data.data;
  },

  createSession: async (payload) => {
    const response = await api.post('/api/sessions', payload);
    return response.data.data;
  },

  createDraftSession: async (payload) => {
    const response = await api.post('/api/sessions/draft', payload);
    return response.data.data;
  },

  deleteSession: async (sessionId) => {
    const response = await api.delete(`/api/sessions/${sessionId}`);
    return response.data.data;
  },

  /**
   * Invite a participant to a session (Step 2)
   * @param {string} sessionId - Session ID
   * @param {object} payload - { identifier: 'email@example.com' or '@username', role?: 'judge' | 'lawyer' | ... }
   */
  inviteParticipant: async (sessionId, payload) => {
    const response = await api.post(`/api/sessions/${sessionId}/participants`, payload);
    return response.data.data;
  },

  /**
   * List participants invited to a session
   * @param {string} sessionId - Session ID
   * @param {object} params - { page, limit, status }
   */
  listParticipants: async (sessionId, params = {}) => {
    const response = await api.get(`/api/sessions/${sessionId}/participants`, { params });
    return response.data.data;
  },

  /**
   * Remove a participant from a session
   * @param {string} sessionId - Session ID
   * @param {string} participantId - Participant/Invitation ID
   */
  removeParticipant: async (sessionId, participantId) => {
    const response = await api.delete(
      `/api/sessions/${sessionId}/participants/${participantId}`
    );
    return response.data.data;
  },

  /**
   * Schedule a session (draft → scheduled)
   * Only the session owner or admin can schedule a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Updated session object
   */
  scheduleSession: async (sessionId) => {
    const response = await api.post(`/api/sessions/${sessionId}/schedule`);
    return response.data.data;
  },

  /**
   * Start a session (scheduled → ongoing)
   * Only the session owner or admin can start a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Updated session object
   */
  startSession: async (sessionId) => {
    const response = await api.post(`/api/sessions/${sessionId}/start`);
    return response.data.data;
  },
};

export default sessionsService;
