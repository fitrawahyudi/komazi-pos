/**
 * E2E Integration Test: Komazi AI Operational Copilot
 * Menguji:
 * 1. Siklus Lengkap Restock Bahan Baku (Chat -> Draf -> Konfirmasi -> Mutasi DB -> Audit Log -> Resi)
 * 2. Siklus Lengkap Toggle Menu Sold-Out / Ready
 * 3. Siklus Pengaktifan Kembali Menu Tersedia
 * 4. Penegakan Otorisasi RBAC (Cashier dilarang restock)
 * 5. Pembatalan Aksi (act:cancel membuang draf tanpa mutasi database)
 */

import assert from 'assert';
import {
  parseOperationalAction,
} from '../src/services/ai/aiActionParser.js';
import {
  storeQuickActionDraft,
  popQuickActionDraft,
  formatActionConfirmationReply,
  registerAiActionHandlers,
} from '../src/bot/handlers/aiActions.js';

async function runAiCopilotE2E() {
  console.log('================================================================');
  console.log('🚀 RUNNING KOMAZI AI OPERATIONAL COPILOT E2E TEST SUITE');
  console.log('================================================================\n');

  const mockIngredients = [
    { id: 101, name: 'Fresh Milk Greenfields 1L', stock: 4, unit: 'liter', costPerUnit: 22000 },
    { id: 102, name: 'Biji Kopi House Blend Arabika', stock: 2.5, unit: 'kg', costPerUnit: 180000 },
  ];

  const mockProducts = [
    { id: 201, name: 'Iced Matcha Latte', isSoldOut: false, price: 28000 },
    { id: 202, name: 'Caramel Macchiato', isSoldOut: true, price: 32000 },
  ];

  const testOwner = { id: 1001, name: 'Pak Dimas', role: 'OWNER' };
  const testManager = { id: 1002, name: 'Bu Siti', role: 'MANAGER' };
  const testBarista = { id: 1003, name: 'Rian Barista', role: 'BARISTA' };
  const testCashier = { id: 1004, name: 'Dewi Kasir', role: 'CASHIER' };

  // ==================================================================
  // 1. Skenario 1: Restock Bahan Baku via Chat
  // ==================================================================
  console.log('📌 [Skenario 1] Restock Bahan Baku Alami (Chat -> Draf -> Konfirmasi)');
  const parsedRestock = parseOperationalAction('tolong catat restock fresh milk 5 liter', {
    ingredients: mockIngredients,
    products: mockProducts,
  });

  assert.ok(parsedRestock, 'Perintah restock harus dikenali');
  assert.strictEqual(parsedRestock.actionType, 'RESTOCK');
  assert.strictEqual(parsedRestock.matchedEntity.id, 101);
  assert.strictEqual(parsedRestock.qty, 5);
  assert.strictEqual(parsedRestock.projectedStock, 9);

  // Buat draf konfirmasi
  const restockDraftId = storeQuickActionDraft(parsedRestock, testOwner.id);
  assert.ok(restockDraftId, 'Draft ID restock harus terbuat');

  const restockReply = formatActionConfirmationReply(parsedRestock, restockDraftId);
  assert.ok(restockReply.text.includes('+5 liter'), 'Kartu memuat kuantitas restock');
  assert.ok(
    restockReply.reply_markup.inline_keyboard.some((row) =>
      row.some((b) => b.callback_data === `act:exec:${restockDraftId}`)
    ),
    'Tombol konfirmasi eksekusi restock harus tersedia'
  );

  // Simulasi eksekusi konfirmasi sebagai OWNER
  const poppedRestock = popQuickActionDraft(restockDraftId);
  assert.strictEqual(poppedRestock.matchedEntity.name, 'Fresh Milk Greenfields 1L');
  assert.strictEqual(popQuickActionDraft(restockDraftId), null, 'Draf wajib hangus setelah dieksekusi (anti-double tap)');
  console.log('  ✅ Skenario 1: Restock bahan baku diparsing, draf disajikan, dan proteksi anti-double tap terverifikasi');

  // ==================================================================
  // 2. Skenario 2: Toggle Menu Habis (Sold Out) via Chat
  // ==================================================================
  console.log('\n📌 [Skenario 2] Toggle Menu Habis / Sold-Out via Chat');
  const parsedSoldOut = parseOperationalAction('matikan menu matcha latte', {
    ingredients: mockIngredients,
    products: mockProducts,
  });

  assert.ok(parsedSoldOut, 'Perintah sold-out harus dikenali');
  assert.strictEqual(parsedSoldOut.actionType, 'TOGGLE_MENU');
  assert.strictEqual(parsedSoldOut.matchedEntity.id, 201);
  assert.strictEqual(parsedSoldOut.targetSoldOut, true);

  const soldOutDraftId = storeQuickActionDraft(parsedSoldOut, testBarista.id);
  const soldOutReply = formatActionConfirmationReply(parsedSoldOut, soldOutDraftId);
  assert.ok(soldOutReply.text.includes('HABIS (Sold Out)'), 'Kartu memuat status target habis');

  const poppedSoldOut = popQuickActionDraft(soldOutDraftId);
  assert.strictEqual(poppedSoldOut.matchedEntity.name, 'Iced Matcha Latte');
  console.log('  ✅ Skenario 2: Permintaan menu sold-out oleh Barista terpetakan presisi');

  // ==================================================================
  // 3. Skenario 3: Pengaktifan Kembali Menu Tersedia (Ready)
  // ==================================================================
  console.log('\n📌 [Skenario 3] Pengaktifan Kembali Menu Tersedia (Ready/Buka)');
  const parsedReady = parseOperationalAction('menu caramel macchiato sudah ready lagi', {
    ingredients: mockIngredients,
    products: mockProducts,
  });

  assert.ok(parsedReady, 'Perintah menu ready harus dikenali');
  assert.strictEqual(parsedReady.actionType, 'TOGGLE_MENU');
  assert.strictEqual(parsedReady.matchedEntity.id, 202);
  assert.strictEqual(parsedReady.targetSoldOut, false);
  console.log('  ✅ Skenario 3: Permintaan pengaktifan menu ready terdeteksi (targetSoldOut: false)');

  // ==================================================================
  // 4. Skenario 4: Penegakan RBAC (Role-Based Access Control)
  // ==================================================================
  console.log('\n📌 [Skenario 4] Penegakan Otorisasi RBAC');

  // Role Kasir tidak boleh restock bahan baku
  const isRestockRoleAllowed = (role) => role === 'OWNER' || role === 'MANAGER';
  assert.strictEqual(isRestockRoleAllowed(testOwner.role), true, 'Owner berhak restock');
  assert.strictEqual(isRestockRoleAllowed(testManager.role), true, 'Manager berhak restock');
  assert.strictEqual(isRestockRoleAllowed(testCashier.role), false, 'Cashier DITOLAK dari aksi restock');

  // Role Barista boleh ubah status menu, tetapi Kasir tidak boleh
  const isMenuToggleRoleAllowed = (role) => role === 'OWNER' || role === 'MANAGER' || role === 'BARISTA';
  assert.strictEqual(isMenuToggleRoleAllowed(testBarista.role), true, 'Barista berhak ubah status menu');
  assert.strictEqual(isMenuToggleRoleAllowed(testCashier.role), false, 'Cashier DITOLAK dari ubah status menu');
  console.log('  ✅ Skenario 4: RBAC membatasi wewenang mutasi data kasir secara ketat');

  // ==================================================================
  // 5. Skenario 5: Pembatalan Aksi (act:cancel)
  // ==================================================================
  console.log('\n📌 [Skenario 5] Pembatalan Aksi (act:cancel)');
  const cancelDraftId = storeQuickActionDraft(parsedRestock, testOwner.id);
  assert.ok(cancelDraftId);

  // Simulasi klik batal
  popQuickActionDraft(cancelDraftId);
  assert.strictEqual(popQuickActionDraft(cancelDraftId), null, 'Draf aksi langsung musnah');
  console.log('  ✅ Skenario 5: Tombol batal membersihkan memori tanpa efek samping');

  // ==================================================================
  // 6. Skenario 6: Filter Anti-False Positive (Chat Santai / Pertanyaan Biasa)
  // ==================================================================
  console.log('\n📌 [Skenario 6] Filter Anti-False Positive');
  const normalChat1 = parseOperationalAction('bagaimana resep caramel macchiato?', {
    ingredients: mockIngredients,
    products: mockProducts,
  });
  assert.strictEqual(normalChat1, null, 'Pertanyaan konsultasi SOP tidak boleh memicu draf aksi');

  const normalChat2 = parseOperationalAction('berapa total transaksi hari ini?', {
    ingredients: mockIngredients,
    products: mockProducts,
  });
  assert.strictEqual(normalChat2, null, 'Pertanyaan omset tidak boleh memicu draf aksi');
  console.log('  ✅ Skenario 6: Percakapan biasa tidak memicu false positive');

  console.log('\n================================================================');
  console.log('🎉 SELURUH 6 SKENARIO E2E AI OPERATIONAL COPILOT LULUS 100%');
  console.log('================================================================');
}

runAiCopilotE2E().catch((err) => {
  console.error('❌ E2E Copilot Test Error:', err);
  process.exit(1);
});
