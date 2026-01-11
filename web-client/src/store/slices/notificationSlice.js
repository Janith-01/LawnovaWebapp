import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    invitations: [], // Array of invitation objects
    systemNotices: [], // System messages
    unreadCount: 0,
    isConnected: false,
};

const notificationSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        setSocketConnected: (state, action) => {
            state.isConnected = action.payload;
        },
        setInvitations: (state, action) => {
            state.invitations = action.payload;
            state.unreadCount = state.invitations.filter(i => i.status === 'Pending').length + state.systemNotices.filter(n => !n.read).length;
        },
        addInvitation: (state, action) => {
            // Check if exists to avoid duplicates
            const exists = state.invitations.find(i => i.roomId === action.payload.roomId);
            if (!exists) {
                state.invitations.unshift({ ...action.payload, isNew: true });
                state.unreadCount += 1;
            }
        },
        updateInvitationStatus: (state, action) => {
            const { roomId, status } = action.payload;
            const invite = state.invitations.find(i => i.roomId === roomId);
            if (invite) {
                invite.status = status;
                // Re-calculate unread
                state.unreadCount = state.invitations.filter(i => i.status === 'Pending').length + state.systemNotices.filter(n => !n.read).length;
            }
        },
        removeInvitation: (state, action) => {
            state.invitations = state.invitations.filter(i => i.roomId !== action.payload);
            state.unreadCount = state.invitations.filter(i => i.status === 'Pending').length + state.systemNotices.filter(n => !n.read).length;
        },
        addSystemNotice: (state, action) => {
            state.systemNotices.unshift({ ...action.payload, read: false, timestamp: new Date().toISOString() });
            state.unreadCount += 1;
        },
        markAsRead: (state) => {
            state.unreadCount = 0;
            // Optionally mark individual items as read logic here
        }
    },
});

export const {
    setSocketConnected,
    setInvitations,
    addInvitation,
    updateInvitationStatus,
    removeInvitation,
    addSystemNotice,
    markAsRead
} = notificationSlice.actions;

export default notificationSlice.reducer;
