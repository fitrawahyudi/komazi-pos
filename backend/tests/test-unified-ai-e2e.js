/**
 * Comprehensive End-to-End Test Suite for Unified Komazi AI Engine (Slice 7).
 * Menguji 14+ skenario across seluruh 7 domain taksonomi pertanyaan,
 * penegakan Zero Data Leakage RBAC, resolusi Action Hints, dan kestabilan inferensi.
 */

import assert from 'node:assert';
import { askAi } from '../src/controllers/aiAnalyticsController.js';
import { classifyIntent, resolveActionHint, AI_INTENT_TYPES } from '../src/services/ai/aiPromptComposer.js';
import { findPosKnowledge, formatPosKnowledgeForPrompt } from '../src/services/ai/posKnowledgeBase.js';
import { parseNaturalScheduleText } from '../src/services/cron/naturalScheduleParser.js';

console.log('======================================================================');
console.log('🚀 RUNNING COMPREHENSIVE UNIFIED KOMAZI AI E2E VERIFICATION (7 DOMAINS)');
console.log('======================================================================\n');

let total = 0;
let passed = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`   ✅ PASS [${passed}]: ${desc}`);
  } catch (err) {
    console.error(`   ❌ FAIL [${total}]: ${desc}\n      Error: ${err.message}`);
    process.exit(1);
  }
}

async function runControllerQuery(query, userRole = 'OWNER', userName = 'Fitra') {
  let responseData = null;
  let statusCode = 200;

  const req = {
    body: { query, history: [] },
    user: { id: 101, role: userRole, name: userName },
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      responseData = payload;
      return this;
    },
  };

  await askAi(req, res);
  return { statusCode, data: responseData?.data };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DOMAIN 1: FINANSIAL & PENJUALAN
// ─────────────────────────────────────────────────────────────────────────────
console.log('1️⃣  Domain 1: Finansial & Analisis Penjualan');

const c1 = classifyIntent('Berapa omset hari ini dibanding kemarin?');
check('Klasifikasi intent omset adalah FINANCIAL_SALES', () => {
  assert.strictEqual(c1.intent, AI_INTENT_TYPES.FINANCIAL_SALES);
});

const resD1Owner = await runControllerQuery('Berapa omset hari ini dibanding kemarin?', 'OWNER', 'Pak Boss');
check('Owner mendapatkan metrik finansial tanpa pembatasan', () => {
  assert.strictEqual(resD1Owner.data.intent, 'FINANCIAL_SALES');
  assert.strictEqual(resD1Owner.data.roleScope, 'OWNER');
  assert.ok(typeof resD1Owner.data.answer === 'string' && resD1Owner.data.answer.length > 20);
});

const resD1Cashier = await runControllerQuery('Berapa omset bulanan dan margin laba kotor kedai?', 'CASHIER', 'Siti');
check('Zero Data Leakage: Kasir ditolak saat menanyakan omset global / margin laba', () => {
  assert.strictEqual(resD1Cashier.data.roleScope, 'CASHIER');
  const ans = resD1Cashier.data.answer.toLowerCase();
  assert.ok(
    ans.includes('tidak memiliki akses') || ans.includes('manager') || ans.includes('owner'),
    'Cashier must be restricted from storewide financial metrics'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DOMAIN 2: INVENTARIS & RESEP MENU
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2️⃣  Domain 2: Inventaris & Resep Menu');

const c2a = classifyIntent('Apa resep dan takaran Vanilla Latte?');
check('Klasifikasi intent resep adalah INVENTORY_RECIPE', () => {
  assert.strictEqual(c2a.intent, AI_INTENT_TYPES.INVENTORY_RECIPE);
});

const resD2Recipe = await runControllerQuery('Apa resep dan takaran Caramel Macchiato?', 'BARISTA', 'Budi');
check('Barista menerima informasi resep beserta actionHint manajemen stok/resep', () => {
  assert.strictEqual(resD2Recipe.data.intent, 'INVENTORY_RECIPE');
  assert.ok(resD2Recipe.data.actionHint !== null);
  assert.strictEqual(resD2Recipe.data.actionHint.type, 'NAVIGATE');
});

const resD2Stock = await runControllerQuery('Bahan apa saja yang stoknya menipis kritis?', 'MANAGER', 'Doni');
check('Manager menerima peringatan bahan baku kritis', () => {
  assert.strictEqual(resD2Stock.data.intent, 'INVENTORY_RECIPE');
  assert.ok(Array.isArray(resD2Stock.data.metrics.ingredientAlerts));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DOMAIN 3: KASIR, SHIFT & REKONSILIASI KAS
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3️⃣  Domain 3: Kasir, Shift & Rekonsiliasi Kas');

const c3 = classifyIntent('Siapa kasir bertugas sekarang dan berapa modal awal kas?');
check('Klasifikasi intent shift adalah SHIFT_OPERATIONAL', () => {
  assert.strictEqual(c3.intent, AI_INTENT_TYPES.SHIFT_OPERATIONAL);
});

const resD3Shift = await runControllerQuery('Siapa kasir bertugas sekarang dan berapa modal awal kas?', 'MANAGER', 'Doni');
check('Manager menerima status shift kasir aktif dan actionHint SHIFT_MODAL', () => {
  assert.strictEqual(resD3Shift.data.intent, 'SHIFT_OPERATIONAL');
  assert.ok(resD3Shift.data.actionHint !== null);
  assert.strictEqual(resD3Shift.data.actionHint.targetModal, 'SHIFT_MODAL');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOMAIN 4: WORKSPACE COWORKING & CRM PELANGGAN
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4️⃣  Domain 4: Workspace Coworking & Pelanggan');

const c4 = classifyIntent('Berapa tamu yang sedang aktif di area workspace saat ini?');
check('Klasifikasi intent workspace adalah WORKSPACE', () => {
  assert.strictEqual(c4.intent, AI_INTENT_TYPES.WORKSPACE);
});

const resD4Ws = await runControllerQuery('Berapa tamu yang sedang aktif di area workspace saat ini?', 'CASHIER', 'Siti');
check('Kasir menerima data sesi workspace dengan actionHint navigasi workspace', () => {
  assert.strictEqual(resD4Ws.data.intent, 'WORKSPACE');
  assert.ok(resD4Ws.data.actionHint !== null);
  assert.strictEqual(resD4Ws.data.actionHint.route, '/workspace');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. DOMAIN 5: PANDUAN TEKNIS POS (SOP BUILT-IN)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n5️⃣  Domain 5: Panduan Teknis POS (SOP Encyclopedia)');

const sopSplit = findPosKnowledge('bagaimana cara split bill pesanan meja 3?');
check('SOP Split Bill ditemukan dengan langkah eksekusi lengkap', () => {
  assert.ok(sopSplit !== null);
  assert.strictEqual(sopSplit.id, 'split_bill');
  assert.ok(sopSplit.steps.length >= 4);
});

const resD5Split = await runControllerQuery('Bagaimana cara split bill pesanan meja 3?', 'CASHIER', 'Siti');
check('askAi menjawab pertanyaan Split Bill dengan actionHint OPEN_BILLS', () => {
  assert.strictEqual(resD5Split.data.intent, 'POS_MANUAL');
  assert.strictEqual(resD5Split.data.actionHint.targetModal, 'OPEN_BILLS');
  assert.ok(resD5Split.data.answer.includes('Split Bill') || resD5Split.data.answer.includes('Tagihan'));
});

const resD5Printer = await runControllerQuery('Kenapa printer thermal bluetooth tidak konek?', 'CASHIER', 'Siti');
check('askAi menjawab panduan Printer Thermal dengan actionHint PRINTER_MODAL', () => {
  assert.strictEqual(resD5Printer.data.intent, 'POS_MANUAL');
  assert.strictEqual(resD5Printer.data.actionHint.targetModal, 'PRINTER_MODAL');
  assert.ok(resD5Printer.data.answer.includes('Printer') || resD5Printer.data.answer.includes('Bluetooth'));
});

const resD5ShiftClosing = await runControllerQuery('cara tutup shift dan hitung selisih kas kasir', 'CASHIER', 'Siti');
check('askAi menjawab SOP Tutup Shift Kasir dengan actionHint SHIFT_MODAL', () => {
  assert.strictEqual(resD5ShiftClosing.data.intent, 'POS_MANUAL');
  assert.strictEqual(resD5ShiftClosing.data.actionHint.targetModal, 'SHIFT_MODAL');
});

const resD5Void = await runControllerQuery('cara ajukan void atau refund transaksi salah input', 'CASHIER', 'Siti');
check('askAi menjawab SOP Void & Refund dengan otorisasi supervisor', () => {
  assert.strictEqual(resD5Void.data.intent, 'POS_MANUAL');
  assert.ok(resD5Void.data.answer.includes('Void') || resD5Void.data.answer.includes('Refund'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DOMAIN 6: PENJADWALAN & PENGINGAT (CRONJOB SCHEDULER)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n6️⃣  Domain 6: Penjadwalan & Pengingat Otomatis (Cronjob)');

const c6 = classifyIntent('Ingatkan saya jam 14:00 untuk cek stok susu');
check('Klasifikasi intent pengingat adalah REMINDER_SCHEDULER', () => {
  assert.strictEqual(c6.intent, AI_INTENT_TYPES.REMINDER_SCHEDULER);
});

const parsedReminder = parseNaturalScheduleText('Ingatkan saya jam 14:00 untuk cek stok susu', 12345);
check('Natural schedule parser mengenali tugas dan cron expression jam 14:00', () => {
  assert.ok(parsedReminder !== null);
  assert.strictEqual(parsedReminder.jobType, 'REMINDER');
  assert.strictEqual(parsedReminder.scheduleExpression, '0 14 * * *');
  assert.ok(parsedReminder.payload.message.toLowerCase().includes('susu'));
});

const parsedRelative = parseNaturalScheduleText('Ingatkan 30 menit lagi untuk cek oven', 12345);
check('Relative schedule parser mengenali timer satu kali (once)', () => {
  assert.ok(parsedRelative !== null);
  assert.strictEqual(parsedRelative.scheduleType, 'once');
  assert.ok(parsedRelative.payload.message.toLowerCase().includes('oven'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. DOMAIN 7: PERCAKAPAN UMUM & CHITCHAT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7️⃣  Domain 7: Percakapan Umum & Identitas Komazi AI');

const c7 = classifyIntent('Halo selamat siang Komazi');
check('Klasifikasi sapaan adalah CHITCHAT', () => {
  assert.strictEqual(c7.intent, AI_INTENT_TYPES.CHITCHAT);
});

const resD7 = await runControllerQuery('Halo selamat siang Komazi', 'OWNER', 'Fitra');
check('askAi menjawab sapaan ramah dengan identitas resmi Komazi Coffee & Workspace', () => {
  assert.strictEqual(resD7.data.intent, 'CHITCHAT');
  assert.ok(typeof resD7.data.answer === 'string' && resD7.data.answer.length > 10, 'Answer must be a non-empty greeting');
  const aLower = resD7.data.answer.toLowerCase();
  assert.ok(
    aLower.includes('komazi') || aLower.includes('halo') || aLower.includes('siang') || aLower.includes('bantu') || aLower.includes('fitra'),
    'Chitchat response must retain warm brand persona'
  );
});

console.log('\n======================================================================');
console.log(`🎉 ALL ${passed}/${total} UNIFIED KOMAZI AI E2E TESTS PASSED 100%!`);
console.log('======================================================================\n');
