/**
 * Scheduled Job Registry Service.
 * Mengelola pendaftaran, validasi ekspresi cron (Asia/Jakarta),
 * komputasi next_run_at berbasis UTC, dan penegakan RBAC.
 */

import { CronExpressionParser } from 'cron-parser';
import prisma from '../../config/db.js';
import { jobAuditService } from './jobAuditService.js';
import logger from '../../utils/logger.js';

export const ALLOWED_JOB_TYPES = ['REPORT', 'BACKUP', 'MONITORING', 'REMINDER', 'AI_TASK'];
export const ALLOWED_SCHEDULE_TYPES = ['cron', 'once', 'interval'];
export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

/**
 * Validasi ekspresi jadwal dan hitung waktu eksekusi berikutnya (UTC).
 * @param {string} scheduleType - 'cron' | 'once' | 'interval'
 * @param {string} expression - misal '0 22 * * *' atau ISO string
 * @param {string} [timezone='Asia/Jakarta']
 * @param {Date} [fromDate=new Date()]
 * @returns {Date|null} Waktu eksekusi berikutnya dalam UTC
 */
export function computeNextRunAt(scheduleType, expression, timezone = DEFAULT_TIMEZONE, fromDate = new Date()) {
  if (!expression) throw new Error('Ekspresi jadwal wajib diisi.');

  if (scheduleType === 'once') {
    const targetDate = new Date(expression);
    if (isNaN(targetDate.getTime())) {
      throw new Error(`Format tanggal 'once' tidak valid: ${expression}`);
    }
    return targetDate;
  }

  if (scheduleType === 'interval') {
    // Format interval: e.g. "15m", "1h", "30s"
    const match = expression.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
    if (!match) {
      throw new Error(`Format interval tidak valid (contoh: 15m, 1h, 30s): ${expression}`);
    }
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const msMap = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return new Date(fromDate.getTime() + val * msMap[unit]);
  }

  // Schedule type: cron
  try {
    const interval = CronExpressionParser.parse(expression.trim(), {
      tz: timezone || DEFAULT_TIMEZONE,
      currentDate: fromDate,
    });
    return interval.next().toDate();
  } catch (err) {
    throw new Error(`Ekspresi cron '${expression}' tidak valid untuk zona waktu ${timezone}: ${err.message}`);
  }
}

/**
 * Format tanggal UTC ke string waktu lokal WIB yang mudah dibaca.
 */
export function formatLocalWib(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }) + ' WIB';
}

export const jobRegistryService = {
  /**
   * Mendaftarkan job terjadwal baru.
   */
  async createJob(
    {
      name,
      jobType,
      description = null,
      scheduleType = 'cron',
      scheduleExpression,
      timezone = DEFAULT_TIMEZONE,
      executor = 'app',
      payload = {},
      ownerScope = 'ALL',
      retryLimit = 3,
      timeoutSeconds = 60,
      misfirePolicy = 'run_once',
      enabled = true,
      createdById = null,
    },
    actor = { type: 'SYSTEM', id: 'system', name: 'System' }
  ) {
    if (!name || typeof name !== 'string') throw new Error('Nama jadwal (name) wajib diisi.');
    const normalizedJobType = (jobType || '').toUpperCase().trim();
    if (!ALLOWED_JOB_TYPES.includes(normalizedJobType)) {
      throw new Error(`jobType '${jobType}' tidak diizinkan. Pilihan: ${ALLOWED_JOB_TYPES.join(', ')}`);
    }

    const normalizedScheduleType = (scheduleType || 'cron').toLowerCase().trim();
    if (!ALLOWED_SCHEDULE_TYPES.includes(normalizedScheduleType)) {
      throw new Error(`scheduleType '${scheduleType}' tidak diizinkan. Pilihan: ${ALLOWED_SCHEDULE_TYPES.join(', ')}`);
    }

    // Hitung nextRunAt
    const nextRunAt = computeNextRunAt(normalizedScheduleType, scheduleExpression, timezone);

    const job = await prisma.scheduledJob.create({
      data: {
        name: name.trim(),
        jobType: normalizedJobType,
        description: description?.trim() || null,
        scheduleType: normalizedScheduleType,
        scheduleExpression: scheduleExpression.trim(),
        timezone: timezone || DEFAULT_TIMEZONE,
        executor: executor === 'openclaw' ? 'openclaw' : 'app',
        payload: payload || {},
        ownerScope: ownerScope || 'ALL',
        retryLimit: Number.isFinite(Number(retryLimit)) ? Number(retryLimit) : 3,
        timeoutSeconds: Number.isFinite(Number(timeoutSeconds)) ? Number(timeoutSeconds) : 60,
        misfirePolicy: misfirePolicy || 'run_once',
        enabled: Boolean(enabled),
        nextRunAt,
        createdById: createdById ? Number(createdById) : null,
      },
    });

    await jobAuditService.log({
      jobId: job.id,
      action: 'CREATE',
      actorType: actor.type || 'USER',
      actorId: actor.id,
      actorName: actor.name,
      details: { name: job.name, jobType: job.jobType, nextRunAt },
    });

    return job;
  },

  /**
   * Mengambil detail job berdasarkan ID.
   */
  async getJobById(id) {
    return prisma.scheduledJob.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  },

  /**
   * Menampilkan daftar jadwal sesuai batasan izin RBAC dan pagination.
   */
  async listJobs({
    actorRole = 'OWNER',
    actorId = null,
    jobType = null,
    type = null,
    search = null,
    enabled = null,
    enabledOnly = false,
    page = 1,
    limit = 10,
    take = null,
  } = {}) {
    const where = { deletedAt: null };

    if (enabled !== null && enabled !== undefined) {
      where.enabled = Boolean(enabled);
    } else if (enabledOnly) {
      where.enabled = true;
    }

    const filterType = jobType || type;
    if (filterType) {
      where.jobType = filterType.toUpperCase();
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    // RBAC Scope
    if (actorRole !== 'OWNER') {
      if (actorRole === 'MANAGER') {
        where.jobType = { in: ['REPORT', 'MONITORING', 'REMINDER', 'AI_TASK'] };
      } else {
        where.createdById = actorId ? Number(actorId) : -1;
      }
    }

    const pageSize = take ? Number(take) : Math.max(1, Number(limit) || 10);
    const currentPage = Math.max(1, Number(page) || 1);
    const skip = (currentPage - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.scheduledJob.findMany({
        where,
        orderBy: [
          { enabled: 'desc' },
          { nextRunAt: 'asc' },
        ],
        skip,
        take: pageSize,
      }),
      prisma.scheduledJob.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  },

  /**
   * Jeda (Pause) jadwal.
   */
  async pauseJob(id, actor = { type: 'USER', id: 'unknown', name: 'User' }) {
    const job = await prisma.scheduledJob.findFirst({ where: { id: Number(id), deletedAt: null } });
    if (!job) throw new Error(`Jadwal #${id} tidak ditemukan.`);

    const updated = await prisma.scheduledJob.update({
      where: { id: Number(id) },
      data: { enabled: false },
    });

    await jobAuditService.log({
      jobId: job.id,
      action: 'PAUSE',
      actorType: actor.type || 'USER',
      actorId: actor.id,
      actorName: actor.name,
      details: { previousStatus: job.enabled, newStatus: false },
    });

    return updated;
  },

  /**
   * Lanjutkan (Resume) jadwal.
   */
  async resumeJob(id, actor = { type: 'USER', id: 'unknown', name: 'User' }) {
    const job = await prisma.scheduledJob.findFirst({ where: { id: Number(id), deletedAt: null } });
    if (!job) throw new Error(`Jadwal #${id} tidak ditemukan.`);

    const nextRunAt = computeNextRunAt(job.scheduleType, job.scheduleExpression, job.timezone);

    const updated = await prisma.scheduledJob.update({
      where: { id: Number(id) },
      data: { enabled: true, nextRunAt },
    });

    await jobAuditService.log({
      jobId: job.id,
      action: 'RESUME',
      actorType: actor.type || 'USER',
      actorId: actor.id,
      actorName: actor.name,
      details: { previousStatus: job.enabled, newStatus: true, nextRunAt },
    });

    return updated;
  },

  /**
   * Batalkan (Soft Delete) jadwal.
   */
  async cancelJob(id, actor = { type: 'USER', id: 'unknown', name: 'User' }) {
    const job = await prisma.scheduledJob.findFirst({ where: { id: Number(id), deletedAt: null } });
    if (!job) throw new Error(`Jadwal #${id} tidak ditemukan.`);

    const updated = await prisma.scheduledJob.update({
      where: { id: Number(id) },
      data: { enabled: false, deletedAt: new Date() },
    });

    await jobAuditService.log({
      jobId: job.id,
      action: 'CANCEL',
      actorType: actor.type || 'USER',
      actorId: actor.id,
      actorName: actor.name,
      details: { cancelledAt: new Date() },
    });

    return updated;
  },

  /**
   * Mengubah (Update) jadwal dengan validasi dan optimistic locking (Section 5.2).
   */
  async updateJob(id, updates = {}, actor = { type: 'USER', id: 'unknown', name: 'User' }) {
    const job = await prisma.scheduledJob.findFirst({ where: { id: Number(id), deletedAt: null } });
    if (!job) throw new Error(`Jadwal #${id} tidak ditemukan.`);

    const data = { version: { increment: 1 } };
    const beforeState = {
      name: job.name,
      description: job.description,
      scheduleExpression: job.scheduleExpression,
      scheduleType: job.scheduleType,
      timezone: job.timezone,
      enabled: job.enabled,
      payload: job.payload,
    };

    if (updates.name && typeof updates.name === 'string') {
      data.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      data.description = updates.description?.trim() || null;
    }
    if (updates.ownerScope) {
      data.ownerScope = updates.ownerScope;
    }
    if (updates.payload !== undefined) {
      data.payload = updates.payload;
    }
    if (updates.enabled !== undefined) {
      data.enabled = Boolean(updates.enabled);
    }

    // Perubahan jadwal / ekspresi
    const newScheduleType = (updates.scheduleType || job.scheduleType).toLowerCase().trim();
    const newExpression = updates.scheduleExpression ? updates.scheduleExpression.trim() : job.scheduleExpression;
    const newTimezone = updates.timezone || job.timezone || DEFAULT_TIMEZONE;

    if (updates.scheduleType || updates.scheduleExpression || updates.timezone) {
      if (!ALLOWED_SCHEDULE_TYPES.includes(newScheduleType)) {
        throw new Error(`scheduleType '${newScheduleType}' tidak diizinkan. Pilihan: ${ALLOWED_SCHEDULE_TYPES.join(', ')}`);
      }
      const nextRunAt = computeNextRunAt(newScheduleType, newExpression, newTimezone);
      data.scheduleType = newScheduleType;
      data.scheduleExpression = newExpression;
      data.timezone = newTimezone;
      data.nextRunAt = nextRunAt;
    }

    const updated = await prisma.scheduledJob.update({
      where: { id: Number(id) },
      data,
    });

    await jobAuditService.log({
      jobId: job.id,
      action: 'UPDATE',
      actorType: actor.type || 'USER',
      actorId: actor.id,
      actorName: actor.name,
      details: { before: beforeState, after: updates },
    });

    return updated;
  },

  /**
   * Melewati eksekusi berikutnya (Skip Next Occurrence) (Section 5.3 & 5.4).
   * Menghitung occurrence berikutnya setelah jadwal saat ini, membuat catatan JobRun berstatus skipped,
   * dan memajukan nextRunAt tanpa mengeksekusi handler.
   */
  async skipJobOccurrence(id, actor = { type: 'USER', id: 'unknown', name: 'User' }) {
    const job = await prisma.scheduledJob.findFirst({ where: { id: Number(id), deletedAt: null } });
    if (!job) throw new Error(`Jadwal #${id} tidak ditemukan.`);
    if (!job.enabled) throw new Error(`Jadwal #${id} sedang dinonaktifkan (paused).`);

    const currentDue = job.nextRunAt || new Date();
    // Hitung jadwal berikutnya mulai dari 1 detik setelah currentDue
    const afterDate = new Date(currentDue.getTime() + 1000);
    const nextNextRunAt = computeNextRunAt(job.scheduleType, job.scheduleExpression, job.timezone, afterDate);

    // Catat JobRun berstatus "skipped"
    const idempotencyKey = `job-${job.id}-skip-${currentDue.getTime()}`;
    await prisma.jobRun.create({
      data: {
        jobId: job.id,
        scheduledFor: currentDue,
        startedAt: new Date(),
        finishedAt: new Date(),
        status: 'skipped',
        attempt: 1,
        idempotencyKey,
        resultSummary: `Occurrence dilewati secara manual oleh ${actor.name || 'User'}`,
      },
    }).catch((err) => {
      logger.scheduler.warn(`[JobRegistry] Catatan JobRun skipped idempotency notice: ${err.message}`);
    });

    // Update job dengan nextRunAt baru
    const updated = await prisma.scheduledJob.update({
      where: { id: Number(id) },
      data: {
        nextRunAt: nextNextRunAt,
        version: { increment: 1 },
      },
    });

    await jobAuditService.log({
      jobId: job.id,
      action: 'SKIP',
      actorType: actor.type || 'USER',
      actorId: actor.id,
      actorName: actor.name,
      details: {
        skippedRunAt: currentDue,
        advancedToNextRunAt: nextNextRunAt,
      },
    });

    return {
      job: updated,
      skippedRunAt: currentDue,
      nextRunAt: nextNextRunAt,
    };
  },
};

