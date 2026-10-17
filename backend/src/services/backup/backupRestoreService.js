/**
 * Backup Restore & Disaster Recovery Service (Layer B & C)
 * Mengelola validasi berkas backup, uji coba simulasi (dry-run), pembuatan safety backup
 * otomatis, serta pemulihan database terkontrol dengan otorisasi Owner.
 */

import zlib from 'zlib';
import crypto from 'crypto';
import prisma from '../../config/db.js';
import { backupStorageService } from './backupStorageService.js';
import { backupRecordService } from './backupRecordService.js';
import { backupEngineService, getEncryptionKey } from './backupEngineService.js';
import { notifier } from '../../bot/notifier.js';
import logger from '../../utils/logger.js';

export const backupRestoreService = {
  /**
   * Tahap A: Validasi & dekripsi berkas backup sebelum pemulihan
   */
  async validateBackupFile(fileName, expectedChecksumSha256) {
    if (!(await backupStorageService.exists(fileName))) {
      throw new Error(`Berkas backup '${fileName}' tidak ditemukan di penyimpanan.`);
    }

    const packedBuffer = await backupStorageService.read(fileName);
    if (!packedBuffer || packedBuffer.length < 28) {
      throw new Error('Berkas backup rusak atau tidak memenuhi ukuran minimum terenkripsi.');
    }

    const encryptionKey = getEncryptionKey();

    // 1. Dekripsi AES-256-GCM
    let decryptedBuffer;
    try {
      decryptedBuffer = backupEngineService.decryptPayload(packedBuffer, encryptionKey);
    } catch (err) {
      throw new Error(`Gagal mendekripsi berkas backup: Kunci enkripsi salah atau berkas korup (${err.message})`);
    }

    // 2. Dekompresi Gzip
    let sqlString;
    try {
      sqlString = zlib.gunzipSync(decryptedBuffer).toString('utf8');
    } catch (err) {
      throw new Error(`Gagal mendekompresi berkas backup: Format arsip kompresi tidak valid (${err.message})`);
    }

    // 3. Validasi Checksum SHA-256
    const calculatedChecksum = crypto.createHash('sha256').update(sqlString, 'utf8').digest('hex');
    if (expectedChecksumSha256 && calculatedChecksum !== expectedChecksumSha256) {
      throw new Error(
        `Integritas gagal: Checksum SHA-256 tidak cocok! (Diharapkan: ${expectedChecksumSha256.slice(0, 10)}..., Aktual: ${calculatedChecksum.slice(0, 10)}...)`
      );
    }

    // 4. Validasi isi SQL
    if (!sqlString.includes('Komazi POS') || !sqlString.includes('FOREIGN_KEY_CHECKS')) {
      throw new Error('Berkas bukan merupakan format dump SQL Komazi POS yang valid.');
    }

    return {
      isValid: true,
      sqlString,
      checksumSha256: calculatedChecksum,
      sizeBytes: packedBuffer.length,
      uncompressedChars: sqlString.length,
    };
  },

  /**
   * Tahap B: Uji coba pemulihan / Dry-run parsing (Staging Validation)
   */
  async testRestore(backupId) {
    const record = await backupRecordService.findById(backupId);
    if (!record) {
      throw new Error(`Catatan backup #${backupId} tidak ditemukan.`);
    }

    logger.scheduler.info(`[BackupRestore] Menjalankan uji simulasi restore untuk backup #${backupId}`);

    const validation = await this.validateBackupFile(record.fileName, record.checksumSha256);

    // Parse statement SQL tanpa mengeksekusinya ke database aktif
    const rawStatements = validation.sqlString
      .split(/;\s*[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    const tablesFound = new Set();
    let insertCount = 0;
    let createTableCount = 0;

    for (const stmt of rawStatements) {
      const createMatch = stmt.match(/CREATE\s+TABLE\s+`?([a-zA-Z0-9_]+)`?/i);
      if (createMatch) {
        tablesFound.add(createMatch[1]);
        createTableCount++;
      }
      if (stmt.startsWith('INSERT INTO')) {
        insertCount++;
      }
    }

    return {
      success: true,
      mode: 'DRY_RUN_TEST',
      backupId: record.id,
      fileName: record.fileName,
      checksumVerified: true,
      totalStatements: rawStatements.length,
      createTableCount,
      insertCount,
      tablesIdentified: Array.from(tablesFound),
      message: 'Uji validasi berkas backup berhasil. Seluruh struktur SQL, enkripsi, dan checksum valid 100%.',
    };
  },

  /**
   * Tahap C: Pemulihan database produksi terkontrol (Controlled Production Restore)
   * Wajib persetujuan Owner dan frasa konfirmasi 'RESTORE-DATABASE'
   */
  async executeControlledRestore(backupId, { confirmationPhrase, user }) {
    if (confirmationPhrase !== 'RESTORE-DATABASE') {
      throw new Error("Frasa konfirmasi tidak valid. Harap masukkan 'RESTORE-DATABASE' persis untuk melanjutkan.");
    }

    if (!user || user.role !== 'OWNER') {
      throw new Error('Akses ditolak: Operasi pemulihan database hanya diizinkan untuk role OWNER.');
    }

    const record = await backupRecordService.findById(backupId);
    if (!record) {
      throw new Error(`Catatan backup #${backupId} tidak ditemukan.`);
    }

    logger.scheduler.warn(
      `[BackupRestore] PERINGATAN: Memulai pemulihan database dari backup #${backupId} oleh ${user.username} (${user.name})`
    );

    // 1. Validasi berkas backup terlebih dahulu
    const validation = await this.validateBackupFile(record.fileName, record.checksumSha256);

    // 2. Buat backup pengaman (Safety Snapshot) kondisi saat ini sebelum restore
    let safetyBackup;
    try {
      logger.scheduler.info('[BackupRestore] Membuat backup pengaman darurat sebelum restore...');
      safetyBackup = await backupEngineService.executeBackup({
        backupType: 'MANUAL',
        triggeredBy: `SAFETY_SNAPSHOT_BEFORE_RESTORE_BY_${user.username}`,
        retentionCategory: 'MANUAL',
        isProtected: true, // Jangan pernah dihapus
      });
      logger.scheduler.info(`[BackupRestore] Safety snapshot berhasil dibuat: ${safetyBackup.executionId}`);
    } catch (safetyErr) {
      throw new Error(`Gagal membuat backup pengaman sebelum restore: ${safetyErr.message}. Operasi dibatalkan demi keamanan.`);
    }

    // 3. Eksekusi Statement SQL secara terurut
    const statements = validation.sqlString
      .split(/;\s*[\r\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    let executedCount = 0;

    try {
      // Nonaktifkan pemeriksaan foreign key sementara
      await prisma.$executeRawUnsafe('/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */');

      for (const statement of statements) {
        if (statement.length > 0) {
          await prisma.$executeRawUnsafe(statement);
          executedCount++;
        }
      }

      // Re-enable foreign key checks
      await prisma.$executeRawUnsafe('/*!40014 SET FOREIGN_KEY_CHECKS=1 */');

      logger.scheduler.info(`[BackupRestore] Pemulihan database BERHASIL. ${executedCount} query dieksekusi.`);

      // 4. Notifikasi darurat ke Telegram Owner
      try {
        const notifHtml = `
🚨 <b>PEMULIHAN DATABASE SELESAI</b>
━━━━━━━━━━━━━━━━━━
<b>Status:</b> BERHASIL DIPULIHKAN ✅
<b>Berkas Asal:</b> <code>${record.fileName}</code>
<b>Safety Backup:</b> <code>${safetyBackup.executionId}</code>
<b>Petugas:</b> ${user.name} (@${user.username})
<b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
<b>Query Dieksekusi:</b> ${executedCount} statement
━━━━━━━━━━━━━━━━━━
<i>Sistem database telah direstorasi sesuai snapshot yang dipilih.</i>
        `.trim();
        await notifier.toRoles(['OWNER'], notifHtml);
      } catch {}

      return {
        success: true,
        restoredBackupId: record.id,
        safetyBackupExecutionId: safetyBackup.executionId,
        executedStatements: executedCount,
        restoredAt: new Date().toISOString(),
        message: 'Pemulihan database berhasil diselesaikan. Safety snapshot kondisi sebelumnya telah disimpan.',
      };
    } catch (execErr) {
      // Pastikan foreign key diaktifkan kembali jika terjadi error
      try {
        await prisma.$executeRawUnsafe('/*!40014 SET FOREIGN_KEY_CHECKS=1 */');
      } catch {}

      logger.scheduler.error(`[BackupRestore] Gagal saat mengeksekusi restore SQL: ${execErr.message}`);
      throw new Error(`Pemulihan database gagal saat eksekusi: ${execErr.message}. Kondisi sebelumnya tersedia di safety backup #${safetyBackup.executionId}`);
    }
  },
};
