/**
 * QRIS (Quick Response Code Indonesian Standard) Dynamic Engine
 * Compliant with EMVCo Merchant-Presented Mode (MPM) & Bank Indonesia PADG No. 21/18/PADG/2019
 */

import QRCode from 'qrcode';

// Default static QRIS template for Komazi Coffee & Workspace
export const DEFAULT_STATIC_QRIS =
  '00020101021126660014ID.LINKAJA.WWW01189360091100200889200215ID10200889201990303UME51440014ID.CO.QRIS.WWW0215ID10200889201990303UME5204581253033605802ID5925KOMAZI COFFEE & WORKSPACE6005MEDAN61052011263045928';

/**
 * Standard CRC-16-CCITT calculation for EMVCo
 * Polynomial: 0x1021, Initial Value: 0xFFFF
 */
export function calculateCrc16(str = '') {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Parse raw TLV string into array of { tag, val }
 */
export function parseQrisTlv(payload = '') {
  let str = String(payload || '').trim();
  // Strip trailing CRC (Tag 63) if present at end of string
  const crcIndex = str.lastIndexOf('6304');
  if (crcIndex !== -1 && crcIndex >= str.length - 10) {
    str = str.substring(0, crcIndex);
  }

  const tags = [];
  let i = 0;
  while (i < str.length) {
    if (i + 4 > str.length) break;
    const tag = str.substring(i, i + 2);
    const len = parseInt(str.substring(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > str.length) break;
    const val = str.substring(i + 4, i + 4 + len);
    tags.push({ tag, val });
    i += 4 + len;
  }
  return tags;
}

/**
 * Extract structured metadata from raw QRIS string (TLV EMVCo / Bank Indonesia)
 * Extracts: NMID, Merchant Name, City, Postal Code, Criteria, Acquirer, etc.
 * 
 * @param {string} payload 
 * @returns {object|null}
 */
export function extractQrisMetadata(payload = '') {
  const str = String(payload || '').trim();
  if (!str || str.length < 20) {
    return null;
  }

  const tags = parseQrisTlv(str);
  const tagMap = {};
  for (const item of tags) {
    tagMap[item.tag] = item.val;
  }

  // Helper to parse nested TLV subtags
  const parseSubtags = (valStr = '') => {
    const subMap = {};
    let idx = 0;
    while (idx + 4 <= valStr.length) {
      const sTag = valStr.substring(idx, idx + 2);
      const sLen = parseInt(valStr.substring(idx + 2, idx + 4), 10);
      if (isNaN(sLen) || idx + 4 + sLen > valStr.length) break;
      subMap[sTag] = valStr.substring(idx + 4, idx + 4 + sLen);
      idx += 4 + sLen;
    }
    return subMap;
  };

  let nmid = '';
  let criteria = '';
  let acquirer = '';

  // 1. Tag 51 (National Central Repository - QRIS) is the primary source of NMID
  if (tagMap['51']) {
    const sub51 = parseSubtags(tagMap['51']);
    if (sub51['02']) nmid = sub51['02'];
    if (sub51['03']) criteria = sub51['03'];
    if (sub51['00']) acquirer = sub51['00'];
  }

  // 2. If not found in Tag 51, check Tag 26 to 45 (Merchant Account Information)
  if (!nmid) {
    for (let t = 26; t <= 45; t++) {
      const tKey = t.toString().padStart(2, '0');
      if (tagMap[tKey]) {
        const sub = parseSubtags(tagMap[tKey]);
        if (sub['02'] && sub['02'].startsWith('ID')) {
          nmid = sub['02'];
        }
        if (sub['00'] && !acquirer) {
          acquirer = sub['00'];
        }
        if (sub['03'] && !criteria) {
          criteria = sub['03'];
        }
      }
    }
  }

  const merchantName = tagMap['59'] || '';
  const merchantCity = tagMap['60'] || '';
  const postalCode = tagMap['61'] || '';
  const mcc = tagMap['52'] || '';
  const currency = tagMap['53'] || '360';
  const pointOfInitiation = tagMap['01'] || '11';

  return {
    rawPayload: str,
    nmid,
    merchantName,
    merchantCity,
    postalCode,
    mcc,
    currency,
    criteria,
    acquirer,
    pointOfInitiation,
    isValid: Boolean(merchantName || nmid),
  };
}

/**
 * Convert a Static QRIS string into a Dynamic or Compatible QRIS string
 * 
 * Compatibility Note for Indonesian Payment Apps (ShopeePay, BCA, GoPay, DANA):
 * - UMKM/Store QRIS (like DANA Bisnis, ShopeePay Merchant, BCA) are registered as Static ('11').
 * - Changing Tag 01 to '12' or injecting Tag 62 causes Acquirer/Switch to reject with "Terjadi kesalahan sistem"
 *   because the acquirer expects an active enterprise Payment Gateway session.
 * - 'compatible' mode keeps Tag 01 as '11', injects Tag 54 (Amount), and omits Tag 62.
 *   This enables automatic nominal entry across ShopeePay, BCA, GoPay, and Livin' without switch errors!
 * 
 * @param {string} staticStr - Raw static QRIS payload
 * @param {number} amount - Grand total transaction amount (in IDR)
 * @param {string|object} invoiceOrOptions - Invoice string or options object
 * @param {object} [maybeOptions] - Additional options if invoice string was passed
 * @returns {string} Fully valid QRIS payload with recalculated CRC16
 */
export function convertStaticToDynamicQris(staticStr, amount, invoiceOrOptions = '', maybeOptions = {}) {
  const baseStr = (staticStr && staticStr.trim().length > 20) ? staticStr.trim() : DEFAULT_STATIC_QRIS;

  let invoiceNo = '';
  let options = {};
  if (typeof invoiceOrOptions === 'object' && invoiceOrOptions !== null) {
    options = invoiceOrOptions;
    invoiceNo = options.invoiceNo || '';
  } else {
    invoiceNo = String(invoiceOrOptions || '');
    options = maybeOptions || {};
  }

  const mode = options.mode || 'compatible'; // 'compatible' (recomended) | 'dynamic' | 'raw'
  const includeInvoice = Boolean(options.includeInvoice); // default false to prevent switch reject

  // Mode 'raw': return original static string untouched
  if (mode === 'raw') {
    return baseStr;
  }

  // Parse payload into structured EMVCo TLV tags
  let tags = parseQrisTlv(baseStr);
  if (!tags || tags.length === 0) {
    return baseStr;
  }

  // 1. Remove existing Tag 54 (Amount) and Tag 63 (CRC) to ensure idempotency
  tags = tags.filter((t) => t.tag !== '54' && t.tag !== '63');

  // 2. Adjust Point of Initiation Method (Tag 01)
  // '11' = Static (recommended for UMKM compatibility across BCA, ShopeePay, GoPay, DANA)
  // '12' = Dynamic (only for enterprise Payment Gateway)
  const tag01 = tags.find((t) => t.tag === '01');
  if (tag01) {
    tag01.val = mode === 'dynamic' ? '12' : '11';
  } else {
    tags.unshift({ tag: '01', val: mode === 'dynamic' ? '12' : '11' });
  }

  // Ensure Tag 00 (Format Indicator) is always first
  const tag00Idx = tags.findIndex((t) => t.tag === '00');
  if (tag00Idx > 0) {
    const [tag00] = tags.splice(tag00Idx, 1);
    tags.unshift(tag00);
  } else if (tag00Idx === -1) {
    tags.unshift({ tag: '00', val: '01' });
  }

  // 3. Inject Tag 54 (Transaction Amount) if amount > 0
  const numericAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (numericAmount > 0) {
    const amtTag = { tag: '54', val: numericAmount.toString() };
    // EMVCo standard: Tag 54 sits between Tag 53 (Currency) and Tag 58 (Country Code)
    const idx58 = tags.findIndex((t) => t.tag === '58');
    if (idx58 !== -1) {
      tags.splice(idx58, 0, amtTag);
    } else {
      const idx53 = tags.findIndex((t) => t.tag === '53');
      if (idx53 !== -1) {
        tags.splice(idx53 + 1, 0, amtTag);
      } else {
        tags.push(amtTag);
      }
    }
  }

  // 4. Optionally inject Tag 62 (Additional Data / Invoice)
  // Warning: injecting Tag 62 on standard UMKM/static QRIS causes ShopeePay & DANA to throw switch error!
  if (includeInvoice && invoiceNo) {
    const cleanInvoice = String(invoiceNo).trim().slice(0, 25);
    const sub01 = `01${cleanInvoice.length.toString().padStart(2, '0')}${cleanInvoice}`;
    const existing62 = tags.find((t) => t.tag === '62');
    if (existing62) {
      existing62.val = sub01;
    } else {
      tags.push({ tag: '62', val: sub01 });
    }
  } else if (!includeInvoice) {
    // Remove Tag 62 in compatible mode so Indonesian payment switches won't reject
    tags = tags.filter((t) => t.tag !== '62');
  }

  // 5. Reconstruct valid TLV string
  const payload = tags
    .map((t) => `${t.tag}${t.val.length.toString().padStart(2, '0')}${t.val}`)
    .join('');

  // 6. Append Tag 63 prefix and calculate standard CRC16-CCITT
  const payloadWith63 = `${payload}6304`;
  const crc = calculateCrc16(payloadWith63);
  return `${payloadWith63}${crc}`;
}

/**
 * Generate a dynamic QRIS string for an order and store settings
 */
export function generateDynamicQrisForOrder(order = {}, storeSettings = {}) {
  const staticStr = (storeSettings?.qrisStaticString && storeSettings.qrisStaticString.trim().length > 20)
    ? storeSettings.qrisStaticString.trim()
    : DEFAULT_STATIC_QRIS;
  const rawTotal = order?.total ?? order?.grandTotal ?? order?.subtotal ?? 0;
  const grandTotal = typeof rawTotal === 'string'
    ? Math.round(Number(rawTotal.replace(/[^0-9]/g, '')) || 0)
    : Math.round(Number(rawTotal) || 0);
  const invoiceNo = order?.invoiceNo || (order?.id ? `KMZ-${order.id}` : 'KMZ-ORDER');
  const mode = storeSettings?.qrisMode || 'compatible';
  const includeInvoice = storeSettings?.qrisIncludeInvoice === true || storeSettings?.qrisIncludeInvoice === 'true';

  return convertStaticToDynamicQris(staticStr, grandTotal, {
    mode,
    includeInvoice,
    invoiceNo,
  });
}

/**
 * Generate an SVG string of a QR Code asynchronously
 */
export async function generateQrSvgString(text, options = {}) {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      margin: options.margin ?? 1,
      width: options.width ?? 140,
      errorCorrectionLevel: options.errorCorrectionLevel ?? 'M',
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff',
      },
    });
  } catch (err) {
    console.error('[QRIS] Failed to generate QR SVG:', err);
    return '';
  }
}

/**
 * Generate a Base64 PNG Data URL of a QR Code
 */
export async function generateQrDataUrl(text, options = {}) {
  try {
    return await QRCode.toDataURL(text, {
      margin: options.margin ?? 1,
      width: options.width ?? 250,
      errorCorrectionLevel: options.errorCorrectionLevel ?? 'M',
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#ffffff',
      },
    });
  } catch (err) {
    console.error('[QRIS] Failed to generate QR DataURL:', err);
    return '';
  }
}

/**
 * Generate ESC/POS centered raster bitmap bytes (GS v 0) from QR text
 * Compact scale prevents buffer overflow on mini thermal printers
 */
export function generateEscPosQrRasterBytes(text, paperWidth = '58mm') {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const rawSize = qr.modules.size;
    const data = qr.modules.data;

    // Compact scale for fast transmission and buffer safety (scale 3 for 58mm, 4 for 80mm)
    const is80 = paperWidth === '80mm';
    const scale = is80 ? 4 : 3;
    const padding = 1;

    const qrModules = rawSize + padding * 2;
    const qrDots = qrModules * scale;

    const totalPaperDots = is80 ? 576 : 384;
    const paperBytesWidth = totalPaperDots / 8; // 48 for 58mm, 72 for 80mm

    // Center offset
    const leftOffsetDots = Math.max(0, Math.floor((totalPaperDots - qrDots) / 2));
    const heightDots = qrDots;
    const totalBytes = paperBytesWidth * heightDots;
    const raster = new Uint8Array(totalBytes);

    for (let r = 0; r < heightDots; r++) {
      const modY = Math.floor(r / scale) - padding;
      const rowOffset = r * paperBytesWidth;

      for (let c = 0; c < qrDots; c++) {
        const modX = Math.floor(c / scale) - padding;
        let isDark = false;
        if (modX >= 0 && modX < rawSize && modY >= 0 && modY < rawSize) {
          isDark = data[modY * rawSize + modX] === 1;
        }

        if (isDark) {
          const dotX = leftOffsetDots + c;
          if (dotX < totalPaperDots) {
            const byteIdx = rowOffset + Math.floor(dotX / 8);
            const bitIdx = 7 - (dotX % 8);
            raster[byteIdx] |= 1 << bitIdx;
          }
        }
      }
    }

    const GS = 0x1d;
    const xL = paperBytesWidth % 256;
    const xH = Math.floor(paperBytesWidth / 256);
    const yL = heightDots % 256;
    const yH = Math.floor(heightDots / 256);

    const header = new Uint8Array([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    const combined = new Uint8Array(header.length + raster.length);
    combined.set(header, 0);
    combined.set(raster, header.length);
    return combined;
  } catch (err) {
    console.error('[QRIS] Failed to generate ESC/POS QR raster:', err);
    return null;
  }
}
