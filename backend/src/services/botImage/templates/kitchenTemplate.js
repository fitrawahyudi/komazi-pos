import { wrapCardHtml, formatRupiah, escapeHtml, formatDateWib, formatTimeWib } from '../styles/brandTheme.js';

/**
 * 6. CardKitchenTicket - Tiket Pesanan Masuk ke Barista (KDS)
 */
export function renderKitchenTicketCard(data = {}) {
  const orderNo = data.invoiceNo || data.orderNo || 'KMZ-' + Date.now().toString().slice(-6);
  const orderType = data.type || data.orderType || 'DINE_IN';
  const tableNo = data.tableNo ? `Meja ${data.tableNo}` : (orderType === 'TAKE_AWAY' ? 'Take Away (Bungkus)' : 'Dine In');
  const customerName = data.customerName || data.customer?.name || 'Tamu Pelanggan';
  const cashierName = data.cashier?.name || data.cashierName || 'Kasir';
  const orderTime = data.createdAt ? formatTimeWib(data.createdAt) : formatTimeWib();

  const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : [
    { qty: 2, productName: 'Aren Latte Signature', variantName: 'Ice • Less Sugar 50%', notes: 'Oat Milk' },
    { qty: 1, productName: 'Butter Croissant', variantName: 'Warm Toasted', notes: '' },
  ];

  const totalQty = items.reduce((acc, i) => acc + Number(i.qty || 1), 0);

  const itemsHtml = items.map((item, idx) => {
    const qty = Number(item.qty || 1);
    const name = item.productName || item.name || 'Produk';
    const variant = item.variantName ? `(${escapeHtml(item.variantName)})` : '';
    const note = item.notes ? `<div style="font-size:11px;color:#FBBF24;margin-top:2px;">↳ Note: "${escapeHtml(item.notes)}"</div>` : '';

    return `
      <div class="table-row" style="grid-template-columns: 48px 1fr 100px;background:${idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'};">
        <span style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:900;color:#FF5A4D;text-align:center;">
          ${qty}×
        </span>
        <div>
          <div style="font-weight:700;font-size:14px;color:#FFFFFF;">
            ${escapeHtml(name)} <span style="font-size:12px;color:#9CA3AF;font-weight:500;">${variant}</span>
          </div>
          ${note}
        </div>
        <div style="text-align:right;">
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(255,90,77,0.15);color:#FF5A4D;border:1px solid rgba(255,90,77,0.3);">
            RUSH
          </span>
        </div>
      </div>
    `;
  }).join('');

  const bodyContent = `
    <!-- Top Metadata -->
    <div class="grid-4">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>📍</span>
          <span>Area / Lokasi</span>
        </div>
        <div class="metric-value coral" style="font-size:22px;">
          ${escapeHtml(tableNo)}
        </div>
        <div class="metric-sub">${escapeHtml(orderType)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Nama Pemesan</span>
        </div>
        <div class="metric-value" style="font-size:20px;">
          ${escapeHtml(customerName)}
        </div>
        <div class="metric-sub">Oleh Kasir: ${escapeHtml(cashierName)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⏰</span>
          <span>Waktu Order</span>
        </div>
        <div class="metric-value">
          ${orderTime}
        </div>
        <div class="metric-sub">${formatDateWib()}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📦</span>
          <span>Total Item</span>
        </div>
        <div class="metric-value large emerald">
          ${totalQty} <span style="font-size:14px;font-weight:500;color:#9CA3AF;">Porsi</span>
        </div>
        <div class="metric-sub">${items.length} Macam Menu</div>
      </div>
    </div>

    <!-- Items Table -->
    <div class="table-box">
      <div class="table-header" style="grid-template-columns: 48px 1fr 100px;">
        <span style="text-align:center;">Qty</span>
        <span>Rincian Item &amp; Customization</span>
        <span style="text-align:right;">Status</span>
      </div>
      ${itemsHtml}
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'KOT • TIKET BARISTA BARU',
    badgeColor: 'badge-coral',
    title: `Tiket Pesanan #${orderNo}`,
    subtitle: `Pesanan baru siap diproses oleh tim Barista & Dapur Komazi`,
    bodyContent,
    metaId: `#${orderNo}`,
  });
}

/**
 * 7. CardQueueDashboard - Dashboard Antrean Pesanan Barista & Dapur
 */
export function renderQueueDashboardCard(data = {}) {
  const queue = Array.isArray(data.queue) ? data.queue : [];
  const inProgress = queue.filter(q => q.status === 'PREPARING' || q.status === 'IN_PROGRESS');
  const pending = queue.filter(q => q.status === 'PENDING' || q.status === 'WAITING' || (!q.status || q.status === 'PAID'));

  const totalActive = queue.length;

  const renderQueueItem = (o) => {
    const inv = o.invoiceNo || 'KMZ';
    const loc = o.tableNo ? `Meja ${o.tableNo}` : (o.type || 'Dine In');
    const itemsCount = (o.items || []).length || 1;
    const itemsPreview = (o.items || []).slice(0, 2).map(i => `${i.qty}x ${i.productName || i.name}`).join(', ');

    return `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-family:'Outfit',sans-serif;font-weight:800;font-size:14px;color:#FFF;">${escapeHtml(inv)}</span>
          <span style="font-size:11px;font-weight:700;color:#FBBF24;background:rgba(245,158,11,0.15);padding:2px 8px;border-radius:6px;">${escapeHtml(loc)}</span>
        </div>
        <div style="font-size:11.5px;color:#9CA3AF;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escapeHtml(itemsPreview)} (${itemsCount} items)
        </div>
      </div>
    `;
  };

  const bodyContent = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>⏳</span>
          <span>Total Antrean Aktif</span>
        </div>
        <div class="metric-value large coral">
          ${totalActive} <span style="font-size:14px;font-weight:500;color:#9CA3AF;">Tiket</span>
        </div>
        <div class="metric-sub">Membutuhkan peracikan</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🟡</span>
          <span>Sedang Diracik</span>
        </div>
        <div class="metric-value gold">
          ${inProgress.length} Tiket
        </div>
        <div class="metric-sub">In-Progress Barista</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⚪</span>
          <span>Menunggu Giliran</span>
        </div>
        <div class="metric-value">
          ${pending.length} Tiket
        </div>
        <div class="metric-sub">Antrean masuk baru</div>
      </div>
    </div>

    <!-- 2 Column Board -->
    <div class="grid-2">
      <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(245,158,11,0.25);border-radius:18px;padding:18px;">
        <div style="font-size:12px;font-weight:800;color:#FBBF24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span>☕ SEDANG DIRACIK (${inProgress.length})</span>
        </div>
        ${inProgress.length > 0 ? inProgress.map(renderQueueItem).join('') : '<div style="font-size:12px;color:#6B7280;font-style:italic;padding:16px 0;text-align:center;">Belum ada pesanan yang sedang diracik</div>'}
      </div>

      <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:18px;">
        <div style="font-size:12px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span>📋 MENUNGGU GILIRAN (${pending.length})</span>
        </div>
        ${pending.length > 0 ? pending.map(renderQueueItem).join('') : '<div style="font-size:12px;color:#6B7280;font-style:italic;padding:16px 0;text-align:center;">Semua pesanan sudah diproses!</div>'}
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: data.badgeText || 'KDS QUEUE DASHBOARD',
    badgeColor: data.badgeColor || 'badge-amber',
    title: data.title || 'Status Antrean Barista & Dapur',
    subtitle: data.subtitle || 'Pemantauan live beban antrean minuman & makanan Komazi POS',
    bodyContent,
  });
}

/**
 * 8. CardOrderReady - Notifikasi Pesanan Siap Saji
 */
export function renderOrderReadyCard(data = {}) {
  const invoiceNo = data.invoiceNo || 'KMZ-' + Date.now().toString().slice(-6);
  const tableNo = data.tableNo ? `Meja ${data.tableNo}` : (data.type || 'Dine In');
  const customerName = data.customerName || 'Pelanggan';
  const readyAt = formatTimeWib();
  const baristaName = data.baristaName || 'Barista';

  const bodyContent = `
    <div class="grid-3">
      <div class="metric-card highlight" style="border-color:rgba(16,185,129,0.35);background:linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(20,20,24,0.8) 100%);">
        <div class="metric-label" style="color:#10B981;">
          <span>☕</span>
          <span>Status Pesanan</span>
        </div>
        <div class="metric-value large emerald">
          SIAP DISAJIKAN
        </div>
        <div class="metric-sub">Silakan diantar ke pelanggan</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📍</span>
          <span>Tujuan Penyajian</span>
        </div>
        <div class="metric-value">
          ${escapeHtml(tableNo)}
        </div>
        <div class="metric-sub">Tamu: ${escapeHtml(customerName)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Peracik (Barista)</span>
        </div>
        <div class="metric-value">
          ${escapeHtml(baristaName)}
        </div>
        <div class="metric-sub">Selesai pada: ${readyAt}</div>
      </div>
    </div>

    <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:18px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:24px;">🔔</span>
        <div>
          <div style="font-size:14px;font-weight:800;color:#FFF;">Notifikasi Kasir &amp; Waiter</div>
          <div style="font-size:12px;color:#9CA3AF;">Mohon ambil pesanan dari bar counter dan serahkan ke meja tujuan.</div>
        </div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#10B981;">
        READY FOR PICKUP
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'PESANAN SIAP SAJI',
    badgeColor: 'badge-emerald',
    title: `Pesanan Siap! #${invoiceNo}`,
    subtitle: `Seluruh racikan pesanan telah tuntas dan siap dihidangkan`,
    bodyContent,
    metaId: `#${invoiceNo}`,
  });
}
