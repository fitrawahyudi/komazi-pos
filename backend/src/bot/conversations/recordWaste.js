import { InlineKeyboard } from 'grammy';
import { getBotUser } from '../context.js';
import { stockService } from '../../services/stock.service.js';
import { rupiah, esc } from '../utils/format.js';
import { logBotAudit } from '../middlewares/audit.js';

export async function recordWasteConv(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun belum tertaut.');

  // Ekstrak preselected ingredient ID jika conversation dipicu dari tombol [ Catat Waste ] pada detail bahan
  const initialData = await conversation.external(() => {
    const cbData = ctx.callbackQuery?.data || '';
    const match = cbData.match(/^go:waste_for:(\d+)$/);
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
      unit: i.unit,
      costPerUnit: Number(i.costPerUnit || 0),
    }));
  });

  if (!ingredients || ingredients.length === 0) {
    return ctx.reply('⚠️ Belum ada data bahan baku yang terdaftar di sistem.');
  }

  let ingredient = null;
  if (initialData.preselectedId) {
    ingredient = ingredients.find((i) => i.id === initialData.preselectedId);
  }

  // 1) Pilih Bahan Baku jika belum dipilih
  if (!ingredient) {
    const kbIng = new InlineKeyboard();
    ingredients.slice(0, 10).forEach((item) => {
      kbIng.text(`${item.name} (${item.stock} ${item.unit})`, `waste_ing:${item.id}`).row();
    });
    kbIng.text('❌ Batal', 'waste:cancel');

    await ctx.reply(
      `🗑️ <b>PENCATATAN BAHAN TERBUANG (WASTE)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Pilih bahan baku yang terbuang/tumpah/kalibrasi:\n` +
      `• Klik tombol di bawah, atau ketik nama bahan.\n\n` +
      `<i>(Ketik /batal untuk membatalkan)</i>`,
      { parse_mode: 'HTML', reply_markup: kbIng }
    );

    while (!ingredient) {
      const input = await conversation.waitFor(['message:text', 'callback_query:data']);
      if (input.callbackQuery) {
        await input.answerCallbackQuery().catch(() => {});
        const data = input.callbackQuery.data;
        if (data === 'waste:cancel') {
          return input.editMessageText('❌ Pencatatan waste dibatalkan.');
        }
        const match = data.match(/^waste_ing:(\d+)$/);
        if (match) {
          const selectedId = Number(match[1]);
          ingredient = ingredients.find((i) => i.id === selectedId);
        }
      } else if (input.message?.text) {
        const text = input.message.text.trim();
        if (text.startsWith('/batal')) {
          return input.reply('❌ Pencatatan waste dibatalkan.');
        }
        const found = ingredients.find((i) => i.name.toLowerCase().includes(text.toLowerCase()));
        if (found) {
          ingredient = found;
        } else {
          await input.reply('⚠️ Bahan tidak ditemukan. Silakan pilih tombol atau ketik nama bahan yang tepat:');
        }
      }
    }
  }

  // 2) Minta Jumlah Qty Terbuang
  await ctx.reply(
    `🗑️ <b>Bahan Terpilih:</b> <b>${esc(ingredient.name)}</b>\n` +
    `• Stok saat ini: <b>${ingredient.stock} ${ingredient.unit}</b>\n` +
    `• Estimasi Modal: <b>${rupiah(ingredient.costPerUnit)} / ${ingredient.unit}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Masukkan jumlah bahan yang terbuang (contoh: <code>0.2</code> atau <code>1.5</code>):\n\n` +
    `<i>(Ketik /batal untuk membatalkan)</i>`,
    { parse_mode: 'HTML' }
  );

  let qty = null;
  while (qty === null) {
    const qtyInput = await conversation.waitFor('message:text');
    const text = qtyInput.message.text.trim();
    if (text.startsWith('/batal')) {
      return qtyInput.reply('❌ Pencatatan waste dibatalkan.');
    }
    const num = parseFloat(text.replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      qty = num;
    } else {
      await qtyInput.reply('⚠️ Masukkan angka jumlah yang valid dan lebih dari 0:');
    }
  }

  // 3) Pilih Alasan Terbuang
  const kbReason = new InlineKeyboard()
    .text('☕ Kalibrasi Grinder / Espresso', 'wr:Kalibrasi Grinder').row()
    .text('⌛ Basi / Kadaluwarsa', 'wr:Basi / Kadaluwarsa').row()
    .text('💦 Tumpah / Jatuh di Bar', 'wr:Tumpah di Bar').row()
    .text('❌ Salah Racik / Human Error', 'wr:Salah Racik').row()
    .text('📦 Rusak / Cacat Kemasan', 'wr:Rusak / Cacat Kemasan').row()
    .text('❌ Batal', 'wr:cancel');

  await ctx.reply(
    `📋 <b>Pilih Alasan Terbuang / Waste:</b>\n` +
    `• Klik salah satu opsi di bawah, ATAU ketik alasan kustom Anda langsung:`,
    { parse_mode: 'HTML', reply_markup: kbReason }
  );

  let reason = null;
  while (!reason) {
    const reasonInput = await conversation.waitFor(['message:text', 'callback_query:data']);
    if (reasonInput.callbackQuery) {
      await reasonInput.answerCallbackQuery().catch(() => {});
      const data = reasonInput.callbackQuery.data;
      if (data === 'wr:cancel') {
        return reasonInput.editMessageText('❌ Pencatatan waste dibatalkan.');
      }
      const match = data.match(/^wr:(.+)$/);
      if (match) {
        reason = match[1];
      }
    } else if (reasonInput.message?.text) {
      const text = reasonInput.message.text.trim();
      if (text.startsWith('/batal')) {
        return reasonInput.reply('❌ Pencatatan waste dibatalkan.');
      }
      reason = text;
    }
  }

  // 4) Eksekusi simpan waste
  const estCost = Math.round(qty * ingredient.costPerUnit);
  try {
    const result = await conversation.external(async () => {
      return stockService.recordWaste({
        ingredientId: ingredient.id,
        qty,
        reason,
        recordedBy: user.name || 'Staff Bot',
      });
    });

    await logBotAudit(user.id, 'RECORD_WASTE', {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      qty,
      reason,
      totalCost: estCost,
    });

    const successMsg = `
✅ <b>PENCATATAN WASTE BERHASIL DISIMPAN</b>
━━━━━━━━━━━━━━━━━━━━━━
• Bahan: <b>${esc(ingredient.name)}</b>
• Jumlah Terbuang: <b>${qty} ${ingredient.unit}</b>
• Alasan: <i>${esc(reason)}</i>
• Kerugian Biaya: <b>${rupiah(estCost)}</b>
• Sisa Stok Terkini: <b>${result.ingredient.stock} ${ingredient.unit}</b>
• Dicatat Oleh: <b>${esc(user.name)}</b>
━━━━━━━━━━━━━━━━━━━━━━
<i>Data waste otomatis masuk ke rekonsiliasi Laba Rugi (/profit).</i>
    `.trim();

    return ctx.reply(successMsg, { parse_mode: 'HTML' });
  } catch (err) {
    return ctx.reply(`❌ Gagal menyimpan waste: ${err.message}`);
  }
}
