import assert from 'assert';
import {
  storeQuickActionDraft,
  popQuickActionDraft,
  formatActionConfirmationReply,
} from '../src/bot/handlers/aiActions.js';

async function testAiActionHandler() {
  console.log('======================================================');
  console.log('🧪 TESTING AI ACTION HANDLER & DRAFT CONFIRM GUARD');
  console.log('======================================================\n');

  // 1. Uji Penyimpanan dan Pemanggilan Draf Aksi (Anti-Double Tap)
  console.log('📌 [Test 1] Siklus Hidup Draf Aksi (Single-Use Guard)');
  const mockDraft = {
    actionType: 'RESTOCK',
    qty: 5,
    unit: 'liter',
    currentStock: 4,
    projectedStock: 9,
    matchedEntity: { id: 101, name: 'Fresh Milk Greenfields 1L' },
  };

  const draftId = storeQuickActionDraft(mockDraft, 999);
  assert.ok(typeof draftId === 'string' && draftId.length >= 6, 'Draft ID harus berupa string acak minimal 6 karakter');

  const retrieved = popQuickActionDraft(draftId);
  assert.ok(retrieved && retrieved.qty === 5, 'Draf berhasil diambil');

  const emptyAfterPop = popQuickActionDraft(draftId);
  assert.strictEqual(emptyAfterPop, null, 'Draf wajib langsung terhapus setelah di-pop untuk mencegah eksekusi ganda');
  console.log('  ✅ Single-use draft storage beroperasi normal & aman dari double tap');

  // 2. Uji Pemformatan Kartu Konfirmasi Restock
  console.log('\n📌 [Test 2] Format Kartu Konfirmasi Restock Bahan');
  const restockCard = formatActionConfirmationReply(mockDraft, 'test123');
  assert.ok(restockCard.text.includes('KONFIRMASI STOK MASUK (RESTOCK)'), 'Judul kartu restock harus sesuai');
  assert.ok(restockCard.text.includes('Fresh Milk Greenfields 1L'), 'Harus menyertakan nama bahan');
  assert.ok(restockCard.text.includes('+5 liter'), 'Harus menyertakan jumlah masuk');
  assert.ok(restockCard.text.includes('9 liter'), 'Harus menyertakan proyeksi stok baru');

  const restockButtons = restockCard.reply_markup.inline_keyboard.flat();
  const execRestockBtn = restockButtons.find((b) => b.callback_data === 'act:exec:test123');
  const cancelRestockBtn = restockButtons.find((b) => b.callback_data === 'act:cancel:test123');
  assert.ok(execRestockBtn && execRestockBtn.text.includes('Ya, Catat Restock'), 'Tombol eksekusi restock harus ada');
  assert.ok(cancelRestockBtn && cancelRestockBtn.text.includes('Batal'), 'Tombol batal harus ada');
  console.log('  ✅ Kartu dan tombol konfirmasi restock terstruktur presisi');

  // 3. Uji Pemformatan Kartu Konfirmasi Toggle Menu (Sold Out)
  console.log('\n📌 [Test 3] Format Kartu Konfirmasi Status Menu (Sold Out)');
  const mockMenuDraft = {
    actionType: 'TOGGLE_MENU',
    targetSoldOut: true,
    matchedEntity: { id: 201, name: 'Iced Matcha Latte', isSoldOut: false },
  };

  const menuCard = formatActionConfirmationReply(mockMenuDraft, 'menu789');
  assert.ok(menuCard.text.includes('KONFIRMASI STATUS KETERSEDIAAN MENU'), 'Judul kartu status menu harus sesuai');
  assert.ok(menuCard.text.includes('Iced Matcha Latte'), 'Harus menyertakan nama menu');
  assert.ok(menuCard.text.includes('HABIS (Sold Out)'), 'Harus menyertakan status target sold-out');

  const menuButtons = menuCard.reply_markup.inline_keyboard.flat();
  const execMenuBtn = menuButtons.find((b) => b.callback_data === 'act:exec:menu789');
  assert.ok(execMenuBtn && execMenuBtn.text.includes('Tandai Menu Habis'), 'Tombol tandai habis harus ada');
  console.log('  ✅ Kartu dan tombol konfirmasi toggle menu terstruktur presisi');

  console.log('\n======================================================');
  console.log('🎉 SELURUH PENGUJIAN ACTION HANDLER 100% LULUS (PASS)');
  console.log('======================================================');
}

testAiActionHandler().catch((err) => {
  console.error('❌ Action handler test error:', err);
  process.exit(1);
});
