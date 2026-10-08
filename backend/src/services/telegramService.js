import prisma from '../config/db.js';
import { getTodayTopSellingData, getRoleScopedBusinessContext } from './salesAnalyticsEngine.js';
import { getAllProductsCogsOverview } from './cogsService.js';
import { orderService } from './order.service.js';

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

/**
 * Notifikasi Transaksi Real-Time untuk Bot Telegram
 * Dikirim secara otomatis saat pembayaran pesanan berhasil (PAID)
 */
export async function notifyPaidTransaction(order) {
  if (!order) return;

  try {
    const invoiceNo = order.invoiceNo || `ORD-${order.id || 'N/A'}`;
    const orderType =
      order.type === 'TAKE_AWAY'
        ? 'Take-Away (Bungkus)'
        : `Dine-In ${order.tableNo ? `(Meja ${order.tableNo})` : ''}`;
    const customer = order.customerName || order.customer?.name || 'Tamu';
    const cashier = order.cashier?.name || order.cashierName || 'Kasir';

    // Format Tanggal & Jam WIB
    const dateObj = order.paidAt
      ? new Date(order.paidAt)
      : order.createdAt
      ? new Date(order.createdAt)
      : new Date();
    const timeStr =
      dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const dateStr = dateObj.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    // Format Daftar Menu
    const itemsList = (order.items || [])
      .map((i) => {
        const variant = i.variantName ? ` [${i.variantName}]` : '';
        const name = i.productName || i.name || 'Menu';
        const total = Number(
          i.lineTotal || Number(i.qty || 1) * Number(i.unitPrice || 0)
        ).toLocaleString('id-ID');
        return `• <b>${i.qty}x ${name}${variant}</b> — Rp ${total}`;
      })
      .join('\n');

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
        paymentMethods.push(`${m} (Rp ${Number(p.amount).toLocaleString('id-ID')})`);
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
      paymentMethods.push('Lunas');
    }

    const subtotal = Number(order.subtotal || 0).toLocaleString('id-ID');
    const discount = Number(order.discount || 0);
    const tax = Number(order.tax || 0);
    const serviceFee = Number(order.serviceFee || 0);
    const total = Number(order.total || 0).toLocaleString('id-ID');

    let breakdown = `• Subtotal: Rp ${subtotal}`;
    if (discount > 0) breakdown += `\n• Diskon Promo: -Rp ${discount.toLocaleString('id-ID')}`;
    if (serviceFee > 0) breakdown += `\n• Service Fee: Rp ${serviceFee.toLocaleString('id-ID')}`;
    if (tax > 0) breakdown += `\n• PB1 / Pajak: Rp ${tax.toLocaleString('id-ID')}`;

    const message = `
💰 <b>NOTIFIKASI TRANSAKSI BERHASIL</b>
━━━━━━━━━━━━━━━━━━
🧾 <b>No. Invoice:</b> <code>${invoiceNo}</code>
📅 <b>Waktu:</b> ${dateStr}, ${timeStr}
👤 <b>Kasir:</b> ${cashier}
🍽️ <b>Tipe:</b> ${orderType}
👥 <b>Pelanggan:</b> ${customer}

🛒 <b>Daftar Menu:</b>
${itemsList || '• 1x Transaksi Kasir'}

📊 <b>Rincian Finansial:</b>
${breakdown}
━━━━━━━━━━━━━━━━━━
💵 <b>TOTAL PEMBAYARAN:</b> <b>Rp ${total}</b>
💳 <b>Metode:</b> <b>${paymentMethods.join(', ')}</b>
━━━━━━━━━━━━━━━━━━
☕ <i>POS Komazi Real-Time Alert</i>
    `.trim();

    // Broadcast ke seluruh admin/owner terdaftar
    sendTelegramMessage(message).catch((err) => {
      console.warn('[TelegramService] notifyPaidTransaction broadcast error:', err.message);
    });
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
  const message = `
⚠️ <b>PERINGATAN STOK MENIPIS</b>
━━━━━━━━━━━━━━━━━━
<b>Bahan:</b> ${ingredientName}
<b>Sisa Stok:</b> ${currentStock} ${unit || ''}
<b>Batas Minimum:</b> ${minStock} ${unit || ''}

<i>Segera lakukan restock atau purchase order bahan baku ini.</i>
━━━━━━━━━━━━━━━━━━
<i>POS Komazi Inventory Alert</i>
  `.trim();

  sendTelegramMessage(message).catch(() => {});
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

  // Otorisasi: Verifikasi Telegram Chat / User ID langsung dari database role OWNER & MANAGER
  const authorizedUser = await prisma.user.findFirst({
    where: {
      telegramId: String(fromId || chatId),
      isActive: true,
      role: { in: ['OWNER', 'MANAGER'] },
    },
  });

  if (!authorizedUser) {
    await sendTelegramMessage(
      `⛔ <b>AKSES DITOLAK</b>\n\nChat ID Anda (<code>${chatId}</code>) tidak terdaftar sebagai Owner atau Manager POS Komazi.`,
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
<i>POS Komazi F&B Control Layer</i>
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
        `.trim();
        await sendTelegramMessage(omzetMsg, chatId);
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal mengambil data omzet: ${err.message}`, chatId);
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
          `.trim();
          await sendTelegramMessage(stokMsg, chatId);
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
        `.trim();
        await sendTelegramMessage(profitMsg, chatId);
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal menghitung estimasi profit: ${err.message}`, chatId);
      }
      break;
    }

    case '/prediksi': {
      try {
        const context = await getRoleScopedBusinessContext({ role: 'OWNER' });
        const peak = context.salesSummary?.today?.peakHour || '14:00 - 17:00';
        const predMsg = `
🔮 <b>PREDIKSI & INSIGHT BISNIS</b>
━━━━━━━━━━━━━━━━━━
<b>Estimasi Jam Sibuk (Peak Hour):</b> ${peak} WIB
<b>Rekomendasi Barista:</b> Siapkan batch cold brew & espresso grind sebelum jam sibuk.
<b>Status Shift:</b> ${context.currentShift?.isOpen ? 'Shift Aktif Berjalan' : 'Belum Ada Shift Terbuka'}
━━━━━━━━━━━━━━━━━━
<i>Analisis pola penjualan Komazi AI Engine.</i>
        `.trim();
        await sendTelegramMessage(predMsg, chatId);
      } catch (err) {
        await sendTelegramMessage(`❌ Gagal menghasilkan insight prediksi: ${err.message}`, chatId);
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
<i>POS Komazi Autonomous Reporting Layer</i>
        `.trim();
        await sendTelegramMessage(lapMsg, chatId);
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

