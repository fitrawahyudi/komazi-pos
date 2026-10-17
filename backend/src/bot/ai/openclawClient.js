/**
 * Klien HTTP REST untuk Komazi AI Engine.
 * Berkomunikasi dengan Komazi AI Gateway surface (/v1/chat/completions).
 * Menggunakan fetch native dengan AbortController timeout & sanitasi error.
 */

import { getOpenclawConfig, isOpenClawAvailable } from './openclawConfig.js';
import { generateSalesAnalyticsNarrative, getAiSettings } from '../../services/aiService.js';
import logger from '../../utils/logger.js';

export class OpenClawError extends Error {
  constructor(message, code, status = null) {
    super(message);
    this.name = 'KomaziAiError';
    this.code = code;
    this.status = status;
  }
}

export const KomaziAiError = OpenClawError;

/**
 * Mengirim percakapan ke Komazi AI Engine via endpoint /v1/chat/completions.
 * @param {object} params
 * @param {Array<{ role: string, content: string }>} params.messages
 * @param {string|number} [params.userId]
 * @returns {Promise<{ text: string, model: string, usage: object }>}
 */
export async function sendOpenClawChat({ messages = [], userId = null }) {
  const config = getOpenclawConfig();

  if (!config.enabled) {
    throw new OpenClawError(
      'Fitur Komazi AI saat ini dinonaktifkan di pengaturan server (AI_ENABLED=false).',
      'AI_DISABLED'
    );
  }

  if (!config.baseUrl) {
    throw new OpenClawError(
      'URL Komazi AI belum dikonfigurasi (AI_BASE_URL).',
      'GATEWAY_CONFIG_MISSING'
    );
  }

  const endpoint = `${config.baseUrl}/v1/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  const payload = {
    model: 'komazi-ai-default',
    messages,
    temperature: 0.3,
    max_tokens: 800,
    user: userId ? String(userId) : undefined,
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      let errorBody = '';
      try {
        errorBody = await res.text();
      } catch {}

      if (res.status === 401 || res.status === 403) {
        throw new OpenClawError('Autentikasi Komazi AI ditolak (token tidak valid).', 'GATEWAY_AUTH_ERROR', res.status);
      }
      if (res.status === 429) {
        throw new OpenClawError('Batas kuota inferensi Komazi AI tercapai.', 'GATEWAY_RATE_LIMIT', res.status);
      }
      if (res.status >= 500) {
        throw new OpenClawError('Komazi AI Engine sedang mengalami gangguan internal.', 'GATEWAY_SERVER_ERROR', res.status);
      }

      throw new OpenClawError(
        `Komazi AI merespons dengan status HTTP ${res.status}: ${errorBody.slice(0, 120)}`,
        'GATEWAY_HTTP_ERROR',
        res.status
      );
    }

    const data = await res.json();
    let text = data?.choices?.[0]?.message?.content || '';

    // Sanitasi dan pemotongan panjang teks maksimal
    if (text.length > config.maxOutputChars) {
      text = text.slice(0, config.maxOutputChars) + '\n\n<i>[Catatan: Jawaban diringkas sesuai batas Telegram]</i>';
    }

    return {
      text: text.trim() || 'Maaf, asisten AI tidak memberikan teks jawaban.',
      model: data?.model || 'komazi-ai',
      usage: data?.usage || {},
    };
  } catch (err) {
    clearTimeout(timer);

    if (err.name === 'AbortError') {
      throw new OpenClawError(
        `Waktu permintaan ke Komazi AI melebihi batas (${Math.round(config.timeoutMs / 1000)} detik).`,
        'GATEWAY_TIMEOUT'
      );
    }

    if (err instanceof OpenClawError) {
      throw err;
    }

    // Network / Socket error -> Coba fallback otomatis ke Native Cloud AI (Groq/Gemini/OpenRouter)
    logger.telegram.warn(`[Komazi AI Network Error] ${err.message}. Mencoba fallback ke Groq/Gemini Cloud AI...`);

    try {
      const aiSettings = await getAiSettings();
      if (aiSettings.groqApiKey || aiSettings.geminiApiKey || aiSettings.openrouterApiKey) {
        const userMsg = messages.filter((m) => m.role === 'user').pop()?.content || '';
        const systemMsg = messages.find((m) => m.role === 'system')?.content || '';
        const historyMsgs = messages
          .filter((m) => m.role !== 'system' && m.content !== userMsg)
          .map((m) => ({
            role: m.role,
            text: m.content,
          }));

        const nativeResult = await generateSalesAnalyticsNarrative(
          userMsg,
          {},
          historyMsgs,
          'OWNER',
          'User',
          { systemPrompt: systemMsg }
        );

        if (nativeResult?.text) {
          let text = nativeResult.text;
          if (text.length > config.maxOutputChars) {
            text = text.slice(0, config.maxOutputChars) + '\n\n<i>[Catatan: Jawaban diringkas sesuai batas Telegram]</i>';
          }
          return {
            text: text.trim(),
            model: nativeResult.model || 'Komazi AI (Cloud Fallback)',
            usage: {},
          };
        }
      }
    } catch (fallbackErr) {
      logger.telegram.warn(`[Komazi AI Fallback Failed] ${fallbackErr.message}`);
    }

    throw new OpenClawError(
      'Tidak dapat terhubung ke Komazi AI Engine. Pastikan layanan AI aktif.',
      'GATEWAY_UNAVAILABLE'
    );
  }
}

export const sendKomaziAiChat = sendOpenClawChat;

/**
 * Pemeriksaan kesehatan (health ping) ke Gateway / Provider AI Komazi.
 * Memeriksa ketersediaan gateway lokal OpenClaw, atau fallback aktif ke Cloud AI (Groq, Gemini, OpenRouter).
 */
export async function pingOpenClawGateway() {
  const config = getOpenclawConfig();

  // 1. Coba ping gateway lokal OpenClaw jika aktif dan URL disetel
  if (config.enabled && config.baseUrl && !config.baseUrl.includes('dummy')) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch(`${config.baseUrl}/v1/models`, {
        method: 'GET',
        headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        return { ok: true, provider: 'LOCAL_OPENCLAW', detail: 'Local Engine Active', status: res.status };
      }
    } catch {
      clearTimeout(timer);
      // Local engine offline, lanjut cek provider Cloud
    }
  }

  // 2. Periksa ketersediaan Cloud AI (Groq, Gemini, OpenRouter)
  try {
    const aiSettings = await getAiSettings();
    if (aiSettings.groqApiKey) {
      return { ok: true, provider: 'GROQ', detail: 'Groq Cloud Active' };
    }
    if (aiSettings.geminiApiKey) {
      return { ok: true, provider: 'GEMINI', detail: 'Gemini Cloud Active' };
    }
    if (aiSettings.openrouterApiKey) {
      return { ok: true, provider: 'OPENROUTER', detail: 'OpenRouter Cloud Active' };
    }
  } catch (err) {
    logger.telegram.warn(`[Komazi AI Health] Failed checking Cloud AI settings: ${err.message}`);
  }

  // 3. Jika AI memang sengaja dinonaktifkan
  if (!config.enabled) {
    return { ok: true, isStandby: true, reason: 'AI_DISABLED', detail: 'Fitur AI Dinonaktifkan' };
  }

  return { ok: false, error: 'Tidak ada engine AI atau API Key yang aktif' };
}

export const pingKomaziAi = pingOpenClawGateway;
