import { errorResponse } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
  console.error('[Error Handler]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan internal pada server';

  return errorResponse(res, message, statusCode, err.errors || null);
}
