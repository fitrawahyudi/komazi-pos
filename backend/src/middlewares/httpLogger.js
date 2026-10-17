import crypto from 'crypto';
import logger from '../utils/logger.js';

/**
 * Sanitizes URL path and query parameters to avoid leaking sensitive information.
 * (PRD Section 4: Jangan menampilkan token, cookie, password, atau query string sensitif)
 */
function sanitizeUrl(originalUrl) {
  try {
    const [path, queryString] = originalUrl.split('?');
    if (!queryString) return path;

    const params = new URLSearchParams(queryString);
    const SENSITIVE_KEYS = ['password', 'token', 'jwt', 'secret', 'key', 'api_key', 'apikey'];

    for (const key of params.keys()) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        params.set(key, '[REDACTED]');
      }
    }

    const cleanQuery = params.toString();
    return cleanQuery ? `${path}?${cleanQuery}` : path;
  } catch {
    return originalUrl;
  }
}

/**
 * Checks if the request is a frequent, routine health-check or status ping.
 * (PRD Section 4: Hindari mencatat health check berulang secara berlebihan)
 */
function isRoutineHealthCheck(url) {
  const cleanPath = url.split('?')[0];
  return (
    cleanPath === '/api/v1/health' ||
    cleanPath === '/api/health' ||
    cleanPath === '/health' ||
    cleanPath === '/'
  );
}

/**
 * HTTP Request Logging Middleware
 * Generates/reads Request Correlation ID, measures response time, and logs formatted HTTP access.
 */
export function httpLogger(req, res, next) {
  // 1. Establish Request ID (Correlation ID)
  const incomingReqId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const reqId = typeof incomingReqId === 'string' && incomingReqId.trim()
    ? incomingReqId.trim()
    : `req-${crypto.randomUUID().slice(0, 8)}`;

  req.id = reqId;
  res.setHeader('x-request-id', reqId);

  const startTime = Date.now();
  const sanitizedPath = sanitizeUrl(req.originalUrl || req.url);

  // 2. Intercept response completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Suppress spammy routine health checks when response is healthy 200 OK
    if (isRoutineHealthCheck(req.originalUrl || req.url) && statusCode === 200) {
      if (process.env.LOG_LEVEL === 'debug') {
        logger.http.debug(`${req.method} ${sanitizedPath} ${statusCode} ${duration}ms`, {
          reqId,
          method: req.method,
          path: sanitizedPath,
          status: statusCode,
          duration: `${duration}ms`,
        });
      }
      return;
    }

    const logMessage = `${req.method} ${sanitizedPath} ${statusCode} ${duration}ms`;
    const meta = {
      reqId,
      method: req.method,
      path: sanitizedPath,
      status: statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
    };

    if (statusCode >= 500) {
      logger.http.error(logMessage, meta);
    } else if (statusCode >= 400) {
      logger.http.warn(logMessage, meta);
    } else {
      logger.http.info(logMessage, meta);
    }
  });

  next();
}

export default httpLogger;
