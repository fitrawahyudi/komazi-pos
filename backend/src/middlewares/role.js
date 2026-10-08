import { errorResponse } from '../utils/response.js';

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Autentikasi diperlukan', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, 'Akses ditolak: Anda tidak memiliki izin untuk tindakan ini', 403);
    }

    next();
  };
}
