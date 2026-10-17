import { Router } from 'express';
import multer from 'multer';
import { uploadImage, deleteImage } from '../controllers/uploadController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';

const storage = multer.memoryStorage();
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Larang tegas file SVG karena dapat memuat payload Stored XSS (script execution)
    const mime = (file.mimetype || '').toLowerCase();
    if (ALLOWED_MIME_TYPES.has(mime) && !mime.includes('svg')) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Hanya gambar JPG, PNG, WebP, dan GIF yang diizinkan (SVG dilarang untuk keamanan)'), false);
    }
  },
});

// Middleware fleksibel untuk menerima file gambar dari field mana saja (image, file, avatar, photo)
const uploadAnyImage = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
};

const router = Router();

// Endpoint upload gambar ke Cloudinary
router.post('/', authenticate, uploadAnyImage, uploadImage);

// Endpoint hapus gambar dari Cloudinary (khusus Owner & Manager)
router.delete('/:publicId(*)', authenticate, requireRole(['OWNER', 'MANAGER']), deleteImage);

export default router;
