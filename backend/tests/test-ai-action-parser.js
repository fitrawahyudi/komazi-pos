import assert from 'assert';
import {
  normalizeEntityString,
  calculateEntityMatchScore,
  findBestIngredientMatch,
  findBestProductMatch,
  parseRestockCommand,
  parseMenuAvailabilityCommand,
  parseOperationalAction,
} from '../src/services/ai/aiActionParser.js';

async function testAiActionParser() {
  console.log('======================================================');
  console.log('🧪 TESTING OPERATIONAL AI ACTION PARSER');
  console.log('======================================================\n');

  const mockIngredients = [
    { id: 101, name: 'Fresh Milk Greenfields 1L', stock: 4, unit: 'liter', costPerUnit: 22000 },
    { id: 102, name: 'Biji Kopi House Blend Arabika', stock: 2.5, unit: 'kg', costPerUnit: 180000 },
    { id: 103, name: 'Sirup Karamel Monin', stock: 1, unit: 'botol', costPerUnit: 135000 },
    { id: 104, name: 'Bubuk Matcha Uji Premium', stock: 500, unit: 'gram', costPerUnit: 450 },
  ];

  const mockProducts = [
    { id: 201, name: 'Iced Matcha Latte', isSoldOut: false, price: 28000 },
    { id: 202, name: 'Caramel Macchiato', isSoldOut: true, price: 32000 },
    { id: 203, name: 'Espresso Double Shot', isSoldOut: false, price: 18000 },
    { id: 204, name: 'Croissant Butter Original', isSoldOut: false, price: 22000 },
  ];

  // 1. Uji Normalisasi & Entity Match Score
  console.log('📌 [Test 1] Normalisasi & Skoring Kemiripan Entitas');
  assert.strictEqual(normalizeEntityString('  Fresh Milk (Greenfields)!  '), 'fresh milk greenfields');
  const scoreExact = calculateEntityMatchScore('fresh milk', 'Fresh Milk Greenfields 1L');
  assert.ok(scoreExact >= 80, `Skor kemiripan harus tinggi (dapat: ${scoreExact})`);
  console.log('  ✅ Normalisasi dan skoring kemiripan string akurat');

  // 2. Uji Pencocokan Entitas Terbaik (Best Match)
  console.log('\n📌 [Test 2] Pencarian Entitas Bahan & Produk');
  const matchIng = findBestIngredientMatch('susu fresh milk', mockIngredients);
  assert.ok(matchIng && matchIng.entity.id === 101, 'Susu fresh milk harus mencocokkan Fresh Milk Greenfields');

  const matchProd = findBestProductMatch('matcha latte', mockProducts);
  assert.ok(matchProd && matchProd.entity.id === 201, 'Matcha latte harus mencocokkan Iced Matcha Latte');
  console.log('  ✅ Pencocokan entitas master bahan dan produk sukses');

  // 3. Uji Parsing Perintah Restock Bahan Baku
  console.log('\n📌 [Test 3] Ekstraksi Perintah Restock Bahan Baku');

  // Kasus A: "catat restock fresh milk 5 liter"
  const restock1 = parseRestockCommand('catat restock fresh milk 5 liter', mockIngredients);
  assert.ok(restock1 && restock1.intent === 'RESTOCK_INGREDIENT');
  assert.strictEqual(restock1.matchedEntity.id, 101);
  assert.strictEqual(restock1.qty, 5);
  assert.strictEqual(restock1.unit, 'liter');
  assert.strictEqual(restock1.projectedStock, 9);
  console.log('  ✅ Kasus A: "catat restock fresh milk 5 liter" -> qty 5, entity id 101');

  // Kasus B: "tambah stok 2.5 kg kopi arabika" (angka di depan)
  const restock2 = parseRestockCommand('tambah stok 2.5 kg kopi arabika', mockIngredients);
  assert.ok(restock2 && restock2.intent === 'RESTOCK_INGREDIENT');
  assert.strictEqual(restock2.matchedEntity.id, 102);
  assert.strictEqual(restock2.qty, 2.5);
  assert.strictEqual(restock2.projectedStock, 5);
  console.log('  ✅ Kasus B: "tambah stok 2.5 kg kopi arabika" -> qty 2.5, entity id 102');

  // Kasus C: "stok masuk sirup karamel 3 botol"
  const restock3 = parseRestockCommand('stok masuk sirup karamel 3 botol', mockIngredients);
  assert.ok(restock3 && restock3.intent === 'RESTOCK_INGREDIENT');
  assert.strictEqual(restock3.matchedEntity.id, 103);
  assert.strictEqual(restock3.qty, 3);
  assert.strictEqual(restock3.projectedStock, 4);
  console.log('  ✅ Kasus C: "stok masuk sirup karamel 3 botol" -> qty 3, entity id 103');

  // 4. Uji Parsing Perintah Status Menu (Sold Out / Ready)
  console.log('\n📌 [Test 4] Ekstraksi Perintah Status Ketersediaan Menu');

  // Kasus A: "matikan menu matcha latte"
  const menu1 = parseMenuAvailabilityCommand('matikan menu matcha latte', mockProducts);
  assert.ok(menu1 && menu1.intent === 'SET_MENU_AVAILABILITY');
  assert.strictEqual(menu1.matchedEntity.id, 201);
  assert.strictEqual(menu1.targetSoldOut, true);
  console.log('  ✅ Kasus A: "matikan menu matcha latte" -> targetSoldOut = true');

  // Kasus B: "tandai caramel macchiato sudah ready lagi"
  const menu2 = parseMenuAvailabilityCommand('tandai caramel macchiato sudah ready lagi', mockProducts);
  assert.ok(menu2 && menu2.intent === 'SET_MENU_AVAILABILITY');
  assert.strictEqual(menu2.matchedEntity.id, 202);
  assert.strictEqual(menu2.targetSoldOut, false);
  console.log('  ✅ Kasus B: "tandai caramel macchiato sudah ready lagi" -> targetSoldOut = false');

  // Kasus C: "menu croissant habis"
  const menu3 = parseMenuAvailabilityCommand('menu croissant habis', mockProducts);
  assert.ok(menu3 && menu3.intent === 'SET_MENU_AVAILABILITY');
  assert.strictEqual(menu3.matchedEntity.id, 204);
  assert.strictEqual(menu3.targetSoldOut, true);
  console.log('  ✅ Kasus C: "menu croissant habis" -> targetSoldOut = true');

  // 5. Uji Parser Utama Terpadu & Kalimat Non-Aksi
  console.log('\n📌 [Test 5] Universal Parser & Kalimat Non-Aksi');
  const actionRestock = parseOperationalAction('tolong catat restock bubuk matcha 250 gram', {
    ingredients: mockIngredients,
    products: mockProducts,
  });
  assert.ok(actionRestock && actionRestock.intent === 'RESTOCK_INGREDIENT');
  assert.strictEqual(actionRestock.matchedEntity.id, 104);
  assert.strictEqual(actionRestock.qty, 250);

  const nonAction1 = parseOperationalAction('berapa omset penjualan hari ini?', {
    ingredients: mockIngredients,
    products: mockProducts,
  });
  assert.strictEqual(nonAction1, null, 'Pertanyaan omset biasa tidak boleh dianggap perintah aksi');

  const nonAction2 = parseOperationalAction('siapa staf yang shift pagi hari ini?', {
    ingredients: mockIngredients,
    products: mockProducts,
  });
  assert.strictEqual(nonAction2, null, 'Pertanyaan shift biasa tidak boleh dianggap perintah aksi');

  console.log('  ✅ Universal parseOperationalAction memisahkan aksi nyata dan chat tanya-jawab biasa secara sempurna');

  console.log('\n======================================================');
  console.log('🎉 SELURUH PENGUJIAN ACTION PARSER 100% LULUS (PASS)');
  console.log('======================================================');
}

testAiActionParser().catch((err) => {
  console.error('❌ Action parser test error:', err);
  process.exit(1);
});
