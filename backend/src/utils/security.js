/**
 * Utility Keamanan Terpusat Komazi POS (Security Hardening)
 * Menerapkan prinsip least-privilege, boundary validation, dan fail-closed defaults.
 */

/**
 * 1. Validasi Whitelist Origin CORS
 * Mencegah wildcard CORS bypass & subdomain takeover di hosting publik (Vercel, dll).
 */
export function isAllowedOrigin(origin) {
  // Izinkan request tanpa origin (aplikasi native mobile Capacitor Android/iOS, curl, Postman)
  if (!origin) return true;

  const cleanOrigin = origin.replace(/\/+$/, '');

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (allowedOrigins.includes(cleanOrigin)) return true;

  // Izinkan koneksi lokal / development LAN
  if (
    process.env.NODE_ENV !== 'production' ||
    cleanOrigin.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/)
  ) {
    return true;
  }

  // Khusus Vercel & Railway deployment: izinkan subdomain komazi-pos atau pos-komazi
  if (cleanOrigin.match(/^https:\/\/(komazi-pos|pos-komazi)(-[a-z0-9_-]+)?\.(vercel\.app|up\.railway\.app)$/i)) {
    return true;
  }

  return false;
}

/**
 * 2. Pengambilan Kunci JWT yang Aman (Fail-Closed di Production)
 * Menghentikan eksekusi jika environment produksi tidak menyediakan JWT_SECRET rahasia.
 */
export function getJwtSecrets() {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && (!secret || secret.includes('super_secret_key'))) {
    throw new Error(
      '[SECURITY CRITICAL] Server berjalan di mode production tanpa JWT_SECRET yang aman di environment! ' +
      'Silakan atur nilai JWT_SECRET acak dan kuat di file .env server.'
    );
  }

  return {
    jwtSecret: secret || 'komazi_pos_jwt_dev_only_local_secret_key_2026',
    jwtRefreshSecret: refreshSecret || 'komazi_pos_jwt_refresh_dev_only_local_secret_key_2026',
  };
}

/**
 * 3. Pencegahan Server-Side Request Forgery (SSRF)
 * Memastikan URL eksternal yang diunggah/diunduh tidak mengarah ke private IP internal.
 */
export function isSafeExternalUrl(urlString) {
  try {
    const parsed = new URL(urlString);

    // Hanya protokol HTTP dan HTTPS yang diizinkan
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Blokir localhost dan loopback
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost')
    ) {
      return false;
    }

    // Blokir AWS/Cloud metadata service
    if (hostname === '169.254.169.254' || hostname.startsWith('169.254.')) {
      return false;
    }

    // Blokir private IP ranges (RFC 1918)
    // 10.0.0.0/8
    if (hostname.startsWith('10.')) return false;
    // 172.16.0.0/12
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return false;
    // 192.168.0.0/16
    if (hostname.startsWith('192.168.')) return false;

    return true;
  } catch {
    return false;
  }
}
