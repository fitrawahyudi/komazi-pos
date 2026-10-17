import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';
import prisma from '../config/db.js';
import { getJwtSecrets } from '../utils/security.js';

export async function authenticate(req, res, next) {
  // 1. Cek autentikasi Kunci API (API Key) untuk perangkat tablet KDS / BDS
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['x-apikey'];
  const apiKeyQuery = req.query?.api_key || req.query?.apikey;
  const providedApiKey = apiKeyHeader || apiKeyQuery;

  if (providedApiKey) {
    const configuredApiKey = process.env.KDS_API_KEY;
    let isValidKey = providedApiKey === configuredApiKey;

    if (!isValidKey) {
      try {
        const dbKey = await prisma.setting.findUnique({ where: { key: 'kdsApiKey' } });
        if (dbKey && dbKey.value === providedApiKey) {
          isValidKey = true;
        }
      } catch {}
    }

    if (!isValidKey) {
      return errorResponse(res, 'Akses ditolak: API Key tidak valid', 401);
    }

    // Restriksi Akses (Scoped Permissions): Hanya diizinkan untuk KDS & BDS
    const requestPath = req.originalUrl || req.baseUrl || req.path || '';
    const isKdsOrBdsRoute = requestPath.includes('/kds') || requestPath.includes('/bds');

    if (!isKdsOrBdsRoute) {
      return errorResponse(
        res,
        'Akses ditolak: Kunci API dibatasi khusus untuk operasional KDS/BDS dapur dan dilarang mengakses data finansial atau POS',
        403
      );
    }

    const isBarRoute = requestPath.includes('/bds');
    req.user = {
      id: 0,
      name: isBarRoute ? 'Bar Tablet (BDS API Key)' : 'Dapur Tablet (KDS API Key)',
      username: isBarRoute ? 'bds_device' : 'kds_device',
      role: isBarRoute ? 'BARISTA' : 'KITCHEN',
      isActive: true,
      isApiKey: true,
      scopes: ['kds:read', 'kds:bump', 'bds:read', 'bds:bump'],
    };

    return next();
  }

  // 2. Autentikasi Standar JWT Bearer Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Akses ditolak: Token autentikasi atau API Key tidak ditemukan', 401);
  }

  const token = authHeader.split(' ')[1];

  if (token && token.startsWith('mock-jwt-token-')) {
    return errorResponse(res, 'Sesi autentikasi lokal kedaluwarsa. Silakan login kembali dengan akun resmi.', 401);
  }

  let decoded;
  try {
    const { jwtSecret } = getJwtSecrets();
    // Sesi persisten di aplikasi POS: Verifikasi kriptografis integritas tanda tangan token.
    // Abaikan masa berlaku clock (ignoreExpiration: true) agar sesi tidak expired otomatis
    // selama pengguna belum logout dan akunnya belum dinonaktifkan di database.
    decoded = jwt.verify(token, jwtSecret, { ignoreExpiration: true });
  } catch (err) {
    return errorResponse(res, 'Sesi tidak valid, silakan login kembali', 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, username: true, role: true, isActive: true, tokenVersion: true },
    });

    if (!user || !user.isActive) {
      return errorResponse(res, 'User tidak ditemukan atau telah dinonaktifkan', 401);
    }

    if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
      return errorResponse(res, 'Sesi telah dicabut karena perubahan password. Silakan login kembali.', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    return errorResponse(res, 'Gagal memverifikasi user', 500);
  }
}

export async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.startsWith('mock-jwt-token-')) {
    return next();
  }

  try {
    const { jwtSecret } = getJwtSecrets();
    const decoded = jwt.verify(token, jwtSecret, { ignoreExpiration: true });

    if (decoded?.id) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, username: true, role: true, isActive: true, tokenVersion: true },
      });
      if (user && user.isActive) {
        if (decoded.tokenVersion === undefined || user.tokenVersion === decoded.tokenVersion) {
          req.user = user;
        }
      }
    }
  } catch {}

  next();
}

