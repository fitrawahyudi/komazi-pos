import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * Prisma Client Configuration with Controlled Logging (PRD Section 3)
 * - Hentikan output SQL mentah prisma:query pada konfigurasi normal production & development.
 * - Pertahankan warning dan error Prisma.
 * - Sediakan environment variable PRISMA_QUERY_LOG=true untuk mengaktifkan query logging ketika debugging.
 * - Deduplikasi query yang sama berulang kali dalam jendela singkat.
 */
const enableQueryLog = process.env.PRISMA_QUERY_LOG === 'true';

const logOptions = [
  { emit: 'event', level: 'warn' },
  { emit: 'event', level: 'error' },
];

if (enableQueryLog) {
  logOptions.push({ emit: 'event', level: 'query' });
}

export const prisma = new PrismaClient({
  log: logOptions,
});

let lastQuery = '';
let lastQueryTime = 0;

if (enableQueryLog) {
  prisma.$on('query', (e) => {
    const now = Date.now();
    // Cegah pencatatan query yang sama berulang kali dalam 500ms
    if (e.query === lastQuery && now - lastQueryTime < 500) {
      return;
    }
    lastQuery = e.query;
    lastQueryTime = now;

    const duration = `${e.duration}ms`;
    logger.db.debug(`SQL Query (${duration}) | query=${e.query}`, {
      duration,
      params: e.params,
    });
  });
}

prisma.$on('warn', (e) => {
  logger.db.warn(`Prisma Warning: ${e.message}`, { target: e.target });
});

prisma.$on('error', (e) => {
  logger.db.error(`Prisma Error: ${e.message}`, { target: e.target });
});

export default prisma;
