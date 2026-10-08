/**
 * QR Code Image Decoder Utility for Browser
 * Uses jsQR to extract string payload from Image files or Blobs
 */
import jsQR from 'jsqr';

/**
 * Read image file and decode QR code
 * Supports multiple attempts (original size, downscaled, inverted) for maximum detection rate
 * 
 * @param {File|Blob} imageFile 
 * @returns {Promise<string>} Decoded QR code text payload
 */
export async function decodeQrFromImageFile(imageFile) {
  if (!imageFile) {
    throw new Error('File gambar tidak ditemukan');
  }

  // Ensure file is an image
  if (imageFile.type && !imageFile.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (PNG, JPG, JPEG, WebP)');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Gagal membaca file gambar'));
    };

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => {
        reject(new Error('Format gambar tidak didukung atau file rusak'));
      };

      img.onload = () => {
        try {
          const result = attemptDecodeImage(img);
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Tidak ditemukan kode QR pada gambar ini. Pastikan gambar jelas dan tidak blur.'));
          }
        } catch (err) {
          reject(new Error('Gagal memproses gambar QR: ' + err.message));
        }
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(imageFile);
  });
}

/**
 * Decode from an Image element using Canvas
 */
function attemptDecodeImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Canvas 2D context tidak tersedia pada browser Anda');
  }

  const { naturalWidth: width, naturalHeight: height } = img;

  // Pass 1: Try natural dimensions (capped at 1600px for performance & jsQR memory limits)
  let targetWidth = width;
  let targetHeight = height;
  const maxDim = 1600;

  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
      targetHeight = maxDim;
    }
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  let imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  let code = jsQR(imageData.data, targetWidth, targetHeight, {
    inversionAttempts: 'attemptBoth',
  });

  if (code && code.data) {
    return code.data;
  }

  // Pass 2: If failed and image was scaled, try original resolution if within reasonable bounds (<= 2500px)
  if ((targetWidth !== width || targetHeight !== height) && width <= 2500 && height <= 2500) {
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    imageData = ctx.getImageData(0, 0, width, height);
    code = jsQR(imageData.data, width, height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code && code.data) {
      return code.data;
    }
  }

  // Pass 3: Try downscaling to 800px (useful for high-res phone camera shots with noise)
  if (width > 800 || height > 800) {
    const scale = Math.min(800 / width, 800 / height);
    const smallW = Math.round(width * scale);
    const smallH = Math.round(height * scale);

    canvas.width = smallW;
    canvas.height = smallH;
    ctx.drawImage(img, 0, 0, smallW, smallH);
    imageData = ctx.getImageData(0, 0, smallW, smallH);
    code = jsQR(imageData.data, smallW, smallH, {
      inversionAttempts: 'attemptBoth',
    });
    if (code && code.data) {
      return code.data;
    }
  }

  return null;
}
