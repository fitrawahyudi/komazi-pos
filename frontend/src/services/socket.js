import { io } from 'socket.io-client';

let socket = null;
let currentJoinedStation = null;

export function getSocket() {
  if (!socket) {
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost'
        ? `http://${window.location.hostname}:4000`
        : 'http://192.168.1.13:4000');
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected, socket ID:', socket.id);
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
