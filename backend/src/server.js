import 'dotenv/config';

import http from 'http';
import app from './app.js';
import prisma from './config/db.js';
import { initSocket } from './config/socket.js';

import { initBot } from './bot/index.js';
import './bot/notifier.js';
import { startJobs } from './bot/jobs.js';

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✅ Connected to MySQL database via Prisma ORM');

    const httpServer = http.createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, async () => {
      console.log(`🚀 Komazi POS Server running at http://localhost:${PORT}`);
      console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
      console.log(`🔌 Realtime WebSockets initialized (Socket.IO)`);
      console.log(`☕ Frontend Origin: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);

      // Initialize Telegram Bot & Cron Jobs (Polling / Webhook)
      await initBot();
      startJobs();
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
