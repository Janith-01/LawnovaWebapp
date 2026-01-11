import api from './api';

/**
 * Dashboard Service
 * Handles all API calls related to the student dashboard
 */
const dashboardService = {
  /**
   * Fetch upcoming mock trial sessions (future, ongoing, or within grace period)
   * Uses the dedicated /api/sessions/upcoming endpoint for accurate time filtering
   */
  getUpcomingSessions: async () => {
    const response = await api.get('/api/sessions/upcoming', {
      params: {
        limit: 6,
        sort: 'scheduledAt',
        order: 'asc',
      },
    });
    // Return sessions array directly for backward compatibility
    return response.data.data.sessions;
  },

  /**
   * Fetch recent (past) sessions for the current user
   * Uses the dedicated /api/sessions/recent endpoint
   */
  getRecentSessions: async (params = {}) => {
    const response = await api.get('/api/sessions/recent', {
      params: {
        limit: params.limit || 20,
        page: params.page || 1,
        sort: 'endsAt',
        order: 'desc',
        ...params,
      },
    });
    return {
      sessions: response.data.data.sessions,
      serverTime: response.data.data.serverTime,
      pagination: response.data.meta?.pagination,
    };
  },

  /**
   * Fetch session invitations for the current user
   */
  getInvitations: async () => {
    const response = await api.get('/api/mocktrial/invitations/me', {
      params: {
        status: 'pending',
        sort: 'createdAt',
        order: 'desc',
        limit: 10,
      },
    });
    return response.data.data;
  },

  /**
   * Accept an invitation
   */
  acceptInvitation: async (invitationId) => {
    const response = await api.post(`/api/mocktrial/invitations/${invitationId}/accept`, {});
    return response.data.data;
  },

  /**
   * Reject an invitation
   */
  rejectInvitation: async (invitationId) => {
    const response = await api.post(`/api/mocktrial/invitations/${invitationId}/reject`, {});
    return response.data.data;
  },

  /**
   * Fetch role exposure stats for charts
   */
  getRoleExposure: async () => {
    const response = await api.get('/api/monitoring/me/roles', {
      params: { limit: 50 },
    });
    return response.data.data;
  }
};

export default dashboardService;
