/**
 * Backup Storage Service (Layer B)
 * Mengelola penyimpanan file backup terenkripsi secara aman.
 * Menerapkan boundary sanitization untuk mencegah path traversal (LFI/RFI).
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root direktori penyimpanan backup lokal (terisolasi dan diabaikan dari git)
const DEFAULT_BACKUP_DIR = path.resolve(__dirname, '../../../../scratch/backups');
const BACKUP_DIR = process.env.BACKUP_STORAGE_PATH
  ? path.resolve(process.env.BACKUP_STORAGE_PATH)
  : DEFAULT_BACKUP_DIR;

/**
 * Validasi dan sanitasi nama file agar aman dari path traversal
 */
export function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('Nama file backup tidak valid');
  }
  // Hanya izinkan karakter alfanumerik, garis bawah, titik, dan strip
  const cleanName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!cleanName || cleanName === '.' || cleanName === '..') {
    throw new Error('Nama file backup berbahaya atau tidak diizinkan');
  }
  return cleanName;
}

export const backupStorageService = {
  /**
   * Pastikan direktori backup sudah siap
   */
  async ensureDirectory() {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    return BACKUP_DIR;
  },

  /**
   * Simpan buffer file ke storage
   */
  async save(fileName, buffer) {
    const safeName = sanitizeFileName(fileName);
    await this.ensureDirectory();
    const targetPath = path.join(BACKUP_DIR, safeName);

    await fs.writeFile(targetPath, buffer);
    const stats = await fs.stat(targetPath);

    logger.scheduler.info(`[BackupStorage] File tersimpan: ${safeName} (${stats.size} bytes)`);

    return {
      fileName: safeName,
      storagePath: targetPath,
      sizeBytes: stats.size,
      storageProvider: 'LOCAL',
    };
  },

  /**
   * Baca seluruh isi file backup (Buffer)
   */
  async read(fileName) {
    const safeName = sanitizeFileName(fileName);
    const targetPath = path.join(BACKUP_DIR, safeName);
    return fs.readFile(targetPath);
  },

  /**
   * Dapatkan ReadStream untuk pengunduhan hemat memori (streaming)
   */
  createReadStream(fileName) {
    const safeName = sanitizeFileName(fileName);
    const targetPath = path.join(BACKUP_DIR, safeName);
    if (!fsSync.existsSync(targetPath)) {
      throw new Error(`File backup '${safeName}' tidak ditemukan di storage.`);
    }
    return fsSync.createReadStream(targetPath);
  },

  /**
   * Cek keberadaan file di storage
   */
  async exists(fileName) {
    try {
      const safeName = sanitizeFileName(fileName);
      const targetPath = path.join(BACKUP_DIR, safeName);
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Ambil ukuran dan metadata file fisik
   */
  async getFileStats(fileName) {
    const safeName = sanitizeFileName(fileName);
    const targetPath = path.join(BACKUP_DIR, safeName);
    const stats = await fs.stat(targetPath);
    return {
      sizeBytes: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      path: targetPath,
    };
  },

  /**
   * Hapus file backup dari storage fisik
   */
  async delete(fileName) {
    try {
      const safeName = sanitizeFileName(fileName);
      const targetPath = path.join(BACKUP_DIR, safeName);
      if (await this.exists(safeName)) {
        await fs.unlink(targetPath);
        logger.scheduler.info(`[BackupStorage] File terhapus: ${safeName}`);
        return true;
      }
      return false;
    } catch (err) {
      logger.scheduler.warn(`[BackupStorage] Gagal menghapus file ${fileName}: ${err.message}`);
      return false;
    }
  },
};
