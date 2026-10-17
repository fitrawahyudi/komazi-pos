import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './db.js';
import { isAllowedOrigin, getJwtSecrets } from '../utils/security.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) {
          return callback(null, origin || true);
        }
        callback(new Error('Koneksi WebSocket ditolak oleh kebijakan CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
    transports: ['websocket', 'polling'],
  });

  // Autentikasi koneksi WebSocket untuk melindungi data pesanan dari penyadapan
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      const query = socket.handshake.query || {};
      const token = auth.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
      const apiKey = auth.apiKey || query.apiKey || socket.handshake.headers?.['x-api-key'];

      // 1. Izinkan jika KDS API Key valid
      const configuredApiKey = process.env.KDS_API_KEY || 'komazi_kds_live_secure_token_key_2026';
      if (apiKey && apiKey === configuredApiKey) {
        socket.isApiKey = true;
        return next();
      }

      // 2. Izinkan jika JWT token valid dan akun user aktif
      if (token) {
        try {
          const { jwtSecret } = getJwtSecrets();
          const decoded = jwt.verify(token, jwtSecret, { ignoreExpiration: true });
          if (decoded?.id) {
            const dbUser = await prisma.user.findUnique({
              where: { id: decoded.id },
              select: { id: true, isActive: true, role: true },
            });
            if (dbUser && dbUser.isActive) {
              socket.user = decoded;
              return next();
            }
          }
        } catch {}
      }

      // 3. Izinkan pada mode development
      if (process.env.NODE_ENV !== 'production') {
        return next();
      }

      // 4. Di mode production, jika token tidak disertakan atau belum login,
      // izinkan sebagai guest agar koneksi WebSocket dan indikator status tetap hidup,
      // tetapi kunci akses ke room data pesanan privat (orders & station).
      socket.isGuest = true;
      return next();
    } catch (err) {
      return next(new Error('Gagal memproses autentikasi WebSocket'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.IO] Client connected: ${socket.id} (${socket.user ? `User: ${socket.user.username || socket.user.id}` : socket.isApiKey ? 'KDS API Key' : 'Guest'})`);

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
      if (socket.isGuest && process.env.NODE_ENV === 'production') {
        console.warn(`[Socket.IO] Guest socket ${socket.id} ditolak dari station room`);
        return;
      }
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
      if (socket.isGuest && process.env.NODE_ENV === 'production') {
        console.warn(`[Socket.IO] Guest socket ${socket.id} ditolak dari room orders`);
        return;
      }
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

/**
 * Emit global customer event ke seluruh client / room
 */
export function emitCustomerEvent(event, data) {
  if (!io) return;
  io.emit(event, data);
}

/**
 * Paksa logout semua sesi aktif milik userId tertentu
 * Digunakan saat Owner menonaktifkan atau menghapus akun user
 */
export function emitForceLogout(userId, reason = 'Akun Anda telah dinonaktifkan oleh pemilik kedai.') {
  if (!io) return;
  io.emit('user:force_logout', { userId, reason });
}

