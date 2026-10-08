import { InlineKeyboard } from 'grammy';
import { getBotUser } from '../context.js';
import { menuService } from '../../services/menu.service.js';
import { orderService } from '../../services/order.service.js';
import { rupiah, esc } from '../utils/format.js';

export async function quickOrder(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun belum tertaut.');

  const shift = await conversation.external(() => orderService.requireOpenShift(user.id));
  if (!shift) {
    return ctx.reply('⚠️ Anda harus membuka shift terlebih dahulu. Gunakan /buka_shift.');
  }

  const categories = await conversation.external(() => menuService.listCategories());
  if (!categories || categories.length === 0) {
    return ctx.reply('Belum ada kategori menu yang terdaftar di sistem POS.');
  }

  const cart = []; // [{ productId, name, price, qty }]

  while (true) {
    // 1) Pilih kategori
    const kbCat = new InlineKeyboard();
    categories.forEach((c) => kbCat.text(c.name, `cat:${c.id}`).row());
    if (cart.length > 0) {
      kbCat.text('✅ Selesai & Lanjut Bayar', 'cart:done').row();
    }
    kbCat.text('❌ Batalkan Pesanan', 'cart:cancel');

    await ctx.reply(
      cart.length > 0
        ? `Keranjang saat ini (${cart.length} item):\n${cart.map((c) => `• ${c.qty}x ${esc(c.name)} (${rupiah(c.price * c.qty)})`).join('\n')}\n\nPilih kategori untuk menambah menu lagi:`
        : '📋 <b>Pilih Kategori Menu:</b>',
      { parse_mode: 'HTML', reply_markup: kbCat }
    );

    const catCtx = await conversation.waitForCallbackQuery(/^(cat:\d+|cart:done|cart:cancel)$/);
    await catCtx.answerCallbackQuery();

    if (catCtx.callbackQuery.data === 'cart:cancel') {
      return ctx.reply('Pesanan dibatalkan.');
    }
    if (catCtx.callbackQuery.data === 'cart:done') {
      break;
    }

    // 2) Pilih produk dalam kategori
    const catId = Number(catCtx.callbackQuery.data.split(':')[1]);
    const products = await conversation.external(() => menuService.listAvailable(catId));

    if (!products || products.length === 0) {
      await ctx.reply('Tidak ada menu aktif yang tersedia pada kategori ini.');
      continue;
    }

    const kbPrd = new InlineKeyboard();
    products.forEach((p) => {
      kbPrd.text(`${p.name} · ${rupiah(p.price)}`, `prd:${p.id}`).row();
    });
    kbPrd.text('🔙 Kembali ke Kategori', 'cat:back');

    await ctx.reply('Pilih menu yang dipesan:', { reply_markup: kbPrd });

    const prdCtx = await conversation.waitForCallbackQuery(/^(prd:\d+|cat:back)$/);
    await prdCtx.answerCallbackQuery();

    if (prdCtx.callbackQuery.data === 'cat:back') {
      continue;
    }

    const prdId = Number(prdCtx.callbackQuery.data.split(':')[1]);
    const product = products.find((p) => p.id === prdId);
    if (!product) continue;

    // 3) Jumlah porsi/cup
    await ctx.reply(`Berapa porsi/cup untuk <b>${esc(product.name)}</b>? (Kirim angka 1–50)`, {
      parse_mode: 'HTML',
    });

    let qty;
    while (true) {
      const { message } = await conversation.waitFor('message:text');
      qty = parseInt(message.text, 10);
      if (qty >= 1 && qty <= 50) break;
      await ctx.reply('Jumlah tidak valid. Masukkan angka antara 1 sampai 50:');
    }

    // Cek apakah item sudah ada di keranjang
    const existingIndex = cart.findIndex((i) => i.productId === product.id);
    if (existingIndex >= 0) {
      cart[existingIndex].qty += qty;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        qty,
      });
    }

    await ctx.reply(`➕ <b>${qty}× ${esc(product.name)}</b> ditambahkan ke keranjang.`, {
      parse_mode: 'HTML',
    });
  }

  // 4) Tipe Pesanan
  await ctx.reply('Pilih tipe pesanan:', {
    reply_markup: new InlineKeyboard()
      .text('🍽️ Dine-in (Makan di Tempat)', 'type:DINE_IN')
      .text('🛍️ Take-away (Bungkus)', 'type:TAKE_AWAY'),
  });

  const typeCtx = await conversation.waitForCallbackQuery(/^type:(DINE_IN|TAKE_AWAY)$/);
  await typeCtx.answerCallbackQuery();
  const type = typeCtx.callbackQuery.data.split(':')[1];

  let tableNo = null;
  if (type === 'DINE_IN') {
    await ctx.reply('Nomor meja? (Ketik nomor meja atau <code>-</code> jika belum ada meja):', {
      parse_mode: 'HTML',
    });
    const tableMsg = await conversation.waitFor('message:text');
    tableNo = tableMsg.message.text.trim() === '-' ? null : tableMsg.message.text.trim();
  }

  await ctx.reply('Nama pelanggan? (Ketik nama atau <code>-</code> jika tamu anonim):', {
    parse_mode: 'HTML',
  });
  const nameMsg = await conversation.waitFor('message:text');
  const customerName = nameMsg.message.text.trim() === '-' ? null : nameMsg.message.text.trim();

  // 5) Ringkasan & Kalkulasi
  const preview = await conversation.external(() => orderService.preview({ items: cart, type }));
  const lines = preview.items
    .map((i) => `• ${i.qty}× ${esc(i.name)} — ${rupiah(i.lineTotal)}`)
    .join('\n');

  const summaryText = `
<b>RINGKASAN PESANAN</b>
━━━━━━━━━━━━━━━━━━
<b>Tipe:</b> ${type === 'DINE_IN' ? `Dine-in ${tableNo ? `(Meja ${esc(tableNo)})` : ''}` : 'Take-away'}
<b>Pelanggan:</b> ${esc(customerName || 'Tamu')}

<b>Rincian Menu:</b>
${lines}

Subtotal: ${rupiah(preview.subtotal)}
${preview.serviceFee > 0 ? `Service Fee: ${rupiah(preview.serviceFee)}\n` : ''}${preview.tax > 0 ? `Pajak PB1: ${rupiah(preview.tax)}\n` : ''}<b>TOTAL: ${rupiah(preview.total)}</b>
━━━━━━━━━━━━━━━━━━
Pilih metode pembayaran:
  `.trim();

  await ctx.reply(summaryText, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text('💵 Tunai (Lunas)', 'pay:CASH')
      .text('📱 QRIS (Lunas)', 'pay:QRIS')
      .row()
      .text('🏦 Transfer (Lunas)', 'pay:TRANSFER')
      .text('🕓 Open Bill', 'pay:OPEN')
      .row()
      .text('❌ Batalkan', 'pay:CANCEL'),
  });

  const payCtx = await conversation.waitForCallbackQuery(/^pay:(CASH|QRIS|TRANSFER|OPEN|CANCEL)$/);
  await payCtx.answerCallbackQuery();
  const payment = payCtx.callbackQuery.data.split(':')[1];

  if (payment === 'CANCEL') {
    return ctx.reply('Pesanan dibatalkan.');
  }

  // 6) Simpan Pesanan
  const order = await conversation.external(() =>
    orderService.createFromBot({
      cashierId: user.id,
      shiftId: shift.id,
      items: cart,
      type,
      payment,
      tableNo,
      customerName,
    })
  );

  await ctx.reply(
    `✅ <b>Pesanan Berhasil Disimpan!</b>\nInvoice: <b>${esc(order.invoiceNo)}</b>\nTotal: <b>${rupiah(order.total)}</b>\nStatus: <b>${order.status}</b>${payment === 'OPEN' ? '\n<i>(Tagihan Open Bill tersimpan di POS)</i>' : '\n<i>(Notifikasi antrean terkirim ke Barista/Kitchen)</i>'}`,
    { parse_mode: 'HTML' }
  );
}
