import { io } from 'socket.io-client';
import { isNative } from './platform';

let socket = null;
let currentJoinedStation = null;

export function getSocketUrl() {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // 1. Explicit VITE_SOCKET_URL
  const envSocketUrl = (import.meta.env.VITE_SOCKET_URL || '').trim();
  if (envSocketUrl) {
    // Pada browser yang dimuat via HTTPS, koneksi langsung ke ws:// / http://
    // diblokir oleh browser sebagai Mixed Content.
    // Gunakan window.location.origin agar proxy HTTPS/WSS Vite dev server menangani koneksi.
    if (isHttps && !isNative && envSocketUrl.startsWith('http://')) {
      return window.location.origin;
    }
    return envSocketUrl;
  }

  // 2. Fallback dari VITE_API_URL
  const envApiUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envApiUrl && !envApiUrl.startsWith('/')) {
    try {
      const parsed = new URL(envApiUrl);
      if (isHttps && !isNative && parsed.protocol === 'http:') {
        return window.location.origin;
      }
      return parsed.origin;
    } catch {}
  }

  // 3. Fallback lingkungan browser
  if (typeof window !== 'undefined' && window.location.hostname) {
    // Pada origin HTTPS (misal Vite basicSsl atau reverse proxy), selalu gunakan origin saat ini
    if (isHttps && !isNative) {
      return window.location.origin;
    }
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:4000`;
    }
    return window.location.origin;
  }

  return 'http://localhost:4000';
}

export function getStoredToken() {
  if (typeof localStorage === 'undefined') return '';
  return (
    localStorage.getItem('komazi-auth-token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('komazi_token') ||
    ''
  );
}

export function syncSocketAuthToken() {
  if (socket) {
    const token = getStoredToken();
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }
}

export function getSocket() {
  if (!socket) {
    const socketUrl = getSocketUrl();

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: (cb) => {
        cb({ token: getStoredToken() });
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('reconnect_attempt', () => {
      socket.auth = { token: getStoredToken() };
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected, socket ID:', socket.id);
      socket.emit('orders:join');
      if (currentJoinedStation) {
        socket.emit('station:join', { stationCode: currentJoinedStation });
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket.IO] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket.IO] Connection error:', error.message);
    });
  }

  return socket;
}

export function joinStationRoom(stationCode) {
  currentJoinedStation = stationCode;
  const s = getSocket();
  if (s.connected) {
    s.emit('station:join', { stationCode });
  }
}

export function leaveStationRoom(stationCode) {
  if (currentJoinedStation === stationCode) {
    currentJoinedStation = null;
  }
  const s = getSocket();
  if (s.connected) {
    s.emit('station:leave', { stationCode });
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentJoinedStation = null;
  }
}
