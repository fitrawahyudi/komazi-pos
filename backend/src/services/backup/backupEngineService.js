/**
 * Backup Engine Service
 * Mengelola proses pencadangan database MySQL secara logis, kompresi Gzip,
 * enkripsi AES-256-GCM, penghitungan SHA-256, dan validasi integritas round-trip.
 */

import zlib from 'zlib';
import crypto from 'crypto';
import prisma from '../../config/db.js';
import { backupStorageService } from './backupStorageService.js';
import { backupRecordService } from './backupRecordService.js';
import { backupRetentionService } from './backupRetentionService.js';
import { notifier } from '../../bot/notifier.js';
import logger from '../../utils/logger.js';

// In-flight mutex lock untuk mencegah dua proses backup berjalan bersamaan
let isBackupRunning = false;

/**
 * Pengambilan kunci enkripsi 256-bit yang aman
 */
export function getEncryptionKey() {
  const envKey = process.env.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY_REFERENCE;
  if (envKey && envKey.length >= 32) {
    return crypto.createHash('sha256').update(envKey).digest();
  }
  // Fallback: Derivasi kriptografis SHA-256 dari JWT secret sistem
  const fallbackSource = process.env.JWT_SECRET || 'komazi_pos_db_backup_default_salt_2026';
  return crypto.createHash('sha256').update(`backup_salt_${fallbackSource}`).digest();
}

/**
 * Escape nilai data SQL agar aman dari injeksi dan karakter khusus
 */
export function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) {
    return `'${val.toISOString().slice(0, 23).replace('T', ' ')}'`;
  }
  if (typeof val === 'object') {
    val = JSON.stringify(val);
  }
  const str = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z');
  return `'${str}'`;
}

export const backupEngineService = {
  /**
   * Status apakah ada proses backup yang sedang berjalan
   */
  isLocked() {
    return isBackupRunning;
  },

  /**
   * Menghasilkan teks SQL dump logis dari seluruh tabel aplikasi
   */
  async generateSqlDump() {
    const rawTables = await prisma.$queryRawUnsafe('SHOW TABLES');
    // Filter abaikan tabel sistem internal migrasi Prisma
    const tableNames = rawTables
      .map((t) => Object.values(t)[0])
      .filter((name) => !name.startsWith('_prisma_'));

    let sql = '';
    sql += `-- ========================================================\n`;
    sql += `-- Komazi POS — Production Logical Database Dump\n`;
    sql += `-- Tanggal Dibuat: ${new Date().toISOString()} (UTC)\n`;
    sql += `-- Engine: MySQL | Total Tabel: ${tableNames.length}\n`;
    sql += `-- ========================================================\n\n`;

    sql += `/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n`;
    sql += `/*!40101 SET NAMES utf8mb4 */;\n`;
    sql += `/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`;
    sql += `/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n\n`;

    let totalRows = 0;

    for (const tableName of tableNames) {
      // Ambil struktur DDL tabel
      const ddlResult = await prisma.$queryRawUnsafe(`SHOW CREATE TABLE \`${tableName}\``);
      const ddl = ddlResult[0]?.['Create Table'] || ddlResult[0]?.f1;

      if (!ddl) continue;

      sql += `-- --------------------------------------------------------\n`;
      sql += `-- Struktur Tabel: \`${tableName}\`\n`;
      sql += `-- --------------------------------------------------------\n`;
      sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sql += `${ddl};\n\n`;

      // Ambil data isi tabel (DML)
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${tableName}\``);
      if (rows && rows.length > 0) {
        totalRows += rows.length;
        const columns = Object.keys(rows[0]).map((c) => `\`${c}\``).join(', ');

        // Batch baris data dalam kelipatan 500 baris per query INSERT
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const slice = rows.slice(i, i + batchSize);
          const valueClauses = slice
            .map((row) => `(${Object.values(row).map(escapeSqlValue).join(', ')})`)
            .join(',\n');
          sql += `INSERT INTO \`${tableName}\` (${columns}) VALUES\n${valueClauses};\n`;
        }
        sql += `\n`;
      }
    }

    sql += `/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n`;
    sql += `/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n`;
    sql += `-- Dump selesai.\n`;

    return {
      sql,
      tablesCount: tableNames.length,
      totalRows,
    };
  },

  /**
   * Enkripsi buffer menggunakan AES-256-GCM
   */
  encryptPayload(buffer, key) {
    const iv = crypto.randomBytes(12); // 96-bit IV
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag(); // 128-bit Authentication Tag

    // Paket terstruktur: [IV (12 byte)] + [AuthTag (16 byte)] + [Encrypted Data]
    return Buffer.concat([iv, authTag, encrypted]);
  },

  /**
   * Dekripsi payload terenkripsi menggunakan AES-256-GCM
   */
  decryptPayload(packedBuffer, key) {
    if (packedBuffer.length < 28) {
      throw new Error('Format file terenkripsi tidak valid: Ukuran berkas terlalu pendek.');
    }
    const iv = packedBuffer.subarray(0, 12);
    const authTag = packedBuffer.subarray(12, 28);
    const encryptedData = packedBuffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  },

  /**
   * Verifikasi integritas round-trip berkas backup
   */
  verifyBackupIntegrity(packedBuffer, expectedChecksumSha256, key) {
    try {
      const decrypted = this.decryptPayload(packedBuffer, key);
      const decompressed = zlib.gunzipSync(decrypted).toString('utf8');
      const calculatedChecksum = crypto.createHash('sha256').update(decompressed, 'utf8').digest('hex');

      if (calculatedChecksum !== expectedChecksumSha256) {
        throw new Error('Checksum SHA-256 tidak cocok! Data mungkin rusak atau termodifikasi.');
      }

      if (!decompressed.includes('Komazi POS') || !decompressed.includes('FOREIGN_KEY_CHECKS')) {
        throw new Error('Header dump SQL tidak valid.');
      }

      return {
        isValid: true,
        calculatedChecksum,
        sizeChars: decompressed.length,
      };
    } catch (err) {
      return {
        isValid: false,
        error: err.message,
      };
    }
  },

  /**
   * Eksekusi alur pencadangan database secara lengkap & terkontrol
   */
  async executeBackup({
    backupType = 'MANUAL',
    triggeredBy = 'OWNER',
    retentionCategory = 'MANUAL',
    isProtected = false,
  } = {}) {
    if (isBackupRunning) {
      throw new Error('Proses pencadangan lain sedang berjalan. Harap tunggu hingga selesai.');
    }

    isBackupRunning = true;
    const startTime = Date.now();
    const executionId = `bak_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
    const fileName = `komazi_pos_${dateStr}_${timeStr}_${executionId.slice(4, 12)}.sql.gz.enc`;

    logger.scheduler.info(`[BackupEngine] Memulai pencadangan [${backupType}] id: ${executionId}`);

    // 1. Catat status awal di database
    await backupRecordService.create({
      executionId,
      backupType,
      status: 'RUNNING',
      startedAt: new Date(),
      fileName,
      storageProvider: 'LOCAL',
      storagePath: fileName,
      isEncrypted: true,
      encryptionAlgorithm: 'AES-256-GCM',
      isVerified: false,
      retentionCategory,
      isProtected: Boolean(isProtected),
      triggeredBy: String(triggeredBy || 'OWNER'),
    });

    try {
      // 2. Dump tabel MySQL
      const { sql, tablesCount, totalRows } = await this.generateSqlDump();
      if (!sql || sql.length === 0) {
        throw new Error('Isi dump database kosong.');
      }

      // 3. Hitung Checksum SHA-256 dari teks SQL asli
      const checksumSha256 = crypto.createHash('sha256').update(sql, 'utf8').digest('hex');

      // 4. Kompresi Gzip
      const gzippedBuffer = zlib.gzipSync(Buffer.from(sql, 'utf8'), { level: 9 });

      // 5. Enkripsi AES-256-GCM
      const encryptionKey = getEncryptionKey();
      const packedBuffer = this.encryptPayload(gzippedBuffer, encryptionKey);

      // 6. Simpan ke storage aman
      const savedStorage = await backupStorageService.save(fileName, packedBuffer);

      // 7. Verifikasi integritas round-trip (decrypt -> decompress -> SHA256 match)
      const verifyResult = this.verifyBackupIntegrity(packedBuffer, checksumSha256, encryptionKey);
      if (!verifyResult.isValid) {
        throw new Error(`Verifikasi integritas pasca-simpan gagal: ${verifyResult.error}`);
      }

      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

      // 8. Tandai SUCCESS pada catatan database
      const updatedRecord = await backupRecordService.updateByExecutionId(executionId, {
        status: 'SUCCESS',
        finishedAt: new Date(),
        durationSeconds,
        fileSizeBytes: savedStorage.sizeBytes,
        checksumSha256,
        isVerified: true,
        verifiedAt: new Date(),
        tablesCount,
        totalRows,
      });

      logger.scheduler.info(
        `[BackupEngine] Backup ${executionId} BERHASIL dalam ${durationSeconds}s (${savedStorage.sizeBytes} bytes, SHA: ${checksumSha256.slice(0, 12)}...)`
      );

      // 9. Kirim notifikasi ringkasan dan lampiran berkas .sql ke Telegram Owner
      try {
        const notifHtml = `
💾 <b>PENCADANGAN DATABASE BERHASIL</b>
━━━━━━━━━━━━━━━━━━
<b>Status:</b> TERVERIFIKASI ✅
<b>Tipe:</b> ${backupType}
<b>ID Eksekusi:</b> <code>${executionId}</code>
<b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
<b>Durasi:</b> ${durationSeconds} detik
<b>Total Tabel:</b> ${tablesCount} tabel
<b>Total Rekord:</b> ${totalRows.toLocaleString('id-ID')} baris
<b>Ukuran File (Encrypted):</b> ${(savedStorage.sizeBytes / 1024).toFixed(1)} KB
<b>Checksum SHA-256:</b>
<code>${checksumSha256}</code>
━━━━━━━━━━━━━━━━━━
<i>Integritas terenkripsi AES-256-GCM & lulus uji verifikasi round-trip. Berkas .sql terlampir.</i>
        `.trim();

        const sqlFileName = fileName.replace(/\.gz\.enc$/, '') || `komazi_pos_${dateStr}_${timeStr}_${executionId.slice(4, 12)}.sql`;
        const sqlBuffer = Buffer.from(sql, 'utf8');

        if (typeof notifier.sendDocumentToRoles === 'function') {
          await notifier.sendDocumentToRoles(['OWNER'], sqlBuffer, sqlFileName, notifHtml);
        } else {
          await notifier.toRoles(['OWNER'], notifHtml);
        }
      } catch (notifErr) {
        logger.scheduler.warn(`[BackupEngine] Gagal mengirim notifikasi Telegram: ${notifErr.message}`);
      }

      // 10. Terapkan kebijakan retensi otomatis
      try {
        await backupRetentionService.applyRetention();
      } catch (retentionErr) {
        logger.scheduler.warn(`[BackupEngine] Retensi otomatis error: ${retentionErr.message}`);
      }

      return {
        success: true,
        executionId,
        fileName,
        fileSizeBytes: savedStorage.sizeBytes,
        checksumSha256,
        durationSeconds,
        tablesCount,
        totalRows,
        record: updatedRecord,
      };
    } catch (err) {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      const safeErrorMsg = err.message ? err.message.slice(0, 500) : 'Kesalahan internal backup';

      logger.scheduler.error(`[BackupEngine] Backup ${executionId} GAGAL: ${safeErrorMsg}`);

      await backupRecordService.updateByExecutionId(executionId, {
        status: 'FAILED',
        finishedAt: new Date(),
        durationSeconds,
        errorCode: 'BACKUP_EXECUTION_ERROR',
        errorMessage: safeErrorMsg,
      });

      // Notifikasi kegagalan ke Telegram Owner
      try {
        const failHtml = `
⚠️ <b>PERINGATAN: PENCADANGAN DATABASE GAGAL</b>
━━━━━━━━━━━━━━━━━━
<b>ID:</b> <code>${executionId}</code>
<b>Tipe:</b> ${backupType}
<b>Waktu:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
<b>Pemicu:</b> ${triggeredBy}
<b>Alasan:</b> <i>${safeErrorMsg}</i>
━━━━━━━━━━━━━━━━━━
<i>Harap periksa status sistem dan kapasitas disk server.</i>
        `.trim();
        await notifier.toRoles(['OWNER'], failHtml);
      } catch {}

      throw err;
    } finally {
      isBackupRunning = false;
    }
  },
};
