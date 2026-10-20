import { wrapCardHtml, formatRupiah, escapeHtml, formatDateWib, formatTimeWib } from '../styles/brandTheme.js';

/**
 * 21. CardRealtimeSales - Ringkasan Realtime Penjualan (/ringkasan)
 */
export function renderRealtimeSalesCard(data = {}) {
  const totalRevenue = Number(data.totalRevenue || 0);
  const totalBills = Number(data.totalTransactions || data.totalBills || 0);
  const avgBasket = totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0;
  const growth = data.growth !== undefined ? data.growth : null;

  const byMethod = data.byMethod || { CASH: 0, QRIS: 0, TRANSFER: 0 };
  const cashTotal = Number(byMethod.CASH || 0);
  const qrisTotal = Number(byMethod.QRIS || 0);
  const transferTotal = Number(byMethod.TRANSFER || 0);

  const qrisShare = totalRevenue > 0 ? Math.round((qrisTotal / totalRevenue) * 100) : 0;
  const cashShare = totalRevenue > 0 ? Math.round((cashTotal / totalRevenue) * 100) : 0;
  const transferShare = totalRevenue > 0 ? Math.round((transferTotal / totalRevenue) * 100) : 0;

  const activeWsCount = Number(data.activeWsCount || 0);
  const topProducts = Array.isArray(data.topProducts) ? data.topProducts : [];

  let growthHtml = '';
  if (growth !== null && growth !== undefined) {
    const isPos = Number(growth) >= 0;
    growthHtml = `<span style="font-size:12px;font-weight:700;color:${isPos ? '#10B981' : '#EF4444'};background:${isPos ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};padding:2px 8px;border-radius:6px;margin-left:8px;">
      ${isPos ? '+' : ''}${growth}% vs Kemarin ${isPos ? '📈' : '📉'}
    </span>`;
  }

  const topProductsHtml = topProducts.slice(0, 3).map((p, idx) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-family:'Outfit',sans-serif;font-weight:900;color:#FBBF24;font-size:14px;">#${idx + 1}</span>
        <span style="font-weight:600;font-size:13px;color:#FFF;">${escapeHtml(p.name)}</span>
      </div>
      <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#10B981;font-size:13px;">${p.qty} cup</span>
    </div>
  `).join('');

  const bodyContent = `
    <!-- Top Metrics Grid -->
    <div class="grid-4" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>💰</span>
          <span>Omzet Hari Ini</span>
        </div>
        <div class="metric-value large coral">
          ${formatRupiah(totalRevenue)}
        </div>
        <div class="metric-sub">
          Penjualan bersih realtime ${growthHtml}
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🧾</span>
          <span>Transaksi Selesai</span>
        </div>
        <div class="metric-value emerald">
          ${totalBills} Struk
        </div>
        <div class="metric-sub">Order lunas kasir</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🎯</span>
          <span>Rata-Rata Transaksi</span>
        </div>
        <div class="metric-value gold">
          ${formatRupiah(avgBasket)}
        </div>
        <div class="metric-sub">Basket size / invoice</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>💻</span>
          <span>Workspace Aktif</span>
        </div>
        <div class="metric-value" style="color:#48D1CC;">
          ${activeWsCount} Sesi
        </div>
        <div class="metric-sub">Tamu sedang bekerja</div>
      </div>
    </div>

    <!-- 2 Column Breakdown -->
    <div class="grid-2">
      <!-- Payment Methods Share -->
      <div class="table-box">
        <div class="table-header" style="grid-template-columns: 2fr 1fr 1fr;">
          <span>Metode Pembayaran</span>
          <span style="text-align:right;">Porsi</span>
          <span style="text-align:right;">Total Omzet</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <span style="font-weight:600;color:#FFFFFF;">📱 QRIS Dinamis (EMVCo)</span>
          <span style="text-align:right;color:#9CA3AF;">${qrisShare}%</span>
          <span style="text-align:right;font-weight:700;color:#60A5FA;">${formatRupiah(qrisTotal)}</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <span style="font-weight:600;color:#FFFFFF;">💵 Uang Tunai (Cash)</span>
          <span style="text-align:right;color:#9CA3AF;">${cashShare}%</span>
          <span style="text-align:right;font-weight:700;color:#10B981;">${formatRupiah(cashTotal)}</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <span style="font-weight:600;color:#FFFFFF;">🏛️ Transfer / EDC Bank</span>
          <span style="text-align:right;color:#9CA3AF;">${transferShare}%</span>
          <span style="text-align:right;font-weight:700;color:#C084FC;">${formatRupiah(transferTotal)}</span>
        </div>
      </div>

      <!-- Top 3 Best Sellers -->
      <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:20px;">
        <div style="font-size:12px;font-weight:800;color:#FBBF24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span>🏆 3 MENU PALING LARIS HARI INI:</span>
        </div>
        ${topProductsHtml || '<div style="color:#6B7280;font-style:italic;font-size:13px;">Belum ada data transaksi menu hari ini</div>'}
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'EXECUTIVE LIVE SUMMARY',
    badgeColor: 'badge-coral',
    title: 'Ringkasan Eksekutif Penjualan Realtime',
    subtitle: `Pemantauan performa bisnis outlet Komazi Coffee & Workspace hari ini`,
    bodyContent,
  });
}

/**
 * 22. CardSalesReport - Laporan Penjualan Periode (/laporan)
 */
export function renderSalesReportCard(data = {}) {
  const periodLabel = data.periodLabel || 'Hari Ini';
  const totalRevenue = Number(data.totalRevenue || 0);
  const totalTransactions = Number(data.totalTransactions || 0);
  const avgTransaction = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

  const byMethod = data.byMethod || { CASH: 0, QRIS: 0, TRANSFER: 0 };
  const topProducts = Array.isArray(data.topProducts) ? data.topProducts : [];

  const topProductsHtml = topProducts.slice(0, 5).map((p, idx) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-family:'Outfit',sans-serif;font-weight:900;color:#FBBF24;font-size:14px;">#${idx + 1}</span>
        <span style="font-weight:600;font-size:13px;color:#FFF;">${escapeHtml(p.name)}</span>
      </div>
      <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#10B981;font-size:13px;">${p.qty} terjual</span>
    </div>
  `).join('');

  const bodyContent = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>💰</span>
          <span>Total Omzet Periode</span>
        </div>
        <div class="metric-value large coral">
          ${formatRupiah(totalRevenue)}
        </div>
        <div class="metric-sub">Periode: ${escapeHtml(periodLabel)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🧾</span>
          <span>Jumlah Transaksi</span>
        </div>
        <div class="metric-value emerald">
          ${totalTransactions} Transaksi
        </div>
        <div class="metric-sub">Semua struk lunas</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🎯</span>
          <span>Rata-Rata Transaksi</span>
        </div>
        <div class="metric-value gold">
          ${formatRupiah(avgTransaction)}
        </div>
        <div class="metric-sub">Basket size periode</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Methods -->
      <div class="table-box">
        <div class="table-header" style="grid-template-columns: 2fr 1fr;">
          <span>Metode Pembayaran</span>
          <span style="text-align:right;">Total Omzet</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr;">
          <span style="font-weight:600;color:#FFF;">📱 QRIS Dinamis</span>
          <span style="text-align:right;font-weight:700;color:#60A5FA;">${formatRupiah(byMethod.QRIS || 0)}</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr;">
          <span style="font-weight:600;color:#FFF;">💵 Tunai (Cash)</span>
          <span style="text-align:right;font-weight:700;color:#10B981;">${formatRupiah(byMethod.CASH || 0)}</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr;">
          <span style="font-weight:600;color:#FFF;">🏛️ Transfer Bank / EDC</span>
          <span style="text-align:right;font-weight:700;color:#C084FC;">${formatRupiah(byMethod.TRANSFER || 0)}</span>
        </div>
      </div>

      <!-- Top 5 -->
      <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:20px;">
        <div style="font-size:12px;font-weight:800;color:#FBBF24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
          TOP 5 MENU PALING LARIS:
        </div>
        ${topProductsHtml || '<div style="color:#6B7280;font-style:italic;">Belum ada data penjualan menu pada periode ini</div>'}
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: `LAPORAN • ${periodLabel.toUpperCase()}`,
    badgeColor: 'badge-gold',
    title: `Laporan Penjualan: ${periodLabel}`,
    subtitle: `Rekapitulasi pendapatan dan statistik menu pesanan untuk periode terpilih`,
    bodyContent,
  });
}

/**
 * 23. CardDailyCloseBook - Laporan Tutup Buku Harian EOD (22:00 WIB)
 */
export function renderDailyCloseBookCard(data = {}) {
  const outletName = data.outletName || 'Komazi Coffee & Workspace';
  const dateFormatted = data.dateFormatted || formatDateWib();
  const grossSales = Number(data.grossSales || data.totalRevenue || 0);
  const discounts = Number(data.totalDiscounts || data.discounts || 0);
  const tax = Number(data.totalTax || data.tax || 0);
  const netRevenue = Number(data.netRevenue || (grossSales - discounts));
  const totalBills = Number(data.totalTransactions || 0);
  const targetPercent = Number(data.targetAchievement || 108);

  const topProducts = Array.isArray(data.topProducts) ? data.topProducts : [];

  const bodyContent = `
    <!-- Top Financial Summary -->
    <div class="grid-4" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>👑</span>
          <span>Pendapatan Bersih (Net)</span>
        </div>
        <div class="metric-value large coral">
          ${formatRupiah(netRevenue)}
        </div>
        <div class="metric-sub">Setelah diskon &amp; penyesuaian</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📊</span>
          <span>Penjualan Kotor (Gross)</span>
        </div>
        <div class="metric-value">
          ${formatRupiah(grossSales)}
        </div>
        <div class="metric-sub">Total nilai item terjual</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🏛️</span>
          <span>Pajak Restoran PB1</span>
        </div>
        <div class="metric-value gold">
          ${formatRupiah(tax)}
        </div>
        <div class="metric-sub">Kewajiban pajak daerah</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🎯</span>
          <span>Capaian Target Harian</span>
        </div>
        <div class="metric-value emerald">
          ${targetPercent}%
        </div>
        <div class="metric-sub">Target omzet tercapai ⭐</div>
      </div>
    </div>

    <!-- Shift & Menu Highlights -->
    <div class="grid-2">
      <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:22px;">
        <div style="font-size:12px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">
          IKHTISAR OPERASIONAL HARI INI:
        </div>
        <div style="space-y:8px;font-size:13px;line-height:2;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Total Struk Lunas:</span>
            <span style="font-weight:700;color:#FFF;">${totalBills} Transaksi</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Total Potongan Diskon:</span>
            <span style="font-weight:700;color:#EF4444;">-${formatRupiah(discounts)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#9CA3AF;">Outlet Penanggung Jawab:</span>
            <span style="font-weight:700;color:#FFF;">${escapeHtml(outletName)}</span>
          </div>
        </div>
      </div>

      <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:22px;">
        <div style="font-size:12px;font-weight:800;color:#FBBF24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">
          TOP 3 MENU PALING LARIS HARI INI:
        </div>
        ${
          topProducts.slice(0, 3).map((p, idx) => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;">
              <span style="font-weight:600;font-size:13px;color:#FFF;">#${idx + 1} ${escapeHtml(p.name)}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#10B981;">${p.qty}</span>
            </div>
          `).join('') || '<div style="color:#6B7280;font-style:italic;">Data menu tuntas diarsipkan</div>'
        }
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'DAILY CLOSE BOOK SETTLEMENT',
    badgeColor: 'badge-gold',
    title: 'Laporan Tutup Buku Harian',
    subtitle: `Rekapitulasi resmi penutupan kas dan operasional outlet per ${dateFormatted}`,
    bodyContent,
  });
}
