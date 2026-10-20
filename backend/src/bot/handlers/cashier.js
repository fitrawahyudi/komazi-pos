import { InlineKeyboard } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { orderService } from '../../services/order.service.js';
import { workspaceService } from '../../services/workspace.service.js';
import { rupiah, esc, fmtTime } from '../utils/format.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback } from '../utils/sendVisual.js';
import { withLoadingAnimation } from '../utils/loading.js';
import { buildPaginatedNumericKeyboard, formatPaginatedList } from '../keyboards/pagination.js';
import prisma from '../../config/db.js';

const PAGE_SIZE = 10;

/**
 * Helper render daftar pesanan open bill berpaginasi
 */
function renderOrdersPage(orders, page, totalPages, totalCount) {
  const startIndex = (page - 1) * PAGE_SIZE;
  const itemsOnPage = orders.slice(startIndex, startIndex + PAGE_SIZE);

  const formatItem = (o, idx) => {
    const tableInfo = o.tableNo ? `(Meja ${esc(o.tableNo)})` : '';
    const itemCount = o.items?.length || 0;
    return `[ ${idx + 1} ] <b>${esc(o.invoiceNo)}</b> [${o.type} ${tableInfo}]\n• Total: <b>${rupiah(o.total)}</b> (${itemCount} item) | Status: <code>${o.status}</code>`;
  };

  const text = formatPaginatedList({
    title: 'PESANAN AKTIF (OPEN BILL)',
    items: itemsOnPage,
    formatItem,
    currentPage: page,
    totalPages,
    totalCount,
    footerHint: 'Tekan nomor [ 1 ] - [ 10 ] di bawah untuk melihat rincian & aksi nota:',
  });

  const keyboard = buildPaginatedNumericKeyboard('ord', itemsOnPage, page, totalPages, 'orders');
  return { text, keyboard };
}

/**
 * Helper render daftar sesi tamu workspace aktif berpaginasi
 */
function renderWorkspaceSessionsPage(sessions, page, totalPages, totalCount) {
  const startIndex = (page - 1) * PAGE_SIZE;
  const itemsOnPage = sessions.slice(startIndex, startIndex + PAGE_SIZE);

  const formatItem = (s, idx) => {
    const areaName = esc(s.area?.name || 'Area');
    const custName = esc(s.customerName || 'Tamu');
    const overtimeTag = s.isOvertime ? `🟡 <i>Overtime +${Math.abs(s.remainingMinutes)}m</i>` : `🟢 <i>Sisa ${s.remainingMinutes}m</i>`;
    return `[ ${idx + 1} ] <b>${custName}</b> (${areaName})\n• Durasi Berjalan: ${s.elapsedMinutes} mnt | ${overtimeTag}`;
  };

  const text = formatPaginatedList({
    title: 'TAMU WORKSPACE AKTIF (CHECK-OUT)',
    items: itemsOnPage,
    formatItem,
    currentPage: page,
    totalPages,
    totalCount,
    footerHint: 'Tekan nomor [ 1 ] - [ 10 ] di bawah untuk memilih tamu yang akan di-checkout:',
  });

  const keyboard = buildPaginatedNumericKeyboard('ws', itemsOnPage, page, totalPages, 'workspace');
  return { text, keyboard };
}

export function registerCashier(bot) {
  // 1) Shift Kasir
  bot.command('buka_shift', requireRole('CASHIER', 'MANAGER'), (ctx) =>
    ctx.conversation.enter('openShift')
  );

  bot.command('tutup_shift', requireRole('CASHIER', 'MANAGER'), (ctx) =>
    ctx.conversation.enter('closeShift')
  );

  // 2) Pesanan Cepat
  bot.command('order', requireRole('CASHIER', 'MANAGER'), (ctx) =>
    ctx.conversation.enter('quickOrder')
  );

  // 3) Daftar Open Bill / Pesanan Aktif (Dengan Animasi Loading Bar & Pagination 10 Item + Tombol Angka)
  bot.command('pesanan', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        const openOrders = await orderService.listOpenBills();

        if (!openOrders || openOrders.length === 0) {
          return ctx.reply('✨ Tidak ada pesanan berstatus Open Bill saat ini. Semua pesanan telah diselesaikan.');
        }

        const totalCount = openOrders.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const { text, keyboard } = renderOrdersPage(openOrders, 1, totalPages, totalCount);

        return ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }
    );
  });

  // Navigasi halaman open bill: p:ord:PAGE
  bot.callbackQuery(/^p:ord:(\d+)$/, requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const page = Math.max(1, parseInt(ctx.match[1], 10));
    await ctx.answerCallbackQuery();

    const openOrders = await orderService.listOpenBills();
    const totalCount = openOrders.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const targetPage = Math.min(page, totalPages);

    const { text, keyboard } = renderOrdersPage(openOrders, targetPage, totalPages, totalCount);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }).catch(() => {});
  });

  // Seleksi pesanan via tombol angka: sel:ord:ID
  bot.callbackQuery(/^sel:ord:(\d+)$/, requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const orderId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    if (!order) {
      return ctx.reply('Pesanan tidak ditemukan atau telah diselesaikan.');
    }

    const itemsLines = (order.items || [])
      .map((it) => `• <b>${it.quantity}×</b> ${esc(it.productName)} — ${rupiah(it.price * it.quantity)}${it.notes ? ` <i>[${esc(it.notes)}]</i>` : ''}`)
      .join('\n') || '<i>(Tidak ada rincian item)</i>';

    const detailText = `
🧾 <b>DETAIL PESANAN ${esc(order.invoiceNo)}</b>
━━━━━━━━━━━━━━━━━━━━━━
• Tipe Layanan: <b>${order.type === 'TAKE_AWAY' ? 'Take-away 🛍️' : `Dine-in 🍽️ ${order.tableNo ? `(Meja ${esc(order.tableNo)})` : ''}`}</b>
• Pelanggan: <b>${esc(order.customerName || 'Tamu')}</b>
• Kasir Bertugas: ${esc(order.cashier?.name || 'Kasir')}
• Waktu Transaksi: ${fmtTime(order.createdAt)}
• Status Pembayaran: <code>${order.status}</code>

<b>Daftar Menu:</b>
${itemsLines}

<b>Ringkasan Tagihan:</b>
• Subtotal: ${rupiah(order.subtotal)}
${Number(order.discount) > 0 ? `• Diskon: -${rupiah(order.discount)}\n` : ''}<b>TOTAL AKHIR: ${rupiah(order.total)}</b>
━━━━━━━━━━━━━━━━━━━━━━
<i>Gunakan tombol di bawah untuk mengajukan persetujuan atau kembali ke daftar:</i>

🤖 <i>@komazi-assistant</i>
    `.trim();

    const kb = new InlineKeyboard()
      .text('⚠️ Ajukan Void / Diskon', `go:appr_for:${order.id}`)
      .text('🔙 Kembali ke Daftar', 'p:ord:1');

    return ctx.editMessageText(detailText, {
      parse_mode: 'HTML',
      reply_markup: kb,
    }).catch(() => ctx.reply(detailText, { parse_mode: 'HTML', reply_markup: kb }));
  });

  // Shortcut ke request approval untuk order tertentu
  bot.callbackQuery(/^go:appr_for:(\d+)$/, requireRole('CASHIER'), async (ctx) => {
    await ctx.answerCallbackQuery();
    return ctx.conversation.enter('requestApproval');
  });

  // 4) Area Workspace & Timer (Dengan Animasi Loading Bar)
  bot.command('workspace', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'find_location' },
      async () => {
        const areas = await workspaceService.listAllAreasWithStatus();

        if (!areas || areas.length === 0) {
          return ctx.reply('Belum ada area workspace yang terkonfigurasi.');
        }

        const lines = areas.map((a) => {
          const activeSession = a.sessions && a.sessions[0];
          if (!activeSession) {
            return `🟢 <b>${esc(a.name)}</b>: Tersedia (Kapasitas: ${a.capacity})`;
          }

          const elapsed = Math.max(1, Math.round((Date.now() - new Date(activeSession.checkInAt).getTime()) / 60000));
          const dur = activeSession.package?.durationMin || 60;
          const rem = dur - elapsed;

          const timerStatus = rem > 0
            ? `🔴 Terisi (${esc(activeSession.customerName)} — Sisa ${rem} mnt)`
            : `🟡 Overtime (+${Math.abs(rem)} mnt)`;

          return `🔴 <b>${esc(a.name)}</b>: ${timerStatus}`;
        }).join('\n');

        const kb = new InlineKeyboard()
          .text('➕ Check-in Tamu', 'go:checkin_ws')
          .text('⏹️ Check-out Tamu', 'go:checkout_ws');

        const caption = `💻 <b>Status Area Workspace Komazi:</b>\n━━━━━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━━━━━`;

        return replyWithPhotoFallback(ctx, {
          imageBufferPromise: generateBotImage('workspace_matrix', { areas }),
          captionHtml: caption,
          replyMarkup: kb,
        });
      }
    );
  });

  bot.command('checkin', requireRole('CASHIER', 'MANAGER'), (ctx) =>
    ctx.conversation.enter('checkinWorkspace')
  );

  bot.callbackQuery('go:checkin_ws', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    await ctx.answerCallbackQuery();
    return ctx.conversation.enter('checkinWorkspace');
  });

  // 5) Check-out Workspace (Dengan Animasi Loading Bar & Pagination 10 Item + Tombol Angka)
  async function handleCheckoutList(ctx) {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        const activeSessions = await workspaceService.getActiveSessions();

        if (!activeSessions || activeSessions.length === 0) {
          return ctx.reply('✨ Tidak ada tamu workspace yang sedang aktif saat ini.');
        }

        const totalCount = activeSessions.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
        const { text, keyboard } = renderWorkspaceSessionsPage(activeSessions, 1, totalPages, totalCount);

        return ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      }
    );
  }

  bot.command('checkout', requireRole('CASHIER', 'MANAGER'), handleCheckoutList);
  bot.callbackQuery('go:checkout_ws', requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    await ctx.answerCallbackQuery();
    return handleCheckoutList(ctx);
  });

  // Navigasi halaman sesi checkout: p:ws:PAGE
  bot.callbackQuery(/^p:ws:(\d+)$/, requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const page = Math.max(1, parseInt(ctx.match[1], 10));
    await ctx.answerCallbackQuery();

    const activeSessions = await workspaceService.getActiveSessions();
    const totalCount = activeSessions.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const targetPage = Math.min(page, totalPages);

    const { text, keyboard } = renderWorkspaceSessionsPage(activeSessions, targetPage, totalPages, totalCount);

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }).catch(() => {});
  });

  // Seleksi tamu checkout via tombol angka: sel:ws:ID
  bot.callbackQuery(/^sel:ws:(\d+)$/, requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const sessionId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();

    const activeSessions = await workspaceService.getActiveSessions();
    const s = activeSessions.find((sess) => sess.id === sessionId);

    if (!s) {
      return ctx.reply('Sesi tamu tidak ditemukan atau telah di-checkout sebelumnya.');
    }

    const confirmText = `
💻 <b>KONFIRMASI CHECK-OUT WORKSPACE</b>
━━━━━━━━━━━━━━━━━━━━━━
• Meja/Area: <b>${esc(s.area?.name || 'Area')}</b>
• Nama Tamu: <b>${esc(s.customerName)}</b>
• Paket: ${esc(s.package?.name)} (${s.package?.durationMin} Menit)
• Waktu Check-in: ${fmtTime(s.checkInAt)}
• Durasi Berjalan: <b>${s.elapsedMinutes} Menit</b>
• Status Waktu: ${s.isOvertime ? `🟡 <b>Overtime (+${Math.abs(s.remainingMinutes)} menit)</b>` : '🟢 <b>Dalam batas waktu paket</b>'}
━━━━━━━━━━━━━━━━━━━━━━
👇 <i>Tekan tombol di bawah untuk memproses kalkulasi tarif & menyelesaikan sesi:</i>
    `.trim();

    const kb = new InlineKeyboard()
      .text('⏹️ Selesaikan & Hitung Biaya', `wsco:${s.id}`)
      .row()
      .text('🔙 Kembali ke Daftar Tamu', 'p:ws:1');

    return ctx.editMessageText(confirmText, {
      parse_mode: 'HTML',
      reply_markup: kb,
    }).catch(() => ctx.reply(confirmText, { parse_mode: 'HTML', reply_markup: kb }));
  });

  bot.callbackQuery(/^wsco:(\d+)$/, requireRole('CASHIER', 'MANAGER'), async (ctx) => {
    const sessionId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();

    try {
      const res = await workspaceService.checkOut(sessionId);
      const caption = `✅ <b>Check-out Workspace Selesai!</b>\n━━━━━━━━━━━━━━━━━━\nArea: <b>${esc(res.area?.name)}</b>\nPelanggan: <b>${esc(res.customerName)}</b>\nDurasi Aktual: ${res.elapsedMinutes} Menit\nTarif Dasar: ${rupiah(res.baseCharge)}\n${res.overtimeCharge > 0 ? `Biaya Overtime: ${rupiah(res.overtimeCharge)}\n` : ''}<b>TOTAL TAGIHAN: ${rupiah(res.totalCharge)}</b>\n━━━━━━━━━━━━━━━━━━\n<i>Tagihan dapat dibayar terpisah atau digabung ke struk F&B di POS kasir.</i>`;

      return replyWithPhotoFallback(ctx, {
        imageBufferPromise: generateBotImage('workspace_billing', {
          customerName: res.customerName,
          areaName: res.area?.name,
          durationMin: res.elapsedMinutes,
          overtimeMin: res.overtimeMinutes || 0,
          basePrice: res.baseCharge,
          overtimeFee: res.overtimeCharge,
          totalBill: res.totalCharge,
        }),
        captionHtml: caption,
      });
    } catch (err) {
      await ctx.reply(`❌ Gagal check-out: ${err.message}`);
    }
  });

  bot.callbackQuery('wsco:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Dibatalkan' });
    await ctx.deleteMessage().catch(() => {});
  });

  // 6) Permintaan Approval oleh Kasir
  bot.command('approval', requireRole('CASHIER'), (ctx) =>
    ctx.conversation.enter('requestApproval')
  );
}
