/**
 * Unit Test untuk Universal Natural Schedule Parser & Tone Formatter.
 * Menguji parsing pengingat operasional, cron jobs, jadwal shift staf HRIS,
 * dan format output percakapan alami (anti-developer log).
 */

import assert from 'assert';
import { parseNaturalScheduleText } from '../src/services/cron/naturalScheduleParser.js';
import {
  formatScheduleNaturalReply,
  formatStaffShiftSuccessReply,
  formatFriendlySalutation,
} from '../src/services/ai/aiToneFormatter.js';

function runTestSuite() {
  console.log('======================================================');
  console.log('🧪 TESTING UNIVERSAL SCHEDULER & CONVERSATIONAL TONE');
  console.log('======================================================\n');

  // 1. Uji Pengingat Relatif (Setengah jam, 15 menit, 1 jam)
  console.log('📌 [Test 1] Parsing Pengingat Waktu Relatif');
  const rel1 = parseNaturalScheduleText('ingatkan saya 15 menit lagi untuk periksa oven');
  assert.ok(rel1, 'Harus terdeteksi sebagai jadwal');
  assert.strictEqual(rel1.jobType, 'REMINDER');
  assert.strictEqual(rel1.scheduleType, 'once');
  assert.ok(rel1.payload.message.includes('Periksa oven'));
  assert.ok(rel1.timeDescription.includes('15 menit lagi'));

  const rel2 = parseNaturalScheduleText('tolong ingatkan setengah jam lagi buat angkat cold brew');
  assert.ok(rel2, 'Harus mengenali setengah jam lagi');
  assert.strictEqual(rel2.scheduleType, 'once');
  assert.ok(rel2.payload.message.includes('Angkat cold brew'));
  assert.ok(rel2.timeDescription.includes('30 menit lagi'));
  console.log('  ✅ Waktu relatif (15 menit & setengah jam lagi) berhasil diekstrak');

  // 2. Uji Jadwal Berulang Harian & Mingguan
  console.log('\n📌 [Test 2] Parsing Jadwal Berulang (Harian & Hari Mingguan)');
  const daily = parseNaturalScheduleText('buat jadwal laporan omzet setiap jam 22:00');
  assert.ok(daily, 'Harus terdeteksi sebagai jadwal laporan');
  assert.strictEqual(daily.jobType, 'REPORT');
  assert.strictEqual(daily.scheduleExpression, '0 22 * * *');

  const weekly = parseNaturalScheduleText('jadwalkan setiap senin jam 8 pagi untuk cek stok bahan');
  assert.ok(weekly, 'Harus terdeteksi sebagai jadwal mingguan');
  assert.strictEqual(weekly.scheduleType, 'cron');
  assert.strictEqual(weekly.scheduleExpression, '0 8 * * 1');
  assert.ok(weekly.timeDescription.includes('Senin'));
  console.log('  ✅ Jadwal harian & mingguan (setiap senin jam 8) berhasil diekstrak');

  // 3. Uji Jadwal Shift Staf HRIS
  console.log('\n📌 [Test 3] Parsing Jadwal Shift Staf HRIS');
  const shift1 = parseNaturalScheduleText('jadwalkan Farhan shift pagi besok');
  assert.ok(shift1, 'Harus terdeteksi sebagai shift kerja staf');
  assert.strictEqual(shift1.jobCategory, 'STAFF_SHIFT');
  assert.strictEqual(shift1.staffName, 'Farhan');
  assert.strictEqual(shift1.shiftName, 'PAGI');
  assert.strictEqual(shift1.startTime, '07:00');
  assert.strictEqual(shift1.endTime, '15:00');
  assert.ok(shift1.timeDescription.includes('Besok'));

  const shift2 = parseNaturalScheduleText('atur jadwal barista Siti shift siang');
  assert.ok(shift2, 'Harus mengenali shift siang');
  assert.strictEqual(shift2.jobCategory, 'STAFF_SHIFT');
  assert.strictEqual(shift2.staffName, 'Siti');
  assert.strictEqual(shift2.shiftName, 'SIANG');
  assert.strictEqual(shift2.startTime, '12:00');
  assert.strictEqual(shift2.endTime, '20:00');
  console.log('  ✅ Jadwal shift staf HRIS (Pagi & Siang) berhasil diekstrak');

  // 4. Uji Format Output Alami (Anti-Developer Log)
  console.log('\n📌 [Test 4] Verifikasi Output Bahasa Alami (No Monospace Cron Code)');
  const dummyUser = { name: 'Budi Hartono', role: 'OWNER' };
  const reply1 = formatScheduleNaturalReply(rel1, { user: dummyUser, isSaved: false });

  // Pastikan TIDAK ADA teks log pengembang
  assert.strictEqual(reply1.includes('DETEKSI JADWAL OTOMATIS'), false, 'Dilarang ada DETEKSI JADWAL OTOMATIS');
  assert.strictEqual(reply1.includes('<code>0 22 * * *</code>'), false, 'Dilarang ada kode cron monospace');
  assert.strictEqual(reply1.includes('REMINDER (cron)'), false, 'Dilarang ada variabel sistem mentah');

  // Pastikan bahasa ramah dan alami
  assert.ok(reply1.includes('Mas Budi'), 'Harus menyapa pengguna secara akrab');
  assert.ok(reply1.includes('Periksa oven'), 'Harus menyebutkan tugas');
  console.log('  ✅ Output terverifikasi ramah dan bebas dari log developer');

  // 5. Uji Format Konfirmasi Shift Staf HRIS
  console.log('\n📌 [Test 5] Format Konfirmasi Shift Staf HRIS');
  const shiftReply = formatStaffShiftSuccessReply('Farhan', 'PAGI', '2026-10-15', '07:00 - 15:00 WIB', 'Bos');
  assert.ok(shiftReply.includes('Farhan'));
  assert.ok(shiftReply.includes('Shift:</b> PAGI'));
  assert.ok(shiftReply.includes('HRIS'));
  console.log('  ✅ Konfirmasi shift staf tersusun rapi dan jelas');

  console.log('\n🎉 SEMUA 5 PENGUJIAN UNIVERSAL SCHEDULER BERHASIL (100% LULUS)');
}

runTestSuite();
