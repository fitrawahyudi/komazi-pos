import { InlineKeyboard } from 'grammy';
import { getBotUser } from '../context.js';
import { stockService } from '../../services/stock.service.js';
import { rupiah, esc } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';

export async function stockIn(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun belum tertaut.');

  const ingredients = await conversation.external(() => stockService.listAll());
  if (!ingredients || ingredients.length === 0) {
    return ctx.reply('Belum ada data bahan baku di inventaris POS.');
  }

  // 1) Pilih Bahan
  const kbIng = new InlineKeyboard();
  ingredients.slice(0, 15).forEach((item) => {
    kbIng.text(`${item.name} (Sisa: ${item.stock} ${item.unit})`, `stk:${item.id}`).row();
  });
  kbIng.text('❌ Batal', 'stk:cancel');

  await ctx.reply('📦 <b>Pilih Bahan Baku yang Masuk:</b>', {
    parse_mode: 'HTML',
    reply_markup: kbIng,
  });

  const ingCtx = await conversation.waitForCallbackQuery(/^(stk:\d+|stk:cancel)$/);
  await ingCtx.answerCallbackQuery();
  if (ingCtx.callbackQuery.data === 'stk:cancel') {
    return ctx.reply('Pencatatan stok masuk dibatalkan.');
  }

  const ingId = Number(ingCtx.callbackQuery.data.split(':')[1]);
  const ingredient = ingredients.find((i) => i.id === ingId);
  if (!ingredient) return ctx.reply('Bahan tidak ditemukan.');

  // 2) Jumlah Masuk
  await ctx.reply(
    `Masukkan jumlah stok <b>${esc(ingredient.name)}</b> yang masuk dalam satuan <b>${esc(ingredient.unit)}</b>:\n<i>(Contoh: 5 atau 2.5)</i>`,
    { parse_mode: 'HTML' }
  );

  let qty;
  while (true) {
    const { message } = await conversation.waitFor('message:text');
    qty = parseFloat((message.text || '').replace(',', '.'));
    if (!isNaN(qty) && qty > 0) break;
    await ctx.reply('Jumlah tidak valid. Masukkan angka positif lebih dari 0:');
  }

  // 3) Harga Beli per Unit (Opsional)
  await ctx.reply(
    `Harga beli per ${esc(ingredient.unit)} (ketik <code>-</code> jika menggunakan harga standar ${rupiah(ingredient.costPerUnit)}):`,
    { parse_mode: 'HTML' }
  );
  const costMsg = await conversation.waitFor('message:text');
  let unitCost = null;
  if (costMsg.message.text.trim() !== '-') {
    const parsedCost = parseFloat(costMsg.message.text.replace(/\D/g, ''));
    if (!isNaN(parsedCost) && parsedCost > 0) {
      unitCost = parsedCost;
    }
  }

  // 4) Catatan
  await ctx.reply('Catatan penerimaan barang / nama supplier (ketik <code>-</code> jika tidak ada):', {
    parse_mode: 'HTML',
  });
  const noteMsg = await conversation.waitFor('message:text');
  const note = noteMsg.message.text.trim() === '-' ? `Stok Masuk via Bot oleh ${user.name}` : noteMsg.message.text.trim();

  try {
    const res = await conversation.external(() =>
      stockService.recordStockIn({
        ingredientId: ingId,
        qty,
        unitCost,
        note,
      })
    );

    await conversation.external(() =>
      logBotAudit(user.id, 'STOCK_IN', {
        ingredientId: ingId,
        ingredientName: ingredient.name,
        qty,
        unit: ingredient.unit,
      })
    );

    await ctx.reply(
      `✅ <b>Stok Masuk Berhasil Dicatat!</b>\n━━━━━━━━━━━━━━━━━━\nBahan: <b>${esc(res.ingredient.name)}</b>\nJumlah Masuk: +${qty} ${res.ingredient.unit}\nTotal Stok Baru: <b>${res.ingredient.stock} ${res.ingredient.unit}</b>\nCatatan: <i>${esc(note)}</i>\n━━━━━━━━━━━━━━━━━━`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    await ctx.reply(`❌ Gagal mencatat stok masuk: ${err.message}`);
  }
}
