import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/error.js';
import { errorResponse } from './utils/response.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middlewares (PRD Section 12)
app.use(helmet());
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
        .split(',')
        .map((o) => o.trim());

      // Always allow localhost variants
      if (
        allowedOrigins.includes(origin) ||
        origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/)
      ) {
        return callback(null, origin);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Logging
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Helper untuk memeriksa apakah request berasal dari mesin lokal/development
const isLocalOrDev = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return (
    process.env.NODE_ENV !== 'production' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.includes('localhost')
  );
};

// Rate limiting khusus endpoint autentikasi (login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100, // 100 percobaan per window
  skipSuccessfulRequests: true, // Login yang berhasil tidak menghabiskan kuota
  skip: isLocalOrDev, // Lewatkan pada lingkungan lokal/development
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login yang gagal. Silakan coba lagi beberapa saat.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting umum API (ramah terhadap POS kasir, KDS polling, & multi-tab)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 50000, // 50.000 requests per 15 menit
  skip: isLocalOrDev, // Lewatkan pada lingkungan lokal/development
  message: {
    success: false,
    message: 'Terlalu banyak permintaan API. Silakan coba lagi nanti.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

import { webhookCallback } from 'grammy';
import { bot } from './bot/index.js';

// Mount grammY telegram webhook HANYA jika TELEGRAM_WEBHOOK_URL diset (Production / Webhook mode)
if (process.env.TELEGRAM_WEBHOOK_URL) {
  const webhookPath = process.env.TELEGRAM_WEBHOOK_PATH || 'hook';
  app.post(
    `/telegram/${webhookPath}`,
    webhookCallback(bot, 'express', {
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    })
  );
}

// Terapkan rate limiter
app.use(['/api/v1/auth/login', '/api/auth/login'], authLimiter);
app.use('/api/', apiLimiter);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
