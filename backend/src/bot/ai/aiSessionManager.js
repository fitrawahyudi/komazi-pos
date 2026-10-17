/**
 * Session & Conversation History Manager untuk Komazi AI.
 * Menggabungkan in-memory fast cache dengan penyimpanan persisten tak terbatas
 * berbasis berkas Markdown (.md) via markdownMemoryManager.
 *
 * Kebal terhadap server restart, crash, maupun pembersihan memori.
 */

import {
  appendConversationTurn,
  loadRecentTurns,
  clearConversationHistory,
} from '../../services/ai/markdownMemoryManager.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // Cache hangat 24 Jam di RAM
const MAX_TURNS = 10; // Maksimal 10 pasang dialog (20 pesan) untuk sliding window prompt

// Map: userId -> { lastAccessedAt: number, messages: Array<{ role: string, content: string }> }
const sessions = new Map();

/**
 * Mengambil riwayat percakapan pengguna (Sinkron dari RAM cache).
 * Jika belum ada di RAM, mengembalikan array kosong (gunakan loadHistoryAsync untuk memuat dari Markdown).
 * @param {string|number} userId
 * @returns {Array<{ role: 'user'|'assistant', content: string }>}
 */
export function getHistory(userId) {
  if (!userId) return [];
  const key = String(userId);
  const session = sessions.get(key);
  if (!session) return [];

  session.lastAccessedAt = Date.now();
  return [...session.messages];
}

/**
 * Mengambil riwayat percakapan pengguna secara asinkron dari berkas Markdown (Crash-resilient).
 * Jika ada di RAM cache, gunakan cache; jika belum, baca dari disk Markdown dan isi RAM cache.
 * @param {string|number} userId
 * @param {number} [maxTurns=10]
 * @returns {Promise<Array<{ role: 'user'|'assistant', content: string }>>}
 */
export async function getHistoryAsync(userId, maxTurns = MAX_TURNS) {
  if (!userId) return [];
  const key = String(userId);

  // Jika sudah ada di in-memory cache dan tidak kosong
  const session = sessions.get(key);
  if (session && session.messages && session.messages.length > 0) {
    session.lastAccessedAt = Date.now();
    return [...session.messages];
  }

  // Jika belum ada di RAM (misal setelah server restart), muat dari berkas Markdown
  try {
    const diskTurns = await loadRecentTurns(userId, maxTurns);
    sessions.set(key, {
      lastAccessedAt: Date.now(),
      messages: diskTurns,
    });
    return [...diskTurns];
  } catch {
    return [];
  }
}

/**
 * Menyimpan sepasang giliran percakapan (user query & assistant response)
 * ke in-memory cache dan berkas Markdown secara persisten.
 * @param {string|number} userId
 * @param {string} userQuery
 * @param {string} assistantReply
 * @param {object} [userInfo={}]
 */
export function appendTurn(userId, userQuery, assistantReply, userInfo = {}) {
  if (!userId) return;
  const key = String(userId);
  const now = Date.now();

  let session = sessions.get(key);
  if (!session) {
    session = {
      lastAccessedAt: now,
      messages: [],
    };
    sessions.set(key, session);
  } else {
    session.lastAccessedAt = now;
  }

  if (userQuery && typeof userQuery === 'string') {
    session.messages.push({ role: 'user', content: userQuery.trim() });
  }

  if (assistantReply && typeof assistantReply === 'string') {
    session.messages.push({ role: 'assistant', content: assistantReply.trim() });
  }

  const maxMessages = MAX_TURNS * 2;
  if (session.messages.length > maxMessages) {
    session.messages = session.messages.slice(-maxMessages);
  }

  // Tulis secara persisten ke berkas Markdown di latar belakang
  return appendConversationTurn(userId, userQuery, assistantReply, userInfo).catch((err) => {
    // Non-fatal warning
    console.warn(`[AiSessionManager] Gagal menulis memori Markdown user ${userId}:`, err.message);
  });
}

/**
 * Membersihkan hanya RAM cache untuk simulasi restart server tanpa menghapus berkas Markdown
 * @param {string|number} userId
 */
export function clearRamCache(userId) {
  if (!userId) return;
  sessions.delete(String(userId));
}

/**
 * Menghapus sesi percakapan pengguna secara eksplisit (dari RAM dan berkas Markdown).
 * Digunakan untuk perintah /ai reset atau /ai clear.
 * @param {string|number} userId
 */
export function clearSession(userId) {
  if (!userId) return;
  const key = String(userId);
  sessions.delete(key);

  // Bersihkan riwayat di Markdown
  clearConversationHistory(userId).catch(() => {});
}

/**
 * Membersihkan seluruh sesi di RAM yang telah melewati batas waktu (TTL).
 * @returns {number} Jumlah sesi yang dibersihkan dari RAM
 */
export function pruneExpiredSessions() {
  const now = Date.now();
  let prunedCount = 0;
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastAccessedAt > SESSION_TTL_MS) {
      sessions.delete(key);
      prunedCount++;
    }
  }
  return prunedCount;
}

/**
 * Mengambil ringkasan diagnostik sesi aktif.
 */
export function getSessionStats() {
  return {
    activeSessionsCount: sessions.size,
    ttlMinutes: SESSION_TTL_MS / 60000,
    maxTurnsStored: MAX_TURNS,
    storageType: 'HYBRID_MARKDOWN_PERSISTENT',
  };
}

// Map: userId -> expiresAt (timestamp)
const directChatModes = new Map();

/**
 * Mengaktifkan atau menonaktifkan mode chat AI langsung tanpa perlu prefix /ai.
 * Mode bebas kini bertahan persisten selama bot aktif (default aktif 7 hari atau tanpa batas).
 * @param {string|number} userId
 * @param {boolean} enabled
 */
export function setAiDirectChatMode(userId, enabled = true) {
  if (!userId) return;
  const key = String(userId);
  if (enabled) {
    // Aktif selama 7 hari
    directChatModes.set(key, Date.now() + 7 * 24 * 60 * 60 * 1000);
  } else {
    directChatModes.delete(key);
  }
}

/**
 * Memeriksa apakah mode chat langsung sedang aktif untuk pengguna tersebut.
 * @param {string|number} userId
 * @returns {boolean}
 */
export function isAiDirectChatMode(userId) {
  if (!userId) return false;
  const key = String(userId);
  const expiresAt = directChatModes.get(key);
  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    directChatModes.delete(key);
    return false;
  }
  return true;
}

/**
 * Melakukan toggle (ON <-> OFF) mode chat langsung.
 * @param {string|number} userId
 * @returns {boolean} Status baru setelah toggle
 */
export function toggleAiDirectChatMode(userId) {
  const current = isAiDirectChatMode(userId);
  setAiDirectChatMode(userId, !current);
  return !current;
}
