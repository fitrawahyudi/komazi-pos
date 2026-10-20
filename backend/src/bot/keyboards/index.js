import { InlineKeyboard } from 'grammy';
import { rupiah, esc } from '../utils/format.js';
export { buildPaginatedNumericKeyboard, formatPaginatedList } from './pagination.js';
export { buildStaffReplyKeyboard } from './replyKeyboard.js';

export function mainMenu(role) {
  const kb = new InlineKeyboard();
  switch (role) {
    case 'CASHIER':
      kb.text('🧾 Pesanan Baru', 'go:order').text('📋 Pesanan Aktif', 'go:orders').row()
        .text('💻 Workspace', 'go:workspace').text('⏱ Shift', 'go:shift').row()
        .text('ℹ️ Status Bot', 'go:infobot');
      break;
    case 'BARISTA':
      kb.text('☕ Antrean Pesanan', 'go:queue').text('ℹ️ Status Bot', 'go:infobot');
      break;
    case 'KITCHEN':
      kb.text('🍳 Antrean Dapur', 'go:queue').text('ℹ️ Status Bot', 'go:infobot');
      break;
    case 'MANAGER':
      kb.text('✅ Approval', 'go:approval').text('📦 Cek Stok', 'go:stock').row()
        .text('🚫 Menu Habis', 'go:soldout').text('📊 Laporan', 'go:report').row()
        .text('⏰ Jadwal Otomatis', 'go:jobs').text('🤖 Asisten AI', 'go:ai_menu').row()
        .text('ℹ️ Status Bot', 'go:infobot');
      break;
    case 'OWNER':
      kb.text('📊 Ringkasan Omzet', 'go:summary').text('✅ Approval', 'go:approval').row()
        .text('📦 Stok', 'go:stock').text('🔗 Tautkan Staf', 'go:link').row()
        .text('⏰ Jadwal Otomatis', 'go:jobs').text('🤖 Asisten AI', 'go:ai_menu').row()
        .text('ℹ️ Status Bot', 'go:infobot');
      break;
    default:
      kb.text('ℹ️ Info Akun', 'go:whoami').text('ℹ️ Status Bot', 'go:infobot');
  }
  return kb;
}

export function buildOrderCard(order) {
  const itemsText = (order.items || [])
    .map((i) => `• <b>${i.qty}×</b> ${esc(i.productName || i.name)}${i.variantName ? ` (${esc(i.variantName)})` : ''}${i.note ? ` <i>[${esc(i.note)}]</i>` : ''}`)
    .join('\n');

  const text = `
🆕 <b>PESANAN ${esc(order.invoiceNo)}</b>
━━━━━━━━━━━━━━━━━━
<b>Tipe:</b> ${order.type === 'TAKE_AWAY' ? 'Take-away 🛍️' : `Dine-in 🍽️ ${order.tableNo ? `(Meja ${esc(order.tableNo)})` : ''}`}
<b>Pelanggan:</b> ${esc(order.customerName || 'Tamu')}
<b>Kasir:</b> ${esc(order.cashier?.name || 'Kasir')}

<b>Menu Pesanan:</b>
${itemsText}

<b>Total:</b> ${rupiah(order.total)}
<b>Status:</b> ${order.status}
━━━━━━━━━━━━━━━━━━
  `.trim();

  const keyboard = new InlineKeyboard()
    .text('▶️ Proses Minuman/Makanan', `ord:prep:${order.id}`);

  return { text, keyboard };
}
