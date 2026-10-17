import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/attendance');

/**
 * Menghitung jarak lurus (Great-Circle Distance) antara dua koordinat GPS
 * menggunakan formula Haversine (dalam satuan meter presisi tinggi).
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Jarak dalam meter
 */
export function calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Menyimpan foto bukti kehadiran staf:
 * - Jika Cloudinary aktif dan tersedia, upload langsung ke Cloudinary folder 'komazi-pos/attendance'.
 * - Jika Cloudinary tidak aktif/offline, simpan di penyimpanan lokal 'public/uploads/attendance'.
 *
 * @param {string} photoData - Base64 Data URL atau URL gambar eksternal
 * @param {number|string} userId
 * @param {string} prefix - 'in' atau 'out'
 * @returns {Promise<string>} URL gambar yang dapat diakses publik
 */
export async function saveAttendancePhoto(photoData, userId, prefix = 'in') {
  if (!photoData || typeof photoData !== 'string') return null;

  // Jika sudah berupa URL http/https lengkap, gunakan langsung
  if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
    return photoData;
  }

  // 1. Coba upload ke Cloudinary jika terkonfigurasi
  if (isCloudinaryConfigured()) {
    try {
      const uploadRes = await cloudinary.uploader.upload(photoData, {
        folder: 'komazi-pos/attendance',
        resource_type: 'image',
        transformation: [
          { width: 640, height: 640, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });
      if (uploadRes && uploadRes.secure_url) {
        return uploadRes.secure_url;
      }
    } catch (err) {
      console.warn('[AttendanceAntiFraud] Cloudinary upload gagal, beralih ke penyimpanan lokal:', err.message);
    }
  }

  // 2. Simpan secara lokal ke disk
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const matches = photoData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    let extension = 'jpg';
    let base64Data = photoData;

    if (matches && matches.length === 3) {
      extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      base64Data = matches[2];
    }

    const filename = `att_${userId}_${prefix}_${Date.now()}.${extension}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
    return `/uploads/attendance/${filename}`;
  } catch (err) {
    console.error('[AttendanceAntiFraud] Gagal menyimpan foto lokal:', err.message);
    return null;
  }
}

/**
 * Memvalidasi kepatuhan presensi terhadap aturan anti-fraud (Geofencing GPS & Bukti Foto Selfie):
 *
 * @param {object} params
 * @param {number|string} params.userId
 * @param {string} params.userRole
 * @param {number|string|null} params.latitude
 * @param {number|string|null} params.longitude
 * @param {number|string|null} params.accuracy
 * @param {string|null} params.photo
 * @param {object} params.settingsMap
 * @returns {Promise<{ valid: boolean, error?: string, statusCode?: number, verifiedDistance: number|null, verifiedLocation: boolean, photoUrl: string|null }>}
 */
export async function verifyAttendanceAntiFraud({
  userId,
  userRole,
  latitude,
  longitude,
  accuracy,
  photo,
  settingsMap = {},
  type = 'in',
}) {
  const outletLat = parseFloat(settingsMap['outletLatitude']);
  const outletLon = parseFloat(settingsMap['outletLongitude']);
  let computedDistance = null;
  if (
    !isNaN(outletLat) &&
    !isNaN(outletLon) &&
    latitude !== undefined &&
    longitude !== undefined &&
    latitude !== null &&
    longitude !== null
  ) {
    const staffLat = parseFloat(latitude);
    const staffLon = parseFloat(longitude);
    if (!isNaN(staffLat) && !isNaN(staffLon)) {
      computedDistance = calculateHaversineDistanceMeters(outletLat, outletLon, staffLat, staffLon);
    }
  }

  // OWNER dibebaskan dari penolakan geofencing & foto, namun tetap dicatat jarak & fotonya
  if (userRole === 'OWNER') {
    let photoUrl = null;
    if (photo) {
      photoUrl = await saveAttendancePhoto(photo, userId, type);
    }
    return {
      valid: true,
      verifiedDistance: computedDistance,
      verifiedLocation: true,
      photoUrl,
    };
  }

  const isGeofenceEnabled =
    settingsMap['attendanceGeofenceEnabled'] === 'true' ||
    settingsMap['attendanceGeofenceEnabled'] === true;

  const maxRadiusMeters = parseInt(settingsMap['attendanceRadiusMeters'], 10) || 100;

  let verifiedDistance = computedDistance;
  let verifiedLocation = false;

  // 1. Validasi Geofencing Lokasi GPS (Jika diaktifkan & koordinat outlet telah diatur)
  if (isGeofenceEnabled && !isNaN(outletLat) && !isNaN(outletLon)) {
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      return {
        valid: false,
        statusCode: 400,
        error:
          `Validasi Lokasi Gagal: Izin GPS (lokasi) wajib diaktifkan pada perangkat untuk memastikan Anda berada di area outlet saat melakukan presensi ${type === 'out' ? 'pulang' : 'masuk'}.`,
      };
    }

    const staffLat = parseFloat(latitude);
    const staffLon = parseFloat(longitude);

    if (isNaN(staffLat) || isNaN(staffLon)) {
      return {
        valid: false,
        statusCode: 400,
        error: 'Koordinat GPS yang dikirimkan perangkat tidak valid.',
      };
    }

    // Deteksi Fake GPS / Akurasi anomali
    if (accuracy !== undefined && accuracy !== null) {
      const acc = parseFloat(accuracy);
      if (acc < 0 || acc > 1500) {
        return {
          valid: false,
          statusCode: 400,
          error: 'Sinyal akurasi GPS terlalu lemah atau terdeteksi anomali. Pastikan Anda berada di luar ruangan tertutup rapat dan matikan aplikasi Mock Location/Fake GPS.',
        };
      }
    }

    verifiedDistance = calculateHaversineDistanceMeters(outletLat, outletLon, staffLat, staffLon);

    if (verifiedDistance > maxRadiusMeters) {
      return {
        valid: false,
        statusCode: 403,
        error: `Presensi Ditolak: Anda terdeteksi berada di luar area outlet (Jarak Anda: ${verifiedDistance} meter, batas toleransi: ${maxRadiusMeters} meter). Presensi ${type === 'out' ? 'pulang' : 'masuk'} hanya dapat dilakukan di lokasi fisik outlet.`,
      };
    }

    verifiedLocation = true;
  }

  // 2. Validasi Bukti Foto Selfie Wajah (Jika diaktifkan)
  const isSelfieRequired =
    settingsMap['attendanceSelfieRequired'] === 'true' ||
    settingsMap['attendanceSelfieRequired'] === true;

  if (isSelfieRequired && (!photo || typeof photo !== 'string' || photo.trim().length === 0)) {
    const actionLabel = type === 'out' ? 'pulang' : 'kehadiran';
    return {
      valid: false,
      statusCode: 400,
      error:
        `Bukti Foto Wajib: Anda wajib mengambil foto selfie langsung di outlet sebelum dapat mencatat presensi ${actionLabel}.`,
    };
  }

  let photoUrl = null;
  if (photo) {
    photoUrl = await saveAttendancePhoto(photo, userId, type);
  }

  return {
    valid: true,
    verifiedDistance,
    verifiedLocation,
    photoUrl,
  };
}
