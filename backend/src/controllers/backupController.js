/**
 * Backup & Recovery Controller
 * Endpoint controller untuk manajemen pencadangan database, verifikasi,
 * pengunduhan terenkripsi, uji simulasi restore, dan pemulihan terkontrol.
 * Seluruh endpoint diamankan khusus role OWNER.
 */

import { successResponse, errorResponse } from '../utils/response.js';
import { backupEngineService } from '../services/backup/backupEngineService.js';
import { backupRecordService } from '../services/backup/backupRecordService.js';
import { backupStorageService } from '../services/backup/backupStorageService.js';
import { backupRestoreService } from '../services/backup/backupRestoreService.js';
import { backupRetentionService } from '../services/backup/backupRetentionService.js';
import prisma from '../config/db.js';

export const backupController = {
  /**
   * GET /api/backup/summary
   * Ringkasan status backup terakhir, scheduler, dan statistik
   */
  async getSummary(req, res) {
    try {
      const summary = await backupRecordService.getSummary();

      // Cek jadwal cron job yang terdaftar untuk BACKUP di ScheduledJob
      let scheduleInfo = {
        scheduleExpression: '0 19 * * *', // 02:00 WIB = 19:00 UTC
        timezone: 'Asia/Jakarta',
        enabled: true,
        nextRunAt: null,
      };

      try {
        const cronJob = await prisma.scheduledJob.findFirst({
          where: { jobType: 'BACKUP', deletedAt: null },
        });
        if (cronJob) {
          scheduleInfo = {
            id: cronJob.id,
            name: cronJob.name,
            scheduleExpression: cronJob.scheduleExpression,
            timezone: cronJob.timezone,
            enabled: cronJob.enabled,
            nextRunAt: cronJob.nextRunAt,
            lastRunAt: cronJob.lastRunAt,
          };
        }
      } catch {}

      return successResponse(res, { ...summary, scheduleInfo }, 'Ringkasan backup berhasil diambil');
    } catch (err) {
      return errorResponse(res, `Gagal mengambil ringkasan backup: ${err.message}`, 500);
    }
  },

  /**
   * GET /api/backup
   * Daftar riwayat pencadangan dengan filter dan pagination
   */
  async getHistory(req, res) {
    try {
      const { page = 1, limit = 20, status, backupType, startDate, endDate } = req.query;
      const result = await backupRecordService.findMany({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        status,
        backupType,
        startDate,
        endDate,
      });

      return successResponse(
        res,
        result.records,
        'Riwayat backup berhasil diambil',
        200,
        result.pagination
      );
    } catch (err) {
      return errorResponse(res, `Gagal mengambil riwayat backup: ${err.message}`, 500);
    }
  },

  /**
   * POST /api/backup/manual
   * Jalankan proses backup sekarang secara manual
   */
  async triggerManual(req, res) {
    try {
      const { retentionCategory = 'MANUAL', isProtected = false } = req.body || {};
      const triggeredBy = req.user?.username || 'OWNER';

      const result = await backupEngineService.executeBackup({
        backupType: 'MANUAL',
        triggeredBy,
        retentionCategory,
        isProtected: Boolean(isProtected),
      });

      return successResponse(
        res,
        result,
        'Pencadangan database berhasil dieksekusi dan diverifikasi.',
        201
      );
    } catch (err) {
      return errorResponse(res, `Pencadangan gagal: ${err.message}`, 500);
    }
  },

  /**
   * GET /api/backup/:id
   * Detail metadata backup tertentu
   */
  async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const record = await backupRecordService.findById(id);

      if (!record) {
        return errorResponse(res, `Catatan backup #${id} tidak ditemukan`, 404);
      }

      const fileExists = await backupStorageService.exists(record.fileName);

      return successResponse(
        res,
        { ...record, fileExistsOnStorage: fileExists },
        'Detail backup berhasil diambil'
      );
    } catch (err) {
      return errorResponse(res, `Gagal mengambil detail backup: ${err.message}`, 500);
    }
  },

  /**
   * POST /api/backup/:id/verify
   * Verifikasi ulang integritas file fisik dan hash SHA-256
   */
  async verifyIntegrity(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const record = await backupRecordService.findById(id);

      if (!record) {
        return errorResponse(res, `Catatan backup #${id} tidak ditemukan`, 404);
      }

      const validation = await backupRestoreService.validateBackupFile(
        record.fileName,
        record.checksumSha256
      );

      await backupRecordService.updateByExecutionId(record.executionId, {
        isVerified: true,
        verifiedAt: new Date(),
      });

      return successResponse(
        res,
        {
          id: record.id,
          executionId: record.executionId,
          fileName: record.fileName,
          checksumVerified: true,
          checksumSha256: validation.checksumSha256,
          fileSizeBytes: validation.sizeBytes,
          verifiedAt: new Date().toISOString(),
        },
        'Integritas dan checksum berkas backup valid 100%.'
      );
    } catch (err) {
      return errorResponse(res, `Verifikasi integritas gagal: ${err.message}`, 400);
    }
  },

  /**
   * GET /api/backup/:id/download
   * Mengunduh berkas backup terenkripsi secara aman
   */
  async download(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const record = await backupRecordService.findById(id);

      if (!record) {
        return errorResponse(res, `Catatan backup #${id} tidak ditemukan`, 404);
      }

      if (!(await backupStorageService.exists(record.fileName))) {
        return errorResponse(res, 'Berkas fisik backup tidak ditemukan di storage server.', 404);
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${record.fileName}"`);

      const stream = backupStorageService.createReadStream(record.fileName);
      stream.on('error', (streamErr) => {
        if (!res.headersSent) {
          errorResponse(res, `Gagal membaca berkas: ${streamErr.message}`, 500);
        }
      });
      stream.pipe(res);
    } catch (err) {
      if (!res.headersSent) {
        return errorResponse(res, `Gagal mengunduh berkas: ${err.message}`, 500);
      }
    }
  },

  /**
   * POST /api/backup/:id/test-restore
   * Uji coba simulasi pemulihan (Dry-run parser)
   */
  async testRestore(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const result = await backupRestoreService.testRestore(id);
      return successResponse(res, result, result.message);
    } catch (err) {
      return errorResponse(res, `Uji restore gagal: ${err.message}`, 400);
    }
  },

  /**
   * POST /api/backup/:id/restore
   * Pemulihan database produksi terkontrol (Khusus Owner)
   */
  async executeRestore(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      const { confirmationPhrase } = req.body || {};

      const result = await backupRestoreService.executeControlledRestore(id, {
        confirmationPhrase,
        user: req.user,
      });

      return successResponse(res, result, result.message);
    } catch (err) {
      return errorResponse(res, `Pemulihan database gagal: ${err.message}`, 400);
    }
  },

  /**
   * POST /api/backup/retention/run
   * Picu evaluasi retensi berkas secara manual
   */
  async runRetention(req, res) {
    try {
      const result = await backupRetentionService.applyRetention();
      return successResponse(
        res,
        result,
        `Evaluasi retensi selesai: ${result.deletedCount} berkas kedaluwarsa dibersihkan.`
      );
    } catch (err) {
      return errorResponse(res, `Gagal menjalankan retensi: ${err.message}`, 500);
    }
  },
};
