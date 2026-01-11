import { create } from 'zustand';
import sessionsService from '@/services/sessionsService';

const useSessionsStore = create((set, get) => ({
  selectedSessionId: null,
  isDrawerOpen: false,
  isLoadingDetails: false,
  detailsError: null,
  session: null,
  participants: [],
  roles: null,

  openSession: async (sessionId) => {
    set({
      selectedSessionId: sessionId,
      isDrawerOpen: true,
      isLoadingDetails: true,
      detailsError: null,
      session: null,
      participants: [],
      roles: null,
    });

    try {
      const [session, participants, roles] = await Promise.all([
        sessionsService.getSessionById(sessionId),
        sessionsService.getSessionParticipants(sessionId, { page: 1, limit: 50 }).catch(() => []),
        sessionsService.getSessionRoles(sessionId).catch(() => null),
      ]);

      set({ session, participants, roles, isLoadingDetails: false });
    } catch (err) {
      set({
        detailsError: err?.response?.data?.error?.message || 'Failed to load session details',
        isLoadingDetails: false,
      });
    }
  },

  closeDrawer: () => {
    set({
      isDrawerOpen: false,
      selectedSessionId: null,
      isLoadingDetails: false,
      detailsError: null,
      session: null,
      participants: [],
      roles: null,
    });
  },
}));

export default useSessionsStore;
