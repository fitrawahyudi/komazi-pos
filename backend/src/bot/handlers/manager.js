import { InlineKeyboard } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { approvalService } from '../../services/approval.service.js';
import { stockService } from '../../services/stock.service.js';
import { menuService } from '../../services/menu.service.js';
import { orderService } from '../../services/order.service.js';
import { notifier } from '../notifier.js';
import { rupiah, esc, fmtTime } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback, notifierVisual } from '../utils/sendVisual.js';
import { withLoadingAnimation } from '../utils/loading.js';
import { buildPaginatedNumericKeyboard, formatPaginatedList } from '../keyboards/pagination.js';
import prisma from '../../config/db.js';

const PAGE_SIZE = 10;

/**
 * Helper render pesan stok berpaginasi
 */
function renderStockPage(items, page, totalPages, totalCount) {
  const startIndex = (page - 1) * PAGE_SIZE;
  const itemsOnPage = items.slice(startIndex, startIndex + PAGE_SIZE);

  const formatItem = (item, idx) => {
    const cur = parseFloat(item.stock);
    const min = parseFloat(item.minStock);
    const isLow = cur <= min;
    const icon = isLow ? '⚠️' : '🟢';
    const statusNote = isLow ? ` <i>[Kritis - Min: ${min}]</i>` : '';
    return `[ ${idx + 1} ] ${icon} <b>${esc(item.name)}</b>: ${cur} ${item.unit}${statusNote}`;
  };

  const text = formatPaginatedList({
    title: 'STOK INVENTARIS BAHAN BAKU',
    items: itemsOnPage,
    formatItem,
    currentPage: page,
    totalPages,
    totalCount,
    footerHint: 'Tekan nomor [ 1 ] - [ 10 ] di bawah untuk melihat rincian & aksi bahan baku:',
  });

  const keyboard = buildPaginatedNumericKeyboard('stk', itemsOnPage, page, totalPages, 'stock');
  return { text, keyboard };
}

/**
 * Helper render pesan menu toggle sold out berpaginasi
 */
function renderMenuTogglePage(products, page, totalPages, totalCount) {
  const startIndex = (page - 1) * PAGE_SIZE;
  const itemsOnPage = products.slice(startIndex, startIndex + PAGE_SIZE);

  const formatItem = (p, idx) => {
    const icon = p.isSoldOut ? '🚫 [HABIS]' : '🟢 [TERSEDIA]';
    return `[ ${idx + 1} ] ${icon} <b>${esc(p.name)}</b> — ${rupiah(p.price)}`;
  };

  const text = formatPaginatedList({
    title: 'KETERSEDIAAN MENU (SOLD OUT TOGGLE)',
    items: itemsOnPage,
    formatItem,
    currentPage: page,
    totalPages,
    totalCount,
    footerHint: 'Tekan nomor [ 1 ] - [ 10 ] untuk mengubah status Habis / Tersedia secara instan:',
  });

  const keyboard = buildPaginatedNumericKeyboard('menu', itemsOnPage, page, totalPages, 'soldout');
  return { text, keyboard };
}

export function registerManager(bot) {
  // 1) Daftar Approval & Keputusan
  bot.command('approval', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        const list = await approvalService.listPending();

        if (!list || list.length === 0) {
          return ctx.reply('✨ Tidak ada permintaan persetujuan (approval) yang sedang menunggu.');
        }

        for (const req of list) {
          const kb = new InlineKeyboard()
            .text('✅ Setujui', `apr:ok:${req.id}`)
            .text('❌ Tolak', `apr:no:${req.id}`);

          const caption = `🔔 <b>Permintaan Persetujuan #${req.id}</b>\n━━━━━━━━━━━━━━━━━━\nJenis: <b>${req.type}</b>\nDiajukan Oleh: ${esc(req.requester?.name || 'Kasir')}\nAlasan: <i>${esc(req.reason)}</i>\n━━━━━━━━━━━━━━━━━━`;

          await replyWithPhotoFallback(ctx, {
            imageBufferPromise: generateBotImage('approval_request', {
              reqId: req.id,
              type: req.type,
              invoiceNo: req.order?.invoiceNo || 'KMZ',
              amount: req.order?.total || 0,
              requesterName: req.requester?.name || 'Kasir',
              reason: req.reason,
            }),
            captionHtml: caption,
            replyMarkup: kb,
          });
        }
      }
    );
  });

  bot.callbackQuery(/^apr:(ok|no):(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const decision = ctx.match[1] === 'ok';
    const reqId = Number(ctx.match[2]);

    const result = await approvalService.decide({
      id: reqId,
      deciderId: ctx.user.id,
      approve: decision,
    });

    if (!result.ok) {
      return ctx.answerCallbackQuery({ text: result.message, show_alert: true });
    }

    await ctx.answerCallbackQuery({ text: decision ? 'Disetujui' : 'Ditolak' });

    await logBotAudit(ctx.user.id, 'DECIDE_APPROVAL', {
      requestId: reqId,
      approved: decision,
    });

    const statusText = decision ? '✅ Disetujui' : '❌ Ditolak';
    await ctx.editMessageText(
      `🔔 <b>Permintaan Persetujuan #${reqId}</b>\n━━━━━━━━━━━━━━━━━━\nStatus: <b>${statusText}</b> oleh <b>${esc(ctx.user.name)}</b> (${ctx.user.role})\n━━━━━━━━━━━━━━━━━━`,
      { parse_mode: 'HTML' }
    );

    // Kirim notifikasi ke kasir yang meminta dengan kartu visual ApprovalResult
    if (result.request.requesterId) {
      const resCaption = `🔔 Permintaan persetujuan #${reqId} (${result.request.type}) telah <b>${decision ? 'DISETUJUI ✅' : 'DITOLAK ❌'}</b> oleh ${esc(ctx.user.name)}.`;
      await notifierVisual.toUser(result.request.requesterId, {
        imageBufferPromise: generateBotImage('approval_result', {
          reqId,
          type: result.request.type,
          approved: decision,
          deciderName: ctx.user.name,
          deciderRole: ctx.user.role,
        }),
        captionHtml: resCaption,
      });
    }
  });

  // 2) Cek Stok Bahan (Dengan Animasi Loading Bar & Pagination 10 Item + Tombol Angka)
  bot.command('stok', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        const all = await stockService.listAll();

        if (!all || all.length === 0) {
          return ctx.reply('Belum ada data stok bahan baku terdaftar di database.');
        }

        const totalCount = all.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const { text, keyboard } = renderStockPage(all, 1, totalPages, totalCount);

        return ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }
    );
  });

  // Navigasi halaman stok: p:stk:PAGE
  bot.callbackQuery(/^p:stk:(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const page = Math.max(1, parseInt(ctx.match[1], 10));
    await ctx.answerCallbackQuery();

    const all = await stockService.listAll();
    const totalCount = all.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const targetPage = Math.min(page, totalPages);

    const { text, keyboard } = renderStockPage(all, targetPage, totalPages, totalCount);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }).catch(() => {});
  });

  // Pemilihan bahan via tombol angka: sel:stk:ID
  bot.callbackQuery(/^sel:stk:(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const ingredientId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const item = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!item) {
      return ctx.reply('Bahan baku tidak ditemukan atau telah dihapus.');
    }

    const cur = parseFloat(item.stock);
    const min = parseFloat(item.minStock);
    const isLow = cur <= min;
    const costPerUnit = parseFloat(item.costPerUnit || 0);

    const supplierLine = item.supplierName || item.supplierPhone
      ? `• Supplier: <b>${esc(item.supplierName || 'Distributor')}</b> ${item.supplierPhone ? `(${item.supplierPhone})` : ''}`
      : '• Supplier: <i>Belum diatur</i>';

    const detailText = `
📦 <b>DETAIL BAHAN BAKU #${item.id}</b>
━━━━━━━━━━━━━━━━━━━━━━
• Nama Bahan: <b>${esc(item.name)}</b>
• Stok Tersedia: <b>${cur} ${item.unit}</b>
• Batas Minimum: ${min} ${item.unit}
• Estimasi Biaya/Satuan: ${rupiah(costPerUnit)}
${supplierLine}
• Status Persediaan: ${isLow ? '⚠️ <b>KRITIS (DI BAWAH MINIMUM)</b>' : '🟢 <b>STOK AMAN</b>'}
━━━━━━━━━━━━━━━━━━━━━━
<i>Gunakan tombol di bawah untuk mencatat mutasi atau memesan restock via WhatsApp.</i>

🤖 <i>@komazi-assistant</i>
    `.trim();

    const kb = new InlineKeyboard()
      .text('➕ Catat Stok Masuk', `go:stock_in_for:${item.id}`)
      .text('🗑️ Catat Waste / Rusak', `go:waste_for:${item.id}`).row();

    if (item.supplierPhone) {
      const waUrl = stockService.formatWhatsAppUrl(
        item.supplierPhone,
        item.name,
        item.unit,
        cur,
        item.supplierName
      );
      if (waUrl) {
        kb.url('📲 Pesan Restock via WA', waUrl).row();
      }
    }

    kb.text('🔙 Kembali ke Daftar Stok', 'p:stk:1');

    return ctx.editMessageText(detailText, {
      parse_mode: 'HTML',
      reply_markup: kb,
    }).catch(() => ctx.reply(detailText, { parse_mode: 'HTML', reply_markup: kb }));
  });

  // Shortcut mulai conversation stok masuk untuk bahan tertentu
  bot.callbackQuery(/^go:stock_in_for:(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.conversation.exitAll().catch(() => {});
    return ctx.conversation.enter('stockIn');
  });

  // Shortcut mulai conversation pencatatan waste untuk bahan tertentu
  bot.callbackQuery(/^go:waste_for:(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.conversation.exitAll().catch(() => {});
    return ctx.conversation.enter('recordWasteConv');
  });

  // 3) Catat Stok Masuk
  bot.command('stok_masuk', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    await ctx.conversation.exitAll().catch(() => {});
    return ctx.conversation.enter('stockIn');
  });

  // 3b) Catat Bahan Terbuang / Rusak (Waste)
  bot.command(['waste', 'catat_waste'], requireRole('MANAGER', 'OWNER'), async (ctx) => {
    await ctx.conversation.exitAll().catch(() => {});
    return ctx.conversation.enter('recordWasteConv');
  });

  // 4) Toggle Menu Habis / Tersedia (Dengan Animasi Loading Bar & Pagination 10 Item + Tombol Angka)
  bot.command('habis', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        const products = await menuService.listAllForToggle();

        if (!products || products.length === 0) {
          return ctx.reply('Belum ada menu produk terdaftar.');
        }

        const totalCount = products.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const { text, keyboard } = renderMenuTogglePage(products, 1, totalPages, totalCount);

        return ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }
    );
  });

  // Navigasi halaman menu soldout: p:menu:PAGE
  bot.callbackQuery(/^p:menu:(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const page = Math.max(1, parseInt(ctx.match[1], 10));
    await ctx.answerCallbackQuery();

    const products = await menuService.listAllForToggle();
    const totalCount = products.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const targetPage = Math.min(page, totalPages);

    const { text, keyboard } = renderMenuTogglePage(products, targetPage, totalPages, totalCount);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }).catch(() => {});
  });

  // Toggle status menu via tombol angka: sel:menu:ID
  bot.callbackQuery(/^sel:menu:(\d+)$/, requireRole('MANAGER', 'OWNER'), async (ctx) => {
    const productId = Number(ctx.match[1]);
    try {
      const updated = await menuService.toggleSoldOut(productId);
      const statusText = updated.isSoldOut ? 'HABIS (Sold Out) 🚫' : 'TERSEDIA 🟢';

      await ctx.answerCallbackQuery({
        text: `${updated.name} kini ${statusText}`,
      });

      await logBotAudit(ctx.user.id, 'TOGGLE_PRODUCT_SOLDOUT', {
        productId,
        name: updated.name,
        isSoldOut: updated.isSoldOut,
      });

      // Refresh tampilan halaman saat ini
      const products = await menuService.listAllForToggle();
      const totalCount = products.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

      // Cari di halaman berapa produk ini berada agar tampilan tetap di halaman yang sama
      const productIndex = products.findIndex((p) => p.id === productId);
      const currentPage = productIndex >= 0 ? Math.floor(productIndex / PAGE_SIZE) + 1 : 1;

      const { text, keyboard } = renderMenuTogglePage(products, currentPage, totalPages, totalCount);

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }).catch(() => {});
    } catch (err) {
      await ctx.answerCallbackQuery({ text: err.message, show_alert: true });
    }
  });

  // 5) Laporan Hari Ini (Manager/Owner) dengan Animasi Loading Bar
  bot.command('laporan', requireRole('MANAGER', 'OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        const summary = await orderService.getSummary('today');

        const topLines = (summary.topProducts || [])
          .map((p, i) => `${i + 1}. ${esc(p.name)}: <b>${p.qty} terjual</b>`)
          .join('\n') || '-';

        const caption = `
📊 <b>LAPORAN PENJUALAN HARI INI</b>
━━━━━━━━━━━━━━━━━━
<b>Total Omzet:</b> <b>${rupiah(summary.totalRevenue)}</b>
<b>Total Transaksi:</b> ${summary.totalTransactions} Pesanan

<b>Rincian Metode Pembayaran:</b>
• Tunai (Cash): ${rupiah(summary.byMethod.CASH)}
• QRIS Dinamis: ${rupiah(summary.byMethod.QRIS)}
• Transfer Bank: ${rupiah(summary.byMethod.TRANSFER)}

<b>Top 5 Menu Paling Laris:</b>
${topLines}
━━━━━━━━━━━━━━━━━━
<i>Data realtime POS • @komazi-assistant</i>
        `.trim();

        return replyWithPhotoFallback(ctx, {
          imageBufferPromise: generateBotImage('sales_report', {
            periodLabel: 'Hari Ini',
            totalRevenue: summary.totalRevenue,
            totalTransactions: summary.totalTransactions,
            byMethod: summary.byMethod,
            topProducts: summary.topProducts,
          }),
          captionHtml: caption,
        });
      }
    );
  });
}
