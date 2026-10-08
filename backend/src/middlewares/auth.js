import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';
import prisma from '../config/db.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Akses ditolak: Token autentikasi tidak ditemukan', 401);
  }

  const token = authHeader.split(' ')[1];

  if (token && token.startsWith('mock-jwt-token-')) {
    return errorResponse(res, 'Sesi autentikasi lokal kedaluwarsa. Silakan login kembali dengan akun resmi.', 401);
  }

  let decoded;
  try {
    const secret = process.env.JWT_SECRET || 'komazi_pos_jwt_super_secret_key_2026_coffeeworkspace';
    decoded = jwt.verify(token, secret);
  } catch (err) {
    // Graceful recovery jika token sah namun telah melewati batas waktu (TokenExpiredError)
    if (err.name === 'TokenExpiredError') {
      const payload = jwt.decode(token);
      if (payload && payload.id) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { id: true, name: true, username: true, role: true, isActive: true },
          });

          if (user && user.isActive) {
            req.user = user;
            return next();
          }
        } catch (dbErr) {
          console.warn('[AuthMiddleware] Error fetching user during expired token recovery:', dbErr.message);
        }
      }
    }
    return errorResponse(res, 'Sesi kadaluarsa atau token tidak valid', 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'User tidak ditemukan atau telah dinonaktifkan', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    return errorResponse(res, 'Gagal memverifikasi user', 500);
  }
}
