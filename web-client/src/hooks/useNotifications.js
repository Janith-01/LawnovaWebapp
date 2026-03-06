import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  connectNotificationsSocket,
  disconnectNotificationsSocket,
  getNotificationsSocket,
  subscribeToSession,
  unsubscribeFromSession,
  subscribeToSessions,
} from '@/services/socket';
import useDashboardStore from '@/store/useDashboardStore';
import useSessionsStore from '@/store/useSessionsStore';
import toast from 'react-hot-toast';

/**
 * Hook to manage real-time notifications via Socket.IO
 * Connects to /notifications namespace and handles invitation/session events
 */
export function useNotifications() {
  const { user } = useAuth();
  const isConnectedRef = useRef(false);

  // Dashboard store actions
  const refreshInvitations = useDashboardStore((state) => state.refreshInvitations);
  const refreshSessions = useDashboardStore((state) => state.refreshSessions);

  // Sessions store for drawer updates
  const selectedSessionId = useSessionsStore((state) => state.selectedSessionId);
  const openSession = useSessionsStore((state) => state.openSession);

  /**
   * Handle incoming invitation events
   */
  const handleInvitationReceived = useCallback((data) => {
    console.log('[Notifications] Invitation received:', data);
    toast.success('You have a new invitation!');
    refreshInvitations();
  }, [refreshInvitations]);

  const handleInvitationAccepted = useCallback((data) => {
    console.log('[Notifications] Invitation accepted:', data);
    
    // Refresh the session drawer if it's open for this session
    if (selectedSessionId === data.sessionId) {
      openSession(data.sessionId);
    }
    
    // Show toast notification
    toast.success(`Invitation accepted by participant`);
  }, [selectedSessionId, openSession]);

  const handleInvitationRejected = useCallback((data) => {
    console.log('[Notifications] Invitation rejected:', data);
    
    // Refresh the session drawer if it's open for this session
    if (selectedSessionId === data.sessionId) {
      openSession(data.sessionId);
    }
  }, [selectedSessionId, openSession]);

  const handleInvitationDeclined = useCallback((data) => {
    console.log('[Notifications] Invitation declined:', data);
    toast('Invitation was declined', { icon: '❌' });
    
    // Refresh the session drawer if it's open for this session
    if (selectedSessionId === data.sessionId) {
      openSession(data.sessionId);
    }
  }, [selectedSessionId, openSession]);

  const handleInvitationRevoked = useCallback((data) => {
    console.log('[Notifications] Invitation revoked:', data);
    toast('Your invitation was revoked', { icon: '⚠️' });
    refreshInvitations();
    refreshSessions();
  }, [refreshInvitations, refreshSessions]);

  const handleInvitationStatusChanged = useCallback((data) => {
    console.log('[Notifications] Invitation status changed:', data);
    refreshInvitations();
    if (data.status === 'accepted') {
      refreshSessions();
    }
  }, [refreshInvitations, refreshSessions]);

  const handleInvitationCreated = useCallback((data) => {
    console.log('[Notifications] Invitation created in session:', data);
    
    // Refresh the session drawer if it's open for this session
    if (selectedSessionId) {
      openSession(selectedSessionId);
    }
  }, [selectedSessionId, openSession]);

  /**
   * Handle participant events
   */
  const handleParticipantRemoved = useCallback((data) => {
    console.log('[Notifications] Participant removed:', data);
    
    // Check if current user was removed
    if (data.userId === user?.id) {
      toast.error('You have been removed from the session');
      refreshSessions();
    }
    
    // Refresh the session drawer if it's open
    if (selectedSessionId === data.sessionId) {
      openSession(data.sessionId);
    }
  }, [user?.id, selectedSessionId, openSession, refreshSessions]);

  const handleParticipantJoined = useCallback((data) => {
    console.log('[Notifications] Participant joined:', data);
    
    // Refresh the session drawer if it's open
    if (selectedSessionId === data.sessionId) {
      openSession(data.sessionId);
    }
  }, [selectedSessionId, openSession]);

  /**
   * Handle session events
   */
  const handleSessionUpdated = useCallback((data) => {
    console.log('[Notifications] Session updated:', data);
    refreshSessions();
    
    // Refresh the session drawer if it's open for this session
    if (selectedSessionId === data.sessionId) {
      openSession(data.sessionId);
    }
  }, [refreshSessions, selectedSessionId, openSession]);

  const handleSessionDeleted = useCallback((data) => {
    console.log('[Notifications] Session deleted:', data);
    toast.error('A session you were part of has been deleted');
    refreshSessions();
    refreshInvitations();
  }, [refreshSessions, refreshInvitations]);

  const handleSessionStatusChanged = useCallback((data) => {
    console.log('[Notifications] Session status changed:', data);
    refreshSessions();
    
    if (selectedSessionId === data.sessionId) {
      openSession(data.sessionId);
    }
  }, [refreshSessions, selectedSessionId, openSession]);

  /**
   * Connect to notifications socket and set up event listeners
   */
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Avoid duplicate connections
    if (isConnectedRef.current) {
      return;
    }

    const socket = connectNotificationsSocket({ userId: user.id });
    isConnectedRef.current = true;

    // Connection events
    socket.on('connect', () => {
      console.log('[Notifications] Connected to notifications socket');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Notifications] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Notifications] Connection error:', error);
    });

    // Invitation events
    socket.on('invitation:received', handleInvitationReceived);
    socket.on('invitation:accepted', handleInvitationAccepted);
    socket.on('invitation:rejected', handleInvitationRejected);
    socket.on('invitation:declined', handleInvitationDeclined);
    socket.on('invitation:revoked', handleInvitationRevoked);
    socket.on('invitation:status_changed', handleInvitationStatusChanged);
    socket.on('invitation:created', handleInvitationCreated);

    // Participant events
    socket.on('participant:removed', handleParticipantRemoved);
    socket.on('participant:joined', handleParticipantJoined);

    // Session events
    socket.on('session:updated', handleSessionUpdated);
    socket.on('session:deleted', handleSessionDeleted);
    socket.on('session:status_changed', handleSessionStatusChanged);

    // Cleanup on unmount
    return () => {
      socket.off('invitation:received', handleInvitationReceived);
      socket.off('invitation:accepted', handleInvitationAccepted);
      socket.off('invitation:rejected', handleInvitationRejected);
      socket.off('invitation:declined', handleInvitationDeclined);
      socket.off('invitation:revoked', handleInvitationRevoked);
      socket.off('invitation:status_changed', handleInvitationStatusChanged);
      socket.off('invitation:created', handleInvitationCreated);
      socket.off('participant:removed', handleParticipantRemoved);
      socket.off('participant:joined', handleParticipantJoined);
      socket.off('session:updated', handleSessionUpdated);
      socket.off('session:deleted', handleSessionDeleted);
      socket.off('session:status_changed', handleSessionStatusChanged);
      
      disconnectNotificationsSocket();
      isConnectedRef.current = false;
    };
  }, [
    user?.id,
    handleInvitationReceived,
    handleInvitationAccepted,
    handleInvitationRejected,
    handleInvitationDeclined,
    handleInvitationRevoked,
    handleInvitationStatusChanged,
    handleInvitationCreated,
    handleParticipantRemoved,
    handleParticipantJoined,
    handleSessionUpdated,
    handleSessionDeleted,
    handleSessionStatusChanged,
  ]);

  return {
    subscribeToSession,
    unsubscribeFromSession,
    subscribeToSessions,
  };
}

export default useNotifications;
