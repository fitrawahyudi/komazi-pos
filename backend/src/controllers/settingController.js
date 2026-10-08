import prisma from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

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
    const settings = await prisma.setting.findMany();
    const map = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    // Default supervisorPin ke '1234' jika belum diatur
    if (!map.supervisorPin) {
      map.supervisorPin = '1234';
    }

    // Mask PIN jika role bukan OWNER atau MANAGER
    const isPrivileged = ['OWNER', 'MANAGER'].includes(req.user?.role);
    if (!isPrivileged) {
      map.supervisorPin = '••••';
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
    const validPin = pinSetting?.value || '1234';

    if (String(pin).trim() !== String(validPin).trim()) {
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
      await prisma.$transaction(
        Object.entries(updates).map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) },
          })
        )
      );
    }

    const all = await prisma.setting.findMany();
    const map = all.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    const sanitized = sanitizeSettingsMap(map);
    return successResponse(res, sanitized, 'Pengaturan berhasil diperbarui');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}
