/**
 * Job Runner Service.
 * Menangani claim atomik, lease timeout, deduplikasi idempotency key,
 * eksekusi handler, retry exponential backoff, dan pencatatan riwayat JobRun.
 */

import os from 'os';
import prisma from '../../config/db.js';
import { computeNextRunAt } from './jobRegistryService.js';
import { jobAuditService } from './jobAuditService.js';
import { executeReportJob } from './handlers/reportHandler.js';
import { executeBackupJob } from './handlers/backupHandler.js';
import { executeMonitoringJob } from './handlers/monitoringHandler.js';
import { executeReminderJob } from './handlers/reminderHandler.js';
import { executeAiTaskJob } from './handlers/aiTaskHandler.js';
import { executeDepreciationJob } from './handlers/depreciationHandler.js';
import logger from '../../utils/logger.js';

const WORKER_ID = `${os.hostname()}:${process.pid}`;

/**
 * Bungkus eksekusi fungsi dalam timeout menggunakan Promise.race
 */
function withTimeout(promise, timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Batas waktu eksekusi job habis (${Math.round(timeoutMs / 1000)} detik)`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Sanitasi pesan error agar tidak mencetak kredensial rahasia
 */
function redactErrorMessage(msg) {
  if (!msg) return 'Unknown error';
  return String(msg)
    .replace(/(bearer\s+)[^\s]+/gi, '$1***')
    .replace(/(token=)[^\s&]+/gi, '$1***')
    .replace(/(password=)[^\s&]+/gi, '$1***')
    .replace(/(key=)[^\s&]+/gi, '$1***')
    .slice(0, 500);
}

export const jobRunnerService = {
  /**
   * Menjalankan handler sesuai tipe job.
   */
  async dispatchHandler(job) {
    switch (job.jobType) {
      case 'REPORT':
        return executeReportJob(job);
      case 'BACKUP':
        return executeBackupJob(job);
      case 'MONITORING':
        return executeMonitoringJob(job);
      case 'REMINDER':
        return executeReminderJob(job);
      case 'AI_TASK':
        return executeAiTaskJob(job);
      case 'DEPRECIATION':
        return executeDepreciationJob(job);
      default:
        throw new Error(`Job type '${job.jobType}' tidak memiliki handler terdaftar.`);
    }
  },

  /**
   * Melakukan atomic claim dan mengeksekusi job terjadwal.
   * @param {object} job - Record ScheduledJob
   * @param {Date} [scheduledFor]
   * @param {number} [attempt=1]
   */
  async claimAndRun(job, scheduledFor = new Date(), attempt = 1) {
    const now = new Date();
    const timeoutMs = (job.timeoutSeconds || 60) * 1000;
    const leaseExpiresAt = new Date(now.getTime() + timeoutMs + 10000);

    // 1. Idempotency Key unik deterministik
    const schedTimestamp = Math.floor(new Date(scheduledFor || now).getTime() / 1000);
    const idempotencyKey = `${job.id}_${schedTimestamp}_v${job.version}_att${attempt}`;

    // 2. Pre-check idempotency key untuk mencegah log error P2002 dari driver database
    const existingRun = await prisma.jobRun.findUnique({
      where: { idempotencyKey },
    });
    if (existingRun) {
      logger.scheduler.info(`[JobRunner] Job #${job.id} already claimed by another worker (idempotency dedupe).`);
      return { skipped: true, reason: 'ALREADY_CLAIMED' };
    }

    // 3. Atomic Claim via database
    let jobRun;
    try {
      jobRun = await prisma.jobRun.create({
        data: {
          jobId: job.id,
          scheduledFor: new Date(scheduledFor || now),
          startedAt: now,
          status: 'running',
          attempt,
          idempotencyKey,
          workerId: WORKER_ID,
          leaseExpiresAt,
        },
      });
    } catch (claimErr) {
      // Jika terjadi collision (P2002 Unique constraint), berarti job sudah diklaim worker lain
      if (claimErr.code === 'P2002') {
        logger.scheduler.info(`[JobRunner] Job #${job.id} already claimed by another worker (idempotency dedupe).`);
        return { skipped: true, reason: 'ALREADY_CLAIMED' };
      }
      throw claimErr;
    }

    logger.scheduler.info(`[JobRunner] Claimed Job #${job.id} '${job.name}' (Run #${jobRun.id}, attempt ${attempt})`);

    // 3. Eksekusi Handler dengan Timeout
    let result = null;
    let executionError = null;

    try {
      result = await withTimeout(this.dispatchHandler(job), timeoutMs);
    } catch (err) {
      executionError = err;
    }

    const finishedAt = new Date();

    // 4. Kasus SUKSES
    if (!executionError) {
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: 'succeeded',
          finishedAt,
          resultSummary: result ? JSON.stringify(result).slice(0, 1000) : 'Success',
        },
      });

      // Hitung jadwal berikutnya
      let nextRunAt = null;
      let newEnabled = job.enabled;

      if (job.scheduleType === 'once') {
        newEnabled = false; // Job sekali jalan dinonaktifkan
      } else {
        try {
          nextRunAt = computeNextRunAt(job.scheduleType, job.scheduleExpression, job.timezone, finishedAt);
        } catch (nextErr) {
          logger.scheduler.warn(`[JobRunner] Failed to compute next run for job #${job.id}: ${nextErr.message}`);
        }
      }

      await prisma.scheduledJob.update({
        where: { id: job.id },
        data: {
          lastRunAt: finishedAt,
          nextRunAt,
          enabled: newEnabled,
          version: { increment: 1 },
        },
      });

      logger.scheduler.info(`[JobRunner] Job #${job.id} succeeded in ${finishedAt - now}ms`);
      return { success: true, runId: jobRun.id, result };
    }

    // 5. Kasus GAGAL (Handling Retry & Backoff)
    const redactedMsg = redactErrorMessage(executionError.message);
    logger.scheduler.warn(`[JobRunner] Job #${job.id} failed on attempt ${attempt}: ${redactedMsg}`);

    const retryLimit = job.retryLimit || 3;
    const canRetry = attempt < retryLimit;

    if (canRetry) {
      // Exponential backoff dengan jitter: (2^attempt * 10 detik) + random(0-5s)
      const backoffMs = Math.min(Math.pow(2, attempt) * 10000, 300000) + Math.floor(Math.random() * 5000);
      const retryAt = new Date(finishedAt.getTime() + backoffMs);

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: 'retrying',
          finishedAt,
          errorCode: 'RETRY_SCHEDULED',
          errorMessageRedacted: redactedMsg,
        },
      });

      await prisma.scheduledJob.update({
        where: { id: job.id },
        data: {
          nextRunAt: retryAt,
          version: { increment: 1 },
        },
      });

      logger.scheduler.info(`[JobRunner] Job #${job.id} scheduled for retry #${attempt + 1} at ${retryAt.toISOString()}`);
      return { success: false, willRetry: true, attempt, nextRetryAt: retryAt };
    }

    // Gagal total setelah retry habis
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'failed',
        finishedAt,
        errorCode: 'MAX_RETRIES_EXCEEDED',
        errorMessageRedacted: redactedMsg,
      },
    });

    // Tetap majukan nextRunAt untuk siklus cron berikutnya agar jadwal tidak mati selamanya
    let nextRunAt = null;
    if (job.scheduleType !== 'once') {
      try {
        nextRunAt = computeNextRunAt(job.scheduleType, job.scheduleExpression, job.timezone, finishedAt);
      } catch {}
    }

    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: finishedAt,
        nextRunAt,
        enabled: job.scheduleType === 'once' ? false : job.enabled,
        version: { increment: 1 },
      },
    });

    return { success: false, failed: true, error: redactedMsg };
  },

  /**
   * Menjalankan job secara on-demand / manual (dipicu dari Telegram / OpenClaw).
   */
  async triggerManualRun(jobId, actor = { type: 'USER', id: 'unknown', name: 'User' }) {
    const job = await prisma.scheduledJob.findFirst({
      where: { id: Number(jobId), deletedAt: null },
    });
    if (!job) throw new Error(`Jadwal #${jobId} tidak ditemukan.`);

    await jobAuditService.log({
      jobId: job.id,
      action: 'MANUAL_RUN',
      actorType: actor.type || 'USER',
      actorId: actor.id,
      actorName: actor.name,
      details: { manualTrigger: true },
    });

    // Eksekusi segera
    return this.claimAndRun(job, new Date(), 1);
  },

  /**
   * Pulihkan job run yang menggantung karena server mati mendadak saat status running.
   */
  async recoverStaleRuns() {
    try {
      const now = new Date();
      const staleRuns = await prisma.jobRun.findMany({
        where: {
          status: 'running',
          leaseExpiresAt: { lt: now },
        },
        include: { job: true },
        take: 20,
      });

      for (const run of staleRuns) {
        logger.scheduler.warn(`[JobRunner] Recovering stale run #${run.id} for job #${run.jobId} (lease expired)`);
        await prisma.jobRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            finishedAt: now,
            errorCode: 'LEASE_EXPIRED',
            errorMessageRedacted: 'Worker lease expired before completion (worker crash or timeout)',
          },
        });
      }
      return staleRuns.length;
    } catch (err) {
      logger.scheduler.warn(`[JobRunner] Error recovering stale runs: ${err.message}`);
      return 0;
    }
  },
};

