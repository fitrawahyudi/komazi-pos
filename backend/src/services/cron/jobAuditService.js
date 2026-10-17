/**
 * Job Audit Service.
 * Mencatat seluruh aksi modifikasi jadwal, eksekusi manual, jeda/lanjutkan,
 * dan penghapusan job ke tabel JobAuditLog di MySQL.
 */

import prisma from '../../config/db.js';
import logger from '../../utils/logger.js';

export const jobAuditService = {
  /**
   * Catat audit log untuk ScheduledJob.
   * @param {object} params
   * @param {number} [params.jobId]
   * @param {string} params.action - "CREATE" | "UPDATE" | "PAUSE" | "RESUME" | "CANCEL" | "MANUAL_RUN" | "DELETE"
   * @param {string} [params.actorType="USER"] - "USER" | "OPENCLAW" | "SYSTEM"
   * @param {string|number} [params.actorId]
   * @param {string} [params.actorName]
   * @param {object} [params.details]
   * @param {string} [params.ipAddress]
   */
  async log({
    jobId = null,
    action,
    actorType = 'USER',
    actorId = null,
    actorName = 'System',
    details = {},
    ipAddress = null,
  }) {
    try {
      // Redact token atau secret jika ada di details
      const sanitizedDetails = { ...details };
      if (sanitizedDetails.token) sanitizedDetails.token = '***';
      if (sanitizedDetails.password) sanitizedDetails.password = '***';

      const entry = await prisma.jobAuditLog.create({
        data: {
          jobId: jobId ? Number(jobId) : null,
          action,
          actorType,
          actorId: actorId ? String(actorId) : null,
          actorName: actorName ? String(actorName) : null,
          details: sanitizedDetails,
          ipAddress: ipAddress ? String(ipAddress) : null,
        },
      });

      logger.scheduler.info(`[JobAudit] ${action} on job #${jobId || 'N/A'} by ${actorType}:${actorName}`);
      return entry;
    } catch (err) {
      logger.scheduler.warn(`[JobAudit] Failed to record audit log: ${err.message}`);
      return null;
    }
  },

  /**
   * Mengambil riwayat audit log untuk job tertentu.
   * @param {number} jobId
   * @param {number} limit
   */
  async getLogsByJob(jobId, limit = 20) {
    return prisma.jobAuditLog.findMany({
      where: { jobId: Number(jobId) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
