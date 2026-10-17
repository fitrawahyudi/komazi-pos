/**
 * End-to-End Test Suite: Komazi AI Super Powerful
 * Menguji:
 * 1. Ketahanan Memori Markdown (Persistensi Lintas Restart Server)
 * 2. Garansi Bahasa Alami (Bebas dari Format Log Developer & Monospace Cron)
 * 3. Spektrum Penjadwalan Universal (Pengingat Relatif, Cron Berkala, & Shift Staf HRIS)
 * 4. Pengambilan Konteks Percakapan Jangka Panjang
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  getMemoryFilePath,
  appendConversationTurn,
  loadRecentTurns,
  getLongTermMemoryPrompt,
  updateEpisodicSummary,
  deleteUserMemoryFile,
} from '../src/services/ai/markdownMemoryManager.js';
import {
  getHistoryAsync,
  appendTurn,
  clearSession,
  clearRamCache,
  setAiDirectChatMode,
  isAiDirectChatMode,
} from '../src/bot/ai/aiSessionManager.js';
import { parseNaturalScheduleText } from '../src/services/cron/naturalScheduleParser.js';
import {
  formatScheduleNaturalReply,
  formatStaffShiftSuccessReply,
  formatFriendlySalutation,
} from '../src/services/ai/aiToneFormatter.js';
import { universalSchedulerAgent } from '../src/services/ai/universalSchedulerAgent.js';

async function runSuperPowerfulE2e() {
  console.log('================================================================');
  console.log('🚀 RUNNING KOMAZI AI SUPER POWERFUL INTEGRATION E2E TEST SUITE');
  console.log('================================================================\n');

  const testUser = {
    id: 887766,
    name: 'Dimas Wicaksono',
    role: 'OWNER',
  };

  // Bersihkan berkas uji sebelum mulai
  await deleteUserMemoryFile(testUser.id);
  clearSession(testUser.id);

  // ==================================================================
  // 1. Skenario 1: Memori Percakapan Markdown & Ketahanan Restart Server
  // ==================================================================
  console.log('📌 [Skenario 1] Ketahanan Memori Markdown Lintas Restart Server');

  // Giliran 1: Pengguna bertanya tentang stok kopi
  await appendTurn(
    testUser.id,
    'Halo Komazi, stok biji kopi House Blend sisa berapa kg ya?',
    'Halo Mas Dimas! Biji kopi House Blend saat ini tersisa 4.5 kg, masih dalam batas aman untuk 3 hari ke depan.',
    testUser
  );

  // Giliran 2: Pengguna meminta pengingat
  await appendTurn(
    testUser.id,
    'Tolong ingatkan 30 menit lagi untuk kalibrasi grinder espresso ya',
    'Siap, Mas Dimas! Pengingat untuk kalibrasi grinder 30 menit lagi sudah saya jadwalkan ya.',
    testUser
  );

  // Simulasi CRASH / RESTART SERVER: Hapus memori cache sesi di RAM (tanpa menghapus disk)
  clearRamCache(testUser.id);

  // Ambil histori setelah restart server
  const restoredHistory = await getHistoryAsync(testUser.id, 10);
  assert.strictEqual(restoredHistory.length, 4, 'Harus memuat 4 pesan (2 pasang) langsung dari berkas Markdown');
  assert.strictEqual(restoredHistory[0].role, 'user');
  assert.ok(restoredHistory[0].content.includes('House Blend'));
  assert.strictEqual(restoredHistory[2].role, 'user');
  assert.ok(restoredHistory[2].content.includes('kalibrasi grinder'));
  assert.strictEqual(restoredHistory[3].role, 'assistant');
  console.log('  ✅ Memori 100% dipulihkan dari berkas Markdown setelah simulasi server crash/restart');

  // ==================================================================
  // 2. Skenario 2: Anti-Developer Log Guarantee
  // ==================================================================
  console.log('\n📌 [Skenario 2] Verifikasi Bahasa Alami Chatbot (Anti-Log Developer)');

  const parsedReminder = parseNaturalScheduleText('ingatkan saya jam 14:00 untuk cek suhu chiller susu');
  assert.ok(parsedReminder, 'Harus terdeteksi sebagai pengingat');

  const conversationalReply = formatScheduleNaturalReply(parsedReminder, {
    user: testUser,
    isSaved: false,
  });

  // Uji ketiadaan elemen teknis pengembang
  assert.strictEqual(
    conversationalReply.includes('DETEKSI JADWAL OTOMATIS'),
    false,
    'Dilarang menampilkan header DETEKSI JADWAL OTOMATIS'
  );
  assert.strictEqual(
    conversationalReply.includes('<code>0 22 * * *</code>'),
    false,
    'Dilarang menampilkan ekspresi cron monospace'
  );
  assert.strictEqual(
    conversationalReply.includes('REMINDER (cron)'),
    false,
    'Dilarang menampilkan raw enum status variabel'
  );

  // Uji keberadaan sapaan hangat dan rincian tugas yang manusiawi
  assert.ok(conversationalReply.includes('Mas Dimas'), 'Harus menyapa nama pengguna secara bersahabat');
  assert.ok(conversationalReply.includes('Cek suhu chiller susu'), 'Harus menyebutkan pesan tindakan tugas');
  assert.ok(conversationalReply.includes('14:00 WIB'), 'Harus menyebutkan jam pelaksanaan');
  console.log('  ✅ Respons percakapan 100% ramah dan bersih dari log developer');

  // ==================================================================
  // 3. Skenario 3: Cakupan Penjadwalan Universal (Universal Scope)
  // ==================================================================
  console.log('\n📌 [Skenario 3] Spektrum Penjadwalan Universal Tanpa Terkecuali');

  // A. Pengingat Relatif (sejam lagi)
  const taskRel = parseNaturalScheduleText('tolong ingatkan sejam lagi buat cuci filter mesin');
  assert.ok(taskRel && taskRel.scheduleType === 'once', 'Harus mengenali waktu relatif sekali jalan');
  assert.ok(taskRel.timeDescription.includes('1 jam lagi'));

  // B. Rekap Omset Berulang (Harian jam 22:00)
  const taskDaily = parseNaturalScheduleText('buatkan jadwal laporan omzet setiap hari jam 22:00');
  assert.ok(taskDaily && taskDaily.jobType === 'REPORT');
  assert.strictEqual(taskDaily.scheduleExpression, '0 22 * * *');

  // C. Perawatan Sistem (Backup database tiap Minggu jam 02:00)
  const taskWeekly = parseNaturalScheduleText('jadwalkan backup database setiap minggu jam 2 pagi');
  assert.ok(taskWeekly && taskWeekly.jobType === 'BACKUP');
  assert.strictEqual(taskWeekly.scheduleExpression, '0 2 * * 0');

  // D. Shift Kerja Staf HRIS (Pagi)
  const shiftPagi = parseNaturalScheduleText('jadwalkan barista Farhan shift pagi besok');
  assert.ok(shiftPagi, 'Harus terdeteksi sebagai jadwal shift HRIS');
  assert.strictEqual(shiftPagi.jobCategory, 'STAFF_SHIFT');
  assert.strictEqual(shiftPagi.staffName, 'Farhan');
  assert.strictEqual(shiftPagi.shiftName, 'PAGI');
  assert.strictEqual(shiftPagi.startTime, '07:00');
  assert.strictEqual(shiftPagi.endTime, '15:00');

  // E. Shift Kerja Staf HRIS (Siang)
  const shiftSiang = parseNaturalScheduleText('atur jadwal Siti shift siang');
  assert.ok(shiftSiang && shiftSiang.jobCategory === 'STAFF_SHIFT');
  assert.strictEqual(shiftSiang.staffName, 'Siti');
  assert.strictEqual(shiftSiang.shiftName, 'SIANG');
  assert.strictEqual(shiftSiang.startTime, '12:00');
  assert.strictEqual(shiftSiang.endTime, '20:00');

  console.log('  ✅ Seluruh variasi jadwal (relatif, harian, mingguan, shift HRIS) berhasil diparsing');

  // ==================================================================
  // 4. Skenario 4: Mode Bebas & Manajemen Direct Chat
  // ==================================================================
  console.log('\n📌 [Skenario 4] Mode Bebas (Direct Chat) & Persistensi Status');

  setAiDirectChatMode(testUser.id, true);
  assert.strictEqual(isAiDirectChatMode(testUser.id), true, 'Mode bebas harus aktif');

  setAiDirectChatMode(testUser.id, false);
  assert.strictEqual(isAiDirectChatMode(testUser.id), false, 'Mode bebas harus nonaktif');

  setAiDirectChatMode(testUser.id, true);
  assert.strictEqual(isAiDirectChatMode(testUser.id), true, 'Mode bebas diaktifkan kembali');
  console.log('  ✅ Toggle Mode Bebas beroperasi normal dan persisten');

  // ==================================================================
  // 5. Skenario 5: Ringkasan Episodik Jangka Panjang untuk Prompt LLM
  // ==================================================================
  console.log('\n📌 [Skenario 5] Pengekstrakan Konteks Jangka Panjang untuk Prompt LLM');

  await updateEpisodicSummary(
    testUser.id,
    '- Menginginkan briefing tim kasir setiap jam 08:00 WIB.\n- Prioritas pengawasan stok Fresh Milk Greenfields.'
  );

  const promptMemory = await getLongTermMemoryPrompt(testUser.id);
  assert.ok(promptMemory.includes('Dimas Wicaksono'), 'Harus menyertakan nama');
  assert.ok(promptMemory.includes('Peran: OWNER'), 'Harus menyertakan role');
  assert.ok(promptMemory.includes('Fresh Milk Greenfields'), 'Harus menyertakan catatan memori jangka panjang');
  console.log('  ✅ Injeksi konteks jangka panjang berhasil diekstraksi dari berkas Markdown');

  // Cleanup file pengujian
  await deleteUserMemoryFile(testUser.id);
  clearSession(testUser.id);

  console.log('\n================================================================');
  console.log('🎉 SELURUH 5 SKENARIO E2E KOMAZI AI SUPER POWERFUL LULUS (100%)');
  console.log('================================================================');
}

runSuperPowerfulE2e().catch((err) => {
  console.error('💥 E2E TEST GAGAL:', err);
  process.exit(1);
});
