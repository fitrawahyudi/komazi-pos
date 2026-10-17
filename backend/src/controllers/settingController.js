import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getSettingsMap, invalidateSettingsCache } from '../services/settingsCache.service.js';

// Kunci sensitif / API keys yang tidak boleh disimpan di tabel Setting
const DISALLOWED_SETTING_KEYS = [
  'groqApiKey',
  'geminiApiKey',
  'openrouterApiKey',
  'cloudinaryApiKey',
  'cloudinarySecret',
  'apiKey',
  'apiSecret',
];

function sanitizeSettingsMap(map) {
  DISALLOWED_SETTING_KEYS.forEach((key) => {
    delete map[key];
  });

  // Tambahkan status konfigurasi AI yang bersumber dari .env
  map.aiGroqConfigured = Boolean(process.env.GROQ_API_KEY);
  map.aiGroqModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  map.aiGeminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  map.aiGeminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  map.aiOpenRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);
  map.aiOpenRouterModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';
  map.aiPrimaryProvider = process.env.AI_PRIMARY_PROVIDER || 'groq';

  return map;
}

export async function getSettings(req, res) {
  try {
    const cached = await getSettingsMap();
    const map = { ...cached };

    // Mask PIN jika role bukan OWNER atau MANAGER
    const isPrivileged = ['OWNER', 'MANAGER'].includes(req.user?.role);
    if (!isPrivileged && map.supervisorPin) {
      map.supervisorPin = '••••';
    }

    // KDS / BDS Display API Key untuk integrasi perangkat dapur
    map.kdsApiKey = process.env.KDS_API_KEY || map.kdsApiKey || 'komazi_kds_live_secure_token_key_2026';
    if (!isPrivileged) {
      map.kdsApiKey = '••••••••';
    }

    const sanitized = sanitizeSettingsMap(map);
    return successResponse(res, sanitized, 'Pengaturan usaha');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function verifySupervisorPin(req, res) {
  try {
    const { pin } = req.body;
    if (!pin) {
      return errorResponse(res, 'PIN wajib diisi', 400);
    }

    const pinSetting = await prisma.setting.findUnique({ where: { key: 'supervisorPin' } });
    const validPin = pinSetting?.value ? String(pinSetting.value).trim() : null;

    if (!validPin) {
      return errorResponse(
        res,
        'PIN Supervisor belum diatur. Silakan minta Owner/Manager untuk mengatur PIN di Pengaturan.',
        400
      );
    }

    if (String(pin).trim() !== validPin) {
      return errorResponse(res, 'PIN Otorisasi Manager/Supervisor salah', 401);
    }

    return successResponse(res, { valid: true }, 'PIN otorisasi valid');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

export async function updateSettings(req, res) {
  try {
    const updates = { ...(req.body || {}) };

    // Hapus API key dari payload agar seluruh API key hanya dikelola via .env
    DISALLOWED_SETTING_KEYS.forEach((key) => {
      delete updates[key];
    });

    // Bersihkan jika ada entri lama dari tabel Setting
    await prisma.setting.deleteMany({
      where: {
        key: { in: DISALLOWED_SETTING_KEYS },
      },
    }).catch(() => {});

    if (Object.keys(updates).length > 0) {
      if (updates.headerText !== undefined && updates.receiptHeader === undefined) {
        updates.receiptHeader = updates.headerText;
      } else if (updates.receiptHeader !== undefined && updates.headerText === undefined) {
        updates.headerText = updates.receiptHeader;
      }

      if (updates.footerText !== undefined && updates.receiptFooter === undefined) {
        updates.receiptFooter = updates.footerText;
      } else if (updates.receiptFooter !== undefined && updates.footerText === undefined) {
        updates.footerText = updates.receiptFooter;
      }

      await prisma.$transaction(
        Object.entries(updates).map(([key, value]) => {
          const stringified =
            typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value ?? '');
          return prisma.setting.upsert({
            where: { key },
            update: { value: stringified },
            create: { key, value: stringified },
          });
        })
      );
      invalidateSettingsCache();
    }

    invalidateSettingsCache();
    const cached = await getSettingsMap();
    const map = { ...cached };

    const sanitized = sanitizeSettingsMap(map);
    return successResponse(res, sanitized, 'Pengaturan berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
