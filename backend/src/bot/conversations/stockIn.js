import { InlineKeyboard } from 'grammy';
import { getBotUser } from '../context.js';
import { stockService } from '../../services/stock.service.js';
import { rupiah, esc } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback } from '../utils/sendVisual.js';

export async function stockIn(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun belum tertaut.');

  // Ekstrak preselected ingredient ID jika conversation dipicu dari tombol [ Catat Stok Masuk ] pada detail bahan
  const initialData = await conversation.external(() => {
    const cbData = ctx.callbackQuery?.data || '';
    const match = cbData.match(/^go:stock_in_for:(\d+)$/);
    return {
      preselectedId: match ? Number(match[1]) : null,
    };
  });

  const ingredients = await conversation.external(async () => {
    const list = await stockService.listAll();
    return (list || []).map((i) => ({
      id: i.id,
      name: i.name,
      stock: Number(i.stock),
      minStock: Number(i.minStock || 0),
      unit: i.unit,
      costPerUnit: Number(i.costPerUnit || 0),
    }));
  });

  if (!ingredients || ingredients.length === 0) {
    return ctx.reply('⚠️ Belum ada data bahan baku yang terdaftar di sistem.');
  }

  let ingredient = null;
  let ingId = null;

  if (initialData.preselectedId) {
    ingredient = ingredients.find((i) => i.id === initialData.preselectedId);
    if (ingredient) {
      ingId = ingredient.id;
    }
  }

  // 1) Jika belum ada bahan yang dipilih (misal dipanggil via perintah /stok_masuk)
  if (!ingredient) {
    const sorted = [...ingredients].sort((a, b) => {
      const aLow = a.stock <= a.minStock;
      const bLow = b.stock <= b.minStock;
      if (aLow && !bLow) return -1;
      if (!aLow && bLow) return 1;
      return a.name.localeCompare(b.name);
    });

    const kbIng = new InlineKeyboard();
    sorted.slice(0, 8).forEach((item) => {
      const isLow = item.stock <= item.minStock;
      const icon = isLow ? '⚠️' : '🟢';
      kbIng.text(`${icon} ${item.name} (${item.stock} ${item.unit})`, `stk:${item.id}`).row();
    });
    kbIng.text('❌ Batal', 'stk:cancel');

    await ctx.reply(
      `📦 <b>Pencatatan Stok Masuk</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Silakan pilih bahan baku yang masuk:\n` +
      `• <b>Klik tombol bahan</b> di bawah, ATAU\n` +
      `• <b>Ketik nama bahan</b> (contoh: <code>Susu</code> atau <code>Sirup</code>), ATAU\n` +
      `• <b>Ketik nomor ID</b> bahan baku.\n\n` +
      `<i>(Ketik /batal untuk membatalkan)</i>`,
      { parse_mode: 'HTML', reply_markup: kbIng }
    );

    while (!ingredient) {
      const input = await conversation.waitFor(['message:text', 'callback_query:data']);
      if (input.callbackQuery) {
        await input.answerCallbackQuery().catch(() => {});
        if (input.callbackQuery.data === 'stk:cancel') {
          return ctx.reply('Pencatatan stok masuk dibatalkan.');
        }
        if (input.callbackQuery.data.startsWith('stk:')) {
          const selectedId = Number(input.callbackQuery.data.split(':')[1]);
          const found = ingredients.find((i) => i.id === selectedId);
          if (found) {
            ingredient = found;
            ingId = found.id;
            break;
          }
        }
      }

      if (input.message?.text) {
        const text = input.message.text.trim();
        if (text.toLowerCase() === '/batal' || text.toLowerCase() === 'batal') {
          return ctx.reply('Pencatatan stok masuk dibatalkan.');
        }

        const numId = Number(text);
        if (!isNaN(numId) && numId > 0) {
          const foundById = ingredients.find((i) => i.id === numId);
          if (foundById) {
            ingredient = foundById;
            ingId = foundById.id;
            break;
          }
        }

        const query = text.toLowerCase();
        const matches = ingredients.filter((i) => i.name.toLowerCase().includes(query));
        if (matches.length === 1) {
          ingredient = matches[0];
          ingId = matches[0].id;
          break;
        } else if (matches.length > 1) {
          const kbMatch = new InlineKeyboard();
          matches.slice(0, 8).forEach((m) => {
            const isLow = m.stock <= m.minStock;
            const icon = isLow ? '⚠️' : '🟢';
            kbMatch.text(`${icon} ${m.name} (${m.stock} ${m.unit})`, `stk:${m.id}`).row();
          });
          kbMatch.text('❌ Batal', 'stk:cancel');
          await ctx.reply(
            `Ditemukan <b>${matches.length} bahan</b> dengan kata kunci "<i>${esc(text)}</i>":\n` +
            `Silakan klik salah satu bahan di bawah atau ketik nama yang lebih spesifik:`,
            { parse_mode: 'HTML', reply_markup: kbMatch }
          );
        } else {
          await ctx.reply(
            `Bahan dengan kata kunci "<i>${esc(text)}</i>" tidak ditemukan.\n` +
            `Silakan coba ketik nama bahan lain atau ketik /batal:`,
            { parse_mode: 'HTML' }
          );
        }
      }
    }
  }

  // 2) Input Jumlah Stok Masuk
  const kbCancel = new InlineKeyboard().text('❌ Batal', 'stk:cancel');
  const isLow = ingredient.stock <= ingredient.minStock;
  const statusIcon = isLow ? '⚠️' : '🟢';

  await ctx.reply(
    `📥 <b>Pencatatan Stok Masuk: ${esc(ingredient.name)}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Sisa Stok Saat Ini: <b>${ingredient.stock} ${ingredient.unit}</b> ${statusIcon}\n` +
    `• Batas Minimum: ${ingredient.minStock} ${ingredient.unit}\n` +
    `• Estimasi Biaya/Satuan: ${rupiah(ingredient.costPerUnit)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Masukkan jumlah stok <b>${esc(ingredient.name)}</b> yang masuk dalam satuan <b>${esc(ingredient.unit)}</b>:\n` +
    `<i>(Ketik angka, contoh: 10 atau 2.5 — atau ketik /batal untuk membatalkan)</i>`,
    { parse_mode: 'HTML', reply_markup: kbCancel }
  );

  let qty;
  while (true) {
    const input = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (input.callbackQuery) {
      await input.answerCallbackQuery().catch(() => {});
      if (input.callbackQuery.data === 'stk:cancel') {
        return ctx.reply('Pencatatan stok masuk dibatalkan.');
      }
      continue;
    }
    const text = (input.message?.text || '').trim();
    if (text.toLowerCase() === '/batal' || text.toLowerCase() === 'batal') {
      return ctx.reply('Pencatatan stok masuk dibatalkan.');
    }
    qty = parseFloat(text.replace(',', '.'));
    if (!isNaN(qty) && qty > 0) break;
    await ctx.reply(
      'Jumlah tidak valid. Masukkan angka positif lebih dari 0 (contoh: 10 atau 2.5 — atau ketik /batal):',
      { reply_markup: kbCancel }
    );
  }

  // 3) Harga Beli per Unit (Opsional)
  await ctx.reply(
    `💵 <b>Harga Beli per ${esc(ingredient.unit)}:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Ketik harga beli satuan baru (contoh: <code>15000</code>)\n` +
    `• Atau ketik <code>-</code> untuk menggunakan harga standar (${rupiah(ingredient.costPerUnit)})\n` +
    `• Atau ketik /batal untuk membatalkan:`,
    { parse_mode: 'HTML', reply_markup: kbCancel }
  );

  let unitCost = null;
  while (true) {
    const input = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (input.callbackQuery) {
      await input.answerCallbackQuery().catch(() => {});
      if (input.callbackQuery.data === 'stk:cancel') {
        return ctx.reply('Pencatatan stok masuk dibatalkan.');
      }
      continue;
    }
    const text = (input.message?.text || '').trim();
    if (text.toLowerCase() === '/batal' || text.toLowerCase() === 'batal') {
      return ctx.reply('Pencatatan stok masuk dibatalkan.');
    }
    if (text === '-') {
      unitCost = null;
      break;
    }
    const parsedCost = parseFloat(text.replace(/\D/g, ''));
    if (!isNaN(parsedCost) && parsedCost > 0) {
      unitCost = parsedCost;
      break;
    }
    await ctx.reply(
      'Format harga tidak valid. Masukkan angka nominal rupiah (contoh: 15000), tanda `-`, atau ketik /batal:',
      { reply_markup: kbCancel }
    );
  }

  // 4) Catatan Penerimaan / Supplier (Opsional)
  await ctx.reply(
    `📝 <b>Catatan Penerimaan / Supplier:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `• Ketik nama supplier atau nomor faktur (contoh: <code>Toko Jaya Abadi / Faktur #45</code>)\n` +
    `• Atau ketik <code>-</code> jika tidak ada catatan khusus\n` +
    `• Atau ketik /batal untuk membatalkan:`,
    { parse_mode: 'HTML', reply_markup: kbCancel }
  );

  let note = `Stok Masuk via Bot oleh ${user.name}`;
  while (true) {
    const input = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (input.callbackQuery) {
      await input.answerCallbackQuery().catch(() => {});
      if (input.callbackQuery.data === 'stk:cancel') {
        return ctx.reply('Pencatatan stok masuk dibatalkan.');
      }
      continue;
    }
    const text = (input.message?.text || '').trim();
    if (text.toLowerCase() === '/batal' || text.toLowerCase() === 'batal') {
      return ctx.reply('Pencatatan stok masuk dibatalkan.');
    }
    if (text !== '-') {
      note = text;
    }
    break;
  }

  // 5) Simpan Transaksi Stok Masuk & Buat Kartu Tanda Penerimaan Barang
  try {
    const res = await conversation.external(async () => {
      const r = await stockService.recordStockIn({
        ingredientId: ingId,
        qty,
        unitCost,
        note,
      });
      return {
        ingredient: {
          name: r.ingredient.name,
          unit: r.ingredient.unit,
          stock: Number(r.ingredient.stock),
        },
      };
    });

    await conversation.external(() =>
      logBotAudit(user.id, 'STOCK_IN', {
        ingredientId: ingId,
        ingredientName: ingredient.name,
        qty,
        unit: ingredient.unit,
      })
    );

    const doneCaption = `✅ <b>Stok Masuk Berhasil Dicatat!</b>\n━━━━━━━━━━━━━━━━━━\nBahan: <b>${esc(res.ingredient.name)}</b>\nJumlah Masuk: +${qty} ${res.ingredient.unit}\nTotal Stok Baru: <b>${res.ingredient.stock} ${res.ingredient.unit}</b>\nCatatan: <i>${esc(note)}</i>\n━━━━━━━━━━━━━━━━━━`;

    await replyWithPhotoFallback(ctx, {
      imageBufferPromise: generateBotImage('goods_receipt', {
        ingredientName: res.ingredient.name,
        qtyAdded: qty,
        unit: res.ingredient.unit,
        newStock: res.ingredient.stock,
        cost: unitCost ? unitCost * qty : (ingredient.costPerUnit || 0) * qty,
        supplier: note,
        recordedBy: user.name,
      }),
      captionHtml: doneCaption,
    });
  } catch (err) {
    await ctx.reply(`❌ Gagal mencatat stok masuk: ${err.message}`);
  }
}
