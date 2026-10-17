/**
 * Markdown-Based Unlimited Conversation Memory Manager untuk Komazi AI.
 * Menyimpan riwayat percakapan secara persisten ke dalam berkas Markdown (.md)
 * di direktori lokal storage/ai_memories/user_{userId}.md.
 *
 * Kebal terhadap server crash, restart, atau deployment ulang.
 * Mendukung pembacaan sliding-window multi-turn dan ringkasan episodik jangka panjang.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Direktori penyimpanan berkas memori Markdown
const MEMORY_DIR = path.resolve(__dirname, '../../../storage/ai_memories');

// Map antrean penulisan per user agar tidak terjadi race condition berkas
const writeQueues = new Map();

/**
 * Format timestamp zona Asia/Jakarta (WIB)
 */
export function formatWibTimestamp(date = new Date()) {
  try {
    const d = new Date(date);
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    const month = parts.find((p) => p.type === 'month')?.value || '01';
    const year = parts.find((p) => p.type === 'year')?.value || '2026';
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    const second = parts.find((p) => p.type === 'second')?.value || '00';
    return `${year}-${month}-${day} ${hour}:${minute}:${second} WIB`;
  } catch {
    return `${new Date().toISOString()} WIB`;
  }
}

/**
 * Mendapatkan path berkas memori pengguna
 */
export function getMemoryFilePath(userId) {
  const safeId = String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(MEMORY_DIR, `user_${safeId}.md`);
}

/**
 * Memastikan direktori memori ada
 */
export async function ensureMemoryDir() {
  await fs.promises.mkdir(MEMORY_DIR, { recursive: true });
}

/**
 * Menjalankan operasi penulisan berkas secara sekuensial per user (FIFO)
 */
function enqueueUserWrite(userId, task) {
  const key = String(userId);
  const previous = writeQueues.get(key) || Promise.resolve();
  const current = previous
    .catch(() => {}) // tangani error task sebelumnya agar antrean tidak macet
    .then(task);

  writeQueues.set(key, current);
  current.finally(() => {
    if (writeQueues.get(key) === current) {
      writeQueues.delete(key);
    }
  });

  return current;
}

/**
 * Membuat berkas template memori baru jika belum ada
 */
export async function ensureUserMemoryFile(userId, userInfo = {}) {
  await ensureMemoryDir();
  const filePath = getMemoryFilePath(userId);

  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch {
    const userName = userInfo.name || 'Staf Komazi';
    const userRole = userInfo.role || 'STAFF';
    const nowWib = formatWibTimestamp();

    const initialTemplate = `# MEMORI ASISTEN KOMAZI: ${userName} (ID: ${userId})
Peran: ${userRole} | Outlet: Komazi Coffee & Workspace
Dibuat: ${nowWib}
Terakhir Diperbarui: ${nowWib}

## 1. Profil & Preferensi Operasional
- Nama: ${userName}
- Peran Sistem: ${userRole}
- Gaya Bahasa: Ramah, santai, profesional, khas kedai kopi.

## 2. Ringkasan Konteks Jangka Panjang (Episodic Memory)
- Belum ada catatan konteks masa lalu.

## 3. Jadwal & Tugas Aktif Pengguna
- Belum ada jadwal atau pengingat aktif yang tercatat.

## 4. Riwayat Percakapan Lengkap (Append-Only)
`;

    await fs.promises.writeFile(filePath, initialTemplate, 'utf8');
  }

  return filePath;
}

/**
 * Menambahkan giliran percakapan baru (User & Assistant) ke berkas Markdown
 * secara append-only dan persisten.
 */
export async function appendConversationTurn(userId, userQuery, assistantReply, userInfo = {}) {
  if (!userId) return;

  return enqueueUserWrite(userId, async () => {
    const filePath = await ensureUserMemoryFile(userId, userInfo);
    const nowWib = formatWibTimestamp();

    let entry = `\n### [${nowWib}] USER\n${(userQuery || '').trim()}\n\n### [${nowWib}] ASSISTANT\n${(assistantReply || '').trim()}\n`;

    // Baca berkas untuk memperbarui header 'Terakhir Diperbarui'
    let content = await fs.promises.readFile(filePath, 'utf8');

    // Perbarui header Terakhir Diperbarui jika ada
    if (/Terakhir Diperbarui:.*/i.test(content)) {
      content = content.replace(/Terakhir Diperbarui:.*/i, `Terakhir Diperbarui: ${nowWib}`);
    }

    // Pastikan header seksi 4 ada
    if (!content.includes('## 4. Riwayat Percakapan Lengkap (Append-Only)')) {
      content += '\n## 4. Riwayat Percakapan Lengkap (Append-Only)\n';
    }

    content += entry;
    await fs.promises.writeFile(filePath, content, 'utf8');
  });
}

/**
 * Membaca giliran percakapan terakhir (sliding window) dari berkas Markdown
 * untuk diinjeksi ke panggilan LLM.
 * @param {string|number} userId
 * @param {number} maxTurns - Maksimal pasang user/assistant (default: 10 pasang = 20 pesan)
 * @returns {Promise<Array<{ role: 'user'|'assistant', content: string }>>}
 */
export async function loadRecentTurns(userId, maxTurns = 10) {
  if (!userId) return [];
  const filePath = getMemoryFilePath(userId);

  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const historySectionIdx = content.indexOf('## 4. Riwayat Percakapan Lengkap (Append-Only)');
    if (historySectionIdx === -1) return [];

    const rawHistory = content.slice(historySectionIdx);
    const lines = rawHistory.split('\n');

    const messages = [];
    let currentRole = null;
    let currentBuffer = [];

    const flushBuffer = () => {
      if (currentRole && currentBuffer.length > 0) {
        const text = currentBuffer.join('\n').trim();
        if (text) {
          messages.push({ role: currentRole, content: text });
        }
      }
      currentBuffer = [];
    };

    for (const line of lines) {
      const userMatch = line.match(/^###\s+\[.*?\]\s+USER$/i);
      const assistantMatch = line.match(/^###\s+\[.*?\]\s+ASSISTANT$/i);

      if (userMatch) {
        flushBuffer();
        currentRole = 'user';
      } else if (assistantMatch) {
        flushBuffer();
        currentRole = 'assistant';
      } else if (currentRole) {
        currentBuffer.push(line);
      }
    }
    flushBuffer();

    const maxMessages = maxTurns * 2;
    if (messages.length > maxMessages) {
      return messages.slice(-maxMessages);
    }
    return messages;
  } catch {
    return [];
  }
}

/**
 * Mengambil ringkasan konteks jangka panjang dan profil dari berkas Markdown
 * untuk dimasukkan ke system prompt LLM.
 */
export async function getLongTermMemoryPrompt(userId) {
  if (!userId) return '';
  const filePath = getMemoryFilePath(userId);

  try {
    const content = await fs.promises.readFile(filePath, 'utf8');

    // Ekstrak seksi 1 (Profil), seksi 2 (Konteks Jangka Panjang), seksi 3 (Jadwal Aktif)
    const historyIdx = content.indexOf('## 4. Riwayat Percakapan Lengkap');
    const headerSections = historyIdx !== -1 ? content.slice(0, historyIdx).trim() : content.trim();

    return headerSections;
  } catch {
    return '';
  }
}

/**
 * Memperbarui seksi 2 (Ringkasan Konteks Jangka Panjang) di berkas Markdown
 */
export async function updateEpisodicSummary(userId, newSummary) {
  if (!userId || !newSummary) return;

  return enqueueUserWrite(userId, async () => {
    const filePath = await ensureUserMemoryFile(userId);
    let content = await fs.promises.readFile(filePath, 'utf8');

    const regex = /## 2\. Ringkasan Konteks Jangka Panjang \(Episodic Memory\)[\s\S]*?(?=## 3\. Jadwal & Tugas Aktif|$)/i;
    const replacement = `## 2. Ringkasan Konteks Jangka Panjang (Episodic Memory)\n${newSummary.trim()}\n\n`;

    if (regex.test(content)) {
      content = content.replace(regex, replacement);
    } else {
      content += `\n${replacement}`;
    }

    await fs.promises.writeFile(filePath, content, 'utf8');
  });
}

/**
 * Memperbarui seksi 3 (Jadwal & Tugas Aktif Pengguna) di berkas Markdown
 */
export async function updateActiveSchedules(userId, schedulesText) {
  if (!userId) return;

  return enqueueUserWrite(userId, async () => {
    const filePath = await ensureUserMemoryFile(userId);
    let content = await fs.promises.readFile(filePath, 'utf8');

    const regex = /## 3\. Jadwal & Tugas Aktif Pengguna[\s\S]*?(?=## 4\. Riwayat Percakapan Lengkap|$)/i;
    const replacement = `## 3. Jadwal & Tugas Aktif Pengguna\n${(schedulesText || '- Belum ada jadwal aktif.').trim()}\n\n`;

    if (regex.test(content)) {
      content = content.replace(regex, replacement);
    } else {
      content += `\n${replacement}`;
    }

    await fs.promises.writeFile(filePath, content, 'utf8');
  });
}

/**
 * Menghapus hanya riwayat percakapan (seksi 4) tanpa menghapus profil dan memori jangka panjang
 */
export async function clearConversationHistory(userId) {
  if (!userId) return;

  return enqueueUserWrite(userId, async () => {
    const filePath = getMemoryFilePath(userId);
    try {
      let content = await fs.promises.readFile(filePath, 'utf8');
      const historyIdx = content.indexOf('## 4. Riwayat Percakapan Lengkap (Append-Only)');
      if (historyIdx !== -1) {
        content = content.slice(0, historyIdx) + '## 4. Riwayat Percakapan Lengkap (Append-Only)\n';
        await fs.promises.writeFile(filePath, content, 'utf8');
      }
    } catch {}
  });
}

/**
 * Menghapus seluruh berkas memori pengguna (Hard Reset)
 */
export async function deleteUserMemoryFile(userId) {
  if (!userId) return;
  return enqueueUserWrite(userId, async () => {
    const filePath = getMemoryFilePath(userId);
    try {
      await fs.promises.unlink(filePath);
    } catch {}
  });
}
