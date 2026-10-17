import { Router } from 'express';
import { backupController } from '../controllers/backupController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter khusus operasi backup & restore untuk mitigasi spam / DDoS disk
const backupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  max: 15,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan operasi backup. Silakan coba kembali 5 menit kemudian.',
  },
});

// Seluruh endpoint Backup & Recovery diproteksi autentikasi dan HANYA untuk role OWNER
router.use(authenticate);
router.use(requireRole(['OWNER']));

// Ringkasan status & statistik
router.get('/summary', backupController.getSummary);

// Riwayat backup dengan filter & pagination
router.get('/', backupController.getHistory);

// Eksekusi backup manual sekarang
router.post('/manual', backupLimiter, backupController.triggerManual);

// Evaluasi retensi berkas
router.post('/retention/run', backupController.runRetention);

// Detail spesifik backup
router.get('/:id', backupController.getDetail);

// Verifikasi ulang integritas file fisik & checksum SHA-256
router.post('/:id/verify', backupController.verifyIntegrity);

// Unduh berkas terenkripsi
router.get('/:id/download', backupController.download);

// Uji coba simulasi pemulihan (Dry-run parser)
router.post('/:id/test-restore', backupController.testRestore);

// Eksekusi pemulihan database terkontrol (Wajib konfirmasi 'RESTORE-DATABASE')
router.post('/:id/restore', backupLimiter, backupController.executeRestore);

export default router;
