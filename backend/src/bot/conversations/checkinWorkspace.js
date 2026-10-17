import { InlineKeyboard } from 'grammy';
import { getBotUser } from '../context.js';
import { workspaceService } from '../../services/workspace.service.js';
import { rupiah, esc } from '../utils/format.js';
import { generateBotImage } from '../../services/botImage/index.js';
import { replyWithPhotoFallback } from '../utils/sendVisual.js';

export async function checkinWorkspace(conversation, ctx) {
  const user = await getBotUser(conversation, ctx);
  if (!user) return ctx.reply('Akun belum tertaut.');

  const areas = await conversation.external(() => workspaceService.listAvailableAreas());
  if (!areas || areas.length === 0) {
    return ctx.reply('⚠️ Semua meja/area workspace saat ini sedang penuh.');
  }

  // 1) Pilih Area
  const kbArea = new InlineKeyboard();
  areas.forEach((a) => kbArea.text(`🟢 ${a.name} (Kap: ${a.capacity})`, `area:${a.id}`).row());
  kbArea.text('❌ Batal', 'ws:cancel');

  await ctx.reply('💻 <b>Pilih Area Workspace Kosong:</b>', {
    parse_mode: 'HTML',
    reply_markup: kbArea,
  });

  const areaCtx = await conversation.waitForCallbackQuery(/^(area:\d+|ws:cancel)$/);
  await areaCtx.answerCallbackQuery();
  if (areaCtx.callbackQuery.data === 'ws:cancel') {
    return ctx.reply('Check-in workspace dibatalkan.');
  }
  const areaId = Number(areaCtx.callbackQuery.data.split(':')[1]);
  const area = areas.find((a) => a.id === areaId);

  // 2) Pilih Paket
  const packages = await conversation.external(async () => {
    const list = await workspaceService.listPackages();
    return (list || []).map((p) => ({
      id: p.id,
      name: p.name,
      durationMin: p.durationMin,
      price: Number(p.price),
    }));
  });
  if (!packages || packages.length === 0) {
    return ctx.reply('Belum ada paket workspace yang aktif.');
  }

  const kbPkg = new InlineKeyboard();
  packages.forEach((p) => {
    kbPkg.text(`${p.name} (${p.durationMin} mnt · ${rupiah(p.price)})`, `pkg:${p.id}`).row();
  });
  kbPkg.text('❌ Batal', 'ws:cancel');

  await ctx.reply('⏱ <b>Pilih Paket Durasi Workspace:</b>', {
    parse_mode: 'HTML',
    reply_markup: kbPkg,
  });

  const pkgCtx = await conversation.waitForCallbackQuery(/^(pkg:\d+|ws:cancel)$/);
  await pkgCtx.answerCallbackQuery();
  if (pkgCtx.callbackQuery.data === 'ws:cancel') {
    return ctx.reply('Check-in workspace dibatalkan.');
  }
  const packageId = Number(pkgCtx.callbackQuery.data.split(':')[1]);

  // 3) Nama Pelanggan
  await ctx.reply('Nama tamu / pelanggan workspace:');
  const nameMsg = await conversation.waitFor('message:text');
  const customerName = nameMsg.message.text.trim();

  // 4) Nomor Telepon
  await ctx.reply('Nomor WhatsApp / telepon tamu (atau ketik <code>-</code> jika tidak diisi):', {
    parse_mode: 'HTML',
  });
  const phoneMsg = await conversation.waitFor('message:text');
  const phone = phoneMsg.message.text.trim() === '-' ? null : phoneMsg.message.text.trim();

  try {
    const session = await conversation.external(async () => {
      const s = await workspaceService.checkIn({
        areaId,
        packageId,
        customerName,
        phone,
      });
      return {
        customerName: s.customerName,
        endsAtLabel: s.endsAtLabel,
        area: s.area ? { name: s.area.name } : null,
        package: s.package ? {
          name: s.package.name,
          durationMin: s.package.durationMin,
          price: Number(s.package.price),
        } : null,
      };
    });

    const caption = `✅ <b>Check-in Workspace Berhasil!</b>\n━━━━━━━━━━━━━━━━━━\nArea: <b>${esc(session.area?.name || area.name)}</b>\nPelanggan: <b>${esc(session.customerName)}</b>\nPaket: <b>${esc(session.package?.name)}</b>\nDurasi: ${session.package?.durationMin} Menit\nJam Berakhir: <b>${session.endsAtLabel} WIB</b>\nTarif: ${rupiah(session.package?.price)}\n━━━━━━━━━━━━━━━━━━\n<i>Timer sesi berjalan otomatis di POS.</i>`;

    await replyWithPhotoFallback(ctx, {
      imageBufferPromise: generateBotImage('workspace_pass', {
        customerName: session.customerName,
        areaName: session.area?.name || area.name,
        package: session.package,
        endsAtLabel: session.endsAtLabel,
      }),
      captionHtml: caption,
    });
  } catch (err) {
    await ctx.reply(`❌ Gagal check-in workspace: ${err.message}`);
  }
}
