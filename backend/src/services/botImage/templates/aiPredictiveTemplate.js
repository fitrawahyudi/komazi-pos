import { wrapCardHtml, formatRupiah, escapeHtml, formatDateWib, formatTimeWib } from '../styles/brandTheme.js';

/**
 * 1. CardAiMorningBriefing - Kartu Proyeksi Bisnis Pagi Hari (08:00 WIB)
 */
export function renderAiMorningBriefingCard(data = {}) {
  const dayName = data.dayName || 'Hari Ini';
  const projectedRevenueFormatted = data.projectedRevenueFormatted || formatRupiah(data.projectedTotalRevenue || 0);
  const primaryPeakWindow = data.primaryPeakWindow || '14:00 - 17:00 WIB';
  const secondaryPeakWindow = data.secondaryPeakWindow || '19:00 - 21:30 WIB';
  const historicalAvgFormatted = formatRupiah(data.historicalDailyAverage || 0);
  const prepAdvice = Array.isArray(data.prepAdvice) && data.prepAdvice.length > 0
    ? data.prepAdvice
    : [
        'Siapkan batch cold brew & espresso grind sebelum jam sibuk siang.',
        'Pastikan stok fresh milk & es batu terisi penuh di bar kopi.',
        'Cek kesiapan area coworking dan meja untuk tamu siang.',
      ];

  const prepItemsHtml = prepAdvice.map((advice, idx) => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(245,158,11,0.2);color:#F59E0B;font-size:12px;font-weight:800;flex-shrink:0;">
        ${idx + 1}
      </span>
      <span style="font-size:13px;color:#E2E8F0;line-height:1.5;">${escapeHtml(advice)}</span>
    </div>
  `).join('');

  const bodyContent = `
    <!-- Top Projection Highlights -->
    <div class="grid-4" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>🎯</span>
          <span>Target Proyeksi Omset</span>
        </div>
        <div class="metric-value large gold" style="font-size:26px;">
          ${escapeHtml(projectedRevenueFormatted)}
        </div>
        <div class="metric-sub">Estimasi performa hari ${escapeHtml(dayName)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⚡</span>
          <span>Jam Sibuk Utama</span>
        </div>
        <div class="metric-value coral" style="font-size:20px;">
          ${escapeHtml(primaryPeakWindow)}
        </div>
        <div class="metric-sub">Estimasi lonjakan pesanan siang</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🌙</span>
          <span>Jam Sibuk Kedua</span>
        </div>
        <div class="metric-value" style="color:#A78BFA;font-size:20px;">
          ${escapeHtml(secondaryPeakWindow)}
        </div>
        <div class="metric-sub">Puncak sesi nongkrong malam</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📊</span>
          <span>Baseline Historis</span>
        </div>
        <div class="metric-value emerald" style="font-size:20px;">
          ${escapeHtml(historicalAvgFormatted)}
        </div>
        <div class="metric-sub">Rata-rata 7 hari aktif</div>
      </div>
    </div>

    <!-- Actionable Prep Advice & Checklist -->
    <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:22px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">💡</span>
          <span style="font-family:'Outfit',sans-serif;font-weight:700;font-size:16px;color:#F3F4F6;">
            Rekomendasi Persiapan Operasional Kedai (Actionable Prep)
          </span>
        </div>
        <span style="font-size:11px;font-family:'JetBrains Mono',monospace;padding:3px 10px;background:rgba(245,158,11,0.15);color:#F59E0B;border-radius:6px;font-weight:700;">
          KOMAZI AI ADVISOR
        </span>
      </div>
      <div>
        ${prepItemsHtml}
      </div>
    </div>

    <!-- Footer Insights Ribbon -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;font-size:12px;color:#94A3B8;">
      <span>📌 Disusun otomatis berdasarkan machine curve riwayat transaksi database Komazi POS.</span>
      <span style="font-weight:700;color:#10B981;">Siap Operasional 🚀</span>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'KOMAZI AI • MORNING FORECAST',
    badgeColor: 'badge-gold',
    title: `Executive Morning Briefing • ${dayName}`,
    subtitle: `Prediksi kurva jam sibuk, target omset penutupan, dan checklist persiapan operasional`,
    bodyContent,
  });
}

/**
 * 2. CardAiStockoutAlert - Kartu Peringatan Darurat Laju Habis Stok (Real-Time)
 */
export function renderAiStockoutAlertCard(data = {}) {
  const criticalItems = Array.isArray(data.criticalItems) ? data.criticalItems : [];
  const hoursElapsed = data.hoursElapsed || 4.5;
  const criticalCount = data.criticalCount || criticalItems.length;

  const rowsHtml = criticalItems.slice(0, 5).map((item) => {
    const isOut = item.riskLevel === 'OUT_OF_STOCK';
    const isCritical = item.riskLevel === 'CRITICAL_RUNOUT';

    let badgeBg = 'rgba(239,68,68,0.2)';
    let badgeColor = '#EF4444';
    let badgeLabel = 'HABIS ❌';

    if (isCritical) {
      badgeBg = 'rgba(239,68,68,0.2)';
      badgeColor = '#EF4444';
      badgeLabel = 'KRITIS ⚠️';
    } else if (item.riskLevel === 'LOW_STOCK_SOON') {
      badgeBg = 'rgba(245,158,11,0.2)';
      badgeColor = '#F59E0B';
      badgeLabel = 'MENIPIS';
    }

    const countdownText = isOut
      ? 'Sudah Habis'
      : item.hoursUntilStockout !== null
      ? `~${item.hoursUntilStockout} Jam (${item.estimatedRunoutTime || '-'})`
      : 'Stok Kritis';

    return `
      <div style="display:grid;grid-template-columns: 2fr 1.2fr 1.2fr 1.8fr 1.2fr;align-items:center;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;font-size:13px;">
        <div style="font-weight:700;color:#FFF;display:flex;align-items:center;gap:8px;">
          <span style="font-size:10px;padding:2px 8px;border-radius:6px;background:${badgeBg};color:${badgeColor};font-weight:800;">
            ${badgeLabel}
          </span>
          <span>${escapeHtml(item.name)}</span>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;color:#F87171;font-weight:700;">
          ${item.currentStock} ${escapeHtml(item.unit)}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;color:#CBD5E1;">
          ${item.burnRatePerHour} ${escapeHtml(item.unit)}/jam
        </div>
        <div style="font-family:'JetBrains Mono',monospace;color:#FBBF24;font-weight:700;">
          ${escapeHtml(countdownText)}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;color:#34D399;font-weight:700;text-align:right;">
          +${item.recommendedRestock || item.minStock} ${escapeHtml(item.unit)}
        </div>
      </div>
    `;
  }).join('');

  const bodyContent = `
    <!-- Critical Banner Warning -->
    <div style="background:linear-gradient(90deg, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.1) 100%);border:1.5px solid rgba(239,68,68,0.4);border-radius:16px;padding:18px 22px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:14px;">
        <span style="font-size:32px;">⚠️</span>
        <div>
          <div style="font-family:'Outfit',sans-serif;font-weight:800;font-size:17px;color:#FCA5A5;">
            ${criticalCount} BAHAN BAKU BERISIKO TINGGI
          </div>
          <div style="font-size:12px;color:#FEE2E2;margin-top:2px;">
            Berdasarkan kecepatan penjualan ${hoursElapsed} jam terakhir, bahan berikut diprediksi habis sebelum toko tutup!
          </div>
        </div>
      </div>
    </div>

    <!-- Stock Runout Forecast Table -->
    <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px;margin-bottom:16px;">
      <div style="display:grid;grid-template-columns: 2fr 1.2fr 1.2fr 1.8fr 1.2fr;padding:0 14px 12px;font-size:11px;font-family:'JetBrains Mono',monospace;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;">
        <span>Bahan Baku</span>
        <span>Sisa Stok</span>
        <span>Laju Pakai</span>
        <span>Prediksi Habis</span>
        <span style="text-align:right;">Saran Restock</span>
      </div>
      <div>
        ${rowsHtml || '<div style="text-align:center;padding:20px;color:#94A3B8;">Tidak ada bahan yang berada dalam status kritis saat ini.</div>'}
      </div>
    </div>

    <!-- Action Directives -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;font-size:12px;color:#CBD5E1;">
      <span>💡 <b>Tindakan Cepat:</b> Belanja darurat bahan di atas atau koordinasikan kasir untuk menonaktifkan menu terkait.</span>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'KOMAZI AI • STOCKOUT ALERT',
    badgeColor: 'badge-red',
    title: `Emergency Stock Runout Warning`,
    subtitle: `Deteksi matematis laju pemakaian bahan baku kritis vs sisa stok aktif`,
    bodyContent,
  });
}

/**
 * 3. CardAiEveningWrapup - Kartu Rekapitulasi & Komparasi Penutupan EOD (22:00 WIB)
 */
export function renderAiEveningWrapupCard(data = {}) {
  const dateFormatted = data.dateFormatted || formatDateWib();
  const actualRevenueFormatted = data.actualRevenueFormatted || formatRupiah(data.actualRevenue || 0);
  const projectedRevenueFormatted = data.projectedRevenueFormatted || formatRupiah(data.projectedRevenue || 0);
  const varianceFormatted = data.varianceFormatted || '+Rp 0';
  const achievementRatePct = data.achievementRatePct || 100;
  const badgeLabel = data.badgeLabel || 'Sesuai Target ✅';
  const totalTransactions = data.totalTransactions || 0;
  const topProducts = Array.isArray(data.topProducts) ? data.topProducts : [];
  const remainingCritical = data.remainingCriticalStockCount || 0;

  const topProductsHtml = topProducts.slice(0, 3).map((p, idx) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-family:'Outfit',sans-serif;font-weight:900;color:#FBBF24;font-size:14px;">#${idx + 1}</span>
        <span style="font-weight:600;font-size:13px;color:#FFF;">${escapeHtml(p.name)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#10B981;font-size:13px;">${p.qty} terjual</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#94A3B8;">${formatRupiah(p.revenue)}</span>
      </div>
    </div>
  `).join('');

  const bodyContent = `
    <!-- Top Comparison Metrics Grid -->
    <div class="grid-4" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>🏆</span>
          <span>Omzet Aktual Penutupan</span>
        </div>
        <div class="metric-value large coral" style="font-size:26px;">
          ${escapeHtml(actualRevenueFormatted)}
        </div>
        <div class="metric-sub">Total pendapatan bersih hari ini</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🎯</span>
          <span>Target Proyeksi Pagi</span>
        </div>
        <div class="metric-value gold" style="font-size:22px;">
          ${escapeHtml(projectedRevenueFormatted)}
        </div>
        <div class="metric-sub">Prediksi awal hari Komazi AI</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📈</span>
          <span>Ketercapaian Target</span>
        </div>
        <div class="metric-value emerald" style="font-size:22px;">
          ${achievementRatePct}%
        </div>
        <div class="metric-sub" style="font-weight:700;color:#FBBF24;">
          ${escapeHtml(badgeLabel)} (${escapeHtml(varianceFormatted)})
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🧾</span>
          <span>Total Transaksi</span>
        </div>
        <div class="metric-value" style="color:#60A5FA;font-size:22px;">
          ${totalTransactions} Struk
        </div>
        <div class="metric-sub">Volume transaksi lunas</div>
      </div>
    </div>

    <!-- 2 Column Breakdown: Menu Bintang & Status Bahan -->
    <div class="grid-2" style="margin-bottom:16px;">
      <!-- Menu Terlaris -->
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:15px;color:#F3F4F6;">
            🔥 Top Menu Terlaris Hari Ini
          </div>
          <span style="font-size:11px;font-family:'JetBrains Mono',monospace;color:#10B981;">MOST POPULAR</span>
        </div>
        <div>
          ${topProductsHtml || '<div style="color:#94A3B8;padding:10px;">Belum ada menu terjual.</div>'}
        </div>
      </div>

      <!-- Evaluasi Inventori & Stok -->
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:15px;color:#F3F4F6;">
            📦 Catatan Stok & Restock Besok
          </div>
          <span style="font-size:11px;font-family:'JetBrains Mono',monospace;color:#F59E0B;">INVENTORY STATUS</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
            <div style="font-size:12px;color:#94A3B8;">Sisa Bahan Perlu Di-Restock Malam Ini:</div>
            <div style="font-size:18px;font-weight:800;color:${remainingCritical > 0 ? '#EF4444' : '#10B981'};margin-top:2px;">
              ${remainingCritical > 0 ? `${remainingCritical} Bahan Menipis / Kritis ⚠️` : 'Semua Stok Bahan Aman ✅'}
            </div>
          </div>
          <div style="font-size:12px;color:#CBD5E1;line-height:1.5;padding:4px 6px;">
            ℹ️ Sistem AI telah memperbarui histori harian untuk meningkatkan akurasi kurva prediksi besok pagi.
          </div>
        </div>
      </div>
    </div>

    <!-- Closing Remarks -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;font-size:12px;color:#94A3B8;">
      <span>📅 ${escapeHtml(dateFormatted)} • Tutup Buku Harian Komazi Coffee &amp; Workspace</span>
      <span style="font-weight:700;color:#FBBF24;">Terima kasih atas kerja keras hari ini! ✨</span>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'KOMAZI AI • DAILY PERFORMANCE',
    badgeColor: 'badge-emerald',
    title: `Daily Performance`,
    subtitle: `Rekapitulasi pencapaian omset aktual vs target proyeksi awal hari`,
    bodyContent,
  });
}
