/**
 * OpenClaw Automation Adapter.
 * Antarmuka terstandarisasi dan aman bagi asisten OpenClaw / API eksternal
 * untuk mengelola jadwal cron tanpa akses arbitrary shell atau SQL liar.
 */

import { jobRegistryService } from './jobRegistryService.js';
import { jobRunnerService } from './jobRunnerService.js';
import prisma from '../../config/db.js';
import logger from '../../utils/logger.js';

// Matriks otorisasi peran
const ALLOWED_ROLES = {
  READ: ['OWNER', 'MANAGER', 'CASHIER', 'KITCHEN'],
  MANAGE: ['OWNER', 'MANAGER'],
  TRIGGER: ['OWNER', 'MANAGER'],
};

/**
 * Validasi otorisasi aksi berdasarkan role
 */
function authorize(action, actorRole) {
  const role = (actorRole || '').toUpperCase();
  if (action === 'READ' && ALLOWED_ROLES.READ.includes(role)) return true;
  if (action === 'MANAGE' && ALLOWED_ROLES.MANAGE.includes(role)) return true;
  if (action === 'TRIGGER' && ALLOWED_ROLES.TRIGGER.includes(role)) return true;

  throw new Error(`Akses ditolak: Peran '${role || 'ANONYMOUS'}' tidak memiliki izin untuk aksi '${action}'.`);
}

export const openclawAutomationAdapter = {
  /**
   * Mengambil daftar jadwal cron aktif/terdaftar.
   */
  async listJobs({ page = 1, limit = 10, search, type, enabled, actorRole = 'OWNER' } = {}) {
    authorize('READ', actorRole);
    return jobRegistryService.listJobs({ page, limit, search, type, enabled });
  },

  /**
   * Mengambil detail jadwal cron spesifik berserta status eksekusi terakhir.
   */
  async getJobDetail(jobId, { actorRole = 'OWNER' } = {}) {
    authorize('READ', actorRole);
    const job = await jobRegistryService.getJobById(jobId);
    if (!job) throw new Error(`Jadwal dengan ID #${jobId} tidak ditemukan.`);

    const recentRuns = await prisma.jobRun.findMany({
      where: { jobId: Number(jobId) },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return { job, recentRuns };
  },

  /**
   * Membuat jadwal baru dengan validasi schema ketat.
   */
  async createJob(data, actor = { role: 'OWNER', id: 'komazi_ai', name: 'Komazi AI' }) {
    authorize('MANAGE', actor.role);

    logger.scheduler.info(`[KomaziAiAdapter] Create job requested by ${actor.name} (${actor.role})`);
    return jobRegistryService.createJob(data, {
      type: 'AI',
      id: String(actor.id || 'komazi_ai'),
      name: actor.name || 'Komazi AI',
    });
  },

  /**
   * Menjeda (pause) jadwal.
   */
  async pauseJob(jobId, actor = { role: 'OWNER', id: 'komazi_ai', name: 'Komazi AI' }) {
    authorize('MANAGE', actor.role);
    return jobRegistryService.pauseJob(jobId, {
      type: 'AI',
      id: String(actor.id || 'komazi_ai'),
      name: actor.name || 'Komazi AI',
    });
  },

  /**
   * Melanjutkan (resume) jadwal yang dijeda.
   */
  async resumeJob(jobId, actor = { role: 'OWNER', id: 'komazi_ai', name: 'Komazi AI' }) {
    authorize('MANAGE', actor.role);
    return jobRegistryService.resumeJob(jobId, {
      type: 'AI',
      id: String(actor.id || 'komazi_ai'),
      name: actor.name || 'Komazi AI',
    });
  },

  /**
   * Membatalkan (soft delete) jadwal.
   */
  async cancelJob(jobId, actor = { role: 'OWNER', id: 'komazi_ai', name: 'Komazi AI' }) {
    authorize('MANAGE', actor.role);
    return jobRegistryService.cancelJob(jobId, {
      type: 'AI',
      id: String(actor.id || 'komazi_ai'),
      name: actor.name || 'Komazi AI',
    });
  },

  /**
   * Mengubah (update) konfigurasi jadwal.
   */
  async updateJob(jobId, updates, actor = { role: 'OWNER', id: 'komazi_ai', name: 'Komazi AI' }) {
    authorize('MANAGE', actor.role);
    return jobRegistryService.updateJob(jobId, updates, {
      type: 'AI',
      id: String(actor.id || 'komazi_ai'),
      name: actor.name || 'Komazi AI',
    });
  },

  /**
   * Melewati eksekusi berikutnya (skip occurrence).
   */
  async skipJob(jobId, actor = { role: 'OWNER', id: 'komazi_ai', name: 'Komazi AI' }) {
    authorize('MANAGE', actor.role);
    return jobRegistryService.skipJobOccurrence(jobId, {
      type: 'AI',
      id: String(actor.id || 'komazi_ai'),
      name: actor.name || 'Komazi AI',
    });
  },

  /**
   * Memicu eksekusi langsung (run now / on demand).
   */
  async triggerJob(jobId, actor = { role: 'OWNER', id: 'komazi_ai', name: 'Komazi AI' }) {
    authorize('TRIGGER', actor.role);
    logger.scheduler.info(`[KomaziAiAdapter] Manual trigger job #${jobId} by ${actor.name}`);
    return jobRunnerService.triggerManualRun(jobId, {
      type: 'AI',
      id: String(actor.id || 'komazi_ai'),
      name: actor.name || 'Komazi AI',
    });
  },

  /**
   * Mengambil riwayat eksekusi job (JobRun logs).
   */
  async getJobRuns(jobId, { page = 1, limit = 10, actorRole = 'OWNER' } = {}) {
    authorize('READ', actorRole);
    const skip = (Math.max(1, page) - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.jobRun.findMany({
        where: { jobId: Number(jobId) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.jobRun.count({ where: { jobId: Number(jobId) } }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },
};

export const komaziAutomationAdapter = openclawAutomationAdapter;
