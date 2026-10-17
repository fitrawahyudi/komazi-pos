import puppeteer from 'puppeteer';
import crypto from 'crypto';
import fs from 'fs';

/**
 * Komazi Coffee & Workspace - Luxury Digital E-Receipt Generator
 * Renders high-fidelity luxury digital receipt matching the official Komazi design.
 */

let sharedBrowser = null;

// Load and cache Komazi logo as base64 data URI
let komaziLogoDataUri = '';
try {
  const logoPath = new URL('../assets/komazi-logo.jpg', import.meta.url);
  if (fs.existsSync(logoPath)) {
    const logoBase64 = fs.readFileSync(logoPath).toString('base64');
    komaziLogoDataUri = `data:image/jpeg;base64,${logoBase64}`;
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
    } catch { }
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
  const rawCustomer = orderData.customerName || orderData.customer?.name || orderData.customer || 'Dine In';
  const customerName = typeof rawCustomer === 'object' ? (rawCustomer.name || 'Dine In') : rawCustomer;
  const cashierName = orderData.cashier?.name || orderData.cashierName || 'Rina Sasmita (Shift 1)';
  const paymentMethod = orderData.paymentMethod || (orderData.payments?.[0]?.method) || 'QRIS Dinamis (Pakasir / Midtrans)';
  const total = Number(orderData.total || 0);
  const subtotal = Number(orderData.subtotal || total);
  const tax = Number(orderData.tax || 0);
  const discount = Number(orderData.discount || 0);
  const stationName = orderData.stationName || `Kasir: ${cashierName}`;

  const dateObj = orderData.paidAt ? new Date(orderData.paidAt) : (orderData.createdAt ? new Date(orderData.createdAt) : new Date());
  const dateFormatted = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeFormatted = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

  const hashShort = crypto.createHash('sha256').update(String(invoiceNo + total + dateObj.getTime())).digest('hex').slice(0, 14);

  const items = Array.isArray(orderData.items) && orderData.items.length > 0
    ? orderData.items
    : [
      {
        name: 'Komazi Aren Latte (16oz)',
        variantName: 'Pilihan: Iced • Oat Milk Substitue • Less Sugar 50%',
        qty: 2,
        unitPrice: 34000,
        lineTotal: 68000,
      },
      {
        name: 'Paket 2 Jam Coworking Pass',
        variantName: 'Fasilitas: Komunal Desk 04 • High-Speed LAN/WiFi • Free Flow Infused Water',
        qty: 1,
        unitPrice: 50000,
        lineTotal: 50000,
      },
      {
        name: 'Butter Almond Croissant',
        note: 'Warm / Dihangatkan',
        qty: 1,
        unitPrice: 32000,
        lineTotal: 32000,
      },
    ];

  let productSummary = orderData.productSummary || '';
  if (!productSummary) {
    const itemNames = items.map((i) => (i.productName || i.name || 'Menu').toUpperCase());
    productSummary = itemNames.slice(0, 2).join(' + ') + (items.length > 2 ? ` (+${items.length - 2} LAINNYA)` : '');
    if (orderData.tableName || orderData.table) {
      productSummary += ` (${orderData.tableName || orderData.table})`;
    }
  }

  const isMember = customerName.toLowerCase().includes('member') || Boolean(orderData.isMember) || (customerName !== 'Pelanggan Dine In' && customerName !== 'Kasir');
  const customerId = orderData.customerId || (orderData.customerPhone ? String(orderData.customerPhone).slice(0, 3) + '****' + String(orderData.customerPhone).slice(-3) : '810****267');
  const memberBadgeHtml = isMember
    ? `<span class="text-[10px] bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-semibold tracking-normal">★ Member Gold (${escapeHtml(customerName)})</span>`
    : `<span class="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-medium">${escapeHtml(customerName)}</span>`;

  const itemsRowsHtml = items.map((item, idx) => {
    const itemName = item.productName || item.name || 'Menu Komazi';
    const variant = item.variantName || item.variant?.name || '';
    const note = item.note || '';
    const qty = Number(item.qty || item.quantity || 1);
    const price = Number(item.unitPrice || item.price || (item.lineTotal ? item.lineTotal / qty : 0));
    const lineTotal = Number(item.lineTotal || item.subtotal || (price * qty));

    let detailsList = [];
    if (variant) {
      const vText = variant.startsWith('Pilihan:') || variant.startsWith('Fasilitas:') ? variant : `Pilihan: ${variant}`;
      detailsList.push(escapeHtml(vText));
    }
    if (note) detailsList.push(`Catatan: ${escapeHtml(note)}`);
    const detailsHtml = detailsList.length > 0
      ? `<div class="text-[11px] text-neutral-400">${detailsList.join(' • ')}</div>`
      : '';

    return `
<tr class="hover:bg-brand-surface transition-colors">
  <td class="py-3.5 px-3 text-center text-neutral-400">${idx + 1}</td>
  <td class="py-3.5 px-4">
    <div class="font-bold text-neutral-100">${escapeHtml(itemName)}</div>
    ${detailsHtml}
  </td>
  <td class="py-3.5 px-4 text-right font-mono text-neutral-200">${formatRupiah(price)}</td>
  <td class="py-3.5 px-4 text-center font-bold text-neutral-300">x${qty}</td>
  <td class="py-3.5 px-4 text-right font-mono font-bold text-neutral-100">${formatRupiah(lineTotal)}</td>
</tr>
    `.trim();
  }).join('\n');

  const discountRowHtml = discount > 0
    ? `<div class="flex justify-between text-emerald-400">
         <span>Diskon Member Gold (10%)</span>
         <span class="font-mono">-${formatRupiah(discount)}</span>
       </div>`
    : '';

  const taxRowHtml = tax > 0
    ? `<div class="flex justify-between text-neutral-400">
         <span>PB1 (Pajak Restoran 10%)</span>
         <span class="font-mono">${formatRupiah(tax)}</span>
       </div>`
    : `<div class="flex justify-between text-neutral-400">
         <span>PB1 (Pajak Restoran 10%)</span>
         <span class="font-mono">Rp 0 (Termasuk)</span>
       </div>`;

  const formattedTotalNum = Number(total || 0).toLocaleString('id-ID');
  const shortPaymentMethod = String(paymentMethod).split('(')[0].trim();

  const logoHtml = komaziLogoDataUri
    ? `<img src="${komaziLogoDataUri}" alt="Komazi Logo" class="w-full h-full object-contain rounded-[14px]" />`
    : `<div class="w-full h-full bg-[#0E0E0E] rounded-[14px] flex flex-col items-center justify-center relative overflow-hidden">
        <span class="font-heading font-black text-2xl tracking-tighter text-white">KMZ</span>
        <span class="text-[8px] font-bold tracking-widest uppercase text-brand-coral">COFFEE</span>
       </div>`;

  return `<!DOCTYPE html>
<html class="dark" lang="id"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Bukti Pembelian Digital | Komazi Coffee &amp; Workspace</title>
<!-- Google Fonts: Outfit & Inter -->
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&amp;family=Inter:wght@400;500;600;700&amp;family=Outfit:wght@500;600;700;800;900&amp;display=swap" rel="stylesheet"/>
<!-- Tailwind CSS CDN with plugins -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Tailwind Configuration -->
<script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              bg: '#0A0A0A',
              card: '#141414',
              surface: '#1A1A1A',
              surface2: '#222222',
              border: '#2A2A2A',
              borderLight: '#383838',
              coral: '#FF5A4D',
              coralHover: '#E0453A',
              coralSoft: 'rgba(255, 90, 77, 0.12)',
              teal: '#2FA39C',
              tealDark: '#1F6F6B',
              tealSoft: 'rgba(47, 163, 156, 0.12)',
              gold: '#E5A93C'
            }
          },
          fontFamily: {
            heading: ['Outfit', 'sans-serif'],
            sans: ['Inter', 'sans-serif'],
            signature: ['Great Vibes', 'cursive']
          },
          boxShadow: {
            'glow-coral': '0 0 25px -5px rgba(255, 90, 77, 0.45)',
            'glow-teal': '0 0 25px -5px rgba(47, 163, 156, 0.45)',
            'card-luxury': '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px 1px rgba(255, 90, 77, 0.15)'
          }
        }
      }
    };
</script>
<style data-purpose="custom-decorations">
    .carbon-texture {
      background-color: #121212;
      background-image: 
        radial-gradient(#262626 15%, transparent 16%),
        radial-gradient(#262626 15%, transparent 16%);
      background-size: 16px 16px;
      background-position: 0 0, 8px 8px;
    }
    
    .frame-border-glow {
      border: 1.5px solid rgba(255, 90, 77, 0.35);
      outline: 1px solid rgba(47, 163, 156, 0.25);
      outline-offset: -5px;
    }

    .shimmer-text-coral {
      background: linear-gradient(135deg, #FFFFFF 20%, #FFA8A1 50%, #FF5A4D 85%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .shimmer-text-teal {
      background: linear-gradient(135deg, #E6FFFA 20%, #5EEAD4 50%, #2FA39C 90%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    @media print {
      body { background: #FFFFFF !important; color: #000000 !important; }
      .no-print { display: none !important; }
      .print-neutral { background: white !important; color: black !important; border: 1px solid #ddd !important; }
    }
</style>
</head>
<body class="bg-[#080808] text-neutral-100 font-sans antialiased min-h-screen py-6 px-3 sm:px-6 lg:px-8 flex flex-col items-center justify-center relative overflow-x-hidden selection:bg-brand-coral selection:text-white">
<!-- Ambient background glow elements -->
<div aria-hidden="true" class="fixed top-12 left-1/4 w-96 h-96 bg-brand-coral/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
<div aria-hidden="true" class="fixed bottom-12 right-1/4 w-96 h-96 bg-brand-teal/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
<!-- BEGIN: ReceiptCertificateWrapper -->
<main class="w-full max-w-[1240px] relative transition-all" data-purpose="receipt-main-container">
<!-- BEGIN: OuterLuxuryCardFrame -->
<div class="relative bg-brand-card rounded-2xl p-3 sm:p-5 lg:p-6 shadow-card-luxury frame-border-glow overflow-hidden">
<!-- Inner Certificate Container -->
<div class="rounded-xl border border-brand-border bg-gradient-to-b from-[#181818] via-[#121212] to-[#161616] p-4 sm:p-6 lg:p-7 relative z-10">
<!-- BEGIN: HeaderSection -->
<header class="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-5 border-b border-brand-border relative" data-purpose="certificate-header">
<!-- Top Left: Brand Emblem & Monogram (with uploaded Komazi Logo) -->
<div class="lg:col-span-3 flex items-center gap-3.5">
<div class="relative flex-shrink-0">
<!-- Rounded Brand Emblem Frame with Logo -->
<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-brand-coral via-[#99251D] to-brand-teal p-[2px] shadow-glow-coral overflow-hidden">
  <div class="w-full h-full bg-[#080808] rounded-[14px] flex items-center justify-center overflow-hidden">
    ${logoHtml}
  </div>
</div>
</div>
<div class="space-y-0.5">
<div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-brand-coralSoft text-brand-coral border border-brand-coral/30 text-[10px] font-semibold tracking-wider uppercase">
  Official Receipt
</div>
<h1 class="text-xl sm:text-2xl font-black font-heading tracking-tight text-white leading-tight">KOMAZI</h1>
<p class="text-xs text-neutral-400 font-medium">Coffee &amp; Coworking Space</p>
</div>
</div>
<!-- Top Center: Title & Salutation -->
<div class="lg:col-span-5 flex flex-col items-center justify-center text-center px-2">
<div class="inline-flex items-center gap-1.5 text-xs tracking-widest uppercase text-brand-teal font-semibold mb-1">
<span class="w-6 h-[1px] bg-brand-teal/50"></span>
              Bukti Pembayaran Sah
              <span class="w-6 h-[1px] bg-brand-teal/50"></span>
</div>
<h2 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-heading tracking-wide shimmer-text-coral uppercase">
              STRUK PEMBELIAN
            </h2>
<p class="text-xs sm:text-sm text-neutral-300 font-medium mt-1">
              TERIMA KASIH TELAH MEMILIH KOMAZI COFFEE &amp; WORKSPACE <span class="text-brand-coral">☕</span>
</p>
<div class="mt-2 text-[11px] font-semibold text-brand-teal bg-brand-tealSoft px-3 py-1 rounded-full border border-brand-teal/30 tracking-wider">
              SOLUSI DIGITAL COFFEE &amp; WORKSPACE TERPERCAYA
            </div>
</div>
<!-- Top Right: Trust Badges -->
<div class="lg:col-span-4 flex flex-col items-end justify-center gap-3">
<!-- Mini Trust Badges Row -->
<div class="grid grid-cols-3 gap-2 w-full text-center">
<div class="bg-brand-surface/70 border border-brand-border rounded-lg p-1.5 flex flex-col items-center">
<span class="text-brand-teal text-xs">🛡️</span>
<span class="text-[9px] font-bold text-neutral-200 mt-0.5 uppercase">100% Aman</span>
<span class="text-[8px] text-neutral-400">Trusted Store</span>
</div>
<div class="bg-brand-surface/70 border border-brand-border rounded-lg p-1.5 flex flex-col items-center">
<span class="text-brand-coral text-xs">⚡</span>
<span class="text-[9px] font-bold text-neutral-200 mt-0.5 uppercase">Fast Server</span>
<span class="text-[8px] text-neutral-400">Siap Layani</span>
</div>
<div class="bg-brand-surface/70 border border-brand-border rounded-lg p-1.5 flex flex-col items-center">
<span class="text-amber-400 text-xs">🔒</span>
<span class="text-[9px] font-bold text-neutral-200 mt-0.5 uppercase">Encrypted</span>
<span class="text-[8px] text-neutral-400">Midtrans Verified</span>
</div>
</div>
</div>
</header>
<!-- END: HeaderSection -->
<!-- Quick Guarantee Ticker -->
<div class="py-2.5 px-4 bg-brand-surface2/50 rounded-lg my-4 flex items-center justify-between text-[11px] font-medium text-neutral-300 border border-brand-border flex-wrap gap-2">
<div class="flex items-center gap-1.5">
<span class="text-brand-coral">✔</span> PROSES CEPAT
          </div>
<span class="text-neutral-600 hidden sm:inline">•</span>
<div class="flex items-center gap-1.5">
<span class="text-brand-teal">☕</span> PELAYANAN RAMAH &amp; BERSIH
          </div>
<span class="text-neutral-600 hidden sm:inline">•</span>
<div class="flex items-center gap-1.5">
<span class="text-emerald-400">📶</span> HIGH-SPEED WIFI 100 MBPS
          </div>
<span class="text-neutral-600 hidden sm:inline">•</span>
<div class="flex items-center gap-1.5">
<span class="text-amber-400">★</span> GARANSI KEPUASAN 100%
          </div>
</div>
<!-- BEGIN: MiddleInfoSection -->
<section aria-label="Informasi Pelanggan dan Otorisasi Digital" class="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5" data-purpose="customer-and-signature-info">
<!-- Left Box: Transaction Details -->
<div class="lg:col-span-7 bg-brand-surface rounded-xl p-4 sm:p-5 border border-brand-border relative overflow-hidden flex flex-col justify-between">
<div class="absolute -right-8 -bottom-8 w-32 h-32 bg-brand-coral/5 rounded-full blur-xl pointer-events-none"></div>
<div class="space-y-3.5">
<!-- Row 0: No Referensi Invoice -->
<div class="flex items-center text-xs sm:text-sm">
<div class="w-36 sm:w-44 flex items-center gap-2 text-neutral-300 font-medium">
<span class="p-1 rounded bg-neutral-800 text-brand-coral">🧾</span>
<span>NO. REFERENSI</span>
</div>
<div class="text-neutral-400 mr-2">:</div>
<div class="font-bold text-neutral-100 tracking-wider font-mono">
<span>${escapeHtml(invoiceNo)}</span>
</div>
</div>
<!-- Row 1: ID Pembeli -->
<div class="flex items-center text-xs sm:text-sm">
<div class="w-36 sm:w-44 flex items-center gap-2 text-neutral-300 font-medium">
<span class="p-1 rounded bg-neutral-800 text-brand-coral">👤</span>
<span>ID PELANGGAN</span>
</div>
<div class="text-neutral-400 mr-2">:</div>
<div class="font-bold text-white tracking-wider flex items-center gap-2">
<span>${escapeHtml(customerId)}</span>
${memberBadgeHtml}
</div>
</div>
<!-- Row 2: Metode Bayar -->
<div class="flex items-center text-xs sm:text-sm">
<div class="w-36 sm:w-44 flex items-center gap-2 text-neutral-300 font-medium">
<span class="p-1 rounded bg-neutral-800 text-emerald-400">💳</span>
<span>METODE BAYAR</span>
</div>
<div class="text-neutral-400 mr-2">:</div>
<div class="font-bold text-emerald-400 flex items-center gap-1.5">
<span>${escapeHtml(paymentMethod)}</span>
</div>
</div>
<!-- Row 3: Tanggal & Waktu -->
<div class="flex items-center text-xs sm:text-sm">
<div class="w-36 sm:w-44 flex items-center gap-2 text-neutral-300 font-medium">
<span class="p-1 rounded bg-neutral-800 text-neutral-300">🗓️</span>
<span>TANGGAL &amp; WAKTU</span>
</div>
<div class="text-neutral-400 mr-2">:</div>
<div class="font-medium text-neutral-200">
                  ${dateFormatted} • ${timeFormatted}
                </div>
</div>
<!-- Row 4: Status Transaksi -->
<div class="flex items-center text-xs sm:text-sm pt-1">
<div class="w-36 sm:w-44 flex items-center gap-2 text-neutral-300 font-medium">
<span class="p-1 rounded bg-neutral-800 text-brand-coral">🛡️</span>
<span>STATUS</span>
</div>
<div class="text-neutral-400 mr-2">:</div>
<div>
<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-emerald-500/20 to-brand-teal/20 border border-emerald-500/50 text-emerald-300 font-bold text-xs shadow-sm">
<svg class="w-3.5 h-3.5 text-emerald-400 fill-current" viewbox="0 0 20 20">
<path clip-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414 0l-4-4a1 1 0 011.414 0z" fill-rule="evenodd"></path>
</svg>
                    PAID 
                  </span>
</div>
</div>
</div>
</div>
<!-- Right Box: Digital Verification & Signature -->
<div class="lg:col-span-5 bg-brand-surface rounded-xl p-4 sm:p-5 border border-brand-border relative flex flex-col justify-between" data-purpose="digital-signature-panel">
<div class="flex items-center justify-between border-b border-brand-border pb-2.5">
<span class="text-xs font-bold tracking-wider text-brand-teal uppercase flex items-center gap-1.5">
<span>✦</span> TANDA TANGAN &amp; OTORISASI DIGITAL <span>✦</span>
</span>
<span class="text-[10px] text-neutral-400 bg-neutral-800/90 px-2 py-0.5 rounded">QR Valid</span>
</div>
<!-- Signature & QR Validation Area -->
<div class="py-4 flex items-center justify-between gap-4">
<!-- Digital Signature visual -->
<div class="flex-1 flex flex-col items-center justify-center">
<div class="font-signature text-3xl sm:text-4xl text-neutral-200 shimmer-text-coral tracking-wide py-1 select-none">
                  Komazi Coffee
                </div>
<div class="w-40 h-[1px] bg-gradient-to-r from-transparent via-brand-coral to-transparent"></div>
<p class="text-[10px] tracking-wider uppercase text-neutral-400 font-semibold mt-1">
                  ${escapeHtml(stationName)}
                </p>
<p class="text-[9px] text-neutral-500">Hash: ${hashShort}</p>
</div>
<!-- Validation QR Badge Code Simulation -->
<div class="flex flex-col items-center">
<div class="w-20 h-20 bg-white p-1.5 rounded-lg shadow-md flex items-center justify-center">
<!-- Simulated 2D Data Matrix / QR -->
<svg class="w-full h-full text-black" fill="currentColor" viewbox="0 0 100 100">
<rect height="30" width="30" x="0" y="0"></rect>
<rect fill="white" height="20" width="20" x="5" y="5"></rect>
<rect height="10" width="10" x="10" y="10"></rect>
<rect height="30" width="30" x="70" y="0"></rect>
<rect fill="white" height="20" width="20" x="75" y="5"></rect>
<rect height="10" width="10" x="80" y="10"></rect>
<rect height="30" width="30" x="0" y="70"></rect>
<rect fill="white" height="20" width="20" x="5" y="75"></rect>
<rect height="10" width="10" x="10" y="80"></rect>
<rect height="20" width="10" x="40" y="10"></rect>
<rect height="8" width="8" x="60" y="20"></rect>
<rect height="20" width="30" x="35" y="40"></rect>
<rect height="10" width="20" x="40" y="70"></rect>
<rect height="15" width="20" x="70" y="50"></rect>
<rect height="15" width="15" x="80" y="75"></rect>
<rect height="15" width="10" x="15" y="45"></rect>
</svg>
</div>
<span class="text-[9px] text-neutral-400 mt-1 font-mono">SCAN TO VERIFY</span>
</div>
</div>
<div class="text-[10px] text-center text-neutral-400 pt-1 border-t border-brand-border/60">
              Disahkan secara elektronik oleh <strong class="text-neutral-200">M. Aditya Prasetyo</strong>
</div>
</div>
</section>
<!-- END: MiddleInfoSection -->
<!-- BEGIN: LineItemsTable -->
<section aria-label="Rincian Item Pembelian" class="mb-5 overflow-hidden rounded-xl border border-brand-border" data-purpose="items-table-section">
<div class="overflow-x-auto">
<table class="w-full text-left text-xs sm:text-sm">
<thead class="bg-neutral-900/90 text-neutral-300 uppercase tracking-wider font-semibold border-b border-brand-border text-[11px]">
<tr>
<th class="py-3 px-3 text-center w-12 text-brand-teal" scope="col">NO</th>
<th class="py-3 px-4" scope="col">DETAIL PRODUK</th>
<th class="py-3 px-4 text-right" scope="col">HARGA SATUAN</th>
<th class="py-3 px-4 text-center" scope="col">QTY</th>
<th class="py-3 px-4 text-right text-brand-coral" scope="col">SUBTOTAL</th>
</tr>
</thead>
<tbody class="divide-y divide-brand-border/50 bg-brand-surface/40 font-medium">
${itemsRowsHtml}
</tbody>
</table>
</div>
</section>
<!-- END: LineItemsTable -->
<!-- BEGIN: CostSummaryAndFooter -->
<footer class="grid grid-cols-1 lg:grid-cols-12 gap-4" data-purpose="summary-total-and-thank-you">
<!-- Bottom Left: Breakdown Biaya -->
<div class="lg:col-span-4 bg-brand-surface rounded-xl p-4 border border-brand-border flex flex-col justify-between">
<div>
<div class="text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2.5 flex items-center gap-1.5">
<span class="text-brand-coral">❖</span> RINCIAN BIAYA &amp; PAJAK :
              </div>
<div class="space-y-1.5 text-xs">
<div class="flex justify-between text-neutral-300">
<span>Subtotal Pesanan</span>
<span class="font-mono">${formatRupiah(subtotal)}</span>
</div>
${discountRowHtml}
${taxRowHtml}
<div class="flex justify-between text-neutral-400">
<span>Fee Transaksi / Layanan</span>
<span class="font-mono text-brand-teal">Rp 0 (GRATIS)</span>
</div>
</div>
</div>
<div class="pt-2 mt-2 border-t border-brand-border/60 text-[10px] text-neutral-400 flex items-center justify-between">
<span>Metode: ${escapeHtml(shortPaymentMethod)}</span>
<span class="text-emerald-400 font-semibold">Terkonfirmasi Otomatis</span>
</div>
</div>
<!-- Bottom Center: Huge Grand Total -->
<div class="lg:col-span-5 bg-gradient-to-br from-brand-surface via-[#202020] to-[#171717] rounded-xl p-4 sm:p-5 border-2 border-brand-coral/40 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
<div class="absolute -top-10 -right-10 w-28 h-28 bg-brand-coral/10 rounded-full blur-xl pointer-events-none"></div>
<span class="text-xs sm:text-sm uppercase tracking-widest font-semibold text-neutral-300 mb-1">
              TOTAL BAYAR
            </span>
<div class="text-3xl sm:text-4xl lg:text-5xl font-black font-heading text-white tracking-tight flex items-baseline gap-1.5 py-1">
<span class="text-brand-coral text-2xl sm:text-3xl font-bold">Rp</span>
<span class="font-mono font-extrabold tracking-normal">${formattedTotalNum}</span>
</div>
<div class="text-[11px] font-medium text-brand-teal mt-1 flex items-center gap-1.5">
<span>✓</span> Pembayaran Selesai • Tidak ada sisa tagihan
            </div>
</div>
<!-- Bottom Right: Thank You & Rating -->
<div class="lg:col-span-3 bg-brand-surface rounded-xl p-4 border border-brand-border flex flex-col items-center justify-center text-center">
<!-- Crown/Stars Icon -->
<div class="flex items-center gap-1 text-amber-400 text-sm mb-1">
              ★ ★ ★ ★ ★
            </div>
<h3 class="font-heading font-black text-base tracking-wide text-white">
              TERIMA KASIH
            </h3>
<p class="text-xs text-neutral-300 font-medium">
              Atas Kepercayaan &amp; Kunjungan Anda
            </p>
<div class="w-12 h-[1px] bg-brand-border my-2"></div>
<address class="not-italic text-[10px] text-neutral-400 leading-snug">
              Komazi Coffee & Workspace<br/>
              Jl. Kapten M. Jamil Lubis Komplek TVRI, Tembung, Kec. Medan Tembung, Kota Medan, Sumatera Utara<br/>
              IG: <span class="text-brand-coral">@komazicoffee</span>
</address>
</div>
</footer>
<!-- END: CostSummaryAndFooter -->
</div>
<!-- END: InnerCertificateContainer -->
</div>
<!-- END: OuterLuxuryCardFrame -->
</main>
<!-- END: ReceiptCertificateWrapper -->
</body></html>`;
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
      width: 1300,
      height: 1200,
      deviceScaleFactor: 1.5,
    });

    const html = generateReceiptHtml(orderData);
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    await page.evaluate(() => document.fonts.ready);

    // Screenshot the receipt main container with luxury frame
    const mainHandle = await page.$('main[data-purpose="receipt-main-container"]') || await page.$('body');
    const screenshotBuffer = await mainHandle.screenshot({
      type: 'png',
      omitBackground: true,
    });

    return Buffer.from(screenshotBuffer);
  } finally {
    await page.close().catch(() => { });
  }
}
