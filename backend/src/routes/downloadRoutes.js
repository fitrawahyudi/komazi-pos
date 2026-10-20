import { Router } from 'express';
import downloadController from '../controllers/downloadController.js';

const router = Router();

// Endpoint publik unduh APK langsung (didukung streaming/redirect dari private GitHub / public release repo)
router.get('/apk', (req, res, next) => downloadController.downloadLatestApk(req, res, next));

// Endpoint info metadata APK
router.get('/apk/info', (req, res, next) => downloadController.getApkInfo(req, res, next));

export default router;
