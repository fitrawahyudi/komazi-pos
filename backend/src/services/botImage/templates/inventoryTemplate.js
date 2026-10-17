import { wrapCardHtml, formatRupiah, escapeHtml, formatDateWib, formatTimeWib } from '../styles/brandTheme.js';

/**
 * 18. CardInventoryCritical - Peringatan Stok Bahan Menipis / Kritis
 */
export function renderInventoryCriticalCard(data = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  const criticalCount = items.length;

  const rowsHtml = items.map((i, idx) => {
    const cur = parseFloat(i.stock || i.currentStock || 0);
    const min = parseFloat(i.minStock || 0);
    const unit = i.unit || 'unit';
    const percent = min > 0 ? Math.min(100, Math.round((cur / min) * 100)) : 0;

    return `
      <div class="table-row" style="grid-template-columns: 2fr 1fr 1fr 120px;background:${idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'};">
        <div>
          <span style="font-weight:700;color:#FFF;font-size:14px;">${escapeHtml(i.name || i.ingredientName)}</span>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#EF4444;font-size:14px;">
          ${cur} ${escapeHtml(unit)}
        </div>
        <div style="color:#9CA3AF;font-size:13px;">
          Min: ${min} ${escapeHtml(unit)}
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;background:rgba(239,68,68,0.15);color:#F87171;border:1px solid rgba(239,68,68,0.35);">
            SISA ${percent}%
          </span>
        </div>
      </div>
    `;
  }).join('');

  const bodyContent = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="metric-card highlight" style="border-color:rgba(239,68,68,0.4);background:linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(20,20,24,0.85) 100%);">
        <div class="metric-label" style="color:#F87171;">
          <span>🚨</span>
          <span>Bahan Kritis</span>
        </div>
        <div class="metric-value large coral">
          ${criticalCount} <span style="font-size:14px;color:#9CA3AF;font-weight:500;">Item Bahan</span>
        </div>
        <div class="metric-sub">Di bawah batas minimum</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📦</span>
          <span>Tindakan Restock</span>
        </div>
        <div class="metric-value" style="font-size:20px;">
          Segera Pesan
        </div>
        <div class="metric-sub">Hubungi supplier mitra</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📝</span>
          <span>Pencatatan Cepat</span>
        </div>
        <div class="metric-value gold" style="font-size:18px;">
          /stok_masuk
        </div>
        <div class="metric-sub">Input bukti barang tiba</div>
      </div>
    </div>

    <!-- Table of Critical Items -->
    <div class="table-box">
      <div class="table-header" style="grid-template-columns: 2fr 1fr 1fr 120px;">
        <span>Nama Bahan Baku</span>
        <span>Sisa Stok Fisik</span>
        <span>Batas Minimum (Safety)</span>
        <span style="text-align:right;">Level Resiko</span>
      </div>
      ${rowsHtml || '<div style="padding:20px;text-align:center;color:#6B7280;">Semua stok bahan dalam batas aman!</div>'}
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'PERINGATAN STOK MENIPIS',
    badgeColor: 'badge-rose',
    title: 'Peringatan Stok Bahan Baku Menipis',
    subtitle: `Bahan baku di bawah batas aman dapat menghambat racikan pesanan kasir & barista`,
    bodyContent,
  });
}

/**
 * 19. CardGoodsReceipt - Bukti Penerimaan Stok Masuk (Restock Voucher)
 */
export function renderGoodsReceiptCard(data = {}) {
  const ingredientName = data.ingredientName || (data.ingredient ? data.ingredient.name : 'Bahan Baku');
  const qtyAdded = Number(data.qtyAdded || data.quantity || 0);
  const unit = data.unit || 'unit';
  const newStock = Number(data.newStock || 0);
  const cost = Number(data.cost || data.totalCost || 0);
  const supplier = data.supplier || 'Supplier Mitra Komazi';
  const recordedBy = data.recordedBy || data.user?.name || 'Manager';

  const bodyContent = `
    <div class="grid-4">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>📦</span>
          <span>Jumlah Diterima</span>
        </div>
        <div class="metric-value large emerald">
          +${qtyAdded} <span style="font-size:16px;color:#9CA3AF;font-weight:500;">${escapeHtml(unit)}</span>
        </div>
        <div class="metric-sub">Stok baru ditambahkan</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📊</span>
          <span>Total Stok Akhir</span>
        </div>
        <div class="metric-value">
          ${newStock} ${escapeHtml(unit)}
        </div>
        <div class="metric-sub">Tercatat di gudang POS</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>💰</span>
          <span>Biaya Pembelian</span>
        </div>
        <div class="metric-value gold">
          ${cost > 0 ? formatRupiah(cost) : 'Rp 0'}
        </div>
        <div class="metric-sub">Pengeluaran COGS/HPP</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Penerima (Staf)</span>
        </div>
        <div class="metric-value" style="font-size:18px;">
          ${escapeHtml(recordedBy)}
        </div>
        <div class="metric-sub">Supplier: ${escapeHtml(supplier)}</div>
      </div>
    </div>

    <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:18px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:14px;font-weight:800;color:#FFF;">Bahan: ${escapeHtml(ingredientName)}</div>
        <div style="font-size:12px;color:#9CA3AF;margin-top:2px;">Kuantitas bahan baku telah diperbarui dan langsung tersedia untuk kalkulasi menu resep.</div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#10B981;background:rgba(16,185,129,0.15);padding:6px 14px;border-radius:8px;">
        STOK MASUK SUKSES
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'RECEIPT NOTE',
    badgeColor: 'badge-emerald',
    title: `Penerimaan Stok: ${ingredientName}`,
    subtitle: `Pencatatan restock bahan baku berhasil dimasukkan ke inventaris`,
    bodyContent,
  });
}

/**
 * 20. CardMenuAvailability - Status Menu 86 (Habis vs Tersedia)
 */
export function renderMenuAvailabilityCard(data = {}) {
  const products = Array.isArray(data.products) ? data.products : [];
  const soldOutProducts = products.filter(p => p.isAvailable === false);
  const availableCount = products.length - soldOutProducts.length;

  const bodyContent = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>☕</span>
          <span>Total Katalog Menu</span>
        </div>
        <div class="metric-value large coral">
          ${products.length} <span style="font-size:14px;color:#9CA3AF;font-weight:500;">Menu</span>
        </div>
        <div class="metric-sub">Katalog aktif POS</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🟢</span>
          <span>Menu Tersedia</span>
        </div>
        <div class="metric-value emerald">
          ${availableCount} Menu
        </div>
        <div class="metric-sub">Bisa dipesan kasir</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🚫</span>
          <span>Menu Habis (86)</span>
        </div>
        <div class="metric-value ${soldOutProducts.length > 0 ? 'coral' : ''}">
          ${soldOutProducts.length} Menu
        </div>
        <div class="metric-sub">Dinonaktifkan sementara</div>
      </div>
    </div>

    <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:20px;">
      <div style="font-size:12px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
        DAFTAR MENU YANG SEDANG KOSONG (86):
      </div>
      ${
        soldOutProducts.length > 0
          ? soldOutProducts.map(p => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;margin-bottom:8px;">
                <span style="font-weight:700;color:#FFF;font-size:13px;">${escapeHtml(p.name)}</span>
                <span style="font-size:10.5px;font-weight:700;color:#EF4444;background:rgba(239,68,68,0.15);padding:3px 8px;border-radius:6px;">SOLD OUT (86)</span>
              </div>
            `).join('')
          : '<div style="font-size:13px;color:#10B981;font-style:italic;">Semua menu sedang tersedia dan siap disajikan!</div>'
      }
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'KONTROL KETERSEDIAAN MENU',
    badgeColor: 'badge-coral',
    title: 'Status Ketersediaan Menu Komazi',
    subtitle: `Gunakan /habis untuk mengaktifkan atau menonaktifkan status order menu di kasir`,
    bodyContent,
  });
}
