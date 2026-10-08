import { Router } from 'express';
import multer from 'multer';
import { uploadImage, deleteImage } from '../controllers/uploadController.js';
import { authenticate } from '../middlewares/auth.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diizinkan (JPG, PNG, WebP, GIF)'), false);
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

// Endpoint hapus gambar dari Cloudinary
router.delete('/:publicId(*)', authenticate, deleteImage);

export default router;
