/**
 * Backup Retention Service (Layer B & C)
 * Menerapkan kebijakan pembersihan berkas backup otomatis yang aman.
 * Menjamin bahwa berkas backup terverifikasi terakhir TIDAK PERNAH terhapus.
 */

import prisma from '../../config/db.js';
import { backupStorageService } from './backupStorageService.js';
import logger from '../../utils/logger.js';

// Konfigurasi default retensi (dapat disesuaikan via environment variable)
const RETENTION_DAYS = {
  DAILY: parseInt(process.env.BACKUP_RETENTION_DAILY || '14', 10), // 14 hari
  WEEKLY: parseInt(process.env.BACKUP_RETENTION_WEEKLY || '56', 10), // 8 minggu (56 hari)
  MONTHLY: parseInt(process.env.BACKUP_RETENTION_MONTHLY || '180', 10), // 6 bulan (180 hari)
};

export const backupRetentionService = {
  /**
   * Evaluasi dan bersihkan backup yang telah kedaluwarsa secara aman
   */
  async applyRetention() {
    logger.scheduler.info('[BackupRetention] Menjalankan evaluasi retensi berkas backup...');

    const now = new Date();
    let deletedCount = 0;

    // 1. Ambil seluruh backup berstatus SUCCESS yang tidak diproteksi
    let successfulRecords = [];
    try {
      if (prisma.backupRecord && typeof prisma.backupRecord.findMany === 'function') {
        successfulRecords = await prisma.backupRecord.findMany({
          where: {
            status: 'SUCCESS',
            deletedAt: null,
            isProtected: false,
          },
          orderBy: { startedAt: 'desc' },
        });
      }
    } catch {}

    if (!successfulRecords.length) {
      const tables = await prisma.$queryRawUnsafe('SHOW TABLES');
      const names = tables.map((t) => Object.values(t)[0]);
      const tableName = names.find((n) => n.toLowerCase() === 'backuprecord') || 'BackupRecord';

      successfulRecords = await prisma.$queryRawUnsafe(
        `SELECT * FROM \`${tableName}\` 
         WHERE \`status\` = 'SUCCESS' 
           AND \`deletedAt\` IS NULL 
           AND \`isProtected\` = 0 
         ORDER BY \`startedAt\` DESC`
      );
    }

    // Golden Rule 1: Jika total backup sukses <= 2, jangan hapus apa pun untuk mencegah hilangnya cadangan tunggal
    if (successfulRecords.length <= 2) {
      logger.scheduler.info('[BackupRetention] Jumlah backup sukses <= 2. Retensi diabaikan demi keselamatan data.');
      return { deletedCount: 0, keptCount: successfulRecords.length };
    }

    // Golden Rule 2: Dua backup terverifikasi terbaru SELALU dipertahankan (Immunity list)
    const immuneIds = new Set(successfulRecords.slice(0, 2).map((r) => r.id));

    for (const record of successfulRecords) {
      if (immuneIds.has(record.id)) {
        continue;
      }

      const category = record.retentionCategory || 'DAILY';
      const retentionLimitDays = RETENTION_DAYS[category] || RETENTION_DAYS.DAILY;
      const ageMs = now.getTime() - new Date(record.startedAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);

      if (ageDays > retentionLimitDays) {
        logger.scheduler.info(
          `[BackupRetention] Berkas ${record.fileName} (umur: ${Math.round(ageDays)} hari, limit: ${retentionLimitDays} hari) melewati masa retensi. Menghapus...`
        );

        // Hapus file fisik
        if (record.fileName) {
          await backupStorageService.delete(record.fileName);
        }

        // Tandai soft-delete di database untuk jejak audit
        try {
          if (prisma.backupRecord && typeof prisma.backupRecord.update === 'function') {
            await prisma.backupRecord.update({
              where: { id: record.id },
              data: { deletedAt: new Date() },
            });
          } else {
            const tables = await prisma.$queryRawUnsafe('SHOW TABLES');
            const names = tables.map((t) => Object.values(t)[0]);
            const tableName = names.find((n) => n.toLowerCase() === 'backuprecord') || 'BackupRecord';
            await prisma.$executeRawUnsafe(
              `UPDATE \`${tableName}\` SET \`deletedAt\` = NOW() WHERE \`id\` = ?`,
              record.id
            );
          }
        } catch (delErr) {
          logger.scheduler.error(`[BackupRetention] Gagal soft-delete backup #${record.id}: ${delErr.message}`);
        }

        deletedCount++;
      }
    }

    logger.scheduler.info(`[BackupRetention] Retensi selesai: ${deletedCount} berkas usang dibersihkan.`);
    return { deletedCount, keptCount: successfulRecords.length - deletedCount };
  },
};
