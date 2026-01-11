import { io, type Socket } from 'socket.io-client';

type LobbyClientOptions = {
  userId: string;
  userEmail?: string;
  userRole?: string;
};

type NotificationsClientOptions = {
  userId: string;
};

let lobbySocket: Socket | null = null;
let notificationsSocket: Socket | null = null;

function getSocketBaseUrl(): string {
  const viteEnv = (import.meta as any)?.env || {};
  return viteEnv.VITE_SOCKET_BASE_URL || 'http://localhost:5000';
}

export function getLobbySocket(): Socket {
  if (lobbySocket) return lobbySocket;

  const socketBaseUrl = getSocketBaseUrl();
  lobbySocket = io(`${socketBaseUrl}/lobby`, {
    transports: ['polling', 'websocket'], // Allow polling fallback
    path: '/socket.io',
    auth: {
      token: localStorage.getItem('accessToken')
    },
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  return lobbySocket;
}

export function connectLobbySocket(options: LobbyClientOptions): Socket {
  const socket = getLobbySocket();

  // Backend lobby namespace requires `userId` during handshake.
  // Browser Socket.IO clients can't reliably set custom headers for WS, so use `auth`.
  socket.auth = {
    ...(socket.auth || {}),
    token: localStorage.getItem('accessToken'),
    userId: options.userId,
    ...(options.userEmail ? { userEmail: options.userEmail } : {}),
    ...(options.userRole ? { userRole: options.userRole } : {}),
  };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectLobbySocket(): void {
  if (!lobbySocket) return;
  try {
    lobbySocket.removeAllListeners();
  } catch {
    // ignore
  }
  try {
    lobbySocket.disconnect();
  } catch {
    // ignore
  }
  lobbySocket = null;
}

// ============================================
// Notifications Socket (real-time updates)
// ============================================

export function getNotificationsSocket(): Socket {
  if (notificationsSocket) return notificationsSocket;

  const socketBaseUrl = getSocketBaseUrl();
  notificationsSocket = io(`${socketBaseUrl}/notifications`, {
    transports: ['polling', 'websocket'], // Allow polling fallback
    path: '/socket.io',
    auth: {
      token: localStorage.getItem('accessToken')
    },
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  return notificationsSocket;
}

export function connectNotificationsSocket(options: NotificationsClientOptions): Socket {
  const socket = getNotificationsSocket();

  // Backend notifications namespace requires `userId` during handshake.
  socket.auth = {
    ...(socket.auth || {}),
    token: localStorage.getItem('accessToken'),
    userId: options.userId
  };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectNotificationsSocket(): void {
  if (!notificationsSocket) return;
  try {
    notificationsSocket.removeAllListeners();
  } catch {
    // ignore
  }
  try {
    notificationsSocket.disconnect();
  } catch {
    // ignore
  }
  notificationsSocket = null;
}

/**
 * Subscribe to session-specific updates
 */
export function subscribeToSession(sessionId: string): void {
  const socket = getNotificationsSocket();
  if (socket.connected) {
    socket.emit('subscribe:session', sessionId);
  }
}

/**
 * Unsubscribe from session-specific updates
 */
export function unsubscribeFromSession(sessionId: string): void {
  const socket = getNotificationsSocket();
  if (socket.connected) {
    socket.emit('unsubscribe:session', sessionId);
  }
}

/**
 * Subscribe to multiple sessions at once
 */
export function subscribeToSessions(sessionIds: string[]): void {
  const socket = getNotificationsSocket();
  if (socket.connected) {
    socket.emit('subscribe:sessions', sessionIds);
  }
}

// Back-compat export (avoid breaking older imports)
export { lobbySocket, notificationsSocket };
