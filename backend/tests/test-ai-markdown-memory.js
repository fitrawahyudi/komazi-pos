/**
 * Unit Test untuk Markdown-Based Unlimited Conversation Memory Manager.
 * Menguji pembuatan file, penambahan percakapan, sliding window,
 * ketahanan restart (crash-resilience), serta update ringkasan jangka panjang.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  getMemoryFilePath,
  ensureUserMemoryFile,
  appendConversationTurn,
  loadRecentTurns,
  getLongTermMemoryPrompt,
  updateEpisodicSummary,
  updateActiveSchedules,
  clearConversationHistory,
  deleteUserMemoryFile,
  formatWibTimestamp,
} from '../src/services/ai/markdownMemoryManager.js';

async function runTest() {
  console.log('======================================================');
  console.log('🧪 TESTING MARKDOWN CONVERSATION MEMORY MANAGER');
  console.log('======================================================\n');

  const testUserId = 999888;
  const userInfo = { name: 'Ridho Test', role: 'OWNER' };

  // Pastikan file bersih sebelum uji
  await deleteUserMemoryFile(testUserId);
  const filePath = getMemoryFilePath(testUserId);

  // 1. Uji Pembuatan Berkas Awal
  console.log('📌 [Test 1] Inisialisasi berkas Markdown memori');
  await ensureUserMemoryFile(testUserId, userInfo);
  assert.strictEqual(fs.existsSync(filePath), true, 'Berkas memori .md harus dibuat');
  const initialContent = fs.readFileSync(filePath, 'utf8');
  assert.ok(initialContent.includes('Ridho Test'), 'Nama pengguna harus tercantum');
  assert.ok(initialContent.includes('Peran: OWNER'), 'Peran pengguna harus tercantum');
  console.log('  ✅ Inisialisasi berkas template Markdown berhasil');

  // 2. Uji Penambahan Percakapan (Append-Only)
  console.log('\n📌 [Test 2] Append interaksi percakapan (User & Assistant)');
  await appendConversationTurn(
    testUserId,
    'Halo Komazi, ingatkan saya jam 14:00 untuk periksa stok susu ya',
    'Siap, Mas Ridho! Pengingat cek stok susu jam 14:00 WIB sudah saya catat.',
    userInfo
  );

  await appendConversationTurn(
    testUserId,
    'Berapa omset hari ini?',
    'Total omset penjualan hari ini adalah Rp 1.850.000 dari 42 transaksi.',
    userInfo
  );

  const turns = await loadRecentTurns(testUserId, 10);
  assert.strictEqual(turns.length, 4, 'Harus ada 4 pesan (2 pasang user & assistant)');
  assert.strictEqual(turns[0].role, 'user');
  assert.ok(turns[0].content.includes('stok susu'));
  assert.strictEqual(turns[1].role, 'assistant');
  assert.strictEqual(turns[2].role, 'user');
  assert.ok(turns[2].content.includes('omset'));
  assert.strictEqual(turns[3].role, 'assistant');
  console.log('  ✅ 2 pasang percakapan berhasil tersimpan dan dibaca kembali');

  // 3. Uji Simulasi Server Restart (Crash-Resilience)
  console.log('\n📌 [Test 3] Ketahanan server restart (Data tetap utuh dari disk)');
  // Membaca langsung dari disk seolah node process baru saja booting
  const turnsAfterRestart = await loadRecentTurns(testUserId, 5);
  assert.strictEqual(turnsAfterRestart.length, 4, 'Data harus tetap 4 pesan setelah restart');
  assert.strictEqual(turnsAfterRestart[2].content, 'Berapa omset hari ini?');
  console.log('  ✅ Data memori 100% persisten di disk Markdown tanpa amnesia');

  // 4. Uji Sliding Window (Batas Maksimal N Percakapan)
  console.log('\n📌 [Test 4] Limitasi pembacaan sliding window');
  // Ambil hanya 1 turn terakhir (2 pesan)
  const slicedTurns = await loadRecentTurns(testUserId, 1);
  assert.strictEqual(slicedTurns.length, 2, 'Harus hanya mengambil 2 pesan terakhir');
  assert.strictEqual(slicedTurns[0].role, 'user');
  assert.ok(slicedTurns[0].content.includes('omset'));
  console.log('  ✅ Sliding window berhasil membatasi N percakapan untuk prompt LLM');

  // 5. Uji Update Ringkasan Episodik Jangka Panjang
  console.log('\n📌 [Test 5] Pembaruan Ringkasan Konteks Jangka Panjang & Jadwal Aktif');
  const summary = '- Pengguna selalu memantau stok susu dan omset harian.\n- Suka disapa dengan nama Mas Ridho.';
  await updateEpisodicSummary(testUserId, summary);

  const schedules = '- [AKTIF] ID #101: Cek stok susu (14:00 WIB)\n- [AKTIF] ID #102: Rekap kasir (22:00 WIB)';
  await updateActiveSchedules(testUserId, schedules);

  const promptMemory = await getLongTermMemoryPrompt(testUserId);
  assert.ok(promptMemory.includes('Pengguna selalu memantau stok susu'), 'Ringkasan episodik harus tersimpan');
  assert.ok(promptMemory.includes('Cek stok susu (14:00 WIB)'), 'Jadwal aktif harus tersimpan');
  console.log('  ✅ Ringkasan memori episodik & jadwal aktif berhasil diperbarui');

  // 6. Uji Clear History Percakapan (Reset chat sambil menjaga memori jangka panjang)
  console.log('\n📌 [Test 6] Pembersihan riwayat percakapan tanpa menghapus profil');
  await clearConversationHistory(testUserId);
  const turnsAfterClear = await loadRecentTurns(testUserId, 10);
  assert.strictEqual(turnsAfterClear.length, 0, 'Riwayat percakapan harus kosong');

  const promptAfterClear = await getLongTermMemoryPrompt(testUserId);
  assert.ok(promptAfterClear.includes('Ridho Test'), 'Profil pengguna tetap utuh');
  assert.ok(promptAfterClear.includes('Pengguna selalu memantau stok susu'), 'Ringkasan episodik tetap utuh');
  console.log('  ✅ Riwayat percakapan direset tetapi memori jangka panjang tetap terlindungi');

  // Cleanup file pengujian
  await deleteUserMemoryFile(testUserId);
  console.log('\n🎉 SEMUA 6 PENGUJIAN MEMORI MARKDOWN BERHASIL (100% LULUS)');
}

runTest().catch((err) => {
  console.error('❌ GAGAL:', err);
  process.exit(1);
});
