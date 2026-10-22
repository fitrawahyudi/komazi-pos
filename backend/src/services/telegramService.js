import prisma from '../config/db.js';
import { getTodayTopSellingData, getRoleScopedBusinessContext } from './salesAnalyticsEngine.js';
import { getAllProductsCogsOverview } from './cogsService.js';
import { orderService } from './order.service.js';
import { generateReceiptImageBuffer } from './receiptCanvasService.js';
import { generateBotImage } from './botImage/index.js';
import {
  calculatePeakHourAndRevenueForecast,
  calculateStockRunoutForecast,
  generateClosingComparison,
  generateRealAiPredictionAnalysis,
} from './aiPredictiveEngine.js';

/**
 * Telegram Notification & Bot Control Service (Section 33 Implementation Guide)
 * Mengirimkan notifikasi order baru, omzet harian, dan peringatan stok menipis
 * Memproses perintah bot (/omzet, /stok, /menu_laris, /laporan, /profit, /prediksi)
 * Dijalankan non-blocking dan aman dengan otorisasi Chat ID
 */

function getTelegramConfig() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  };
}

/**
 * Mengambil daftar Chat ID penerima notifikasi administratif dari database.
 * Khusus akun staf dengan role OWNER dan MANAGER yang telah menautkan akun Telegram.
 */
export async function getAdminRecipients() {
  const recipients = new Set();

  try {
    const linkedStaff = await prisma.user.findMany({
      where: {
        role: { in: ['OWNER', 'MANAGER'] },
        isActive: true,
        telegramId: { not: null },
      },
      select: { telegramId: true },
    });
    linkedStaff.forEach((u) => {
      if (u.telegramId && String(u.telegramId).trim()) {
        recipients.add(String(u.telegramId).trim());
      }
    });
  } catch (err) {
    console.warn('[TelegramService] Error fetching owner & manager recipients:', err);
  }

  return Array.from(recipients);
}

async function sendSingleMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return { success: data.ok, data, chatId };
  } catch (err) {
    console.warn(`[TelegramService] Gagal kirim pesan ke ${chatId}:`, err.message);
    return { success: false, error: err.message, chatId };
  }
}

export async function sendTelegramMessage(text, targetChatId = null) {
  const { botToken } = getTelegramConfig();
  if (!botToken) {
    return { success: false, reason: 'TELEGRAM_CONFIG_MISSING' };
  }

  if (targetChatId) {
    return sendSingleMessage(botToken, targetChatId, text);
  }

  const recipients = await getAdminRecipients();
  if (recipients.length === 0) {
    return { success: false, reason: 'NO_RECIPIENTS_FOUND' };
  }

  const results = await Promise.allSettled(
    recipients.map((cId) => sendSingleMessage(botToken, cId, text))
  );

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;
  return {
    success: successCount > 0,
    recipientsCount: recipients.length,
    sentCount: successCount,
  };
}

async function sendSinglePhoto(botToken, chatId, photoBuffer, caption) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    const blob = new Blob([photoBuffer], { type: 'image/png' });
    formData.append('photo', blob, 'struk-komazi.png');

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.ok) {
      return { success: true, data, chatId };
    }
    console.warn(`[TelegramService] Gagal sendPhoto (${chatId}), fallback text:`, data.description);
    return sendSingleMessage(botToken, chatId, caption);
  } catch (err) {
    console.warn(`[TelegramService] Error sendPhoto (${chatId}), fallback text:`, err.message);
    return sendSingleMessage(botToken, chatId, caption);
  }
}

export async function sendTelegramPhoto(photoBuffer, caption, targetChatId = null) {
  const { botToken } = getTelegramConfig();
  if (!botToken) {
    return { success: false, reason: 'TELEGRAM_CONFIG_MISSING' };
  }

  if (targetChatId) {
    return sendSinglePhoto(botToken, targetChatId, photoBuffer, caption);
  }

  const recipients = await getAdminRecipients();
  if (recipients.length === 0) {
    return { success: false, reason: 'NO_RECIPIENTS_FOUND' };
  }

  const results = await Promise.allSettled(
    recipients.map((cId) => sendSinglePhoto(botToken, cId, photoBuffer, caption))
  );

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;
  return {
    success: successCount > 0,
    recipientsCount: recipients.length,
    sentCount: successCount,
  };
}

async function sendSingleDocument(botToken, chatId, documentBuffer, fileName, caption) {
  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    if (caption) {
      formData.append('caption', caption.slice(0, 1024));
      formData.append('parse_mode', 'HTML');
    }
    const blob = new Blob([documentBuffer], { type: 'application/sql' });
    formData.append('document', blob, fileName || 'backup.sql');

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.ok) {
      return { success: true, data, chatId };
    }
    console.warn(`[TelegramService] Gagal sendDocument (${chatId}), fallback text:`, data.description);
    return sendSingleMessage(botToken, chatId, caption);
  } catch (err) {
    console.warn(`[TelegramService] Error sendDocument (${chatId}), fallback text:`, err.message);
    return sendSingleMessage(botToken, chatId, caption);
  }
}

export async function sendTelegramDocument(documentBuffer, fileName, caption, targetChatId = null) {
  const { botToken } = getTelegramConfig();
  if (!botToken) {
    return { success: false, reason: 'TELEGRAM_CONFIG_MISSING' };
  }

  if (targetChatId) {
    return sendSingleDocument(botToken, targetChatId, documentBuffer, fileName, caption);
  }

  const recipients = await getAdminRecipients();
  if (recipients.length === 0) {
    return { success: false, reason: 'NO_RECIPIENTS_FOUND' };
  }

  const results = await Promise.allSettled(
    recipients.map((cId) => sendSingleDocument(botToken, cId, documentBuffer, fileName, caption))
  );

  const successCount = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;
  return {
    success: successCount > 0,
    recipientsCount: recipients.length,
    sentCount: successCount,
  };
}

async function getBotSetting(key, defaultValue = 'true') {
  try {
    const s = await prisma.setting.findUnique({ where: { key } });
    return s ? s.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Notifikasi Transaksi Real-Time untuk Bot Telegram
 * Menghasilkan banner grafis struk canvas HD 16:9 + caption detail terstruktur
 */
export async function notifyPaidTransaction(order) {
  if (!order) return;

  try {
    const botEnabled = (await getBotSetting('botEnabled', 'true')) === 'true';
    const notifyTx = (await getBotSetting('botNotifyTransaction', 'true')) === 'true';
    if (!botEnabled || !notifyTx) {
      return;
    }

    const invoiceNo = order.invoiceNo || `KMZ-${Date.now().toString().slice(-8)}`;
    const customer = order.customerName || order.customer?.name || 'Pelanggan Dine In';
    const cashier = order.cashier?.name || order.cashierName || 'Kasir';

    // Format Tanggal & Jam WIB
    const dateObj = order.paidAt
      ? new Date(order.paidAt)
      : order.createdAt
      ? new Date(order.createdAt)
      : new Date();
    const timeStr =
      dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    const dateStr = dateObj.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // Format Daftar Menu & Rincian Varian / Suhu / Ukuran / Catatan
    const items = Array.isArray(order.items) && order.items.length > 0 ? order.items : [];
    const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 1), 0) || 1;

    const itemsDetailLines = items.map((i) => {
      const name = i.productName || i.name || 'Menu';
      const qty = i.qty || 1;
      const unitPrice = Number(i.unitPrice || (i.lineTotal ? i.lineTotal / qty : 0));
      const lineTotal = Number(i.lineTotal || (qty * unitPrice));
      const variant = i.variantName ? `\n   🏷️ <i>Varian/Suhu: ${i.variantName}</i>` : '';
      const note = i.note ? `\n   📝 <i>Catatan: ${i.note}</i>` : '';
      return `• <b>${qty}× ${name}</b> — Rp${lineTotal.toLocaleString('id-ID')} (Rp${unitPrice.toLocaleString('id-ID')}/item)${variant}${note}`;
    }).join('\n') || '• 1× Transaksi Kasir';

    // Format Metode Pembayaran
    const paymentMethods = [];
    if (Array.isArray(order.payments) && order.payments.length > 0) {
      order.payments.forEach((p) => {
        const m =
          p.method === 'CASH'
            ? 'Tunai (Cash)'
            : p.method === 'QRIS'
            ? 'QRIS Dinamis'
            : p.method === 'TRANSFER'
            ? 'Transfer Bank'
            : p.method;
        paymentMethods.push(m);
      });
    } else if (order.paymentMethod) {
      const m =
        order.paymentMethod === 'CASH'
          ? 'Tunai (Cash)'
          : order.paymentMethod === 'QRIS'
          ? 'QRIS Dinamis'
          : order.paymentMethod === 'TRANSFER'
          ? 'Transfer Bank'
          : order.paymentMethod;
      paymentMethods.push(m);
    } else {
      paymentMethods.push('QRIS Dinamis');
    }

    const subtotal = Number(order.subtotal || 0);
    const discount = Number(order.discount || 0);
    const tax = Number(order.tax || 0);
    const total = Number(order.total || 0);

    // Caption Telegram berformat rapi dengan rincian varian & harga
    const caption = `
🧾 <b>STRUK TRANSAKSI — PAID ✅</b>
━━━━━━━━━━━━━━━━━━━━━
👤 <b>Pelanggan:</b> <code>${customer}</code>
💳 <b>Metode:</b> <b>${paymentMethods.join(', ')}</b>
📅 <b>Waktu:</b> ${dateStr} · ${timeStr}
🧾 <b>No. Invoice:</b> <code>${invoiceNo}</code>
━━━━━━━━━━━━━━━━━━━━━
📋 <b>RINCIAN PESANAN:</b>
${itemsDetailLines}
─────────────────────
🧮 <b>Subtotal (${totalQty} item):</b> Rp${Number(subtotal).toLocaleString('id-ID')}
${tax > 0 ? `🏛️ <b>PB1 Resto:</b> Rp${Number(tax).toLocaleString('id-ID')}\n` : ''}${discount > 0 ? `🎟️ <b>Diskon:</b> -Rp${Number(discount).toLocaleString('id-ID')}\n` : ''}💵 <b>TOTAL BAYAR:</b> <b>Rp${Number(total).toLocaleString('id-ID')}</b>
━━━━━━━━━━━━━━━━━━━━━
🤖 <i>@komazi-assistant</i>
    `.trim();

    // 1. Generate Banner Grafis Canvas Digital Receipt
    let photoBuffer = null;
    try {
      photoBuffer = await generateReceiptImageBuffer({
        invoiceNo,
        customerName: customer,
        cashierName: cashier,
        paymentMethod: paymentMethods.join(', '),
        paidAt: dateObj,
        subtotal,
        discount,
        tax,
        total,
        items,
      });
    } catch (canvasErr) {
      console.warn('[TelegramService] Canvas generator error:', canvasErr.message);
    }

    // 2. Broadcast Foto + Caption ke seluruh Owner & Manager terdaftar
    if (photoBuffer) {
      sendTelegramPhoto(photoBuffer, caption).catch((err) => {
        console.warn('[TelegramService] notifyPaidTransaction photo broadcast error:', err.message);
      });
    } else {
      sendTelegramMessage(caption).catch((err) => {
        console.warn('[TelegramService] notifyPaidTransaction fallback text error:', err.message);
      });
    }
  } catch (err) {
    console.warn('[TelegramService] Error preparing transaction notification:', err);
  }
}

/**
 * Alias kompatibilitas
 */
export async function notifyNewOrder(order) {
  return notifyPaidTransaction(order);
}

export async function notifyLowStock({ ingredientName, currentStock, minStock, unit }) {
  try {
    const botEnabled = (await getBotSetting('botEnabled', 'true')) === 'true';
    const notifyStock = (await getBotSetting('botNotifyLowStock', 'true')) === 'true';
    if (!botEnabled || !notifyStock) {
      return;
    }

    const message = `
⚠️ <b>PERINGATAN STOK MENIPIS</b>
━━━━━━━━━━━━━━━━━━
<b>Bahan:</b> ${ingredientName}
<b>Sisa Stok:</b> ${currentStock} ${unit || ''}
<b>Batas Minimum:</b> ${minStock} ${unit || ''}

<i>Segera lakukan restock atau purchase order bahan baku ini.</i>
━━━━━━━━━━━━━━━━━━
🤖 <i>@komazi-assistant</i>
  `.trim();

    let photoBuffer = null;
    try {
      photoBuffer = await generateBotImage('inventory_critical', {
        items: [
          {
            name: ingredientName,
            stock: currentStock,
            minStock: minStock,
            unit: unit || 'unit',
          },
        ],
        totalAlerts: 1,
      });
    } catch (imgErr) {
      console.warn('[TelegramService] notifyLowStock image generation error:', imgErr.message);
    }

    if (photoBuffer) {
      sendTelegramPhoto(photoBuffer, message).catch(() => {});
    } else {
      sendTelegramMessage(message).catch(() => {});
    }
  } catch (err) {
    console.warn('[TelegramService] notifyLowStock error:', err.message);
  }
}

/**
 * Notifikasi Sesi Kasir Dibuka ke Telegram Bot (Khusus Owner & Manager)
 */
export async function notifyShiftOpened({ shift, cashier, register, openingCash }) {
  try {
    const botEnabled = (await getBotSetting('botEnabled', 'true')) === 'true';
    const notifyShift = (await getBotSetting('botNotifyShift', 'true')) === 'true';
    if (!botEnabled || !notifyShift) return;

    const cashierName = cashier?.name || shift?.cashier?.name || 'Kasir';
    const regName = register?.name || shift?.register?.name || 'Kasir Utama';
    const regCode = register?.code || shift?.register?.code || 'REG-01';
    const initialCash = Number(openingCash !== undefined ? openingCash : shift?.openingCash || 0);
    const openedTimeStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(shift?.openedAt ? new Date(shift.openedAt) : new Date());

    const message = `
🟢 <b>NOTIFIKASI SESI KASIR DIBUKA</b>
━━━━━━━━━━━━━━━━━━
<b>Kasir Pembuka:</b> ${cashierName}
<b>Terminal:</b> ${regName} (${regCode})
<b>Modal Awal Kas:</b> Rp ${initialCash.toLocaleString('id-ID')}
<b>Waktu Buka:</b> ${openedTimeStr} WIB
━━━━━━━━━━━━━━━━━━
<i>Sesi kasir telah dibuka • @komazi-assistant</i>
    `.trim();

    let photoBuffer = null;
    try {
      photoBuffer = await generateBotImage('shift_open', {
        shiftId,
        cashierName,
        outletName: 'Komazi Coffee & Workspace',
        initialCash,
        openedAt: shift?.openedAt || new Date(),
      });
    } catch (imgErr) {
      console.warn('[TelegramService] notifyShiftOpened image error:', imgErr.message);
    }

    if (photoBuffer) {
      sendTelegramPhoto(photoBuffer, message).catch(() => {});
    } else {
      sendTelegramMessage(message).catch(() => {});
    }
  } catch (err) {
    console.warn('[TelegramService] notifyShiftOpened error:', err.message);
  }
}

/**
 * Notifikasi Sesi Kasir Ditutup (Z-Report) ke Telegram Bot (Khusus Owner & Manager)
 */
export async function notifyShiftClosed({ shift, cashier, closedBy, summary }) {
  try {
    const botEnabled = (await getBotSetting('botEnabled', 'true')) === 'true';
    const notifyShift = (await getBotSetting('botNotifyShift', 'true')) === 'true';
    if (!botEnabled || !notifyShift) return;

    const cashierName = cashier?.name || shift?.cashier?.name || 'Kasir';
    const closedByName = closedBy?.name || summary?.closedByName || cashierName;
    const regName = summary?.registerName || shift?.register?.name || 'Kasir Utama';

    const initialCash = Number(summary?.openingCash || shift?.openingCash || 0);
    const countedCash = Number(summary?.closingCash !== undefined ? summary.closingCash : shift?.closingCash || 0);
    const expectedCash = Number(summary?.expectedCash !== undefined ? summary.expectedCash : shift?.expectedCash || 0);
    const diff = Number(summary?.difference !== undefined ? summary.difference : (countedCash - expectedCash));
    const cashSales = Number(summary?.totalCashSales || summary?.cashSales || 0);
    const nonCashSales = Number(summary?.totalNonCashSales || summary?.nonCashSales || 0);
    const totalSales = Number(summary?.totalSales || (cashSales + nonCashSales));
    const ordersCount = Number(summary?.ordersCount || 0);
    const notes = summary?.notes || shift?.notes || '';

    let diffText = '🟢 Kas Seimbang (Rp 0 / Pas)';
    if (diff > 0) {
      diffText = `🔵 Surplus +Rp ${diff.toLocaleString('id-ID')}`;
    } else if (diff < 0) {
      diffText = `🔴 Defisit -Rp ${Math.abs(diff).toLocaleString('id-ID')}`;
    }

    const closedTimeStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(summary?.closedAt || shift?.closedAt ? new Date(summary?.closedAt || shift?.closedAt) : new Date());

    const message = `
🔒 <b>NOTIFIKASI PENUTUPAN SESI KASIR (Z-REPORT)</b>
━━━━━━━━━━━━━━━━━━
<b>Terminal:</b> ${regName}
<b>Kasir Pembuka:</b> ${cashierName}
${closedByName && closedByName !== cashierName ? `<b>Kasir Penutup:</b> ${closedByName}\n` : ''}<b>Waktu Tutup:</b> ${closedTimeStr} WIB
━━━━━━━━━━━━━━━━━━
<b>Modal Awal:</b> Rp ${initialCash.toLocaleString('id-ID')}
<b>Penjualan Tunai:</b> Rp ${cashSales.toLocaleString('id-ID')}
<b>Penjualan Non-Tunai:</b> Rp ${nonCashSales.toLocaleString('id-ID')}
<b>Total Omzet:</b> Rp ${totalSales.toLocaleString('id-ID')} (${ordersCount} transaksi)
━━━━━━━━━━━━━━━━━━
<b>Kas yang Diharapkan:</b> Rp ${expectedCash.toLocaleString('id-ID')}
<b>Kas Fisik Aktual:</b> Rp ${countedCash.toLocaleString('id-ID')}
<b>Status Rekonsiliasi:</b> <b>${diffText}</b>
${notes ? `<b>Catatan:</b> <i>${notes}</i>\n` : ''}━━━━━━━━━━━━━━━━━━
🤖 <i>@komazi-assistant</i>
    `.trim();

    let photoBuffer = null;
    try {
      photoBuffer = await generateBotImage('shift_closed', {
        shiftId,
        cashierName,
        initialCash,
        closingCash: countedCash,
        expectedCash,
        diff,
        notes,
        cashSales,
        qrisSales: nonCashSales,
        totalSales,
      });
    } catch (imgErr) {
      console.warn('[TelegramService] notifyShiftClosed image error:', imgErr.message);
    }

    if (photoBuffer) {
      sendTelegramPhoto(photoBuffer, message).catch(() => {});
    } else {
      sendTelegramMessage(message).catch(() => {});
    }
  } catch (err) {
    console.warn('[TelegramService] notifyShiftClosed error:', err.message);
  }
}

/**
 * Handle incoming webhook updates from Telegram Bot API (Section 33)
 */
export async function handleTelegramWebhook(update) {
  if (!update || !update.message) return { status: 'ignored' };

  const message = update.message;
  const chatId = message.chat?.id;
  const fromId = message.from?.id;
  const text = (message.text || '').trim();

  if (!chatId || !text) return { status: 'no_text' };

  // Otorisasi: Verifikasi Telegram Chat / User ID langsung dari database staf terdaftar
  const authorizedUser = await prisma.user.findFirst({
    where: {
      telegramId: String(fromId || chatId),
      isActive: true,
      role: { in: ['OWNER', 'MANAGER', 'BARISTA', 'KITCHEN'] },
    },
  });

  if (!authorizedUser) {
    await sendTelegramMessage(
      `⛔ <b>AKSES DITOLAK</b>\n\nChat ID Anda (<code>${chatId}</code>) belum terdaftar sebagai staf aktif POS Komazi. Hubungi Owner/Manager untuk menautkan akun.`,
      chatId
    );
    return { status: 'unauthorized', chatId };
  }

  const command = text.split(' ')[0].toLowerCase().split('@')[0]; // Support /command@botname

  switch (command) {
    case '/start':
    case '/help': {
      const helpMsg = `
👋 <b>HALO, ADMIN KOMAZI POS!</b>
━━━━━━━━━━━━━━━━━━
Berikut perintah kontrol & monitoring yang tersedia:

📊 <b>/omzet</b> — Ringkasan omzet & transaksi hari ini
📦 <b>/stok</b> — Pantau bahan baku yang menipis
🔥 <b>/menu_laris</b> — Menu terpopuler & terlaris hari ini
📈 <b>/laporan</b> — Laporan penjualan lengkap hari ini
💰 <b>/profit</b> — Estimasi laba kotor (Gross Profit & HPP)
🔮 <b>/prediksi</b> — Prediksi jam sibuk & insight AI
━━━━━━━━━━━━━━━━━━
🤖 <i>@komazi-assistant</i>
      `.trim();
      await sendTelegramMessage(helpMsg, chatId);
      break;
    }

    case '/omzet': {
      try {
        const [sales, summary] = await Promise.all([
          getTodayTopSellingData(5),
          orderService.getSummary('today'),
        ]);

        const omzetMsg = `
📊 <b>RINGKASAN OMZET HARI INI</b>
━━━━━━━━━━━━━━━━━━
<b>Total Omzet:</b> Rp ${Number(summary.totalRevenue || sales.todayTotalRevenue || 0).toLocaleString('id-ID')}
<b>Total Transaksi:</b> ${summary.totalTransactions} transaksi
<b>Rata-rata Order:</b> ${sales.averageOrderValueFormatted || 'Rp 0'}

<b>Metode Pembayaran:</b>
• Tunai (Cash): Rp ${Number(summary.byMethod?.CASH || 0).toLocaleString('id-ID')}
• QRIS Dinamis: Rp ${Number(summary.byMethod?.QRIS || 0).toLocaleString('id-ID')}
• Transfer Bank: Rp ${Number(summary.byMethod?.TRANSFER || 0).toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━
<i>Gunakan /laporan untuk rincian selengkapnya.</i>

🤖 <i>@komazi-assistant</i>
        `.trim();

        let photoBuffer = null;
        try {
          photoBuffer = await generateBotImage('realtime_sales', {
            totalRevenue: Number(summary.totalRevenue || sales.todayTotalRevenue || 0),
            transactionCount: summary.totalTransactions,
            avgOrderValue: sales.averageOrderValue || 0,
            cashRevenue: summary.byMethod?.CASH || 0,
            qrisRevenue: summary.byMethod?.QRIS || 0,
            transferRevenue: summary.byMethod?.TRANSFER || 0,
          });
        } catch (imgErr) {
          console.warn('[TelegramService] webhook omzet image error:', imgErr.message);
        }

        if (photoBuffer) {
          await sendTelegramPhoto(photoBuffer, omzetMsg, chatId);
        } else {
          await sendTelegramMessage(omzetMsg, chatId);
        }
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal mengambil data omzet: ${err.message}`, chatId);
      }
      break;
    }

    case '/antrean':
    case '/antrian': {
      try {
        const userRole = (authorizedUser?.role || 'BARISTA').toUpperCase();
        const queue = await orderService.listQueue(userRole);

        let emptyMessage = '✨ <b>Antrean Bersih!</b>\nTidak ada pesanan aktif saat ini.';
        let roleTitle = '📋 Antrean Pesanan';
        let cardBadge = 'KDS QUEUE DASHBOARD';
        let cardBadgeColor = 'badge-amber';
        let cardTitle = 'Status Antrean Pesanan';
        let cardSubtitle = 'Pemantauan live antrean pesanan Komazi POS';

        if (userRole === 'BARISTA') {
          emptyMessage = '✨ <b>Antrean Bar Bersih!</b>\nTidak ada pesanan minuman yang sedang menunggu racikan barista saat ini.';
          roleTitle = `☕ <b>Antrean Bar Minuman (Barista - ${queue.length} Pesanan):</b>`;
          cardBadge = 'BDS BARISTA QUEUE';
          cardBadgeColor = 'badge-amber';
          cardTitle = 'Status Antrean Bar Minuman (Barista)';
          cardSubtitle = 'Live pemantauan antrean pesanan racikan bar & kopi';
        } else if (userRole === 'KITCHEN') {
          emptyMessage = '✨ <b>Antrean Dapur Bersih!</b>\nTidak ada pesanan makanan yang sedang menunggu persiapan dapur saat ini.';
          roleTitle = `🥐 <b>Antrean Dapur Makanan (Kitchen - ${queue.length} Pesanan):</b>`;
          cardBadge = 'KDS KITCHEN QUEUE';
          cardBadgeColor = 'badge-coral';
          cardTitle = 'Status Antrean Dapur Makanan (Kitchen)';
          cardSubtitle = 'Live pemantauan antrean pesanan dapur & pastry';
        } else {
          emptyMessage = '✨ <b>Antrean Kedai Bersih!</b>\nTidak ada pesanan aktif yang menunggu di bar maupun dapur saat ini.';
          roleTitle = `📋 <b>Antrean Pesanan Keseluruhan (Bar & Dapur - ${queue.length} Pesanan):</b>`;
          cardBadge = 'KDS/BDS MASTER QUEUE';
          cardBadgeColor = 'badge-amber';
          cardTitle = 'Status Antrean Barista & Dapur';
          cardSubtitle = 'Live pemantauan seluruh antrean minuman & makanan Komazi POS';
        }

        if (!queue || queue.length === 0) {
          await sendTelegramMessage(emptyMessage, chatId);
        } else {
          const cards = queue.map((o) => {
            const items = (o.items || [])
              .map((i) => `• <b>${i.qty}×</b> ${i.productName || i.name}${i.variantName ? ` (${i.variantName})` : ''}`)
              .join('\n');
            const icon = userRole === 'KITCHEN' ? '🥐' : '☕';
            return `${icon} <b>${o.invoiceNo}</b> (${o.type} ${o.tableNo ? `Meja ${o.tableNo}` : ''})\n${items}\nStatus: <code>${o.status}</code>`;
          }).join('\n\n━━━━━━━━━━━━━━━━━━\n\n');

          const caption = `${roleTitle}\n━━━━━━━━━━━━━━━━━━\n\n${cards}\n\n━━━━━━━━━━━━━━━━━━\n\n🤖 <i>@komazi-assistant</i>`;

          let photoBuffer = null;
          try {
            photoBuffer = await generateBotImage('queue_dashboard', {
              queue,
              badgeText: cardBadge,
              badgeColor: cardBadgeColor,
              title: cardTitle,
              subtitle: cardSubtitle,
            });
          } catch (imgErr) {
            console.warn('[TelegramService] queue_dashboard render error:', imgErr.message);
          }

          if (photoBuffer) {
            await sendTelegramPhoto(photoBuffer, caption, chatId);
          } else {
            await sendTelegramMessage(caption, chatId);
          }
        }
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal mengambil antrean: ${err.message}`, chatId);
      }
      break;
    }

    case '/stok': {
      try {
        const ingredients = await prisma.ingredient.findMany({
          where: { isActive: true },
          orderBy: { stock: 'asc' },
        });

        const lowStock = ingredients.filter((i) => Number(i.stock) <= Number(i.minStock || 5));
        if (lowStock.length === 0) {
          await sendTelegramMessage(
            '✅ <b>SEMUA STOK AMAN</b>\n\nSeluruh bahan baku saat ini berada di atas batas minimum cadangan.',
            chatId
          );
        } else {
          const list = lowStock
            .slice(0, 10)
            .map((i) => `• <b>${i.name}:</b> sisa ${i.stock} ${i.unit || ''} (min: ${i.minStock})`)
            .join('\n');

          const stokMsg = `
⚠️ <b>PERINGATAN BAHAN MENIPIS (${lowStock.length})</b>
━━━━━━━━━━━━━━━━━━
${list}
━━━━━━━━━━━━━━━━━━
<i>Harap segera buat PO atau restock persediaan bahan!</i>

🤖 <i>@komazi-assistant</i>
          `.trim();

          let photoBuffer = null;
          try {
            photoBuffer = await generateBotImage('inventory_critical', {
              items: lowStock.slice(0, 5).map((i) => ({
                name: i.name,
                stock: i.stock,
                minStock: i.minStock,
                unit: i.unit || 'unit',
              })),
              totalAlerts: lowStock.length,
            });
          } catch (imgErr) {
            console.warn('[TelegramService] webhook stok image error:', imgErr.message);
          }

          if (photoBuffer) {
            await sendTelegramPhoto(photoBuffer, stokMsg, chatId);
          } else {
            await sendTelegramMessage(stokMsg, chatId);
          }
        }
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal mengambil data stok: ${err.message}`, chatId);
      }
      break;
    }

    case '/menu_laris': {
      try {
        const sales = await getTodayTopSellingData(5);
        const top = sales.topProducts || [];
        if (top.length === 0) {
          await sendTelegramMessage('ℹ️ Belum ada menu terjual yang tercatat hari ini.', chatId);
        } else {
          const topList = top
            .map((p, idx) => `${idx + 1}. <b>${p.productName}</b> — ${p.qtySold} porsi (${p.revenueFormatted})`)
            .join('\n');

          const menuMsg = `
🔥 <b>TOP 5 MENU TERLARIS</b>
━━━━━━━━━━━━━━━━━━
${topList}
━━━━━━━━━━━━━━━━━━
<i>Terus pertahankan ketersediaan bahan menu unggulan ini!</i>

🤖 <i>@komazi-assistant</i>
          `.trim();
          await sendTelegramMessage(menuMsg, chatId);
        }
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal mengambil menu laris: ${err.message}`, chatId);
      }
      break;
    }

    case '/profit': {
      try {
        const cogsOverview = await getAllProductsCogsOverview();
        const sales = await getTodayTopSellingData(5);
        const avgMargin = cogsOverview.length > 0
          ? Math.round(cogsOverview.reduce((acc, c) => acc + (c.margin || 0), 0) / cogsOverview.length)
          : 60;

        const estProfit = Math.round((sales.todayTotalRevenue || 0) * (avgMargin / 100));

        const profitMsg = `
💰 <b>ESTIMASI LABA KOTOR (GROSS PROFIT)</b>
━━━━━━━━━━━━━━━━━━
<b>Pendapatan:</b> ${sales.todayTotalRevenueFormatted || 'Rp 0'}
<b>Rata-rata Margin:</b> ~${avgMargin}%
<b>Estimasi Laba Kotor:</b> Rp ${estProfit.toLocaleString('id-ID')}
━━━━━━━━━━━━━━━━━━
<i>Dihitung berdasarkan komposisi HPP Resep (BOM) produk aktif.</i>

🤖 <i>@komazi-assistant</i>
        `.trim();
        await sendTelegramMessage(profitMsg, chatId);
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal menghitung estimasi profit: ${err.message}`, chatId);
      }
      break;
    }

    case '/prediksi':
    case '/briefing': {
      try {
        const forecast = await calculatePeakHourAndRevenueForecast();
        const aiInsight = await generateRealAiPredictionAnalysis(forecast);
        const dateStr = new Date().toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

        const topMenuText = forecast.topProducts && forecast.topProducts.length > 0
          ? forecast.topProducts.slice(0, 3).map((p, i) => `• <b>${p.name}</b> (${p.qty} terjual)`).join('\n')
          : '• -';

        const caption = `
🔮 <b>KOMAZI AI — PREDIKSI & BRIEFING BISNIS</b>
━━━━━━━━━━━━━━━━━━
📅 <b>Hari:</b> ${forecast.dayName}, ${dateStr}
🎯 <b>Target Proyeksi:</b> <code>${forecast.projectedRevenueFormatted}</code>
📊 <b>Kemarin:</b> ${forecast.yesterdayRevenueFormatted} (${forecast.yesterdayOrderCount} pesanan)
⚡ <b>Jam Ramai:</b> <code>${forecast.primaryPeakWindow}</code>
🌙 <b>Sesi Malam:</b> <code>${forecast.secondaryPeakWindow}</code>
🏆 <b>Menu Primadona:</b>
${topMenuText}
━━━━━━━━━━━━━━━━━━
💡 <i>Detail analisis AI tertera di bawah.</i>

🤖 <i>@komazi-assistant</i>
        `.trim();

        const fullMsg = `
🔮 <b>KOMAZI AI — PREDIKSI & BRIEFING BISNIS</b>
━━━━━━━━━━━━━━━━━━
📅 <b>Hari:</b> ${forecast.dayName}, ${dateStr}
🎯 <b>Target Proyeksi:</b> <code>${forecast.projectedRevenueFormatted}</code>
📊 <b>Kemarin:</b> ${forecast.yesterdayRevenueFormatted} (${forecast.yesterdayOrderCount} pesanan)
⚡ <b>Jam Ramai:</b> <code>${forecast.primaryPeakWindow}</code>
🌙 <b>Sesi Malam:</b> <code>${forecast.secondaryPeakWindow}</code>
━━━━━━━━━━━━━━━━━━
🧠 <b>ANALISIS STRATEGI & TAKTIS:</b>
${aiInsight}
━━━━━━━━━━━━━━━━━━
<i>Dianalisis secara real-time • @komazi-assistant</i>
        `.trim();

        let photoBuffer = null;
        try {
          photoBuffer = await generateBotImage('ai_morning_briefing', forecast);
        } catch (imgErr) {
          console.warn('[TelegramService] ai_morning_briefing render error:', imgErr.message);
        }

        if (photoBuffer) {
          await sendTelegramPhoto(photoBuffer, caption, chatId);
          const detailMsg = `
🧠 <b>ANALISIS STRATEGI & TAKTIS:</b>
━━━━━━━━━━━━━━━━━━
${aiInsight}
━━━━━━━━━━━━━━━━━━
<i>Dianalisis secara real-time • @komazi-assistant</i>
          `.trim();
          await sendTelegramMessage(detailMsg, chatId);
        } else {
          await sendTelegramMessage(fullMsg, chatId);
        }
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal menghasilkan insight prediksi: ${err.message}`, chatId);
      }
      break;
    }

    case '/cek_stok_kritis':
    case '/prediksi_stok': {
      try {
        const stockForecast = await calculateStockRunoutForecast();
        const critMsg = `
🚨 <b>KOMAZI AI — ESTIMASI HABIS BAHAN BAKU</b>
━━━━━━━━━━━━━━━━━━
Status: <b>${stockForecast.hasCriticalRisk ? `${stockForecast.criticalCount} Bahan Berisiko Kritis ⚠️` : 'Semua Bahan Aman Terkendali ✅'}</b>
${stockForecast.criticalItems.slice(0, 4).map((it) => `• <b>${it.name}</b>: sisa ${it.currentStock} ${it.unit} (${it.estimatedRunoutTime ? `habis ~${it.hoursUntilStockout} jam / ${it.estimatedRunoutTime}` : 'habis'})`).join('\n') || 'Tidak ada bahan yang terancam habis dalam waktu dekat.'}
━━━━━━━━━━━━━━━━━━
<i>Dihitung dari laju konsumsi pesanan aktif.</i>

🤖 <i>@komazi-assistant</i>
        `.trim();

        let photoBuffer = null;
        try {
          photoBuffer = await generateBotImage('ai_stockout_alert', stockForecast);
        } catch (imgErr) {
          console.warn('[TelegramService] ai_stockout_alert render error:', imgErr.message);
        }

        if (photoBuffer) {
          await sendTelegramPhoto(photoBuffer, critMsg, chatId);
        } else {
          await sendTelegramMessage(critMsg, chatId);
        }
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal memeriksa estimasi stok: ${err.message}`, chatId);
      }
      break;
    }

    case '/evaluasi_ai': {
      try {
        const closeComparison = await generateClosingComparison();
        const evalMsg = `
🌙 <b>KOMAZI AI — REKAPITULASI PENUTUPAN HARI INI</b>
━━━━━━━━━━━━━━━━━━
🏆 <b>Omset Realisasi:</b> ${closeComparison.actualRevenueFormatted}
🎯 <b>Target Awal Hari:</b> ${closeComparison.projectedRevenueFormatted}
📈 <b>Pencapaian:</b> ${closeComparison.achievementRatePct}% (${closeComparison.badgeLabel})
🧾 <b>Total Struk:</b> ${closeComparison.totalTransactions} pesanan
━━━━━━━━━━━━━━━━━━
<i>Laporan performa harian • @komazi-assistant</i>
        `.trim();

        let photoBuffer = null;
        try {
          photoBuffer = await generateBotImage('ai_evening_wrapup', closeComparison);
        } catch (imgErr) {
          console.warn('[TelegramService] ai_evening_wrapup render error:', imgErr.message);
        }

        if (photoBuffer) {
          await sendTelegramPhoto(photoBuffer, evalMsg, chatId);
        } else {
          await sendTelegramMessage(evalMsg, chatId);
        }
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal menyusun evaluasi penutupan: ${err.message}`, chatId);
      }
      break;
    }

    case '/laporan': {
      try {
        const [sales, summary, cogsOverview] = await Promise.all([
          getTodayTopSellingData(5),
          orderService.getSummary('today'),
          getAllProductsCogsOverview(),
        ]);

        const avgMargin = cogsOverview.length > 0
          ? Math.round(cogsOverview.reduce((acc, c) => acc + (c.margin || 0), 0) / cogsOverview.length)
          : 60;
        const totalRev = Number(summary.totalRevenue || sales.todayTotalRevenue || 0);
        const estProfit = Math.round(totalRev * (avgMargin / 100));

        const lapMsg = `
📈 <b>LAPORAN PENJUALAN HARIAN KOMAZI</b>
━━━━━━━━━━━━━━━━━━
<b>Tanggal:</b> ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
<b>Total Omzet:</b> Rp ${totalRev.toLocaleString('id-ID')}
<b>Total Pesanan:</b> ${summary.totalTransactions} pesanan
<b>Estimasi Profit:</b> Rp ${estProfit.toLocaleString('id-ID')} (~${avgMargin}%)

<b>Rincian Metode Pembayaran:</b>
• Tunai (Cash): Rp ${Number(summary.byMethod?.CASH || 0).toLocaleString('id-ID')}
• QRIS Dinamis: Rp ${Number(summary.byMethod?.QRIS || 0).toLocaleString('id-ID')}
• Transfer Bank: Rp ${Number(summary.byMethod?.TRANSFER || 0).toLocaleString('id-ID')}

<b>Menu Teratas:</b> ${sales.topProducts?.[0]?.productName || summary.topProducts?.[0]?.name || '-'} (${sales.topProducts?.[0]?.qtySold || summary.topProducts?.[0]?.qty || 0} porsi)
━━━━━━━━━━━━━━━━━━
🤖 <i>@komazi-assistant</i>
        `.trim();

        let photoBuffer = null;
        try {
          photoBuffer = await generateBotImage('sales_report', {
            period: 'Harian (Hari Ini)',
            date: new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' }),
            totalRevenue: totalRev,
            transactionCount: summary.totalTransactions,
            grossProfit: estProfit,
            marginPct: avgMargin,
            cashRevenue: summary.byMethod?.CASH || 0,
            qrisRevenue: summary.byMethod?.QRIS || 0,
            transferRevenue: summary.byMethod?.TRANSFER || 0,
            topProducts: (sales.topProducts || []).slice(0, 3).map((p) => ({
              name: p.productName,
              qty: p.qtySold,
              revenue: p.revenue,
            })),
          });
        } catch (imgErr) {
          console.warn('[TelegramService] webhook laporan image error:', imgErr.message);
        }

        if (photoBuffer) {
          await sendTelegramPhoto(photoBuffer, lapMsg, chatId);
        } else {
          await sendTelegramMessage(lapMsg, chatId);
        }
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal menyusun laporan: ${err.message}`, chatId);
      }
      break;
    }

    default: {
      await sendTelegramMessage(
        `❓ Perintah <code>${command}</code> tidak dikenali.\nKetik <b>/help</b> untuk melihat daftar perintah.`,
        chatId
      );
    }
  }

  return { status: 'handled', command };
}

