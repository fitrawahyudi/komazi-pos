import prisma from '../config/db.js';

let cachedSettings = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Get cached key-value map of business settings.
 * Avoids executing SELECT * FROM Setting on every order, report, or receipt.
 */
export async function getSettingsMap() {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiresAt) {
    return cachedSettings;
  }

  try {
    const settings = await prisma.setting.findMany();
    const map = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    cachedSettings = map;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedSettings;
  } catch (error) {
    // If DB fails and we have stale cache, return stale cache as fallback
    if (cachedSettings) return cachedSettings;
    throw error;
  }
}

/**
 * Invalidate the settings cache immediately upon setting update.
 */
export function invalidateSettingsCache() {
  cachedSettings = null;
  cacheExpiresAt = 0;
}
