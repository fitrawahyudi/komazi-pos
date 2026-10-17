import assert from 'assert';
import { findPosKnowledge, formatPosKnowledgeForPrompt, POS_KNOWLEDGE_ENTRIES } from '../src/services/ai/posKnowledgeBase.js';

console.log('🧪 Testing POS Knowledge Base (Slice 1)...');

// 1. Test Split Bill match
const splitMatch = findPosKnowledge('bagaimana cara split bill pesanan meja 3?');
assert(splitMatch !== null, 'Split bill intent should match');
assert(splitMatch.id === 'split_bill', 'ID should be split_bill');
assert(splitMatch.steps.length > 3, 'Steps should be populated');

// 2. Test Printer match
const printerMatch = findPosKnowledge('kenapa printer thermal bluetooth tidak konek?');
assert(printerMatch !== null, 'Printer intent should match');
assert(printerMatch.id === 'thermal_printer', 'ID should be thermal_printer');
assert(printerMatch.actionHint.targetModal === 'PRINTER_MODAL', 'Action hint points to PRINTER_MODAL');

// 3. Test Shift Closing match
const shiftMatch = findPosKnowledge('cara tutup shift dan hitung selisih kas kasir');
assert(shiftMatch !== null, 'Shift intent should match');
assert(shiftMatch.id === 'shift_management', 'ID should be shift_management');

// 4. Test Recipe match
const recipeMatch = findPosKnowledge('bagaimana cara mengatur resep dan takaran kopi?');
assert(recipeMatch !== null, 'Recipe intent should match');
assert(recipeMatch.id === 'recipe_inventory', 'ID should be recipe_inventory');

// 5. Test Merge Bill match
const mergeMatch = findPosKnowledge('gimana cara gabung bill tagihan meja?');
assert(mergeMatch !== null, 'Merge bill intent should match');
assert(mergeMatch.id === 'merge_bill', 'ID should be merge_bill');

// 6. Test Void Refund match
const voidMatch = findPosKnowledge('cara ajukan void atau refund transaksi salah input');
assert(voidMatch !== null, 'Void intent should match');
assert(voidMatch.id === 'void_refund', 'ID should be void_refund');

// 7. Non-SOP query should return null
const generalQuery = findPosKnowledge('berapa omset penjualan hari ini?');
assert(generalQuery === null, 'General sales query should not match POS technical SOP');

// 8. Test formatting for prompt
const formatted = formatPosKnowledgeForPrompt(splitMatch);
assert(formatted.includes('PANDUAN RESMI KOMAZI POS'), 'Prompt should have header');
assert(formatted.includes('Langkah-langkah Eksekusi'), 'Prompt should have steps');

console.log('✅ Slice 1 Tests PASSED! (8/8 assertions valid)\n');
