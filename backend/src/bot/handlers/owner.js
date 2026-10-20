import { InlineKeyboard, InputFile } from 'grammy';
import { requireRole } from '../middlewares/role.js';
import { orderService } from '../../services/order.service.js';
import { userService } from '../../services/userService.js';
import { telegramLinkService } from '../../services/telegramLinkService.js';
import { workspaceService } from '../../services/workspace.service.js';
import { profitService } from '../../services/profitService.js';
import { stockService } from '../../services/stock.service.js';
import { rupiah, esc } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback } from '../utils/sendVisual.js';
import { withLoadingAnimation } from '../utils/loading.js';
import {
  calculatePeakHourAndRevenueForecast,
  calculateStockRunoutForecast,
  generateClosingComparison,
  generateRealAiPredictionAnalysis,
} from '../../services/aiPredictiveEngine.js';
import prisma from '../../config/db.js';
import { checkSystemHealth, formatSentinelStatusHtml } from '../../services/cron/handlers/monitoringHandler.js';
import { computeNextRunAt } from '../../services/cron/jobRegistryService.js';
import { formatCronToIndonesian, parseHumanScheduleInput } from '../../services/cron/cronHumanizer.js';

function buildSentinelKeyboard(sentinelJob) {
  const kb = new InlineKeyboard()
    .text('🔄 Refresh Status', 'sentinel_action:refresh')
    .text('⏰ Atur Jadwal', 'sentinel_action:schedule_menu');

  if (sentinelJob) {
    if (sentinelJob.enabled) {
      kb.row().text('⏸ Jeda Peringatan Otomatis', 'sentinel_action:toggle_pause');
    } else {
      kb.row().text('▶️ Aktifkan Peringatan Otomatis', 'sentinel_action:toggle_resume');
    }
  }

  kb.row().text('📋 Kelola Semua Jadwal Otomatis', 'go:jobs');
  return kb;
}

export function registerOwner(bot) {
  // 1) Ringkasan Realtime (Dengan Animasi Loading Bar)
  bot.command('ringkasan', requireRole('OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'upload_photo' },
      async () => {
        const [today, yesterday, activeWs] = await Promise.all([
          orderService.getSummary('today'),
          orderService.getSummary('yesterday'),
          workspaceService.getActiveSessions(),
        ]);

        const growth = yesterday.totalRevenue > 0
          ? (((today.totalRevenue - yesterday.totalRevenue) / yesterday.totalRevenue) * 100).toFixed(1)
          : null;

        const growthText = growth !== null
          ? (Number(growth) >= 0 ? `(+${growth}%) 📈` : `(${growth}%) 📉`)
          : '-';

        const caption = `
☕ <b>RINGKASAN EKSEKUTIF OWNER</b>
━━━━━━━━━━━━━━━━━━
<b>Omzet Hari Ini:</b> <b>${rupiah(today.totalRevenue)}</b> ${growthText}
<b>Omzet Kemarin:</b> ${rupiah(yesterday.totalRevenue)}

<b>Aktivitas Transaksi:</b>
• Transaksi Selesai: <b>${today.totalTransactions}</b>
• Tamu Workspace Aktif: <b>${activeWs.length}</b> sesi berjalan

<b>Metode Pembayaran:</b>
• Tunai (Cash): ${rupiah(today.byMethod.CASH)}
• QRIS Dinamis: ${rupiah(today.byMethod.QRIS)}
• Transfer Bank: ${rupiah(today.byMethod.TRANSFER)}
━━━━━━━━━━━━━━━━━━
<i>Gunakan /laporan untuk melihat laporan per periode.</i>

🤖 <i>@komazi-assistant</i>
        `.trim();

        return replyWithPhotoFallback(ctx, {
          imageBufferPromise: generateBotImage('realtime_sales', {
            totalRevenue: today.totalRevenue,
            totalTransactions: today.totalTransactions,
            byMethod: today.byMethod,
            growth: Number(growth),
            activeWsCount: activeWs.length,
            topProducts: today.topProducts,
          }),
          captionHtml: caption,
        });
      }
    );
  });

  // 2) Laporan Berbagai Periode
  bot.command('laporan', requireRole('OWNER'), async (ctx) => {
    const kb = new InlineKeyboard()
      .text('Hari Ini', 'rep_per:today')
      .text('Kemarin', 'rep_per:yesterday')
      .row()
      .text('7 Hari Terakhir', 'rep_per:7d')
      .text('Bulan Ini', 'rep_per:month');

    return ctx.reply('📊 <b>Pilih Periode Laporan Penjualan:</b>', {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  });

  bot.callbackQuery(/^rep_per:(today|yesterday|7d|month)$/, requireRole('OWNER'), async (ctx) => {
    const period = ctx.match[1];
    await ctx.answerCallbackQuery();

    return withLoadingAnimation(
      ctx,
      { chatAction: 'upload_photo' },
      async () => {
        const summary = await orderService.getSummary(period);

        const periodLabels = {
          today: 'Hari Ini',
          yesterday: 'Kemarin',
          '7d': '7 Hari Terakhir',
          month: 'Bulan Ini',
        };

        const topLines = (summary.topProducts || [])
          .map((p, i) => `${i + 1}. ${esc(p.name)}: <b>${p.qty} item</b>`)
          .join('\n') || '-';

        const caption = `
📊 <b>LAPORAN PENJUALAN (${periodLabels[period].toUpperCase()})</b>
━━━━━━━━━━━━━━━━━━
<b>Total Omzet:</b> <b>${rupiah(summary.totalRevenue)}</b>
<b>Total Transaksi:</b> ${summary.totalTransactions} Pesanan

<b>Metode Pembayaran:</b>
• Tunai (Cash): ${rupiah(summary.byMethod.CASH)}
• QRIS Dinamis: ${rupiah(summary.byMethod.QRIS)}
• Transfer Bank: ${rupiah(summary.byMethod.TRANSFER)}

<b>Top 5 Menu Paling Diminati:</b>
${topLines}
━━━━━━━━━━━━━━━━━━
        `.trim();

        return replyWithPhotoFallback(ctx, {
          imageBufferPromise: generateBotImage('sales_report', {
            periodLabel: periodLabels[period],
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

  // Helper render laporan laba rugi P&L
  function renderProfitMessage(report, period = 'today') {
    const periodLabels = {
      today: 'Hari Ini',
      yesterday: 'Kemarin',
      '7d': '7 Hari Terakhir',
      month: 'Bulan Ini',
    };
    const label = periodLabels[period] || period;
    const s = report.summary;
    const statusIcon = s.isProfitable ? '🟢 <b>PROFIT (UNTUNG)</b>' : '🔴 <b>DEFISIT OPERASIONAL</b>';

    const caption = `
💰 <b>LAPORAN ESTIMASI LABA BERSIH (P&L)</b>
<i>Periode: ${label}</i>
━━━━━━━━━━━━━━━━━━
📈 <b>Omzet Penjualan:</b> <b>${rupiah(s.grossRevenue)}</b> <i>(${s.totalOrders} pesanan)</i>
🥩 <b>Beban Pokok (HPP / COGS):</b> -${rupiah(s.cogs)}
──────────────────
⚖️ <b>Laba Kotor:</b> <b>${rupiah(s.grossProfit)}</b> <i>(Margin ${s.grossMarginPct}%)</i>

<b>Beban & Pengeluaran Operasional:</b>
• 💸 Kas Keluar: -${rupiah(s.expenses.pettyCashOut)}
• 🗑️ Kerugian Waste / Rusak: -${rupiah(s.expenses.wasteCost)}
• 👥 Estimasi Beban Shift: -${rupiah(s.expenses.laborCost)}
• <b>Total Beban Operasional:</b> -${rupiah(s.expenses.totalOperatingExpenses)}
━━━━━━━━━━━━━━━━━━
🏆 <b>ESTIMASI LABA BERSIH:</b> <b>${rupiah(s.netProfit)}</b>
📊 <b>Net Profit Margin:</b> <b>${s.netMarginPct}%</b>
Status Keuangan: ${statusIcon}
━━━━━━━━━━━━━━━━━━
<i>Dihitung realtime: Omzet - HPP - Kas Keluar - Waste - Upah Shift.</i>

🤖 <i>@komazi-assistant</i>
    `.trim();

    const kb = new InlineKeyboard()
      .text(period === 'today' ? '• Hari Ini •' : 'Hari Ini', 'profit_per:today')
      .text(period === 'yesterday' ? '• Kemarin •' : 'Kemarin', 'profit_per:yesterday')
      .row()
      .text(period === '7d' ? '• 7 Hari •' : '7 Hari', 'profit_per:7d')
      .text(period === 'month' ? '• Bulan Ini •' : 'Bulan Ini', 'profit_per:month');

    return { caption, kb };
  }

  // 2b) Laporan Estimasi Laba Bersih (P&L)
  bot.command(['profit', 'lababersih'], requireRole('OWNER', 'MANAGER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        try {
          const report = await profitService.calculateProfitAndLoss({ period: 'today' });
          const { caption, kb } = renderProfitMessage(report, 'today');
          return ctx.reply(caption, { parse_mode: 'HTML', reply_markup: kb });
        } catch (err) {
          return ctx.reply(`❌ Gagal menghitung laba bersih: ${err.message}`);
        }
      }
    );
  });

  bot.callbackQuery(/^profit_per:(today|yesterday|7d|month)$/, requireRole('OWNER', 'MANAGER'), async (ctx) => {
    const period = ctx.match[1];
    await ctx.answerCallbackQuery().catch(() => {});

    try {
      const report = await profitService.calculateProfitAndLoss({ period });
      const { caption, kb } = renderProfitMessage(report, period);
      return ctx.editMessageText(caption, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
    } catch (err) {
      return ctx.reply(`❌ Gagal memperbarui laba bersih: ${err.message}`);
    }
  });

  // 3) Tautkan Akun Staf (Generate Link Code)
  bot.command('tautkan', requireRole('OWNER'), async (ctx) => {
    const unlinked = await userService.listUnlinked();

    if (!unlinked || unlinked.length === 0) {
      return ctx.reply('✨ Semua staf aktif sudah menautkan akun Telegram mereka.');
    }

    const kb = new InlineKeyboard();
    unlinked.forEach((u) => {
      kb.text(`${u.name} (${u.role})`, `link:${u.id}`).row();
    });

    return ctx.reply('🔗 <b>Pilih Staf untuk Ditautkan ke Telegram:</b>', {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  });

  bot.callbackQuery(/^link:(\d+)$/, requireRole('OWNER'), async (ctx) => {
    const staffId = Number(ctx.match[1]);
    await ctx.answerCallbackQuery();

    try {
      const code = await telegramLinkService.generate(staffId);
      const staff = await userService.getById(staffId);

      await logBotAudit(ctx.user.id, 'GENERATE_LINK_CODE', { staffId, code });

      const ttlMin = process.env.BOT_LINK_CODE_TTL_MIN || '10';

      const caption = `✅ <b>Kode Tautan Staf Dibuat!</b>\n━━━━━━━━━━━━━━━━━━\nStaf: <b>${esc(staff?.name)}</b> (@${staff?.username} - ${staff?.role})\nKode: <code>${code}</code>\n<i>(Berlaku ${ttlMin} menit, satu kali pakai)</i>\n\nMinta staf membuka bot dan mengirim perintah:\n<code>/start ${code}</code>\n━━━━━━━━━━━━━━━━━━`;

      return replyWithPhotoFallback(ctx, {
        imageBufferPromise: generateBotImage('staff_invitation', {
          targetStaffName: staff?.name,
          targetStaffRole: staff?.role,
          linkCode: code,
        }),
        captionHtml: caption,
      });
    } catch (err) {
      return ctx.reply(`❌ Gagal membuat kode tautan: ${err.message}`);
    }
  });

  // 4) Komazi AI Proactive & Predictive Commands (Real-time Machine Curve & AI Narrative)
  bot.command(['prediksi', 'briefing'], requireRole('OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        try {
          const forecast = await calculatePeakHourAndRevenueForecast();
          const aiInsight = await generateRealAiPredictionAnalysis(forecast);

          const dateStr = new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          const topMenuText = forecast.topProducts && forecast.topProducts.length > 0
            ? forecast.topProducts.slice(0, 3).map((p, i) => `  ${i + 1}. <b>${esc(p.name)}</b> (${p.qty} terjual)`).join('\n')
            : '  - Belum ada data transaksi';

          const caption = `
🔮 <b>KOMAZI AI — PREDIKSI & BRIEFING BISNIS</b>
━━━━━━━━━━━━━━━━━━
📅 <b>Hari/Tanggal:</b> ${forecast.dayName}, ${dateStr}
🎯 <b>Target Proyeksi:</b> <code>${forecast.projectedRevenueFormatted}</code>
📊 <b>Kemarin:</b> ${forecast.yesterdayRevenueFormatted} (${forecast.yesterdayOrderCount} pesanan)
⚡ <b>Jam Ramai Utama:</b> <code>${forecast.primaryPeakWindow}</code>
🌙 <b>Jam Ramai Kedua:</b> <code>${forecast.secondaryPeakWindow}</code>
🏆 <b>Menu Primadona (7 Hari):</b>
${topMenuText}
━━━━━━━━━━━━━━━━━━
💡 <i>Analisis strategi & langkah taktis AI tertera di bawah.</i>
          `.trim();

          const detailMsg = `
🧠 <b>KOMAZI AI — ANALISIS STRATEGI & TAKTIS</b>
━━━━━━━━━━━━━━━━━━
${aiInsight}
━━━━━━━━━━━━━━━━━━
<i>Dianalisis secara real-time • @komazi-assistant</i>
          `.trim();

          const kb = new InlineKeyboard()
            .text('🔄 Perbarui Prediksi', 'prediksi_action:refresh')
            .text('📦 Cek Stok Kritis', 'prediksi_action:cek_stok')
            .row()
            .text('📊 Ringkasan Hari Ini', 'prediksi_action:omzet_today')
            .text('⏰ Atur Sentinel', 'sentinel_action:schedule_menu');

          let photoBuffer = null;
          try {
            photoBuffer = await generateBotImage('ai_morning_briefing', forecast);
          } catch (imgErr) {
            console.warn('[OwnerBot] Gagal render gambar morning briefing:', imgErr.message);
          }

          if (photoBuffer) {
            try {
              await ctx.replyWithPhoto(new InputFile(photoBuffer, 'komazi-forecast.png'), {
                caption,
                parse_mode: 'HTML',
              });
            } catch (pErr) {
              console.warn('[OwnerBot] Gagal kirim foto briefing:', pErr.message);
              await ctx.reply(caption, { parse_mode: 'HTML' });
            }
            return ctx.reply(detailMsg, {
              parse_mode: 'HTML',
              reply_markup: kb,
            });
          } else {
            const combined = `${caption}\n\n${detailMsg}`;
            return ctx.reply(combined, {
              parse_mode: 'HTML',
              reply_markup: kb,
            });
          }
        } catch (err) {
          return ctx.reply(`❌ Gagal menghasilkan insight prediksi: ${err.message}`);
        }
      }
    );
  });

  bot.command(['cek_stok_kritis', 'prediksi_stok'], requireRole('OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        try {
          const stockForecast = await calculateStockRunoutForecast();
          const criticalNames = (stockForecast.criticalItems || []).map((it) => it.name);

          // Ambil nomor kontak supplier jika ada
          const ingredientsWithSupplier = criticalNames.length > 0
            ? await prisma.ingredient.findMany({
                where: {
                  name: { in: criticalNames },
                  supplierPhone: { not: null },
                },
                select: { id: true, name: true, unit: true, stock: true, supplierName: true, supplierPhone: true },
              })
            : [];

          const waKb = new InlineKeyboard();
          for (const ing of ingredientsWithSupplier.slice(0, 3)) {
            const waUrl = stockService.formatWhatsAppUrl(
              ing.supplierPhone,
              ing.name,
              ing.unit,
              parseFloat(ing.stock || 0),
              ing.supplierName
            );
            if (waUrl) {
              waKb.url(`📲 Pesan ${ing.name} (WA)`, waUrl).row();
            }
          }

          const caption = `
🚨 <b>KOMAZI AI — ESTIMASI HABIS BAHAN BAKU</b>
━━━━━━━━━━━━━━━━━━
Status: <b>${stockForecast.hasCriticalRisk ? `${stockForecast.criticalCount} Bahan Berisiko Kritis ⚠️` : 'Semua Bahan Aman Terkendali ✅'}</b>
${stockForecast.criticalItems.slice(0, 4).map((it) => `• <b>${it.name}</b>: sisa ${it.currentStock} ${it.unit} (${it.estimatedRunoutTime ? `habis ~${it.hoursUntilStockout} jam / ${it.estimatedRunoutTime}` : 'habis'})`).join('\n') || 'Tidak ada bahan yang terancam habis dalam waktu dekat.'}
━━━━━━━━━━━━━━━━━━
<i>Dihitung dari laju konsumsi pesanan aktif.${ingredientsWithSupplier.length > 0 ? ' Klik tombol di bawah untuk langsung pesan ke WhatsApp supplier.' : ''}</i>

🤖 <i>@komazi-assistant</i>
          `.trim();

          return replyWithPhotoFallback(ctx, {
            imageBufferPromise: generateBotImage('ai_stockout_alert', stockForecast),
            captionHtml: caption,
            replyMarkup: waKb.inline_keyboard.length > 0 ? waKb : undefined,
          });
        } catch (err) {
          return ctx.reply(`❌ Gagal memeriksa estimasi stok: ${err.message}`);
        }
      }
    );
  });

  bot.command('evaluasi_ai', requireRole('OWNER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        try {
          const closeComparison = await generateClosingComparison();
          const caption = `
🌙 <b>KOMAZI AI — REKAPITULASI PENUTUPAN HARI INI</b>
━━━━━━━━━━━━━━━━━━
🏆 <b>Omset Realisasi:</b> ${closeComparison.actualRevenueFormatted}
🎯 <b>Target Awal Hari:</b> ${closeComparison.projectedRevenueFormatted}
📈 <b>Pencapaian:</b> ${closeComparison.achievementRatePct}% (${closeComparison.badgeLabel})
🧾 <b>Total Struk:</b> ${closeComparison.totalTransactions} pesanan
━━━━━━━━━━━━━━━━━━
<i>Laporan performa harian • @komazi-assistant</i>
          `.trim();

          return replyWithPhotoFallback(ctx, {
            imageBufferPromise: generateBotImage('ai_evening_wrapup', closeComparison),
            captionHtml: caption,
          });
        } catch (err) {
          return ctx.reply(`❌ Gagal menyusun evaluasi penutupan: ${err.message}`);
        }
      }
    );
  });

  // 6) Sentinel Health Check & Status On-Demand
  bot.command(['sentinel', 'status', 'health', 'cek_sistem'], requireRole('OWNER', 'MANAGER'), async (ctx) => {
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        const status = await checkSystemHealth({ checkAi: true });
        const sentinelJob = await prisma.scheduledJob.findFirst({
          where: { jobType: 'MONITORING', name: { contains: 'Sentinel' }, deletedAt: null },
        });

        const caption = formatSentinelStatusHtml(status, { isManual: true, jobConfig: sentinelJob });
        const kb = buildSentinelKeyboard(sentinelJob);

        return ctx.reply(caption, { parse_mode: 'HTML', reply_markup: kb });
      }
    );
  });

  // 7) Atur Jadwal Sentinel Langsung (/sentinel_schedule <waktu>)
  bot.command('sentinel_schedule', requireRole('OWNER'), async (ctx) => {
    const expr = (ctx.match || '').trim();
    if (!expr) {
      return ctx.reply(
        '⚙️ <b>PANDUAN PENGATURAN JADWAL SENTINEL</b>\n━━━━━━━━━━━━━━━━━━\n' +
        'Gunakan format:\n<code>/sentinel_schedule &lt;waktu_atau_frekuensi&gt;</code>\n\n' +
        '<b>💡 Contoh Penggunaan Mudah:</b>\n' +
        '• <code>/sentinel_schedule 08:00</code> — Setiap hari pukul 08:00 WIB\n' +
        '• <code>/sentinel_schedule 30m</code> — Setiap 30 menit (atau <code>tiap 30 menit</code>)\n' +
        '• <code>/sentinel_schedule 1h</code> — Setiap 1 jam (atau <code>tiap 1 jam</code>)\n' +
        '• <code>/sentinel_schedule manual</code> — Matikan otomatis (hanya saat dipanggil)\n\n' +
        '<i>Atau ketik <code>/sentinel</code> lalu tekan tombol <b>"⏰ Atur Jadwal"</b> untuk memilih via tombol.</i>',
        { parse_mode: 'HTML' }
      );
    }

    const sentinelJob = await prisma.scheduledJob.findFirst({
      where: { jobType: 'MONITORING', name: { contains: 'Sentinel' }, deletedAt: null },
    });
    if (!sentinelJob) return ctx.reply('⚠️ Jadwal pemantauan sistem Sentinel tidak ditemukan.');

    if (expr.toLowerCase() === 'manual' || expr.toLowerCase() === 'pause' || expr.toLowerCase() === 'off') {
      await prisma.scheduledJob.update({
        where: { id: sentinelJob.id },
        data: { enabled: false, version: { increment: 1 } },
      });
      return ctx.reply(
        '🔕 <b>Peringatan Otomatis Sentinel Dinonaktifkan (Mode Manual).</b>\n\nSistem tidak akan mengirim pesan peringatan berkala. Anda dapat memeriksa kesehatan sistem kapan saja dengan mengetik <code>/sentinel</code>.',
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('🛡️ Cek Sentinel Sekarang', 'sentinel_action:refresh')
            .text('▶️ Aktifkan Kembali', 'sentinel_action:toggle_resume'),
        }
      );
    }

    const parsed = parseHumanScheduleInput(expr);
    if (!parsed) {
      return ctx.reply(
        '❌ <b>Format waktu tidak dikenali.</b>\nContoh yang bisa diketik: <code>08:00</code>, <code>30m</code>, <code>tiap 1 jam</code>, atau <code>manual</code>.',
        { parse_mode: 'HTML' }
      );
    }

    try {
      const nextRunAt = computeNextRunAt(parsed.scheduleType, parsed.scheduleExpression, 'Asia/Jakarta');
      const updated = await prisma.scheduledJob.update({
        where: { id: sentinelJob.id },
        data: {
          scheduleExpression: parsed.scheduleExpression,
          scheduleType: parsed.scheduleType,
          nextRunAt,
          enabled: true,
          version: { increment: 1 },
        },
      });

      const nextStr = updated.nextRunAt
        ? new Date(updated.nextRunAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB'
        : '-';

      return ctx.reply(
        `✅ <b>Jadwal Sentinel Berhasil Diatur!</b>\n━━━━━━━━━━━━━━━━━━\n• Jadwal: <b>${esc(parsed.humanDescription)}</b>\n• Eksekusi Berikutnya: <b>${nextStr}</b>\n\nSentinel akan memeriksa sistem otomatis pada jadwal ini, atau kapan saja saat Anda meminta dengan /sentinel.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('🛡️ Cek Status Sekarang', 'sentinel_action:refresh')
            .text('⏰ Atur Jadwal Lain', 'sentinel_action:schedule_menu'),
        }
      );
    } catch (err) {
      return ctx.reply(`❌ Format jadwal tidak valid: ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  // Callbacks untuk Sentinel
  bot.callbackQuery('sentinel_action:refresh', requireRole('OWNER', 'MANAGER'), async (ctx) => {
    await ctx.answerCallbackQuery('Memperbarui status sistem...').catch(() => {});
    const status = await checkSystemHealth({ checkAi: true });
    const sentinelJob = await prisma.scheduledJob.findFirst({
      where: { jobType: 'MONITORING', name: { contains: 'Sentinel' }, deletedAt: null },
    });

    const caption = formatSentinelStatusHtml(status, { isManual: true, jobConfig: sentinelJob });
    const kb = buildSentinelKeyboard(sentinelJob);

    return ctx.editMessageText(caption, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
  });

  bot.callbackQuery('sentinel_action:schedule_menu', requireRole('OWNER'), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const kb = new InlineKeyboard()
      .text('🌅 Pagi 08:00 WIB (1x Sehari)', 'sentinel_set:0 8 * * *')
      .row()
      .text('🌓 Pagi & Malam (08:00 & 20:00 WIB)', 'sentinel_set:0 8,20 * * *')
      .row()
      .text('⏱ Setiap 6 Jam', 'sentinel_set:0 */6 * * *')
      .row()
      .text('⚡ Setiap 1 Jam', 'sentinel_set:0 * * * *')
      .row()
      .text('🔄 Setiap 30 Menit (Bawaan)', 'sentinel_set:*/30 * * * *')
      .row()
      .text('🔕 Hanya Manual (Saat Dipanggil Saja)', 'sentinel_set:pause')
      .row()
      .text('🔙 Kembali ke Status Sentinel', 'sentinel_action:refresh');

    const msg = `
⏰ <b>PILIH JADWAL SENTINEL OTOMATIS</b>
━━━━━━━━━━━━━━━━━━
Kapan Sentinel Scheduler harus memeriksa kesehatan sistem & mengirim laporan ke Telegram Anda?

• <b>Pagi 08:00 WIB</b>: Pemeriksaan kesiapan kedai sebelum operasional
• <b>Pagi & Malam</b>: Cek sebelum buka dan saat tutup buku
• <b>Setiap 6 Jam</b>: Monitoring berkala 4x sehari
• <b>Setiap 1 Jam / 30 Menit</b>: Pengawasan intensif
• <b>Hanya Manual</b>: Hanya tampil saat Anda mengetik /sentinel

<i>Atau gunakan perintah:</i> <code>/sentinel_schedule &lt;waktu&gt;</code> (cth: 08:00, 30m, 1h)
    `.trim();

    return ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
  });

  bot.callbackQuery(/^sentinel_set:(.+)$/, requireRole('OWNER'), async (ctx) => {
    const choice = ctx.match[1];
    await ctx.answerCallbackQuery('Menyimpan jadwal...').catch(() => {});

    const sentinelJob = await prisma.scheduledJob.findFirst({
      where: { jobType: 'MONITORING', name: { contains: 'Sentinel' }, deletedAt: null },
    });
    if (!sentinelJob) return ctx.reply('⚠️ Jadwal Sentinel tidak ditemukan.');

    if (choice === 'pause') {
      await prisma.scheduledJob.update({
        where: { id: sentinelJob.id },
        data: { enabled: false, version: { increment: 1 } },
      });
      return ctx.editMessageText(
        '🔕 <b>Sentinel Otomatis Dijeda (Mode Manual On-Demand).</b>\n\nSistem tidak akan mengirim peringatan berkala. Anda dapat memanggil status kapan saja dengan mengetik <code>/sentinel</code>.',
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('🛡️ Cek Status', 'sentinel_action:refresh')
            .text('▶️ Aktifkan Kembali', 'sentinel_action:toggle_resume'),
        }
      ).catch(() => {});
    }

    try {
      const nextRunAt = computeNextRunAt('cron', choice, 'Asia/Jakarta');
      const updated = await prisma.scheduledJob.update({
        where: { id: sentinelJob.id },
        data: {
          scheduleExpression: choice,
          scheduleType: 'cron',
          nextRunAt,
          enabled: true,
          version: { increment: 1 },
        },
      });

      const nextStr = updated.nextRunAt
        ? new Date(updated.nextRunAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB'
        : '-';

      const humanSched = formatCronToIndonesian(choice, 'cron');
      return ctx.editMessageText(
        `✅ <b>Jadwal Sentinel Berhasil Diperbarui!</b>\n━━━━━━━━━━━━━━━━━━\n• Jadwal: <b>${esc(humanSched)}</b>\n• Eksekusi Berikutnya: <b>${nextStr}</b>\n\nSentinel akan memeriksa sistem otomatis pada jadwal ini, atau kapan saja saat Anda meminta dengan /sentinel.`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('🛡️ Cek Status Sekarang', 'sentinel_action:refresh')
            .text('⏰ Atur Jadwal Lain', 'sentinel_action:schedule_menu'),
        }
      ).catch(() => {});
    } catch (err) {
      return ctx.reply(`❌ Format jadwal tidak valid: ${esc(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  bot.callbackQuery('sentinel_action:toggle_pause', requireRole('OWNER'), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const sentinelJob = await prisma.scheduledJob.findFirst({
      where: { jobType: 'MONITORING', name: { contains: 'Sentinel' }, deletedAt: null },
    });
    if (!sentinelJob) return;

    await prisma.scheduledJob.update({
      where: { id: sentinelJob.id },
      data: { enabled: false, version: { increment: 1 } },
    });

    const status = await checkSystemHealth({ checkAi: true });
    sentinelJob.enabled = false;
    const caption = formatSentinelStatusHtml(status, { isManual: true, jobConfig: sentinelJob });
    const kb = buildSentinelKeyboard(sentinelJob);

    return ctx.editMessageText(caption, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
  });

  bot.callbackQuery('sentinel_action:toggle_resume', requireRole('OWNER'), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const sentinelJob = await prisma.scheduledJob.findFirst({
      where: { jobType: 'MONITORING', name: { contains: 'Sentinel' }, deletedAt: null },
    });
    if (!sentinelJob) return;

    const nextRunAt = computeNextRunAt(sentinelJob.scheduleType, sentinelJob.scheduleExpression, sentinelJob.timezone);
    await prisma.scheduledJob.update({
      where: { id: sentinelJob.id },
      data: { enabled: true, nextRunAt, version: { increment: 1 } },
    });

    const status = await checkSystemHealth({ checkAi: true });
    sentinelJob.enabled = true;
    sentinelJob.nextRunAt = nextRunAt;
    const caption = formatSentinelStatusHtml(status, { isManual: true, jobConfig: sentinelJob });
    const kb = buildSentinelKeyboard(sentinelJob);

    return ctx.editMessageText(caption, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
  });

  bot.callbackQuery('prediksi_action:refresh', requireRole('OWNER'), async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🧠 Menghitung prediksi terbaru...' }).catch(() => {});
    return withLoadingAnimation(
      ctx,
      { chatAction: 'typing' },
      async () => {
        try {
          const forecast = await calculatePeakHourAndRevenueForecast();
          const aiInsight = await generateRealAiPredictionAnalysis(forecast);

          const dateStr = new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          const topMenuText = forecast.topProducts && forecast.topProducts.length > 0
            ? forecast.topProducts.slice(0, 3).map((p, i) => `  ${i + 1}. <b>${esc(p.name)}</b> (${p.qty} terjual)`).join('\n')
            : '  - Belum ada data transaksi';

          const msg = `
🔮 <b>KOMAZI AI — PREDIKSI & BRIEFING BISNIS (TERBARU)</b>
━━━━━━━━━━━━━━━━━━
📅 <b>Hari/Tanggal:</b> ${forecast.dayName}, ${dateStr}
🎯 <b>Target Proyeksi:</b> <code>${forecast.projectedRevenueFormatted}</code>
📊 <b>Kemarin:</b> ${forecast.yesterdayRevenueFormatted} (${forecast.yesterdayOrderCount} pesanan)
⚡ <b>Jam Ramai Utama:</b> <code>${forecast.primaryPeakWindow}</code>
🌙 <b>Jam Ramai Kedua:</b> <code>${forecast.secondaryPeakWindow}</code>
🏆 <b>Menu Primadona (7 Hari):</b>
${topMenuText}
━━━━━━━━━━━━━━━━━━
🧠 <b>ANALISIS STRATEGI & TAKTIS:</b>
${aiInsight}
━━━━━━━━━━━━━━━━━━
<i>Diperbarui secara real-time • @komazi-assistant</i>
          `.trim();

          const kb = new InlineKeyboard()
            .text('🔄 Perbarui Prediksi', 'prediksi_action:refresh')
            .text('📦 Cek Stok Kritis', 'prediksi_action:cek_stok')
            .row()
            .text('📊 Ringkasan Hari Ini', 'prediksi_action:omzet_today')
            .text('⏰ Atur Sentinel', 'sentinel_action:schedule_menu');

          return ctx.reply(msg, {
            parse_mode: 'HTML',
            reply_markup: kb,
          });
        } catch (err) {
          return ctx.reply(`❌ Gagal memperbarui prediksi: ${err.message}`);
        }
      }
    );
  });

  bot.callbackQuery('prediksi_action:cek_stok', requireRole('OWNER'), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const stockForecast = await calculateStockRunoutForecast();
      const caption = `
🚨 <b>KOMAZI AI — ESTIMASI HABIS BAHAN BAKU</b>
━━━━━━━━━━━━━━━━━━
Status: <b>${stockForecast.hasCriticalRisk ? `${stockForecast.criticalCount} Bahan Berisiko Kritis ⚠️` : 'Semua Bahan Aman Terkendali ✅'}</b>
${stockForecast.criticalItems.slice(0, 5).map((it) => `• <b>${esc(it.name)}</b>: sisa ${it.currentStock} ${esc(it.unit)} (${it.estimatedRunoutTime ? `habis ~${it.hoursUntilStockout} jam / ${it.estimatedRunoutTime}` : 'habis'})`).join('\n') || 'Tidak ada bahan yang terancam habis dalam waktu dekat.'}
━━━━━━━━━━━━━━━━━━
<i>Dihitung dari laju konsumsi pesanan aktif • @komazi-assistant</i>
      `.trim();

      return replyWithPhotoFallback(ctx, {
        imageBufferPromise: generateBotImage('ai_stockout_alert', stockForecast),
        captionHtml: caption,
      });
    } catch (err) {
      return ctx.reply(`❌ Gagal memeriksa estimasi stok: ${err.message}`);
    }
  });

  bot.callbackQuery('prediksi_action:omzet_today', requireRole('OWNER'), async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const [today, yesterday, activeWs] = await Promise.all([
        orderService.getSummary('today'),
        orderService.getSummary('yesterday'),
        workspaceService.getActiveSessions(),
      ]);

      const growth = yesterday.totalRevenue > 0
        ? (((today.totalRevenue - yesterday.totalRevenue) / yesterday.totalRevenue) * 100).toFixed(1)
        : null;

      const visualData = {
        totalRevenue: rupiah(today.totalRevenue),
        growth: growth ? `${growth > 0 ? '+' : ''}${growth}%` : 'N/A',
        totalOrders: today.totalOrders,
        activeWorkspace: activeWs.length,
        cashShare: today.cashShare,
        qrisShare: today.qrisShare,
        transferShare: today.transferShare,
      };

      const caption = `
📊 <b>KOMAZI POS — RINGKASAN HARI INI</b>
━━━━━━━━━━━━━━━━━━
💰 <b>Total Omzet:</b> ${rupiah(today.totalRevenue)} (${growth ? `${growth > 0 ? '+' : ''}${growth}% vs kemarin` : 'Hari pertama'})
🧾 <b>Total Pesanan:</b> ${today.totalOrders} transaksi
💻 <b>Workspace Aktif:</b> ${activeWs.length} pengguna
💳 <b>Metode Pembayaran:</b>
   • Tunai: ${today.cashShare}%
   • QRIS: ${today.qrisShare}%
   • Transfer: ${today.transferShare}%
━━━━━━━━━━━━━━━━━━
<i>Data sinkronisasi real-time • @komazi-assistant</i>
      `.trim();

      return replyWithPhotoFallback(ctx, {
        imageBufferPromise: generateBotImage('ringkasan_realtime', visualData),
        captionHtml: caption,
      });
    } catch (err) {
      return ctx.reply(`❌ Gagal memuat ringkasan omzet: ${err.message}`);
    }
  });
}
