import assert from 'node:assert';
import {
  classifyIntent,
  resolveActionHint,
  composeUnifiedSystemPrompt,
  AI_INTENT_TYPES,
} from '../src/services/ai/aiPromptComposer.js';

console.log('🧪 Testing Multi-Domain Intent Classifier & Prompt Composer (Slice 3)...');

// 1. Test POS_MANUAL intent classification
const resPos1 = classifyIntent('Bagaimana cara split bill pesanan meja 3?');
assert.strictEqual(resPos1.intent, AI_INTENT_TYPES.POS_MANUAL);
assert.ok(resPos1.matchedSop, 'Should find matched SOP for split bill');

const resPos2 = classifyIntent('Kenapa printer thermal bluetooth tidak konek?');
assert.strictEqual(resPos2.intent, AI_INTENT_TYPES.POS_MANUAL);
assert.strictEqual(resPos2.matchedSop.id, 'thermal_printer');
console.log('   ✅ PASS [1]: POS_MANUAL inquiries correctly detected with matched SOP');

// 2. Test INVENTORY_RECIPE intent classification
const resRecipe1 = classifyIntent('Apa resep dan takaran Vanilla Latte?');
assert.strictEqual(resRecipe1.intent, AI_INTENT_TYPES.INVENTORY_RECIPE);

const resRecipe2 = classifyIntent('Bahan apa saja yang stoknya menipis kritis?');
assert.strictEqual(resRecipe2.intent, AI_INTENT_TYPES.INVENTORY_RECIPE);
console.log('   ✅ PASS [2]: INVENTORY_RECIPE inquiries correctly detected');

// 3. Test FINANCIAL_SALES intent classification
const resSales = classifyIntent('Berapa total omset hari ini dibanding kemarin?');
assert.strictEqual(resSales.intent, AI_INTENT_TYPES.FINANCIAL_SALES);
console.log('   ✅ PASS [3]: FINANCIAL_SALES inquiries correctly detected');

// 4. Test SHIFT_OPERATIONAL intent classification
const resShift = classifyIntent('Siapa kasir bertugas sekarang dan berapa modal awal kas?');
assert.strictEqual(resShift.intent, AI_INTENT_TYPES.SHIFT_OPERATIONAL);
console.log('   ✅ PASS [4]: SHIFT_OPERATIONAL inquiries correctly detected');

// 5. Test WORKSPACE intent classification
const resWs = classifyIntent('Berapa tamu yang sedang aktif di area workspace saat ini?');
assert.strictEqual(resWs.intent, AI_INTENT_TYPES.WORKSPACE);
console.log('   ✅ PASS [5]: WORKSPACE inquiries correctly detected');

// 6. Test REMINDER_SCHEDULER intent classification
const resReminder = classifyIntent('Ingatkan saya jam 14:00 untuk cek susu');
assert.strictEqual(resReminder.intent, AI_INTENT_TYPES.REMINDER_SCHEDULER);
console.log('   ✅ PASS [6]: REMINDER_SCHEDULER inquiries correctly detected');

// 7. Test CHITCHAT intent classification
const resChitchat = classifyIntent('Halo selamat siang Komazi');
assert.strictEqual(resChitchat.intent, AI_INTENT_TYPES.CHITCHAT);
console.log('   ✅ PASS [7]: CHITCHAT inquiries correctly detected');

// 8. Test Action Hint Resolution
const hintPrinter = resolveActionHint({
  intent: AI_INTENT_TYPES.POS_MANUAL,
  matchedSop: resPos2.matchedSop,
  query: 'printer bluetooth',
});
assert.strictEqual(hintPrinter.type, 'OPEN_MODAL');
assert.strictEqual(hintPrinter.targetModal, 'PRINTER_MODAL');

const hintStock = resolveActionHint({
  intent: AI_INTENT_TYPES.INVENTORY_RECIPE,
  query: 'stok bahan menipis',
});
assert.strictEqual(hintStock.type, 'NAVIGATE');
assert.strictEqual(hintStock.route, '/stock');
console.log('   ✅ PASS [8]: Interactive action hints resolved accurately');

// 9. Test Prompt Composer RBAC enforcement
const cashierPrompt = composeUnifiedSystemPrompt({
  user: { name: 'Siti', role: 'CASHIER' },
  userQuery: 'Berapa omset bulanan?',
  unifiedContext: { role: 'CASHIER', userName: 'Siti' },
  intent: AI_INTENT_TYPES.FINANCIAL_SALES,
});
assert.ok(cashierPrompt.includes('ZERO FINANCIAL LEAKAGE'), 'Cashier prompt must enforce zero financial leakage');
assert.ok(cashierPrompt.includes('Komazi AI'), 'Must include brand identity');

const ownerPrompt = composeUnifiedSystemPrompt({
  user: { name: 'Pak Boss', role: 'OWNER' },
  userQuery: 'Bagaimana performa omset?',
  unifiedContext: { role: 'OWNER', userName: 'Pak Boss' },
  intent: AI_INTENT_TYPES.FINANCIAL_SALES,
});
assert.ok(ownerPrompt.includes('Pemilik Kedai (Owner)'), 'Owner prompt must acknowledge owner role');
console.log('   ✅ PASS [9]: System prompt composition enforces RBAC & brand identity');

console.log('🎉 ALL SLICE 3 TESTS PASSED 100%!');
