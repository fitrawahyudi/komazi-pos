import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import httpLogger from './middlewares/httpLogger.js';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/error.js';
import { errorResponse } from './utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxy (Nginx, Cloudflare, tunneling) for accurate rate limiting and IP logging
app.set('trust proxy', 1);

// Security middlewares (PRD Section 12)
app.use(helmet());

import { isAllowedOrigin } from './utils/security.js';

app.use(
  cors({
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, origin || true);
      }
      callback(new Error('Akses diblokir oleh kebijakan keamanan CORS'));
    },
    credentials: true,
  })
);

// High-performance, colorful & sanitized HTTP Request Logging (PRD Section 4)
app.use(httpLogger);

// Helper untuk memeriksa apakah request berasal dari mesin lokal/development
const isLocalOrDev = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return (
    process.env.NODE_ENV === 'test' ||
    (process.env.NODE_ENV !== 'production' &&
      (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost')))
  );
};

// Rate limiting ketat untuk endpoint autentikasi (mitigasi brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20, // Maksimal 20 percobaan gagal per 15 menit
  skipSuccessfulRequests: true, // Login yang berhasil tidak menghabiskan kuota
  skip: isLocalOrDev, // Lewatkan pada lingkungan lokal/testing
  message: {
    success: false,
    message: 'Terlalu banyak percobaan autentikasi yang gagal. Silakan coba lagi 15 menit kemudian.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting umum API (ramah terhadap POS kasir, KDS polling, & multi-tab)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 50000, // 50.000 requests per 15 menit
  skip: isLocalOrDev,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan API. Silakan coba lagi nanti.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parser dengan batasan ukuran payload eksplisit untuk mitigasi Memory Exhaustion DoS
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Terapkan rate limiter
app.use(['/api/v1/auth/login', '/api/auth/login'], authLimiter);
app.use('/api/', apiLimiter);

import { bot } from './bot/index.js';

/**
 * Handler serbaguna untuk menerima webhook update dari server Telegram di mode production.
 * Menghindari bug webhookCallback yang menimpa bot.start, serta memverifikasi secret token.
 */
export async function telegramWebhookHandler(req, res) {
  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secretToken) {
      const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (incomingSecret !== secretToken) {
        console.warn('[Telegram Webhook] Akses ditolak: Secret token tidak cocok.');
        return res.status(401).send('Unauthorized secret token');
      }
    }

    const update = req.body;
    if (!update || typeof update !== 'object') {
      return res.status(400).send('Bad Request: Missing update payload');
    }

    if (!bot.isInited()) {
      await bot.init();
    }

    await bot.handleUpdate(update);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[Telegram Webhook] Gagal memproses update:', err.message);
    return res.status(200).send('OK');
  }
}

// Mount Telegram Webhook Endpoints (Mendukung semua format endpoint umum)
const webhookPaths = [
  '/telegram/webhook',
  '/telegram/hook',
  '/api/v1/telegram/webhook',
  '/api/telegram/webhook',
];
if (process.env.TELEGRAM_WEBHOOK_PATH) {
  webhookPaths.push(`/telegram/${process.env.TELEGRAM_WEBHOOK_PATH}`);
}
app.post(webhookPaths, telegramWebhookHandler);

// Tangani webhook Telegram jika server webhook dikonfigurasi ke root domain (POST /)
app.post('/', (req, res, next) => {
  if (req.body && (req.body.update_id !== undefined || req.body.message || req.body.callback_query)) {
    return telegramWebhookHandler(req, res);
  }
  return next();
});

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Mount API (support both /api/v1 and /api)
app.use('/api/v1', apiRoutes);
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    service: 'Komazi POS API',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// 404 Handler
app.use((req, res) => {
  return errorResponse(res, `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`, 404);
});

// Global Error Handler
app.use(errorHandler);

export default app;
