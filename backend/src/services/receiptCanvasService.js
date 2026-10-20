import puppeteer from 'puppeteer';
import fs from 'fs';

/**
 * Komazi Coffee & Workspace - Luxury Digital E-Receipt Generator
 * Menghasilkan banner bukti pembayaran/transaksi sukses bot Telegram dengan layout
 * resmi komazi-receipt-banner, diselaraskan dengan palet warna logo Komazi (Coral Red & Deep Teal).
 */

let sharedBrowser = null;

// Load and cache Komazi logo as base64 data URI
let komaziLogoDataUri = '';
try {
  const possibleLogoPaths = [
    new URL('../assets/komazi-logo.jpg', import.meta.url),
    new URL('../../../frontend/public/komazi-logo.png', import.meta.url),
    new URL('../../../frontend/public/komazi-logo-transparent.png', import.meta.url),
  ];
  for (const p of possibleLogoPaths) {
    if (fs.existsSync(p)) {
      const ext = p.pathname.endsWith('.png') ? 'png' : 'jpeg';
      const logoBase64 = fs.readFileSync(p).toString('base64');
      komaziLogoDataUri = `data:image/${ext};base64,${logoBase64}`;
      break;
    }
  }
} catch (e) {
  console.warn('[ReceiptService] Could not load local logo:', e.message);
}

async function getBrowser() {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }
  try {
    sharedBrowser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });
    sharedBrowser.on('disconnected', () => {
      sharedBrowser = null;
    });
    return sharedBrowser;
  } catch (err) {
    sharedBrowser = null;
    throw err;
  }
}

const cleanup = async () => {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch {}
    sharedBrowser = null;
  }
};

process.on('SIGINT', () => {
  cleanup().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  cleanup().finally(() => process.exit(0));
});

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateReceiptHtml(orderData = {}) {
  const invoiceNo = orderData.invoiceNo || 'KMZ-' + Date.now().toString().slice(-8);
  const rawCustomer = orderData.customerName || orderData.customer?.name || orderData.customer || 'Pelanggan Walk-In';
  const customerName = typeof rawCustomer === 'object' ? (rawCustomer.name || 'Pelanggan Walk-In') : rawCustomer;
  const cashierName = orderData.cashier?.name || orderData.cashierName || 'Kasir Utama';
  const paymentMethod = (orderData.paymentMethod || orderData.payments?.[0]?.method || 'QRIS DINAMIS').toUpperCase();
  const items = Array.isArray(orderData.items) && orderData.items.length > 0
    ? orderData.items
    : [
      {
        name: 'Aren Latte Signature',
        variantName: 'Less Sugar 50% • Oat Milk',
        qty: 2,
        unitPrice: 28000,
        lineTotal: 56000,
      },
      {
        name: 'Butter Croissant Almond',
        variantName: 'Warm / Dihangatkan',
        qty: 1,
        unitPrice: 32000,
        lineTotal: 32000,
      },
    ];

  const calculatedItemsTotal = items.reduce((acc, it) => {
    const qty = Number(it.qty || it.quantity || 1);
    const price = Number(it.unitPrice || it.price || (it.lineTotal ? it.lineTotal / qty : 0));
    return acc + (it.lineTotal ? Number(it.lineTotal) : price * qty);
  }, 0);

  const subtotal = Number(orderData.subtotal || calculatedItemsTotal);
  const tax = Number(orderData.tax || 0);
  const discount = Number(orderData.discount || 0);
  const total = Number(orderData.total || (subtotal - discount + tax));

  const dateObj = orderData.paidAt
    ? new Date(orderData.paidAt)
    : orderData.createdAt
    ? new Date(orderData.createdAt)
    : new Date();

  const dateFormatted = dateObj.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted =
    dateObj.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).replace(/\./g, ':') + ' WIB';

  // Ringkasan produk untuk baris "PRODUK / MENU"
  const productNames = items.map((it) => it.productName || it.name || 'Menu');
  const productSummary = productNames.length > 2
    ? productNames.slice(0, 2).join(', ') + ` (+${productNames.length - 2} lainnya)`
    : productNames.join(', ');

  // Baris-baris rincian item (maks 5 baris pertama agar proporsi 16:9 tetap presisi)
  const displayItems = items.slice(0, 5);
  const remainingCount = items.length - displayItems.length;

  const itemsRowsHtml = displayItems.map((item, idx) => {
    const itemName = item.productName || item.name || 'Menu Komazi';
    const variant = item.variantName || item.variant?.name || item.note || '';
    const qty = Number(item.qty || item.quantity || 1);
    const price = Number(item.unitPrice || item.price || (item.lineTotal ? item.lineTotal / qty : 0));
    const lineTotal = Number(item.lineTotal || item.subtotal || (price * qty));

    return `
      <tr>
        <td class="col-no">${idx + 1}</td>
        <td class="col-product">
          <div>${escapeHtml(itemName)}</div>
          ${variant ? `<div class="variant">${escapeHtml(variant)}</div>` : ''}
        </td>
        <td class="col-price">${formatRupiah(price)}</td>
        <td class="col-qty">x${qty}</td>
        <td class="col-subtotal">${formatRupiah(lineTotal)}</td>
      </tr>
    `.trim();
  }).join('\n');

  const extraItemsHtml = remainingCount > 0
    ? `<tr><td colspan="5" style="text-align:center; color:#9CA3AF; font-size:11px; padding:6px; font-style:italic;">...dan ${remainingCount} item lainnya dalam pesanan ini</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=1280, initial-scale=1.0"/>
  <title>Struk Pembelian Komazi</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet"/>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 1280px;
      height: 720px;
      background: #000000;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #F3F4F6;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      -webkit-font-smoothing: antialiased;
      overflow: hidden;
    }
    .receipt-card {
      width: 1248px;
      height: 688px;
      background: #0A0B0E;
      border: 2px solid #FF5A4D;
      border-radius: 24px;
      padding: 20px 28px;
      position: relative;
      box-shadow: 0 0 35px rgba(255, 90, 77, 0.22), inset 0 0 0 1px rgba(47, 163, 156, 0.35);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .receipt-card::before {
      content: '';
      position: absolute;
      inset: 4px;
      border: 1px solid rgba(255, 90, 77, 0.25);
      border-radius: 20px;
      pointer-events: none;
    }
    
    /* Header Row */
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .brand-logo-circle {
      width: 86px;
      height: 86px;
      border-radius: 50%;
      border: 2.5px solid #FF5A4D;
      box-shadow: 0 0 18px rgba(255, 90, 77, 0.45);
      background: #000000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-logo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .title-center {
      text-align: center;
      flex: 1;
    }
    .title-main {
      font-family: 'Outfit', sans-serif;
      font-size: 38px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #FF5A4D;
      text-transform: uppercase;
      line-height: 1.1;
      text-shadow: 0 2px 12px rgba(255, 90, 77, 0.35);
    }
    .title-sub1 {
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #FFFFFF;
      margin-top: 5px;
      text-transform: uppercase;
    }
    .title-sub2 {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 2.5px;
      color: #2FA39C;
      margin-top: 3px;
      text-transform: uppercase;
    }
    .header-vip-box {
      border: 1.5px solid rgba(255, 90, 77, 0.4);
      border-radius: 14px;
      background: rgba(18, 20, 26, 0.85);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    }
    .vip-left {
      text-align: center;
    }
    .vip-left svg {
      width: 28px;
      height: 28px;
      fill: none;
      stroke: #FF5A4D;
      stroke-width: 2;
    }
    .vip-left .vip-label {
      font-size: 10px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .vip-divider {
      width: 1px;
      height: 48px;
      background: rgba(255, 90, 77, 0.25);
    }
    .vip-bullets {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .vip-bullet-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }
    .vip-bullet-item .check {
      color: #2FA39C;
      font-weight: 800;
      font-size: 12px;
    }
    .vip-bullet-item .bold-title {
      font-weight: 700;
      color: #F3F4F6;
      width: 95px;
    }
    .vip-bullet-item .desc {
      color: #9CA3AF;
      font-size: 10.5px;
    }

    /* Middle Row */
    .middle-row {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 16px;
    }
    .info-card {
      border: 1.5px solid rgba(255, 90, 77, 0.35);
      border-radius: 16px;
      background: rgba(16, 18, 24, 0.85);
      padding: 12px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      gap: 6px;
    }
    .info-row {
      display: grid;
      grid-template-columns: 160px 14px 1fr;
      align-items: center;
      font-size: 12.5px;
    }
    .info-label {
      color: #D1D5DB;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
      text-transform: uppercase;
      font-size: 11.5px;
    }
    .info-colon {
      color: #9CA3AF;
      font-weight: 700;
    }
    .info-value {
      font-weight: 700;
      color: #FFFFFF;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #FF5A4D;
      color: #FFFFFF;
      padding: 3px 14px;
      border-radius: 9999px;
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(255, 90, 77, 0.4);
    }

    .signature-card {
      border: 1.5px solid rgba(255, 90, 77, 0.35);
      border-radius: 16px;
      background: rgba(16, 18, 24, 0.85);
      padding: 12px 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sig-top-badge {
      background: rgba(255, 90, 77, 0.15);
      border: 1px solid rgba(255, 90, 77, 0.35);
      border-radius: 8px;
      padding: 4px 12px;
      text-align: center;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: #FF5A4D;
      text-transform: uppercase;
    }
    .sig-body {
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 4px 0;
    }
    .sig-text {
      text-align: center;
    }
    .sig-cursive {
      font-family: 'Great Vibes', cursive;
      font-size: 40px;
      color: #FFFFFF;
      line-height: 1;
      text-shadow: 0 0 12px rgba(255, 90, 77, 0.4);
    }
    .sig-sub {
      font-family: 'Outfit', sans-serif;
      font-size: 17px;
      font-weight: 700;
      color: #E5E7EB;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .sig-emblem {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      border: 2px solid #FF5A4D;
      background: rgba(255, 90, 77, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 12px rgba(255, 90, 77, 0.25);
    }
    .sig-emblem svg {
      width: 28px;
      height: 28px;
      fill: none;
      stroke: #FF5A4D;
      stroke-width: 2;
    }

    /* Table */
    .table-card {
      border: 1.5px solid rgba(255, 90, 77, 0.35);
      border-radius: 16px;
      background: rgba(16, 18, 24, 0.85);
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    thead {
      background: rgba(28, 30, 38, 0.95);
      border-bottom: 1.5px solid rgba(255, 90, 77, 0.3);
    }
    th {
      padding: 9px 16px;
      font-size: 11.5px;
      font-weight: 800;
      color: #FF5A4D;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    td {
      padding: 8px 16px;
      font-size: 12.5px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    tr:last-child td {
      border-bottom: none;
    }
    .col-no {
      text-align: center;
      width: 60px;
      color: #9CA3AF;
      font-weight: 700;
    }
    .col-product {
      font-weight: 700;
      color: #FFFFFF;
    }
    .col-product .variant {
      font-size: 10.5px;
      font-weight: 500;
      color: #2FA39C;
      margin-top: 2px;
    }
    .col-price {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      color: #D1D5DB;
      width: 150px;
    }
    .col-qty {
      text-align: center;
      font-weight: 800;
      color: #FF5A4D;
      width: 120px;
    }
    .col-subtotal {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 800;
      color: #FFFFFF;
      width: 160px;
    }

    /* Bottom Row */
    .bottom-row {
      display: grid;
      grid-template-columns: 1fr 1.6fr 1fr;
      gap: 16px;
    }
    .bottom-box {
      border: 1.5px solid rgba(255, 90, 77, 0.35);
      border-radius: 16px;
      background: rgba(16, 18, 24, 0.85);
      padding: 12px 18px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .cost-title {
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 900;
      color: #FFFFFF;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .cost-subline {
      font-size: 11px;
      color: #9CA3AF;
      display: flex;
      justify-content: space-between;
      margin-top: 2px;
    }
    .total-box {
      border: 1.5px solid rgba(255, 90, 77, 0.6);
      background: linear-gradient(135deg, rgba(255, 90, 77, 0.15) 0%, rgba(20, 22, 30, 0.95) 100%);
      box-shadow: 0 0 20px rgba(255, 90, 77, 0.15);
      padding: 10px 22px;
    }
    .total-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      font-weight: 700;
      color: #D1D5DB;
      border-bottom: 1px solid rgba(255, 90, 77, 0.2);
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .total-amount-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }
    .total-label {
      font-size: 13px;
      font-weight: 900;
      color: #FF5A4D;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .total-value {
      font-family: 'Outfit', sans-serif;
      font-size: 32px;
      font-weight: 900;
      color: #FFFFFF;
      letter-spacing: -0.5px;
    }
    .thanks-box {
      text-align: center;
      align-items: center;
    }
    .thanks-title {
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 900;
      color: #FFFFFF;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .thanks-sub {
      font-size: 10px;
      font-weight: 600;
      color: #9CA3AF;
      letter-spacing: 0.5px;
      margin-top: 3px;
      text-transform: uppercase;
    }
    .stars-row {
      color: #FF5A4D;
      font-size: 14px;
      margin-top: 5px;
      letter-spacing: 3px;
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <!-- Header -->
    <div class="header-row">
      <div class="brand-logo-circle">
        ${
          komaziLogoDataUri
            ? `<img src="${komaziLogoDataUri}" alt="Komazi Logo" class="brand-logo-img"/>`
            : `<div style="font-family:'Outfit',sans-serif;font-weight:900;font-size:20px;color:#FF5A4D;">KMZ</div>`
        }
      </div>
      <div class="title-center">
        <h1 class="title-main">STRUK PEMBELIAN</h1>
        <p class="title-sub1">TERIMA KASIH TELAH MEMILIH KOMAZI COFFEE</p>
        <p class="title-sub2">— PREMIUM COFFEE &amp; COLLABORATIVE WORKSPACE —</p>
      </div>
      <div class="header-vip-box">
        <div class="vip-left">
          <svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
          <div class="vip-label">KOMAZI VIP</div>
        </div>
        <div class="vip-divider"></div>
        <div class="vip-bullets">
          <div class="vip-bullet-item">
            <span class="check">✓</span>
            <span class="bold-title">100% ARABICA</span>
            <span class="desc">Single Origin Blend</span>
          </div>
          <div class="vip-bullet-item">
            <span class="check">✓</span>
            <span class="bold-title">FAST BARISTA</span>
            <span class="desc">Express Preparation</span>
          </div>
          <div class="vip-bullet-item">
            <span class="check">✓</span>
            <span class="bold-title">SECURE POS</span>
            <span class="desc">EMVCo Validated</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Middle Info -->
    <div class="middle-row">
      <!-- Left Info Box -->
      <div class="info-card">
        <div class="info-row">
          <div class="info-label">
            <span>👤</span>
            <span>ID PEMBELI</span>
          </div>
          <div class="info-colon">:</div>
          <div class="info-value">${escapeHtml(customerName)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <span>⊞</span>
            <span>PRODUK / MENU</span>
          </div>
          <div class="info-colon">:</div>
          <div class="info-value">${escapeHtml(productSummary)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <span>💳</span>
            <span>METODE BAYAR</span>
          </div>
          <div class="info-colon">:</div>
          <div class="info-value" style="color: #2FA39C;">${escapeHtml(paymentMethod)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <span>📅</span>
            <span>TANGGAL &amp; WAKTU</span>
          </div>
          <div class="info-colon">:</div>
          <div class="info-value">${dateFormatted} ${timeFormatted}</div>
        </div>
        <div class="info-row">
          <div class="info-label">
            <span>🛡</span>
            <span>STATUS</span>
          </div>
          <div class="info-colon">:</div>
          <div class="info-value">
            <span class="status-badge">👑 PAID (LUNAS)</span>
          </div>
        </div>
      </div>

      <!-- Right Signature Box -->
      <div class="signature-card">
        <div class="sig-top-badge">✦ TANDA TANGAN &amp; VERIFIKASI ✦</div>
        <div class="sig-body">
          <div class="sig-text">
            <div class="sig-cursive">Komazi Coffee</div>
            <div class="sig-sub">Official System</div>
            <div style="font-size: 10px; color: #2FA39C; margin-top: 3px;">Kasir: ${escapeHtml(cashierName)}</div>
          </div>
          <div class="sig-emblem">
            <svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th class="col-no">NO</th>
            <th>DETAIL MENU / PRODUK</th>
            <th style="text-align: right; padding-right: 20px;">HARGA SATUAN</th>
            <th style="text-align: center;">JUMLAH / QTY</th>
            <th style="text-align: right; padding-right: 20px;">SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
          ${extraItemsHtml}
        </tbody>
      </table>
    </div>

    <!-- Bottom Row -->
    <div class="bottom-row">
      <div class="bottom-box">
        <div class="cost-title">RINCIAN BIAYA :</div>
        <div class="cost-subline">
          <span>Subtotal (${items.length} Item)</span>
          <span style="font-family: 'JetBrains Mono', monospace; color: #fff;">${formatRupiah(subtotal)}</span>
        </div>
        ${
          discount > 0
            ? `<div class="cost-subline" style="color: #2FA39C;">
                <span>Diskon Promo</span>
                <span style="font-family: 'JetBrains Mono', monospace;">-${formatRupiah(discount)}</span>
              </div>`
            : ''
        }
      </div>

      <div class="bottom-box total-box">
        <div class="total-meta">
          <span>PB1 RESTO / ADMIN :</span>
          <span style="font-family: 'JetBrains Mono', monospace;">${tax > 0 ? formatRupiah(tax) : 'Rp 0 (Termasuk)'}</span>
        </div>
        <div class="total-amount-row">
          <span class="total-label">TOTAL BAYAR :</span>
          <span class="total-value">${formatRupiah(total)}</span>
        </div>
      </div>

      <div class="bottom-box thanks-box">
        <div class="thanks-title">THANK YOU</div>
        <div class="thanks-sub">ATAS KEPERCAYAAN ANDA</div>
        <div class="stars-row">★ ★ ★ ★ ★</div>
        <div style="font-family:'Outfit',sans-serif;font-size:11px;font-weight:800;color:#FF5A4D;letter-spacing:1px;margin-top:4px;">@komazi-assistant</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate receipt PNG image buffer
 * @param {Object} orderData
 * @returns {Promise<Buffer>}
 */
export async function generateReceiptImageBuffer(orderData = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 2,
    });

    const html = generateReceiptHtml(orderData);
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    await page.evaluate(() => document.fonts.ready);

    // Screenshot the receipt card element
    const cardHandle = (await page.$('.receipt-card')) || (await page.$('body'));
    const screenshotBuffer = await cardHandle.screenshot({
      type: 'png',
      omitBackground: false,
    });

    return Buffer.from(screenshotBuffer);
  } finally {
    await page.close().catch(() => {});
  }
}
