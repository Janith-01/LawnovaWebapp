import { create } from 'zustand';
import toast from 'react-hot-toast';
import dashboardService from '../services/dashboardService';
import sessionsService from '../services/sessionsService';

/**
 * Dashboard Store
 * Manages state for the student dashboard
 */
const useDashboardStore = create((set, get) => ({
  upcomingSessions: [],
  invitations: [],
  roleExposure: null,
  isLoading: false,
  error: null,
  isDeletingSession: false,

  /**
   * Fetch all dashboard data in parallel
   */
  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [upcoming, invitations, roleExposure] = await Promise.all([
        dashboardService.getUpcomingSessions().catch(() => []),
        dashboardService.getInvitations().catch(() => []),
        dashboardService.getRoleExposure().catch(() => null),
      ]);

      set({
        upcomingSessions: upcoming,
        invitations,
        roleExposure,
        isLoading: false
      });
    } catch (err) {
      set({ 
        error: err.response?.data?.error?.message || 'Failed to fetch dashboard data', 
        isLoading: false 
      });
    }
  },

  /**
   * Refresh specific sections
   */
  refreshSessions: async () => {
    try {
      const upcoming = await dashboardService.getUpcomingSessions();
      set({ upcomingSessions: upcoming });
    } catch (err) {
      console.error('Failed to refresh sessions:', err);
    }
  },

  refreshInvitations: async () => {
    try {
      const invitations = await dashboardService.getInvitations();
      set({ invitations });
    } catch (err) {
      console.error('Failed to refresh invitations:', err);
    }
  },

  acceptInvitation: async (invitationId) => {
    try {
      await dashboardService.acceptInvitation(invitationId);
      toast.success('Invitation accepted! Session added to your upcoming sessions.');
      // Refresh both invitations and sessions since accepting adds user to session
      await Promise.all([
        get().refreshInvitations(),
        get().refreshSessions(),
      ]);
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      const errorMsg = err.response?.data?.error?.message || 'Failed to accept invitation';
      toast.error(errorMsg);
      set({ error: errorMsg });
    }
  },

  rejectInvitation: async (invitationId) => {
    try {
      await dashboardService.rejectInvitation(invitationId);
      toast.success('Invitation declined.');
      await get().refreshInvitations();
    } catch (err) {
      console.error('Failed to reject invitation:', err);
      const errorMsg = err.response?.data?.error?.message || 'Failed to decline invitation';
      toast.error(errorMsg);
      set({ error: errorMsg });
    }
  },

  deleteSession: async (sessionId) => {
    set({ isDeletingSession: true, error: null });
    try {
      await sessionsService.deleteSession(sessionId);
      await get().refreshSessions();
      set({ isDeletingSession: false });
    } catch (err) {
      set({
        isDeletingSession: false,
        error: err.response?.data?.error?.message || 'Failed to delete session',
      });
      throw err;
    }
  },
}));

export default useDashboardStore;
