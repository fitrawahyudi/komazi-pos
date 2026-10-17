import fs from 'fs';

// Load Komazi logo as base64 data URI
let komaziLogoDataUri = '';
try {
  const logoPath = new URL('../../../assets/komazi-logo.jpg', import.meta.url);
  if (fs.existsSync(logoPath)) {
    const logoBase64 = fs.readFileSync(logoPath).toString('base64');
    komaziLogoDataUri = `data:image/jpeg;base64,${logoBase64}`;
  }
} catch (e) {
  console.warn('[BrandTheme] Could not load local logo:', e.message);
}

export function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDateWib(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimeWib(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return (
    d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB'
  );
}

/**
 * Standard CSS and design system tokens for all Telegram Bot Graphics
 */
export const BRAND_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: transparent;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #F3F4F6;
    -webkit-font-smoothing: antialiased;
    padding: 24px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .font-heading {
    font-family: 'Outfit', sans-serif;
  }

  .font-mono {
    font-family: 'JetBrains Mono', monospace;
  }

  .bot-card-wrapper {
    width: 100%;
    max-width: 1140px;
    background: linear-gradient(145deg, #101014 0%, #08080A 100%);
    border: 1.5px solid #282830;
    border-radius: 28px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 90, 77, 0.12);
    overflow: hidden;
    position: relative;
  }

  /* Decorative Ambient Glow */
  .bot-card-wrapper::before {
    content: '';
    position: absolute;
    top: -80px;
    right: -80px;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(255, 90, 77, 0.18) 0%, rgba(255, 90, 77, 0) 70%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 1;
  }

  .bot-card-wrapper::after {
    content: '';
    position: absolute;
    bottom: -80px;
    left: -80px;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(47, 163, 156, 0.14) 0%, rgba(47, 163, 156, 0) 70%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 1;
  }

  .card-inner {
    position: relative;
    z-index: 2;
    padding: 36px 42px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* Header Bar */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .brand-identity {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .brand-logo-img {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    object-fit: cover;
    border: 1.5px solid rgba(255, 90, 77, 0.4);
    box-shadow: 0 4px 14px rgba(255, 90, 77, 0.2);
  }

  .brand-text h1 {
    font-family: 'Outfit', sans-serif;
    font-weight: 900;
    font-size: 20px;
    letter-spacing: 0.5px;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .brand-text p {
    font-size: 11.5px;
    color: #9CA3AF;
    font-weight: 500;
    margin-top: 2px;
  }

  .header-badge {
    padding: 7px 16px;
    border-radius: 9999px;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .badge-coral {
    background: rgba(255, 90, 77, 0.15);
    color: #FF5A4D;
    border: 1px solid rgba(255, 90, 77, 0.35);
  }

  .badge-emerald {
    background: rgba(16, 185, 129, 0.15);
    color: #10B981;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }

  .badge-teal {
    background: rgba(47, 163, 156, 0.18);
    color: #48D1CC;
    border: 1px solid rgba(47, 163, 156, 0.4);
  }

  .badge-amber {
    background: rgba(245, 158, 11, 0.15);
    color: #FBBF24;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }

  .badge-rose {
    background: rgba(239, 68, 68, 0.16);
    color: #F87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .badge-gold {
    background: rgba(229, 169, 60, 0.18);
    color: #F59E0B;
    border: 1px solid rgba(229, 169, 60, 0.45);
  }

  .badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: currentColor;
    display: inline-block;
  }

  /* Title Block */
  .title-block {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .title-main {
    font-family: 'Outfit', sans-serif;
    font-size: 28px;
    font-weight: 800;
    color: #FFFFFF;
    line-height: 1.25;
    letter-spacing: -0.3px;
  }

  .title-sub {
    font-size: 13.5px;
    color: #9CA3AF;
    margin-top: 6px;
    line-height: 1.5;
  }

  /* Metric Stat Cards Grid */
  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }

  .metric-card {
    background: rgba(24, 24, 28, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 18px;
    padding: 18px 22px;
    backdrop-blur: 8px;
  }

  .metric-card.highlight {
    background: linear-gradient(135deg, rgba(255, 90, 77, 0.12) 0%, rgba(20, 20, 24, 0.8) 100%);
    border-color: rgba(255, 90, 77, 0.35);
  }

  .metric-label {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    font-weight: 600;
    color: #9CA3AF;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .metric-value {
    font-family: 'Outfit', sans-serif;
    font-size: 24px;
    font-weight: 800;
    color: #FFFFFF;
    margin-top: 6px;
  }

  .metric-value.large {
    font-size: 32px;
  }

  .metric-value.coral {
    color: #FF5A4D;
  }

  .metric-value.emerald {
    color: #10B981;
  }

  .metric-value.gold {
    color: #FBBF24;
  }

  .metric-sub {
    font-size: 11.5px;
    color: #6B7280;
    margin-top: 4px;
  }

  /* Table Container */
  .table-box {
    background: rgba(18, 18, 22, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    overflow: hidden;
  }

  .table-header {
    background: rgba(30, 30, 36, 0.6);
    padding: 12px 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #9CA3AF;
    display: grid;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .table-row {
    padding: 14px 20px;
    display: grid;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    font-size: 13px;
  }

  .table-row:last-child {
    border-bottom: none;
  }

  /* Footer bar */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    font-size: 11.5px;
    color: #6B7280;
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .footer-meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #9CA3AF;
  }
`;

/**
 * Standard Outer Card HTML Shell
 */
export function wrapCardHtml({
  badgeText = 'KOMAZI BOT',
  badgeColor = 'badge-coral',
  title = '',
  subtitle = '',
  bodyContent = '',
  metaTime = formatTimeWib(),
  metaId = '',
}) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    ${BRAND_CSS}
  </style>
</head>
<body>
  <div id="bot-card" class="bot-card-wrapper">
    <div class="card-inner">
      <!-- Header -->
      <div class="card-header">
        <div class="brand-identity">
          ${
            komaziLogoDataUri
              ? `<img src="${komaziLogoDataUri}" alt="Komazi Logo" class="brand-logo-img" />`
              : `<div class="brand-logo-img" style="background:#FF5A4D;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;">KZ</div>`
          }
          <div class="brand-text">
            <h1>KOMAZI ASSISTANT</h1>
            <p>Coffee &amp; Workspace • Medan, ID</p>
          </div>
        </div>

        <div class="header-badge ${badgeColor}">
          <span class="badge-dot"></span>
          <span>${escapeHtml(badgeText)}</span>
        </div>
      </div>

      <!-- Title Block -->
      <div class="title-block">
        <div>
          <h2 class="title-main">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="title-sub">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${
          metaId
            ? `<div class="font-mono text-right" style="font-size:12px;color:#9CA3AF;background:rgba(255,255,255,0.05);padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:10px;text-transform:uppercase;color:#6B7280;">REFERENSI</div>
                <div style="font-weight:700;color:#F3F4F6;">${escapeHtml(metaId)}</div>
              </div>`
            : ''
        }
      </div>

      <!-- Main Body Content -->
      <div class="card-body">
        ${bodyContent}
      </div>

      <!-- Footer -->
      <div class="card-footer">
        <div class="footer-brand">
          <span style="color:#FF5A4D;font-weight:700;">★</span>
          <span>Komazi Assistant</span>
        </div>
        <div class="footer-meta">
          <span>${formatDateWib()}</span> • <span>${escapeHtml(metaTime)}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
