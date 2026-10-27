/**
 * Cron Worker Engine.
 * Poller background periodik yang memeriksa ScheduledJob yang jatuh tempo (due),
 * mengklaim secara atomik, dan mengeksekusinya dengan kontrol konkurensi.
 */

import prisma from '../../config/db.js';
import { jobRunnerService } from './jobRunnerService.js';
import logger from '../../utils/logger.js';

const POLL_INTERVAL_MS = Number(process.env.CRON_WORKER_INTERVAL_MS) || 15000; // 15 detik
const MAX_CONCURRENT_JOBS = Number(process.env.CRON_WORKER_CONCURRENCY) || 3;

let workerInterval = null;
let isRunning = false;
let isTicking = false;
let lastTickAt = null;
let activeRunningCount = 0;

/**
 * Satu siklus polling worker.
 */
async function tick() {
  if (isTicking) return;
  isTicking = true;
  lastTickAt = new Date();

  try {
    const now = new Date();

    // 1. Ambil job yang aktif, sudah melewati nextRunAt, dan tidak sedang berjalan dengan lease aktif
    const dueJobs = await prisma.scheduledJob.findMany({
      where: {
        enabled: true,
        deletedAt: null,
        nextRunAt: { lte: now },
        runs: {
          none: {
            status: 'running',
            leaseExpiresAt: { gt: now },
          },
        },
      },
      orderBy: { nextRunAt: 'asc' },
      take: MAX_CONCURRENT_JOBS * 2,
    });

    if (dueJobs.length === 0) {
      return;
    }

    logger.scheduler.info(`[CronWorker] Found ${dueJobs.length} due job(s) ready for execution.`);

    // 2. Eksekusi dengan pembatasan konkurensi (batch pool)
    for (const job of dueJobs) {
      // Jika worker sudah mencapai batas kapasitas paralel, tunggu siklus berikutnya
      if (activeRunningCount >= MAX_CONCURRENT_JOBS) {
        logger.scheduler.info(`[CronWorker] Concurrency limit reached (${activeRunningCount}/${MAX_CONCURRENT_JOBS}). Deferring remaining jobs.`);
        break;
      }

      activeRunningCount++;

      // Eksekusi non-blocking asynchronously agar satu job lambat tidak memblokir loop
      jobRunnerService
        .claimAndRun(job, job.nextRunAt || now, 1)
        .catch((err) => {
          logger.scheduler.error(`[CronWorker] Unexpected unhandled error executing job #${job.id}:`, err);
        })
        .finally(() => {
          activeRunningCount = Math.max(0, activeRunningCount - 1);
        });
    }
  } catch (err) {
    logger.scheduler.error(`[CronWorker] Error during tick execution: ${err.message}`);
  } finally {
    isTicking = false;
  }
}

/**
 * Memulai worker polling cron engine.
 */
export async function startCronWorker() {
  if (isRunning) {
    logger.scheduler.info('[CronWorker] Already running.');
    return;
  }

  isRunning = true;
  logger.scheduler.info(`[CronWorker] Starting engine (interval: ${POLL_INTERVAL_MS}ms, maxConcurrency: ${MAX_CONCURRENT_JOBS})`);

  try {
    // 1. Bersihkan job runs yang menggantung dari restart sebelumnya
    await jobRunnerService.recoverStaleRuns();
  } catch (startupErr) {
    logger.scheduler.warn(`[CronWorker] Warning on startup checks: ${startupErr.message}`);
  }

  // 3. Jalankan tick perdana segera, lalu pasang interval
  tick().catch((e) => logger.scheduler.error('[CronWorker] Initial tick failed:', e));
  workerInterval = setInterval(tick, POLL_INTERVAL_MS);
}

/**
 * Menghentikan worker polling cron engine.
 */
export function stopCronWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  isRunning = false;
  logger.scheduler.info('[CronWorker] Engine stopped.');
}

/**
 * Cek status kesehatan worker engine.
 */
export function getCronWorkerStatus() {
  return {
    isRunning,
    lastTickAt,
    activeRunningCount,
    concurrencyLimit: MAX_CONCURRENT_JOBS,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}
