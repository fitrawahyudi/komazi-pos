/**
 * ESC/POS Thermal Receipt Logo Rasterizer
 * Converts brand logo (PNG/JPG/DataURL) to centered 1-bit monochrome GS v 0 raster commands
 * Compatible with 58mm (384 dots) and 80mm (576 dots) thermal printers.
 */

const logoRasterCache = new Map();

/**
 * Preload and rasterize logo image for thermal printer
 * @param {string} logoUrl - Path or URL of the logo (default: '/komazi-logo-transparent.png')
 * @param {string} paperWidth - '58mm' or '80mm'
 * @returns {Promise<Uint8Array|null>}
 */
export async function preloadReceiptLogoRaster(logoUrl = '/komazi-logo-transparent.png', paperWidth = '58mm') {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return null;
  const targetUrl = logoUrl || '/komazi-logo-transparent.png';
  const cacheKey = `${targetUrl}_${paperWidth}`;
  if (logoRasterCache.has(cacheKey)) {
    return logoRasterCache.get(cacheKey);
  }

  try {
    const is80 = paperWidth === '80mm';
    const totalPaperDots = is80 ? 576 : 384;
    const paperBytesWidth = totalPaperDots / 8; // 48 for 58mm, 72 for 80mm

    // Target dimensions for thermal printhead:
    // 58mm: 240px max width, max 72px tall
    // 80mm: 360px max width, max 96px tall
    const targetMaxWidth = is80 ? 360 : 240;
    const targetMaxHeight = is80 ? 96 : 72;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Failed to load receipt logo image: ' + targetUrl));
      img.src = targetUrl;
    });

    const imgWidth = img.naturalWidth || img.width || targetMaxWidth;
    const imgHeight = img.naturalHeight || img.height || targetMaxHeight;
    const ratio = Math.min(targetMaxWidth / imgWidth, targetMaxHeight / imgHeight, 1);

    // Ensure width and height are multiples of 8 for optimal thermal raster alignment
    let drawWidth = Math.max(16, Math.round((imgWidth * ratio) / 8) * 8);
    let drawHeight = Math.max(16, Math.round((imgHeight * ratio) / 8) * 8);

    const canvas = document.createElement('canvas');
    canvas.width = drawWidth;
    canvas.height = drawHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Fill canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    // Draw image centered
    ctx.drawImage(img, 0, 0, drawWidth, drawHeight);

    const imgData = ctx.getImageData(0, 0, drawWidth, drawHeight);
    const pixels = imgData.data;

    // Calculate left offset to center on thermal paper
    const leftOffsetDots = Math.max(0, Math.floor((totalPaperDots - drawWidth) / 2));
    const heightDots = drawHeight;
    const totalBytes = paperBytesWidth * heightDots;
    const bitmap = new Uint8Array(totalBytes);

    for (let y = 0; y < heightDots; y++) {
      for (let x = 0; x < drawWidth; x++) {
        const pixelIdx = (y * drawWidth + x) * 4;
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const b = pixels[pixelIdx + 2];
        const a = pixels[pixelIdx + 3];

        // Transparent or bright pixels are white (0)
        // Opaque dark/colored pixels are black (1)
        const isBlack = a > 60 && (0.299 * r + 0.587 * g + 0.114 * b) < 175;

        if (isBlack) {
          const targetDotX = leftOffsetDots + x;
          if (targetDotX < totalPaperDots) {
            const byteIndex = y * paperBytesWidth + Math.floor(targetDotX / 8);
            const bitOffset = 7 - (targetDotX % 8);
            bitmap[byteIndex] |= (1 << bitOffset);
          }
        }
      }
    }

    // ESC/POS GS v 0 Command Header: GS v 0 m xL xH yL yH
    const xL = paperBytesWidth & 0xff;
    const xH = (paperBytesWidth >> 8) & 0xff;
    const yL = heightDots & 0xff;
    const yH = (heightDots >> 8) & 0xff;

    const rasterBytes = new Uint8Array(8 + bitmap.length);
    rasterBytes[0] = 0x1d; // GS
    rasterBytes[1] = 0x76; // 'v'
    rasterBytes[2] = 0x30; // '0'
    rasterBytes[3] = 0x00; // Normal mode
    rasterBytes[4] = xL;
    rasterBytes[5] = xH;
    rasterBytes[6] = yL;
    rasterBytes[7] = yH;
    rasterBytes.set(bitmap, 8);

    logoRasterCache.set(cacheKey, rasterBytes);
    return rasterBytes;
  } catch (err) {
    console.warn('[ReceiptLogo] Preload logo raster warning:', err.message);
    return null;
  }
}

/**
 * Synchronously get preloaded logo raster bytes from cache
 * @param {string} logoUrl
 * @param {string} paperWidth
 * @returns {Uint8Array|null}
 */
export function getCachedReceiptLogoRasterBytes(logoUrl = '/komazi-logo-transparent.png', paperWidth = '58mm') {
  const targetUrl = logoUrl || '/komazi-logo-transparent.png';
  const cacheKey = `${targetUrl}_${paperWidth}`;
  return logoRasterCache.get(cacheKey) || null;
}

