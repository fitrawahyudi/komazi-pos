import 'dotenv/config';
import { generateSalesAnalyticsNarrative, getAiSettings } from '../src/services/aiService.js';

async function runEzkielynaTest() {
  console.log('================================================================');
  console.log('🤖 PENGUJIAN KONEKSI & RESPON EZKIELYNA AI CLOUD (KOMAZI POS)');
  console.log('================================================================\n');

  const apiKey = process.env.EZKIELYNA_API_KEY || '';
  const model = process.env.EZKIELYNA_MODEL || 'deepseek-v4.1-flash';
  const rawBaseUrl = process.env.EZKIELYNA_BASE_URL || 'https://api.ezkielyna.store/v1';
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

  console.log('📋 Konfigurasi Saat Ini (.env):');
  console.log(`   - Model        : ${model}`);
  console.log(`   - Base URL     : ${baseUrl}`);
  console.log(`   - Endpoint     : ${endpoint}`);
  console.log(`   - API Key      : ${apiKey ? apiKey.slice(0, 7) + '...' + apiKey.slice(-4) : '⚠️ (KOSONG / BELUM DIISI)'}\n`);

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_ezkielyna_api_key_here')) {
    console.log('❌ PENGUJIAN DIBATALKAN:');
    console.log('   API Key Ezkielyna belum diatur di file `backend/.env`.');
    console.log('\n👉 Cara Mengisi:');
    console.log('   1. Buka file `backend/.env`');
    console.log('   2. Temukan baris 21: EZKIELYNA_API_KEY=');
    console.log('   3. Isi dengan token API Key Anda dari https://api.ezkielyna.store');
    console.log('      Contoh: EZKIELYNA_API_KEY=sk-abc123xyz...');
    console.log('   4. Simpan file, lalu jalankan pengujian ini kembali:');
    console.log('      npm run test:ezkielyna\n');
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAHAP 1: Direct Ping ke Endpoint Ezkielyna API
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('📡 [Tahap 1] Mengirim permintaan uji langsung ke Ezkielyna API...');
  const startTime = Date.now();

  try {
    const payload = {
      model,
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah asisten pengujian API Komazi POS. Berikan respon singkat dalam 1-2 kalimat.',
        },
        {
          role: 'user',
          content: 'Halo! Konfirmasi bahwa koneksi API Ezkielyna berhasil dan sebutkan model yang kamu gunakan.',
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const latency = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      console.log(`❌ Gagal terhubung ke Ezkielyna (HTTP ${res.status}):`);
      console.log(`   Respon Error: ${errText}`);
      console.log('\n💡 Kemungkinan Penyebab:');
      console.log('   - API Key salah atau kadaluarsa.');
      console.log('   - Saldo akun di https://api.ezkielyna.store belum mencukupi (bisa isi via QRIS).');
      console.log(`   - Model '${model}' tidak tersedia pada grup tier token Anda.`);
      return;
    }

    const json = await res.json();
    const replyText = json.choices?.[0]?.message?.content?.trim();

    console.log(`✅ [Tahap 1 SUKSES] Respon diterima dalam ${latency} ms!`);
    console.log(`   - HTTP Status : ${res.status} OK`);
    console.log(`   - Model Aktif : ${json.model || model}`);
    console.log(`   - Usage       : ${JSON.stringify(json.usage || {})}`);
    console.log(`   - Pesan AI    : "${replyText}"\n`);

  } catch (err) {
    console.log(`❌ Terjadi kesalahan jaringan / timeout: ${err.message}\n`);
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAHAP 2: Pengujian Integrasi POS Komazi Narrative Engine
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('🏪 [Tahap 2] Menguji integrasi dengan Komazi AI Analytics Narrative Engine...');
  try {
    // Simulasikan business data mini
    const mockBusinessData = {
      roleScope: 'OWNER',
      currentUser: { name: 'Dimas (Owner)' },
      todaySummary: {
        totalRevenue: 2450000,
        totalTransactions: 68,
        topItem: 'Kopi Susu Gula Aren',
      },
    };

    const narrativeResult = await generateSalesAnalyticsNarrative(
      'Ringkas performa penjualan kedai hari ini secara singkat.',
      mockBusinessData,
      [],
      'OWNER',
      'Dimas',
      {
        systemPrompt: 'Anda adalah Komazi AI, asisten analitik pintar untuk kedai kopi Komazi.',
      }
    );

    console.log('✅ [Tahap 2 SUKSES] Narrative Engine berhasil dieksekusi!');
    console.log(`   - Provider Digunakan : ${narrativeResult.provider}`);
    console.log(`   - Model Label        : ${narrativeResult.model}`);
    console.log(`   - Latency Tier       : ${narrativeResult.latencyTier}`);
    console.log(`   - Isi Analisis       :\n"${narrativeResult.text}"\n`);

    if (narrativeResult.provider === 'EZKIELYNA') {
      console.log('🎉 Provider EZKIELYNA aktif dan digunakan sebagai AI utama!');
    } else {
      console.log(`ℹ️ Catatan: Provider yang terpakai adalah ${narrativeResult.provider}.`);
      console.log('   Jika Anda ingin Ezkielyna menjadi prioritas utama di atas Groq/Gemini,');
      console.log('   atur di .env: AI_PRIMARY_PROVIDER=ezkielyna');
    }

  } catch (err) {
    console.log(`❌ Gagal pada tahap integrasi: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log('✨ Pengujian selesai.');
  console.log('================================================================');
}

runEzkielynaTest();
