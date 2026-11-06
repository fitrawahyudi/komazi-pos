import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROOFS_DIR = path.join(__dirname, '../../public/uploads/payment-proofs');

/**
 * Menyimpan foto bukti transfer pembayaran QR Order.
 * Prioritas: Cloudinary jika tersedia -> Penyimpanan Lokal Disk (/uploads/payment-proofs/).
 *
 * @param {object} params
 * @param {object} [params.file] - Multer file buffer
 * @param {string} [params.base64] - Base64 Data URL string
 * @param {string} [params.invoiceNo] - Nomor invoice transaksi
 * @returns {Promise<string>} URL publik foto bukti bayar
 */
export async function savePaymentProof({ file = null, base64 = null, invoiceNo = 'ORDER' }) {
  const cleanInvoice = String(invoiceNo).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFilename = `proof_${cleanInvoice}_${Date.now()}`;

  let fileBuffer = null;
  let extension = 'jpg';

  if (file && file.buffer) {
    fileBuffer = file.buffer;
    const ext = path.extname(file.originalname || '').replace('.', '');
    if (ext) extension = ext.toLowerCase();
  } else if (base64 && typeof base64 === 'string') {
    const matches = base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      fileBuffer = Buffer.from(matches[2], 'base64');
    } else {
      fileBuffer = Buffer.from(base64, 'base64');
    }
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File foto bukti transfer tidak ditemukan atau format tidak valid.');
  }

  // 1. Coba upload ke Cloudinary jika sudah dikonfigurasi
  if (isCloudinaryConfigured()) {
    try {
      const uploadRes = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'komazi-pos/proofs',
            public_id: safeFilename,
            resource_type: 'image',
            transformation: [{ quality: 'auto:good' }, { fetch_format: 'auto' }],
          },
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        );
        stream.end(fileBuffer);
      });

      if (uploadRes && uploadRes.secure_url) {
        return uploadRes.secure_url;
      }
    } catch (err) {
      console.warn('[PaymentProof] Cloudinary upload gagal, fallback ke penyimpanan lokal disk:', err.message);
    }
  }

  // 2. Fallback: Simpan ke penyimpanan lokal disk
  try {
    if (!fs.existsSync(PROOFS_DIR)) {
      fs.mkdirSync(PROOFS_DIR, { recursive: true });
    }

    const finalFileName = `${safeFilename}.${extension}`;
    const destinationPath = path.join(PROOFS_DIR, finalFileName);

    await fs.promises.writeFile(destinationPath, fileBuffer);
    return `/uploads/payment-proofs/${finalFileName}`;
  } catch (err) {
    console.error('[PaymentProof] Gagal menulis foto bukti transfer ke disk lokal:', err);
    throw new Error('Gagal menyimpan file bukti transfer di server.');
  }
}

