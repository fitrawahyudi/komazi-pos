import 'dotenv/config';
import './bot/utils/clonePatch.js';

import http from 'http';
import app from './app.js';
import prisma from './config/db.js';
import { initSocket } from './config/socket.js';
import logger from './utils/logger.js';

import { initBot } from './bot/index.js';
import './bot/notifier.js';
import { startJobs } from './bot/jobs.js';
import { initFirebaseAdmin } from './services/fcm.service.js';
import { initNotificationEventSubscriber } from './services/notificationEventSubscriber.js';

const PORT = process.env.PORT || process.env.SERVER_PORT || 4000;

async function startServer() {
  try {
    // Verify database connection
    await prisma.$connect();
    logger.db.success('Connected to MySQL database via Prisma ORM');

    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, '0.0.0.0', async () => {
      logger.info(`Komazi POS Server running at http://localhost:${PORT}`);
      logger.info(`API Base URL: http://localhost:${PORT}/api`);
      logger.info(`Realtime WebSockets initialized (Socket.IO)`);
      logger.info(`Frontend Origin: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);

      // Initialize Firebase Admin & Core Event Notification Subscriber
      initFirebaseAdmin();
      initNotificationEventSubscriber();

      // Initialize Telegram Bot & Cron Jobs (Polling / Webhook)
      await initBot();
      startJobs();
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

startServer();
