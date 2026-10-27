/**
 * Handler Aksi Operasional AI Copilot (Telegram Bot).
 * Menangani penyimpanan draf aksi berbatas waktu, pembuatan antarmuka konfirmasi
 * tombol (Draft & Confirm Guard), serta eksekusi mutasi inventaris dan menu dengan RBAC.
 */

import { InlineKeyboard } from 'grammy';
import prisma from '../../config/db.js';
import { stockService } from '../../services/stock.service.js';
import { menuService } from '../../services/menu.service.js';
import { parseOperationalAction } from '../../services/ai/aiActionParser.js';
import { logBotAudit } from '../middlewares/audit.js';
import { esc } from '../utils/format.js';
import logger from '../../utils/logger.js';

// Cache draf aksi dalam memori (otomatis kedaluwarsa 15 menit)
const quickActionDrafts = new Map();

/**
 * Menyimpan draf aksi ke dalam cache memori sementara
 * @param {object} actionData
 * @param {string|number} userId
 * @returns {string} draftId acak 7 karakter
 */
export function storeQuickActionDraft(actionData, userId) {
  const draftId = Math.random().toString(36).slice(2, 9);
  quickActionDrafts.set(draftId, {
    ...actionData,
    userId: String(userId || ''),
    createdAt: Date.now(),
  });

  // Bersihkan draf kedaluwarsa jika cache membesar
  if (quickActionDrafts.size > 100) {
    const expireBefore = Date.now() - 15 * 60 * 1000;
    for (const [id, item] of quickActionDrafts.entries()) {
      if (item.createdAt < expireBefore) quickActionDrafts.delete(id);
    }
  }

  return draftId;
}

/**
 * Mengambil dan langsung menghapus draf (jaminan eksekusi tunggal / anti-double tap)
 * @param {string} draftId
 * @returns {object|null}
 */
export function popQuickActionDraft(draftId) {
  const draft = quickActionDrafts.get(draftId);
  if (draft) {
    quickActionDrafts.delete(draftId);
  }
  return draft || null;
}

/**
 * Menghasilkan teks dan InlineKeyboard konfirmasi aksi yang aman
 * @param {object} draft
 * @param {string} draftId
 * @returns {{ text: string, reply_markup: InlineKeyboard }}
 */
export function formatActionConfirmationReply(draft, draftId) {
  const kb = new InlineKeyboard();

  if (draft.actionType === 'RESTOCK') {
    const item = draft.matchedEntity;
    const text = `
📦 <b>KONFIRMASI STOK MASUK (RESTOCK)</b>
━━━━━━━━━━━━━━━━━━
• Bahan Baku: <b>${esc(item.name)}</b>
• Jumlah Masuk: <b>+${draft.qty} ${esc(draft.unit)}</b>
• Stok Saat Ini: <code>${draft.currentStock} ${esc(draft.unit)}</code>
• Proyeksi Stok Baru: <b>${draft.projectedStock} ${esc(draft.unit)}</b>
━━━━━━━━━━━━━━━━━━
<i>💡 Konfirmasikan perubahan stok ini dengan menekan tombol di bawah:</i>
    `.trim();

    kb.text(`✅ Ya, Catat Restock (+${draft.qty})`, `act:exec:${draftId}`)
      .row()
      .text('❌ Batal', `act:cancel:${draftId}`);

    return { text, reply_markup: kb };
  }

  if (draft.actionType === 'TOGGLE_MENU') {
    const item = draft.matchedEntity;
    const currentStatusText = item.isSoldOut ? '🚫 HABIS (Sold Out)' : '🟢 TERSEDIA (Ready)';
    const targetStatusText = draft.targetSoldOut ? '🚫 HABIS (Sold Out)' : '🟢 TERSEDIA (Ready)';
    const buttonIcon = draft.targetSoldOut ? '🚫 Tandai Menu Habis' : '🟢 Buka Menu Tersedia';

    const text = `
🍽️ <b>KONFIRMASI STATUS KETERSEDIAAN MENU</b>
━━━━━━━━━━━━━━━━━━
• Nama Menu: <b>${esc(item.name)}</b>
• Status Sekarang: <code>${currentStatusText}</code>
• Status Baru: <b>${targetStatusText}</b>
━━━━━━━━━━━━━━━━━━
<i>💡 Konfirmasikan perubahan status menu ini dengan menekan tombol di bawah:</i>
    `.trim();

    kb.text(buttonIcon, `act:exec:${draftId}`)
      .row()
      .text('❌ Batal', `act:cancel:${draftId}`);

    return { text, reply_markup: kb };
  }

  // Fallback umum
  kb.text('✅ Ya, Konfirmasi', `act:exec:${draftId}`)
    .row()
    .text('❌ Batal', `act:cancel:${draftId}`);

  return {
    text: `⚠️ <b>KONFIRMASI AKSI OPERASIONAL</b>\n\n${draft.summary || 'Apakah Anda yakin ingin menjalankan aksi ini?'}`,
    reply_markup: kb,
  };
}

/**
 * Mencoba memproses pesan obrolan sebagai perintah aksi operasional
 * @param {object} ctx - Grammy context
 * @param {string} rawText - Teks pesan
 * @returns {Promise<{ handled: boolean, draftId?: string }>}
 */
export async function tryHandleOperationalAction(ctx, rawText) {
  if (!ctx.user) return { handled: false };

  try {
    // Ambil data referensi bahan dan produk dari cache/database
    const [ingredients, products] = await Promise.all([
      stockService.listAll().catch(() => []),
      menuService.listAllForToggle().catch(() => []),
    ]);

    const parsedAction = parseOperationalAction(rawText, { ingredients, products });
    if (!parsedAction || !parsedAction.matchedEntity) {
      return { handled: false };
    }

    // Periksa hak akses role sebelum membuat draf:
    const role = ctx.user.role;
    if (parsedAction.actionType === 'RESTOCK' && role !== 'OWNER' && role !== 'MANAGER') {
      await ctx.reply(
        `⛔ <b>AKSES TERBATAS</b>\n\nHanya role <b>Owner</b> atau <b>Manager</b> yang memiliki wewenang untuk mencatat stok masuk (restock) bahan baku.`,
        { parse_mode: 'HTML' }
      );
      return { handled: true };
    }

    if (parsedAction.actionType === 'TOGGLE_MENU' && role !== 'OWNER' && role !== 'MANAGER' && role !== 'BARISTA') {
      await ctx.reply(
        `⛔ <b>AKSES TERBATAS</b>\n\nHanya role <b>Owner</b>, <b>Manager</b>, atau <b>Barista</b> yang memiliki wewenang untuk mengubah status ketersediaan menu.`,
        { parse_mode: 'HTML' }
      );
      return { handled: true };
    }

    // Buat draf dan sajikan kartu konfirmasi aman
    const draftId = storeQuickActionDraft(parsedAction, ctx.user.id);
    const replyData = formatActionConfirmationReply(parsedAction, draftId);

    await ctx.reply(replyData.text, {
      parse_mode: 'HTML',
      reply_markup: replyData.reply_markup,
    });

    return { handled: true, draftId };
  } catch (err) {
    logger.telegram.warn(`[AiActions] Gagal memproses draf aksi operasional: ${err.message}`);
    return { handled: false };
  }
}

/**
 * Mendaftarkan callback queries untuk eksekusi dan pembatalan aksi operasional AI
 * @param {object} bot - Grammy Bot instance
 */
export function registerAiActionHandlers(bot) {
  // 1. Eksekusi Aksi: act:exec:DRAFT_ID
  bot.callbackQuery(/^act:exec:([a-z0-9]+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    const draft = popQuickActionDraft(draftId);

    if (!draft) {
      return ctx.answerCallbackQuery({
        text: '⚠️ Draf aksi sudah kedaluwarsa atau telah dieksekusi sebelumnya.',
        show_alert: true,
      });
    }

    const user = ctx.user;
    if (!user) {
      return ctx.answerCallbackQuery({
        text: '⛔ Anda belum terdaftar sebagai staf POS.',
        show_alert: true,
      });
    }

    const role = user.role;

    try {
      // Eksekusi A: Restock Bahan Baku
      if (draft.actionType === 'RESTOCK') {
        if (role !== 'OWNER' && role !== 'MANAGER') {
          return ctx.answerCallbackQuery({
            text: '⛔ Akses ditolak: Hanya Owner dan Manager yang dapat mencatat restock.',
            show_alert: true,
          });
        }

        const ingId = draft.matchedEntity.id;
        const result = await stockService.recordStockIn({
          ingredientId: ingId,
          qty: draft.qty,
          note: `Restock via AI Copilot oleh ${user.name} (${user.role})`,
        });

        await logBotAudit(user.id, 'AI_COPILOT_RESTOCK', {
          ingredientId: ingId,
          ingredientName: draft.matchedEntity.name,
          addedQty: draft.qty,
          unit: draft.unit,
          newStock: result.ingredient?.stock,
        });

        await ctx.answerCallbackQuery({
          text: `✅ Stok ${draft.matchedEntity.name} berhasil ditambah +${draft.qty} ${draft.unit}!`,
        });

        const successText = `
✅ <b>RESTOCK BERHASIL DICATAT</b>
━━━━━━━━━━━━━━━━━━
• Bahan Baku: <b>${esc(draft.matchedEntity.name)}</b>
• Jumlah Masuk: <b>+${draft.qty} ${esc(draft.unit)}</b>
• Stok Baru di POS: <b>${result.ingredient?.stock} ${esc(draft.unit)}</b>
• Dicatat Oleh: <b>${esc(user.name)} (${user.role})</b>
━━━━━━━━━━━━━━━━━━
🤖 <i>Komazi AI Operational Copilot</i>
        `.trim();

        return ctx.editMessageText(successText, { parse_mode: 'HTML' }).catch(() => {});
      }

      // Eksekusi B: Toggle Ketersediaan Menu (Sold Out / Ready)
      if (draft.actionType === 'TOGGLE_MENU') {
        if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'BARISTA') {
          return ctx.answerCallbackQuery({
            text: '⛔ Akses ditolak: Hanya Owner, Manager, atau Barista yang dapat mengubah status menu.',
            show_alert: true,
          });
        }

        const prodId = draft.matchedEntity.id;
        const updated = await prisma.product.update({
          where: { id: prodId },
          data: { isSoldOut: draft.targetSoldOut },
        });

        await logBotAudit(user.id, 'AI_COPILOT_MENU_STATUS', {
          productId: prodId,
          productName: updated.name,
          isSoldOut: updated.isSoldOut,
        });

        const statusLabel = updated.isSoldOut ? '🚫 HABIS (Sold Out)' : '🟢 TERSEDIA (Ready)';
        await ctx.answerCallbackQuery({
          text: `${updated.name} kini ${statusLabel}`,
        });

        const successText = `
✅ <b>STATUS MENU BERHASIL DIPERBARUI</b>
━━━━━━━━━━━━━━━━━━
• Menu: <b>${esc(updated.name)}</b>
• Status Sekarang: <b>${statusLabel}</b>
• Diperbarui Oleh: <b>${esc(user.name)} (${user.role})</b>
━━━━━━━━━━━━━━━━━━
🤖 <i>Komazi AI Operational Copilot</i>
        `.trim();

        return ctx.editMessageText(successText, { parse_mode: 'HTML' }).catch(() => {});
      }
    } catch (execErr) {
      logger.telegram.error(`[AiActions] Gagal mengeksekusi mutasi: ${execErr.message}`);
      await ctx.answerCallbackQuery({
        text: `❌ Gagal: ${execErr.message}`,
        show_alert: true,
      });
      return ctx.editMessageText(
        `❌ <b>Gagal Mengeksekusi Aksi:</b>\n<i>${esc(execErr.message)}</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
  });

  // 2. Pembatalan Aksi: act:cancel:DRAFT_ID
  bot.callbackQuery(/^act:cancel:([a-z0-9]+)$/, async (ctx) => {
    const draftId = ctx.match[1];
    popQuickActionDraft(draftId);

    await ctx.answerCallbackQuery({ text: 'Aksi dibatalkan.' });

    const cancelText = `
❌ <b>AKSI DIBATALKAN</b>
━━━━━━━━━━━━━━━━━━
<i>Draf aksi telah dihapus. Tidak ada perubahan yang disimpan ke database POS.</i>
    `.trim();

    return ctx.editMessageText(cancelText, { parse_mode: 'HTML' }).catch(() => {});
  });
}
