import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { isSafeExternalUrl } from '../utils/security.js';

/**
 * Handle all photo uploads strictly to Cloudinary with automatic optimization
 */
export async function uploadImage(req, res) {
  try {
    if (!isCloudinaryConfigured()) {
      return errorResponse(res, 'Kredensial Cloudinary belum dikonfigurasi di server (.env)', 500);
    }

    // 1. Upload via multipart file buffer
    if (req.file) {
      const { buffer, originalname, mimetype } = req.file;

      return new Promise((resolve) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'komazi-pos',
            resource_type: 'image',
            transformation: [
              { quality: 'auto:good' },
              { fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) {
              console.error('[Cloudinary Upload Error]', error);
              return resolve(
                errorResponse(res, `Gagal upload ke Cloudinary: ${error.message}`, 500)
              );
            }

            return resolve(
              successResponse(
                res,
                {
                  url: result.secure_url,
                  publicId: result.public_id,
                  width: result.width,
                  height: result.height,
                  format: result.format,
                  bytes: result.bytes,
                  provider: 'cloudinary',
                },
                'Foto berhasil diunggah ke Cloudinary'
              )
            );
          }
        );

        uploadStream.end(buffer);
      });
    }

    // 2. Upload via Base64 data URL or external URL in request body
    const base64OrUrl = req.body?.image || req.body?.file || req.body?.dataUrl || req.body?.url;
    if (base64OrUrl && typeof base64OrUrl === 'string') {
      const isDataUrl = base64OrUrl.startsWith('data:image/');
      
      // Jika data URL, tolak SVG untuk mencegah Stored XSS
      if (isDataUrl) {
        if (base64OrUrl.startsWith('data:image/svg')) {
          return errorResponse(res, 'Format gambar SVG tidak diizinkan untuk alasan keamanan', 400);
        }
      } else {
        // Jika URL eksternal, validasi terhadap SSRF (tolak localhost, internal network, cloud metadata)
        if (!isSafeExternalUrl(base64OrUrl)) {
          return errorResponse(
            res,
            'URL sumber gambar tidak valid atau mengarah ke alamat jaringan internal yang dilarang (SSRF Protection)',
            400
          );
        }
      }

      const result = await cloudinary.uploader.upload(base64OrUrl, {
        folder: 'komazi-pos',
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      return successResponse(
        res,
        {
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          provider: 'cloudinary',
        },
        'Foto berhasil diunggah ke Cloudinary'
      );
    }

    return errorResponse(res, 'File gambar tidak ditemukan dalam request (kirim form-data image atau base64 string)', 400);
  } catch (err) {
    console.error('[Upload Controller Error]', err);
    return errorResponse(res, `Gagal memproses upload ke Cloudinary: ${err.message}`, 500);
  }
}

/**
 * Delete image from Cloudinary by public ID
 */
export async function deleteImage(req, res) {
  try {
    const { publicId } = req.params;
    if (!publicId) {
      return errorResponse(res, 'Public ID gambar wajib disertakan', 400);
    }

    const fullPublicId = publicId.startsWith('komazi-pos/') ? publicId : `komazi-pos/${publicId}`;
    const result = await cloudinary.uploader.destroy(fullPublicId);

    return successResponse(res, result, 'Foto berhasil dihapus dari Cloudinary');
  } catch (err) {
    console.error('[Delete Cloudinary Image Error]', err);
    return errorResponse(res, err.message, 500);
  }
}
