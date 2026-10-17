import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Global Express Error Handler Middleware (PRD Section 7)
 * - Mencatat unhandled exception ke structured logger tanpa menelan exception.
 * - Mencegah duplikasi log jika error sudah dicatat oleh service sebelumnya (_logged flag).
 * - Menyaring dan me-redact field sensitif secara otomatis.
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const message = err.message || 'Terjadi kesalahan internal pada server';

  // Cegah pencatatan error ganda jika service atau controller telah mencatatnya
  if (!err._logged) {
    err._logged = true;
    logger.http.error(`${req.method} ${req.originalUrl || req.url} failed with ${statusCode}: ${message}`, {
      reqId: req.id,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code,
      },
    });
  }

  // Saring error message agar tidak membocorkan informasi internal/database di mode production
  const isProduction = process.env.NODE_ENV === 'production';
  const clientMessage =
    statusCode >= 500 && isProduction
      ? 'Terjadi kesalahan internal pada server. Silakan hubungi administrator.'
      : message;

  return errorResponse(res, clientMessage, statusCode, err.errors || null);
}

export default errorHandler;
