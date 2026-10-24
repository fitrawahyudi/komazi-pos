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

/**
 * Generate AI food/beverage photo for menu items and optionally persist to Cloudinary
 */
export async function generateAiMenuImage(req, res) {
  try {
    const { productName, categoryName, customPrompt, saveToCloudinary, imageUrl: existingImageUrl } = req.body || {};

    // 1. If client asks to persist a previewed image URL to Cloudinary
    if (saveToCloudinary && existingImageUrl) {
      if (!isCloudinaryConfigured()) {
        return errorResponse(res, 'Kredensial Cloudinary belum dikonfigurasi di server (.env)', 500);
      }
      if (!isSafeExternalUrl(existingImageUrl)) {
        return errorResponse(res, 'URL gambar tidak valid atau tidak diizinkan untuk alasan keamanan', 400);
      }

      const uploadResult = await cloudinary.uploader.upload(existingImageUrl, {
        folder: 'komazi-pos/menu',
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      return successResponse(
        res,
        {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          isSaved: true,
        },
        'Foto produk berhasil disimpan permanen ke Cloudinary'
      );
    }

    // 2. Validate product name for generation
    if (!productName || typeof productName !== 'string' || !productName.trim()) {
      return errorResponse(res, 'Nama menu wajib diisi untuk menghasilkan foto AI', 400);
    }

    const cleanName = productName.trim();
    const cleanCat = (categoryName || '').toLowerCase().trim();

    // Check if item is beverage or food/pastry
    const isDrink =
      cleanCat.includes('kopi') ||
      cleanCat.includes('coffee') ||
      cleanCat.includes('minum') ||
      cleanCat.includes('drink') ||
      cleanCat.includes('beverage') ||
      cleanCat.includes('tea') ||
      cleanCat.includes('teh') ||
      cleanCat.includes('boba') ||
      cleanCat.includes('juice') ||
      cleanCat.includes('jus') ||
      cleanCat.includes('latte') ||
      cleanCat.includes('mocktail') ||
      cleanCat.includes('smoothie') ||
      /^(kopi|iced|ice|es|hot|tea|teh|latte|americano|cappuccino|matcha|boba|espresso)/i.test(cleanName);

    let promptText = '';
    if (isDrink) {
      promptText = `Professional commercial beverage photography of ${cleanName}, served in an aesthetic clean modern glass, cafe ambiance on a rustic wooden table, soft warm cafe lighting, shallow depth of field, high-end cafe aesthetic, garnished, appetizing, 8k resolution, photorealistic`;
    } else {
      promptText = `Professional commercial food photography of ${cleanName}, beautifully plated on an elegant ceramic dish, cafe table setting, appetizing presentation with garnish, warm ambient lighting, shallow depth of field, 8k resolution, photorealistic, culinary food magazine style`;
    }

    if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
      promptText += `, ${customPrompt.trim()}`;
    }

    const seed = Math.floor(Math.random() * 900000) + 100000;
    const encodedPrompt = encodeURIComponent(promptText);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=800&model=flux&seed=${seed}&nologo=true`;

    // 3. If direct save requested immediately
    if (saveToCloudinary) {
      if (!isCloudinaryConfigured()) {
        return errorResponse(res, 'Kredensial Cloudinary belum dikonfigurasi di server (.env)', 500);
      }

      const uploadResult = await cloudinary.uploader.upload(pollinationsUrl, {
        folder: 'komazi-pos/menu',
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      return successResponse(
        res,
        {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          prompt: promptText,
          seed,
          isSaved: true,
        },
        'Foto menu berhasil dibuat dan disimpan ke Cloudinary'
      );
    }

    // 4. Default: Return preview URL so user can review/regenerate before persisting
    return successResponse(
      res,
      {
        imageUrl: pollinationsUrl,
        prompt: promptText,
        seed,
        isSaved: false,
      },
      'Foto AI berhasil dibuat. Silakan pratinjau sebelum menyimpan.'
    );
  } catch (err) {
    console.error('[AI Menu Image Error]', err);
    return errorResponse(res, `Gagal membuat foto AI: ${err.message}`, 500);
  }
}

