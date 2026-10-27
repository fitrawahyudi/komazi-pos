import { wrapCardHtml, formatRupiah, escapeHtml, formatDateWib, formatTimeWib } from '../styles/brandTheme.js';

/**
 * 1. CardShiftOpen - Kartu Buka Shift Kasir
 */
export function renderShiftOpenCard(data = {}) {
  const cashierName = data.cashierName || data.user?.name || 'Kasir';
  const outletName = data.outletName || 'Komazi Coffee & Workspace ';
  const initialCash = Number(data.initialCash || data.openingCash || data.amount || 0);
  const openedAt = data.openedAt ? formatTimeWib(data.openedAt) : formatTimeWib();
  const shiftId = data.shiftId || (data.shift ? data.shift.id : 'SHF-' + Date.now().toString().slice(-6));

  const bodyContent = `
    <div class="grid-3">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>💵</span>
          <span>Modal Kas Awal</span>
        </div>
        <div class="metric-value large emerald">
          ${formatRupiah(initialCash)}
        </div>
        <div class="metric-sub">Kas fisik dalam laci kasir</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Kasir Penanggung Jawab</span>
        </div>
        <div class="metric-value">
          ${escapeHtml(cashierName)}
        </div>
        <div class="metric-sub">Role: CASHIER • Shift Aktif</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⏰</span>
          <span>Waktu Buka Kasir</span>
        </div>
        <div class="metric-value">
          ${openedAt}
        </div>
        <div class="metric-sub">${formatDateWib()}</div>
      </div>
    </div>

    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:18px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(16,185,129,0.2);display:flex;align-items:center;justify-content:center;color:#10B981;font-weight:900;">
          ✓
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#F3F4F6;">Laci Kasir &amp; POS Siap Menerima Transaksi</div>
          <div style="font-size:11px;color:#9CA3AF;">Semua penjualan tunai dan QRIS akan tercatat otomatis dalam sesi shift ini.</div>
        </div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#10B981;font-weight:700;background:rgba(16,185,129,0.12);padding:6px 12px;border-radius:8px;">
        SHIFT READY
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'SHIFT KASIR AKTIF',
    badgeColor: 'badge-emerald',
    title: 'Buka Shift Kasir Berhasil',
    subtitle: `Sesi shift kasir baru telah resmi dibuka di ${outletName}`,
    bodyContent,
    metaId: `#${shiftId}`,
  });
}

/**
 * 2. CardShiftClosed - Kartu Tutup Shift Kasir (Z-Report)
 */
export function renderShiftClosedCard(data = {}) {
  const cashierName = data.cashierName || data.user?.name || 'Kasir';
  const initialCash = Number(data.initialCash || data.openingCash || 0);
  const closingCash = Number(data.closingCash || data.actualCash || 0);
  const expectedCash = Number(data.expectedCash || (initialCash + Number(data.cashSales || 0)));
  const cashSales = Number(data.cashSales || 0);
  const qrisSales = Number(data.qrisSales || data.nonCashSales || 0);
  const transferSales = Number(data.transferSales || 0);
  const totalSales = Number(data.totalSales || (cashSales + qrisSales + transferSales));
  const diff = Number(data.diff !== undefined ? data.diff : (closingCash - expectedCash));
  const notes = data.notes || data.catatan || 'Shift ditutup tanpa catatan khusus.';
  const shiftId = data.shiftId || 'Z-REP-' + Date.now().toString().slice(-6);

  let diffBadge = 'KAS IMBANG (0)';
  let diffClass = 'emerald';
  let diffColor = '#10B981';
  let diffBg = 'rgba(16,185,129,0.15)';
  if (diff > 0) {
    diffBadge = `SURPLUS +${formatRupiah(diff)}`;
    diffClass = 'gold';
    diffColor = '#F59E0B';
    diffBg = 'rgba(245,158,11,0.15)';
  } else if (diff < 0) {
    diffBadge = `DEFISIT ${formatRupiah(diff)}`;
    diffClass = 'coral';
    diffColor = '#FF5A4D';
    diffBg = 'rgba(255,90,77,0.15)';
  }

  const bodyContent = `
    <!-- Top Summary Metrics -->
    <div class="grid-4">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>💰</span>
          <span>Total Omzet Shift</span>
        </div>
        <div class="metric-value large coral">
          ${formatRupiah(totalSales)}
        </div>
        <div class="metric-sub">Tunai + QRIS + Transfer</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>💵</span>
          <span>Kas Aktual Fisik</span>
        </div>
        <div class="metric-value emerald">
          ${formatRupiah(closingCash)}
        </div>
        <div class="metric-sub">Dihitung di laci kas</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🧮</span>
          <span>Kas Seharusnya</span>
        </div>
        <div class="metric-value">
          ${formatRupiah(expectedCash)}
        </div>
        <div class="metric-sub">Modal + Penjualan Tunai</div>
      </div>

      <div class="metric-card" style="border-color:${diffColor};background:${diffBg};">
        <div class="metric-label" style="color:${diffColor};">
          <span>⚖️</span>
          <span>Status Selisih</span>
        </div>
        <div class="metric-value ${diffClass}" style="font-size:20px;">
          ${diffBadge}
        </div>
        <div class="metric-sub" style="color:#D1D5DB;">Rekonsiliasi Fisik</div>
      </div>
    </div>

    <!-- Breakdown Table & Notes -->
    <div class="grid-2">
      <div class="table-box">
        <div class="table-header" style="grid-template-columns: 2fr 1fr 1fr;">
          <span>Metode Pembayaran</span>
          <span style="text-align:right;">Porsi</span>
          <span style="text-align:right;">Nominal</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <span style="font-weight:600;color:#FFFFFF;">💵 Uang Tunai</span>
          <span style="text-align:right;color:#9CA3AF;">${totalSales > 0 ? Math.round((cashSales / totalSales) * 100) : 0}%</span>
          <span style="text-align:right;font-weight:700;color:#10B981;">${formatRupiah(cashSales)}</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <span style="font-weight:600;color:#FFFFFF;">📱 QRIS Dinamis (EMVCo)</span>
          <span style="text-align:right;color:#9CA3AF;">${totalSales > 0 ? Math.round((qrisSales / totalSales) * 100) : 0}%</span>
          <span style="text-align:right;font-weight:700;color:#60A5FA;">${formatRupiah(qrisSales)}</span>
        </div>
        <div class="table-row" style="grid-template-columns: 2fr 1fr 1fr;">
          <span style="font-weight:600;color:#FFFFFF;">🏛️ Transfer / EDC Bank</span>
          <span style="text-align:right;color:#9CA3AF;">${totalSales > 0 ? Math.round((transferSales / totalSales) * 100) : 0}%</span>
          <span style="text-align:right;font-weight:700;color:#C084FC;">${formatRupiah(transferSales)}</span>
        </div>
      </div>

      <div style="background:rgba(24,24,28,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
            📝 CATATAN KASIR PENANGGUNG JAWAB:
          </div>
          <div style="font-size:13px;color:#F3F4F6;line-height:1.6;font-style:italic;background:rgba(0,0,0,0.3);padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
            "${escapeHtml(notes)}"
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06);font-size:11.5px;color:#9CA3AF;">
          <span>Kasir: <b style="color:#FFF;">${escapeHtml(cashierName)}</b></span>
          <span style="color:#10B981;font-weight:700;">Z-REPORT VERIFIED</span>
        </div>
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'Z-REPORT SETTLEMENT',
    badgeColor: 'badge-amber',
    title: 'Tutup Shift Kasir & Rekonsiliasi',
    subtitle: `Laporan penutupan buku shift kasir oleh ${cashierName}`,
    bodyContent,
    metaId: `#${shiftId}`,
  });
}
