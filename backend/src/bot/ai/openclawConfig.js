/**
 * Konfigurasi Integrasi Komazi AI Engine untuk Bot Telegram Komazi POS.
 * Semua nilai dibaca dari environment variables (.env).
 * Default aman: AI_ENABLED=false.
 */

export function getOpenclawConfig() {
  const isEnabled = (process.env.AI_ENABLED || '').toLowerCase().trim() === 'true';
  const baseUrl = (process.env.AI_BASE_URL || process.env.OPENCLAW_BASE_URL || '').replace(/\/+$/, '').trim();
  const token = (process.env.AI_GATEWAY_TOKEN || process.env.AI_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN || '').trim();

  const timeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10);
  const maxInputChars = parseInt(process.env.AI_MAX_INPUT_CHARS, 10);
  const maxOutputChars = parseInt(process.env.AI_MAX_OUTPUT_CHARS, 10);
  const maxConcurrent = parseInt(process.env.AI_MAX_CONCURRENT_REQUESTS, 10);
  const dailyLimit = parseInt(process.env.AI_USER_DAILY_LIMIT, 10);

  const rolesRaw = process.env.AI_ALLOWED_ROLES || 'OWNER,MANAGER';
  const allowedRoles = rolesRaw
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);

  return {
    enabled: isEnabled,
    baseUrl: baseUrl || 'http://localhost:18789',
    token,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000,
    maxInputChars: Number.isFinite(maxInputChars) && maxInputChars > 0 ? maxInputChars : 500,
    maxOutputChars: Number.isFinite(maxOutputChars) && maxOutputChars > 0 ? maxOutputChars : 1500,
    maxConcurrent: Number.isFinite(maxConcurrent) && maxConcurrent > 0 ? maxConcurrent : 1,
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : 30,
    allowedRoles: allowedRoles.length > 0 ? allowedRoles : ['OWNER', 'MANAGER'],
  };
}

export const getKomaziAiConfig = getOpenclawConfig;

/**
 * Memeriksa apakah AI diaktifkan dan memiliki konfigurasi minimum untuk dipanggil.
 */
export function isOpenClawAvailable() {
  const cfg = getOpenclawConfig();
  return cfg.enabled && Boolean(cfg.baseUrl);
}

export const isKomaziAiAvailable = isOpenClawAvailable;

/**
 * Menyajikan konfigurasi aman untuk logging/diagnostik (token disamarkan).
 */
export function getSafeOpenclawConfig() {
  const cfg = getOpenclawConfig();
  return {
    enabled: cfg.enabled,
    baseUrl: cfg.baseUrl,
    tokenMasked: cfg.token ? `${cfg.token.slice(0, 4)}...${cfg.token.slice(-4)}` : '(not set)',
    timeoutMs: cfg.timeoutMs,
    maxInputChars: cfg.maxInputChars,
    maxOutputChars: cfg.maxOutputChars,
    dailyLimit: cfg.dailyLimit,
    allowedRoles: cfg.allowedRoles,
  };
}

export const getSafeKomaziAiConfig = getSafeOpenclawConfig;
