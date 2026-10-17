import { wrapCardHtml, formatRupiah, escapeHtml, formatDateWib, formatTimeWib } from '../styles/brandTheme.js';

/**
 * 16. CardApprovalRequest - Permintaan Persetujuan Void / Diskon (Approval)
 */
export function renderApprovalRequestCard(data = {}) {
  const reqId = data.reqId || (data.request ? data.request.id : 'REQ-' + Date.now().toString().slice(-4));
  const type = data.type || (data.request ? data.request.type : 'VOID_ORDER');
  const invoiceNo = data.invoiceNo || (data.order ? data.order.invoiceNo : 'KMZ-ORDER');
  const amount = Number(data.amount || (data.order ? data.order.total : 0));
  const requesterName = data.requesterName || (data.request?.requester?.name) || 'Kasir';
  const reason = data.reason || (data.request ? data.request.reason : 'Tidak ada alasan dicantumkan.');

  const typeLabels = {
    VOID_ORDER: 'Pembatalan Seluruh Pesanan (Void Bill)',
    VOID_ITEM: 'Pembatalan Menu Tertentu (Void Item)',
    DISCOUNT: 'Pemberian Diskon Khusus Kasir',
    REFUND: 'Pengembalian Dana Pembayaran (Refund)',
  };

  const bodyContent = `
    <div class="grid-4" style="margin-bottom:20px;">
      <div class="metric-card highlight" style="border-color:rgba(245,158,11,0.4);background:linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(20,20,24,0.85) 100%);">
        <div class="metric-label" style="color:#FBBF24;">
          <span>⚖️</span>
          <span>Tipe Tindakan</span>
        </div>
        <div class="metric-value gold" style="font-size:18px;">
          ${escapeHtml(typeLabels[type] || type)}
        </div>
        <div class="metric-sub">Memerlukan otorisasi</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>💰</span>
          <span>Nominal Transaksi</span>
        </div>
        <div class="metric-value large coral">
          ${formatRupiah(amount)}
        </div>
        <div class="metric-sub">Nilai pesanan terlibat</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Kasir Pemohon</span>
        </div>
        <div class="metric-value" style="font-size:18px;">
          ${escapeHtml(requesterName)}
        </div>
        <div class="metric-sub">Staf pembuat pengajuan</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🧾</span>
          <span>Invoice Terkait</span>
        </div>
        <div class="metric-value" style="font-size:16px;">
          ${escapeHtml(invoiceNo)}
        </div>
        <div class="metric-sub">Order ID di POS</div>
      </div>
    </div>

    <!-- Reason Box -->
    <div style="background:rgba(24,24,28,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:22px;">
      <div style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
        ALASAN PENGAJUAN DARI KASIR:
      </div>
      <div style="font-size:14px;color:#F3F4F6;line-height:1.6;font-style:italic;background:rgba(0,0,0,0.3);padding:14px 18px;border-radius:14px;border:1px solid rgba(255,255,255,0.06);">
        "${escapeHtml(reason)}"
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;font-size:12px;color:#9CA3AF;">
        <span>Tekan tombol inline di Telegram untuk memberikan keputusan secara aman.</span>
        <span style="color:#FBBF24;font-weight:700;">WAITING DECISION</span>
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'PERMINTAAN PERSETUJUAN',
    badgeColor: 'badge-amber',
    title: `Persetujuan #${reqId} • ${invoiceNo}`,
    subtitle: `Otorisasi manajerial diperlukan sebelum pembatalan atau perubahan dieksekusi di kasir`,
    bodyContent,
    metaId: `#REQ-${reqId}`,
  });
}

/**
 * 17. CardApprovalResult - Hasil Keputusan Approval (Disetujui / Ditolak)
 */
export function renderApprovalResultCard(data = {}) {
  const reqId = data.reqId || 'REQ';
  const type = data.type || 'VOID';
  const approved = Boolean(data.approved || data.decision === 'ok');
  const deciderName = data.deciderName || 'Owner';
  const deciderRole = data.deciderRole || 'OWNER';
  const decidedAt = formatTimeWib();

  const isApproved = approved;
  const statusColor = isApproved ? '#10B981' : '#EF4444';
  const statusText = isApproved ? 'DISETUJUI (APPROVED)' : 'DITOLAK (REJECTED)';
  const badgeClass = isApproved ? 'badge-emerald' : 'badge-rose';

  const bodyContent = `
    <div class="grid-3">
      <div class="metric-card highlight" style="border-color:${statusColor};background:linear-gradient(135deg, ${isApproved ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'} 0%, rgba(20,20,24,0.85) 100%);">
        <div class="metric-label" style="color:${statusColor};">
          <span>⚖️</span>
          <span>Status Keputusan</span>
        </div>
        <div class="metric-value large ${isApproved ? 'emerald' : 'coral'}">
          ${statusText}
        </div>
        <div class="metric-sub">Telah diputuskan oleh pimpinan</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Pengambil Keputusan</span>
        </div>
        <div class="metric-value">
          ${escapeHtml(deciderName)}
        </div>
        <div class="metric-sub">Role: ${escapeHtml(deciderRole)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⏰</span>
          <span>Waktu Keputusan</span>
        </div>
        <div class="metric-value">
          ${decidedAt}
        </div>
        <div class="metric-sub">${formatDateWib()}</div>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:24px;">${isApproved ? '✅' : '❌'}</span>
        <div>
          <div style="font-size:14px;font-weight:700;color:#FFF;">Notifikasi Resmi Kasir &amp; Pemohon</div>
          <div style="font-size:12px;color:#9CA3AF;">Layar kasir web otomatis memperbarui status tindakan sesuai keputusan otorisasi ini.</div>
        </div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:${statusColor};">
        ${isApproved ? 'AUTHORIZED' : 'DENIED'}
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: isApproved ? 'APPROVAL DISETUJUI' : 'APPROVAL DITOLAK',
    badgeColor: badgeClass,
    title: `Hasil Otorisasi #${reqId}`,
    subtitle: `Keputusan resmi terhadap pengajuan otorisasi staf outlet Komazi`,
    bodyContent,
    metaId: `#${reqId}`,
  });
}

/**
 * 25. CardSecurityAlert - Peringatan Darurat Void Nominal Tinggi
 */
export function renderSecurityAlertCard(data = {}) {
  const invoiceNo = data.invoiceNo || (data.order ? data.order.invoiceNo : 'KMZ-VOID');
  const amount = Number(data.amount || (data.order ? data.order.total : 0));
  const reason = data.reason || 'Tidak ada keterangan pembatalan.';
  const time = formatTimeWib();

  const bodyContent = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="metric-card highlight" style="border-color:rgba(239,68,68,0.5);background:linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(20,20,24,0.9) 100%);">
        <div class="metric-label" style="color:#F87171;">
          <span>🚨</span>
          <span>Nominal Void Alert</span>
        </div>
        <div class="metric-value large coral">
          ${formatRupiah(amount)}
        </div>
        <div class="metric-sub">Melebihi batas threshold keamanan</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🧾</span>
          <span>No. Transaksi</span>
        </div>
        <div class="metric-value" style="font-size:20px;">
          ${escapeHtml(invoiceNo)}
        </div>
        <div class="metric-sub">Dibatalkan dari POS</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⏰</span>
          <span>Waktu Kejadian</span>
        </div>
        <div class="metric-value">
          ${time}
        </div>
        <div class="metric-sub">${formatDateWib()}</div>
      </div>
    </div>

    <div style="background:rgba(239,68,68,0.1);border:1.5px solid rgba(239,68,68,0.4);border-radius:20px;padding:22px;">
      <div style="font-size:11px;font-weight:800;color:#F87171;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">
        ⚠️ ALASAN PEMBATALAN TRANSAKSI:
      </div>
      <div style="font-size:14px;color:#FFF;line-height:1.6;font-style:italic;background:rgba(0,0,0,0.4);padding:14px 18px;border-radius:12px;border:1px solid rgba(239,68,68,0.25);">
        "${escapeHtml(reason)}"
      </div>
      <div style="font-size:12px;color:#D1D5DB;margin-top:14px;">
        Notifikasi ini dikirimkan langsung ke Owner untuk memastikan akurasi dan mencegah kecurangan laci kasir.
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'SECURITY ALERT • HIGH VOID',
    badgeColor: 'badge-rose',
    title: 'Peringatan Pembatalan Pesanan Tinggi',
    subtitle: `Transaksi dibatalkan dengan nominal mencapai batas batas void alert`,
    bodyContent,
    metaId: `#VOID-${invoiceNo}`,
  });
}
