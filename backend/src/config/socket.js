import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
          .split(',')
          .map((o) => o.trim());

        if (
          allowedOrigins.includes(origin) ||
          origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/)
        ) {
          return callback(null, origin);
        }
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.IO] Client connected: ${socket.id}`);

    // Helper safely extract station code string from payload (string or { stationCode })
    const extractStationCode = (payload) => {
      if (!payload) return null;
      if (typeof payload === 'string') return payload.trim();
      if (typeof payload === 'object') {
        const val = payload.stationCode || payload.code || payload.station || '';
        return typeof val === 'string' ? val.trim() : null;
      }
      return null;
    };

    // Join room berdasarkan station (misal: 'KITCHEN_MAIN', 'BAR_MAIN', 'KITCHEN', 'BAR')
    socket.on('station:join', (payload) => {
      const code = extractStationCode(payload);
      if (code) {
        const room = `station:${code.toUpperCase()}`;
        socket.join(room);
        console.log(`📡 [Socket.IO] Client ${socket.id} joined room: ${room}`);
      }
    });

    socket.on('station:leave', (payload) => {
      const code = extractStationCode(payload);
      if (code) {
        const room = `station:${code.toUpperCase()}`;
        socket.leave(room);
        console.log(`📡 [Socket.IO] Client ${socket.id} left room: ${room}`);
      }
    });

    // POS / Monitoring global room
    socket.on('orders:join', () => {
      socket.join('orders');
      console.log(`📡 [Socket.IO] Client ${socket.id} joined room: orders`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`❌ [Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

/**
 * Emit event ke station tertentu (misal: 'KITCHEN_MAIN', 'BAR_MAIN')
 */
export function emitToStation(stationCode, event, data) {
  if (!io) return;
  const targetRoom = `station:${(stationCode || '').toUpperCase()}`;
  io.to(targetRoom).emit(event, data);
  // Juga kirim ke monitor umum POS
  io.to('orders').emit(event, { ...data, targetStation: stationCode });
}

/**
 * Emit global order event ke seluruh client / room
 */
export function emitOrderEvent(event, data) {
  if (!io) return;
  io.emit(event, data);
}
