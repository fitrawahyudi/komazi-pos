import assert from 'node:assert';
import { formatFriendlySalutation, formatMarkdownTables } from '../src/services/ai/aiToneFormatter.js';
import { sanitizeAiResponse } from '../src/services/aiService.js';
import { buildAiSystemContext } from '../src/bot/ai/aiContextService.js';
import { formatAiTextForTelegram } from '../src/bot/handlers/ai.js';

console.log('🧪 Testing Komazi AI Persona & Guardrail Lockdown (Enhanced)...');

// 1. Uji Format Sapaan Berbasis Role (Bebas dari "Owner User", "Bos", dan "Mas")
console.log('\n📌 [Test 1] Pengujian formatFriendlySalutation (Bebas dari "Owner User" & sapaan informal)');
const ownerUser = { role: 'OWNER', name: 'Fitra Wahyudi' };
const placeholderUser = { role: 'OWNER', name: 'User' };
const adminUser = { role: 'CASHIER', name: 'Admin' };
const managerUser = { role: 'MANAGER', name: 'Budi Santoso' };
const cashierUser = { role: 'CASHIER', name: 'Siti Rahma' };
const baristaUser = { role: 'BARISTA', name: 'Reza' };
const anonymousOwner = { role: 'OWNER' };

assert.strictEqual(formatFriendlySalutation(ownerUser), 'Owner Fitra');
assert.strictEqual(formatFriendlySalutation(placeholderUser), 'Owner', 'Nama placeholder "User" harus diabaikan');
assert.strictEqual(formatFriendlySalutation(adminUser), 'Kasir', 'Nama placeholder "Admin" harus diabaikan');
assert.strictEqual(formatFriendlySalutation(managerUser), 'Manager Budi');
assert.strictEqual(formatFriendlySalutation(cashierUser), 'Kasir Siti');
assert.strictEqual(formatFriendlySalutation(baristaUser), 'Barista Reza');
assert.strictEqual(formatFriendlySalutation(anonymousOwner), 'Owner');
assert.strictEqual(formatFriendlySalutation(null), 'Rekan Komazi');

console.log('   ✅ PASS [1]: Seluruh role disapa dengan nama role resmi akun tanpa "Owner User", "Bos", atau "Mas"');

// 2. Uji Sanitasi Output AI (Pembersihan "Owner User", "Bapak", "saya", dan provider leak)
console.log('\n📌 [Test 2] Pengujian sanitizeAiResponse (Pembersihan kasus nyata dari screenshot Telegram)');
const screenshotLeak1 =
  'Berikut ringkasan penjualan hari ini, Owner User:\n\n' +
  'Catatan: data di atas berdasarkan ringkasan terakhir yang saya miliki. Kalau Bapak mau saya breakdown per menu atau per jam, tinggal bilang saja. 🚀';

const sanitized1 = sanitizeAiResponse(screenshotLeak1, { role: 'OWNER', name: 'User' });
assert.strictEqual(sanitized1.includes('Owner User'), false, 'Dilarang ada "Owner User"');
assert.ok(sanitized1.includes('Owner:'), 'Harus menjadi "Owner:"');
assert.strictEqual(sanitized1.includes('Bapak'), false, 'Dilarang ada kata "Bapak"');
assert.strictEqual(sanitized1.toLowerCase().includes('saya'), false, 'Dilarang ada kata "saya"');
assert.ok(sanitized1.includes('yang Komazi miliki'), 'Harus dikonversi menjadi "yang Komazi miliki"');
assert.ok(sanitized1.includes('Kalau Owner mau Komazi breakdown'), 'Harus menjadi "Kalau Owner mau Komazi breakdown"');

const screenshotLeak2 =
  'Maaf, Owner User, saya tidak bisa memastikan tanggalnya. Saya tidak menyimpan tanggal eksplisit pada data ringkasan penjualan yang saya miliki—hanya keterangan "hari ini" dengan waktu update 20:45 WIB. Kalau Bapak butuh tanggal pasti, Komazi bisa cek ulang atau tampilkan data lengkap dengan tanggal transaksinya. Mau saya lakukan? 🚀';

const sanitized2 = sanitizeAiResponse(screenshotLeak2, { role: 'OWNER', name: 'User' });
assert.strictEqual(sanitized2.includes('Owner User'), false, 'Dilarang ada "Owner User"');
assert.strictEqual(sanitized2.includes('Bapak'), false, 'Dilarang ada "Bapak"');
assert.strictEqual(sanitized2.toLowerCase().includes('saya'), false, 'Dilarang ada kata "saya"');
assert.ok(sanitized2.includes('Mau Komazi lakukan?'), 'Kata tanya harus "Mau Komazi lakukan?"');

const screenshotLeak3 =
  'Selamat malam, Owner!\n\n' +
  'Komazi Komazi, model dari Komazi—di sini Komazi berperan sebagai Komazi buat bantu seputar Komazi Coffee & Workspace.\n\n' +
  'Ada lagi yang mau dicek soal penjualan malam ini, atau mau lanjut cek tanggal data tadi? 🚀';

const sanitized3 = sanitizeAiResponse(screenshotLeak3, { role: 'OWNER', name: 'User' });
assert.strictEqual(sanitized3.includes('Komazi Komazi'), false, 'Dilarang ada repetisi "Komazi Komazi"');
assert.strictEqual(sanitized3.includes('model dari Komazi'), false, 'Kalimat perkenalan robotik harus dibersihkan');
assert.ok(sanitized3.includes('Selamat malam, Owner!'));
assert.ok(sanitized3.includes('Ada lagi yang mau dicek'));

const hallucinatedName = 'Kalau Owner Doni mau, Komazi bisa bantu cek datanya.';
const sanitizedName = sanitizeAiResponse(hallucinatedName, { role: 'OWNER', name: 'User' });
assert.strictEqual(sanitizedName.includes('Owner Doni'), false, 'Dilarang ada halusinasi nama "Owner Doni"');
assert.ok(sanitizedName.includes('Kalau Owner mau'));

console.log('   ✅ PASS [2]: Semua kebocoran kata ganti "saya", "Bapak", "Komazi Komazi", dan "Owner User" bersih tuntas');

// 3. Uji Pemformatan Tabel Markdown Telegram
console.log('\n📌 [Test 3] Pengujian formatAiTextForTelegram & formatMarkdownTables');
const rawTableMarkdown = `Berikut ringkasan penjualan hari ini, Owner User:

| Keterangan | Nilai |
|---|---|
| Total pesanan (paid) | 1 transaksi |
| Total omset | Rp 54.000 |
| Rata-rata nilai transaksi | Rp 54.000 |
| Waktu update data | 20:45 WIB |

Catatan: Kalau Bapak butuh breakdown, tinggal bilang saja.`;

const telegramFormatted = formatAiTextForTelegram(rawTableMarkdown, { role: 'OWNER', name: 'User' });

assert.ok(telegramFormatted.includes('<pre>'), 'Harus dibungkus dalam tag <pre>');
assert.ok(telegramFormatted.includes('</pre>'), 'Harus ada penutup </pre>');
assert.strictEqual(telegramFormatted.includes('|---|---|'), false, 'Garis pipa mentah markdown harus dibersihkan');
assert.strictEqual(telegramFormatted.includes('Owner User'), false, 'Dilarang ada "Owner User"');
assert.strictEqual(telegramFormatted.includes('Bapak'), false, 'Dilarang ada "Bapak"');
assert.ok(telegramFormatted.includes('Total pesanan (paid)'), 'Isi baris tabel harus ada');
assert.ok(telegramFormatted.includes('Rp 54.000'), 'Nilai rupiah harus ada');

console.log('   ✅ PASS [3]: Tabel markdown dikonversi menjadi blok monospace <pre> yang rapi di Telegram');

// 4. Uji System Context Prompt & Aturan Penanggalan
console.log('\n📌 [Test 4] Pengujian buildAiSystemContext (Penanggalan Kalender Riil & Aturan Waktu)');
const prompt = await buildAiSystemContext(ownerUser, 'itu tanggal berapa?');

assert.ok(prompt.includes('Owner Fitra'), 'Prompt harus menyapa Owner Fitra');
assert.ok(prompt.includes('Tanggal & Hari Resmi:'), 'Prompt harus mencantumkan Tanggal & Hari Resmi');
assert.ok(prompt.includes('Periode Data: Transaksi penjualan hari ini'), 'Prompt harus mencantumkan Periode Data hari ini');
assert.ok(prompt.includes('DILARANG KERAS memanggil "Bapak"'), 'Prompt harus melarang sapaan Bapak');
assert.ok(prompt.includes('DILARANG KERAS berdalih "tidak bisa memastikan tanggalnya"'), 'Prompt harus melarang dalih tidak tahu tanggal');
assert.ok(prompt.includes('FORMAT PENYAJIAN TABEL TELEGRAM'), 'Prompt harus mengatur format tabel Telegram');

console.log('   ✅ PASS [4]: System context prompt memuat tanggal resmi dan aturan penalaran waktu');

console.log('\n🎉 ALL 4 ENHANCED PERSONA & GUARDRAIL TESTS PASSED 100%!');
