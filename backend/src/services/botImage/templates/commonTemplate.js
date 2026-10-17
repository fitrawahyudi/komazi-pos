import { wrapCardHtml, formatRupiah, escapeHtml, formatDateWib, formatTimeWib } from '../styles/brandTheme.js';

/**
 * 1. CardWelcomeHero - Kartu Selamat Datang & Onboarding (/start)
 */
export function renderWelcomeHeroCard(data = {}) {
  const user = data.user || null;
  const isLinked = Boolean(user);
  const staffName = user ? user.name : 'Staf Baru Komazi';
  const role = user ? user.role : 'PENDING_LINK';
  const telegramId = data.telegramId || (user ? user.telegramId : 'ID');

  const bodyContent = `
    <div style="background:linear-gradient(135deg, rgba(255,90,77,0.15) 0%, rgba(20,20,24,0.85) 100%);border:1.5px solid rgba(255,90,77,0.35);border-radius:24px;padding:26px 30px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <span style="font-size:11px;font-weight:800;color:#FF5A4D;letter-spacing:1px;text-transform:uppercase;">SELAMAT DATANG DI ASISTEN BOT</span>
          <h3 style="font-family:'Outfit',sans-serif;font-size:26px;font-weight:800;color:#FFF;margin-top:2px;">
            Halo, ${escapeHtml(staffName)}! ☕
          </h3>
          <p style="font-size:13px;color:#9CA3AF;margin-top:4px;">
            ${isLinked ? `Akun Telegram Anda telah terhubung secara aman dengan peran <b>${escapeHtml(role)}</b>.` : 'Silakan gunakan Kode Tautan resmi dari Owner untuk mengaktifkan seluruh fitur.'}
          </p>
        </div>
        <div style="text-align:right;">
          <span style="font-size:10px;color:#9CA3AF;text-transform:uppercase;">Status Akses:</span>
          <div style="font-family:'Outfit',sans-serif;font-size:16px;font-weight:800;color:${isLinked ? '#10B981' : '#FBBF24'};background:${isLinked ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};padding:4px 12px;border-radius:8px;border:1px solid ${isLinked ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'};margin-top:4px;">
            ${isLinked ? 'AKTIF' : 'MENUNGGU KODE'}
          </div>
        </div>
      </div>
    </div>

    <div class="grid-3">
      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Peran Pengguna</span>
        </div>
        <div class="metric-value coral" style="font-size:20px;">
          ${escapeHtml(role)}
        </div>
        <div class="metric-sub">Hak otorisasi sistem</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📱</span>
          <span>Telegram ID</span>
        </div>
        <div class="metric-value font-mono" style="font-size:18px;">
          ${escapeHtml(telegramId)}
        </div>
        <div class="metric-sub">Identitas terverifikasi</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🏢</span>
          <span>Outlet Penugasan</span>
        </div>
        <div class="metric-value" style="font-size:18px;">
          Medan
        </div>
        <div class="metric-sub">Komazi Coffee &amp; Workspace</div>
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: isLinked ? 'STAF TERHUBUNG' : 'ONBOARDING BOT',
    badgeColor: isLinked ? 'badge-emerald' : 'badge-amber',
    title: 'Asisten Pintar Komazi POS',
    subtitle: 'Solusi otomasi kasir, antrean barista KDS, coworking workspace & analitik omzet harian',
    bodyContent,
  });
}

/**
 * 2. CardMenuNavigation - Dashboard Navigasi Menu (/menu)
 */
export function renderMenuNavigationCard(data = {}) {
  const role = data.role || 'CASHIER';

  const bodyContent = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>🧭</span>
          <span>Peran Pengguna Aktif</span>
        </div>
        <div class="metric-value large coral">
          ${escapeHtml(role)}
        </div>
        <div class="metric-sub">Navigasi fitur disesuaikan</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⚡</span>
          <span>Akses Perintah Cepat</span>
        </div>
        <div class="metric-value emerald" style="font-size:20px;">
          Slash Commands
        </div>
        <div class="metric-sub">Ketik / di chat Telegram</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🔒</span>
          <span>Tingkat Keamanan</span>
        </div>
        <div class="metric-value gold" style="font-size:20px;">
          Role-Protected
        </div>
        <div class="metric-sub">Audit trail tercatat</div>
      </div>
    </div>

    <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:22px;">
      <div style="font-size:12px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
        PINTASAN MENU SESUAI PERAN ANDA:
      </div>
      <div class="grid-2">
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:12px 14px;">
          <div style="font-weight:700;color:#FFF;font-size:13px;">☕ Operasional Kasir &amp; Shift</div>
          <div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;">/buka_shift • /tutup_shift • /order • /pesanan</div>
        </div>
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:12px 14px;">
          <div style="font-weight:700;color:#FBBF24;font-size:13px;">📊 Barista &amp; Kitchen</div>
          <div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;">/antrean • /stok • /stok_masuk • /habis</div>
        </div>
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:12px 14px;">
          <div style="font-weight:700;color:#FF5A4D;font-size:13px;">👑 Manager</div>
          <div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;">/ringkasan • /laporan • /approval • /tautkan</div>
        </div>
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'MENU UTAMA & PANDUAN',
    badgeColor: 'badge-coral',
    title: 'Menu Navigasi Bot Komazi',
    subtitle: `Pilih fitur operasional outlet melalui tombol interaktif di Telegram`,
    bodyContent,
  });
}

/**
 * 3. CardStaffBadge - Kartu Identitas Digital Staf (/whoami)
 */
export function renderStaffBadgeCard(data = {}) {
  const user = data.user || {};
  const staffName = user.name || 'Staf Komazi';
  const username = user.username ? `@${user.username}` : '@komazi_staff';
  const role = user.role || 'CASHIER';
  const telegramId = user.telegramId || data.telegramId || '-';

  const bodyContent = `
    <div style="background:linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(20,20,24,0.9) 100%);border:1.5px solid rgba(255,255,255,0.1);border-radius:24px;padding:26px 30px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:18px;">
          <div style="width:64px;height:64px;border-radius:18px;background:rgba(255,90,77,0.15);border:1.5px solid rgba(255,90,77,0.4);display:flex;align-items:center;justify-content:center;font-size:26px;color:#FF5A4D;font-weight:900;">
            ${escapeHtml(staffName.slice(0, 1).toUpperCase())}
          </div>
          <div>
            <h3 style="font-family:'Outfit',sans-serif;font-size:26px;font-weight:800;color:#FFF;">
              ${escapeHtml(staffName)}
            </h3>
            <div style="font-size:13px;color:#9CA3AF;margin-top:2px;">
              Username: <b style="color:#FFF;">${escapeHtml(username)}</b> • ID Telegram: <code style="color:#48D1CC;font-weight:700;">${escapeHtml(telegramId)}</code>
            </div>
          </div>
        </div>

        <div style="text-align:right;">
          <div style="font-family:'Outfit',sans-serif;font-size:20px;font-weight:900;color:#FF5A4D;">
            ${escapeHtml(role)}
          </div>
        </div>
      </div>
    </div>

    <div class="grid-3">
      <div class="metric-card">
        <div class="metric-label">
          <span>🏢</span>
          <span>Outlet Penugasan</span>
        </div>
        <div class="metric-value" style="font-size:18px;">
          Komazi Medan
        </div>
        <div class="metric-sub">TVRI Tembung Utama</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🛡️</span>
          <span>Status Akun</span>
        </div>
        <div class="metric-value emerald" style="font-size:18px;">
          AKTIF &amp; TERVERIFIKASI
        </div>
        <div class="metric-sub">Otoritas sistem POS</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📅</span>
          <span>Status Tautan</span>
        </div>
        <div class="metric-value gold" style="font-size:18px;">
          TERTAUT RESMI
        </div>
        <div class="metric-sub">Koneksi Telegram Aktif</div>
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'DIGITAL STAFF BADGE',
    badgeColor: 'badge-emerald',
    title: 'Kartu Identitas Staf Outlet',
    subtitle: `Profil dan hak otorisasi staf resmi dalam ekosistem Komazi Coffee & Workspace`,
    bodyContent,
  });
}

/**
 * 24. CardStaffInvitation - Voucher Penautan Staf Baru (/tautkan)
 */
export function renderStaffInvitationCard(data = {}) {
  const staffName = data.targetStaffName || (data.targetUser ? data.targetUser.name : 'Staf');
  const role = data.targetStaffRole || (data.targetUser ? data.targetUser.role : 'CASHIER');
  const linkCode = data.linkCode || data.code || '88889999';

  const bodyContent = `
    <div style="background:linear-gradient(135deg, rgba(255,90,77,0.18) 0%, rgba(20,20,24,0.85) 100%);border:1.5px solid rgba(255,90,77,0.4);border-radius:24px;padding:26px 30px;margin-bottom:20px;text-align:center;">
      <span style="font-size:11px;font-weight:800;color:#FF5A4D;letter-spacing:1px;text-transform:uppercase;">KODE VERIFIKASI TAUTAN STAF BARU</span>
      <div style="font-family:'JetBrains Mono',monospace;font-size:42px;font-weight:900;color:#FFF;letter-spacing:6px;margin:14px 0;text-shadow:0 0 20px rgba(255,90,77,0.4);">
        ${escapeHtml(linkCode)}
      </div>
      <p style="font-size:13px;color:#D1D5DB;">
        Berikan kode di atas kepada <b>${escapeHtml(staffName)}</b> (${escapeHtml(role)}) untuk menghubungkan akun Telegramnya.
      </p>
    </div>

    <div class="grid-3">
      <div class="metric-card">
        <div class="metric-label">
          <span>⏱️</span>
          <span>Masa Berlaku</span>
        </div>
        <div class="metric-value gold" style="font-size:20px;">
          10 Menit
        </div>
        <div class="metric-sub">Kode sekali pakai</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Penerima Tautan</span>
        </div>
        <div class="metric-value" style="font-size:20px;">
          ${escapeHtml(staffName)}
        </div>
        <div class="metric-sub">Role: ${escapeHtml(role)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>💬</span>
          <span>Perintah Aktivasi</span>
        </div>
        <div class="metric-value font-mono coral" style="font-size:16px;">
          /start ${escapeHtml(linkCode)}
        </div>
        <div class="metric-sub">Kirim di bot Telegram</div>
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'ONBOARDING LINK CODE',
    badgeColor: 'badge-coral',
    title: `Kode Tautan: ${staffName}`,
    subtitle: `Verifikasi aman menghubungkan akun Telegram staf dengan hak akses POS`,
    bodyContent,
    metaId: `#CODE-${linkCode}`,
  });
}

/**
 * 10. CardQuickOrderSummary - Ringkasan Pesanan Cepat Kasir (/order)
 */
export function renderQuickOrderSummaryCard(data = {}) {
  const invoiceNo = data.invoiceNo || 'KMZ-' + Date.now().toString().slice(-6);
  const type = data.type || 'DINE_IN';
  const customerName = data.customerName || 'Pelanggan';
  const cashierName = data.cashierName || 'Kasir';
  const total = Number(data.total || 0);
  const items = Array.isArray(data.items) ? data.items : [];

  const bodyContent = `
    <div class="grid-4" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>💰</span>
          <span>Total Tagihan</span>
        </div>
        <div class="metric-value large coral">
          ${formatRupiah(total)}
        </div>
        <div class="metric-sub">Belum dibayar (Open Bill)</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📍</span>
          <span>Tipe &amp; Pelanggan</span>
        </div>
        <div class="metric-value" style="font-size:18px;">
          ${escapeHtml(customerName)}
        </div>
        <div class="metric-sub">${escapeHtml(type)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📦</span>
          <span>Jumlah Item</span>
        </div>
        <div class="metric-value emerald">
          ${items.length} Menu
        </div>
        <div class="metric-sub">Tercatat di antrean</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Kasir Pembuat</span>
        </div>
        <div class="metric-value" style="font-size:18px;">
          ${escapeHtml(cashierName)}
        </div>
        <div class="metric-sub">POS Quick Order</div>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:22px;">🧾</span>
        <div style="font-size:13px;color:#F3F4F6;">
          Pesanan berstatus <b>OPEN BILL</b> telah dibuat. Lakukan pelunasan tunai/QRIS di kasir web saat pelanggan membayar.
        </div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#60A5FA;">
        STATUS: OPEN_BILL
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'PESANAN CEPAT DIBUAT',
    badgeColor: 'badge-coral',
    title: `Pesanan Baru #${invoiceNo}`,
    subtitle: `Transaksi tersimpan sebagai Open Bill dan tiket diteruskan ke Barista`,
    bodyContent,
    metaId: `#${invoiceNo}`,
  });
}

/**
 * 11. CardOpenBillList - Daftar Open Bill Belum Lunas (/pesanan)
 */
export function renderOpenBillListCard(data = {}) {
  const openOrders = Array.isArray(data.orders) ? data.orders : [];
  const totalOpenAmount = openOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);

  const rowsHtml = openOrders.map((o, idx) => {
    const loc = o.tableNo ? `Meja ${o.tableNo}` : (o.type || 'Dine In');
    const itemsCount = (o.items || []).length || 1;

    return `
      <div class="table-row" style="grid-template-columns: 2fr 1fr 1fr 140px;background:${idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'};">
        <div>
          <span style="font-family:'Outfit',sans-serif;font-weight:800;color:#FFF;font-size:14px;">${escapeHtml(o.invoiceNo)}</span>
          <div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;">Tamu: ${escapeHtml(o.customerName || 'Pelanggan')}</div>
        </div>
        <div style="font-size:13px;color:#FBBF24;font-weight:600;">
          ${escapeHtml(loc)}
        </div>
        <div style="font-size:13px;color:#9CA3AF;">
          ${itemsCount} Item
        </div>
        <div style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;color:#FF5A4D;font-size:14px;">
          ${formatRupiah(o.total)}
        </div>
      </div>
    `;
  }).join('');

  const bodyContent = `
    <div class="grid-3" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>📋</span>
          <span>Total Open Bill</span>
        </div>
        <div class="metric-value large coral">
          ${openOrders.length} <span style="font-size:14px;color:#9CA3AF;font-weight:500;">Pesanan</span>
        </div>
        <div class="metric-sub">Belum dilunasi kasir</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>💰</span>
          <span>Akumulasi Tagihan</span>
        </div>
        <div class="metric-value large gold">
          ${formatRupiah(totalOpenAmount)}
        </div>
        <div class="metric-sub">Total belum terbayar</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>💡</span>
          <span>Proses Kasir</span>
        </div>
        <div class="metric-value emerald" style="font-size:18px;">
          Web POS Ready
        </div>
        <div class="metric-sub">Selesaikan di layar kasir</div>
      </div>
    </div>

    <!-- Table -->
    <div class="table-box">
      <div class="table-header" style="grid-template-columns: 2fr 1fr 1fr 140px;">
        <span>No. Invoice &amp; Tamu</span>
        <span>Meja / Tipe</span>
        <span>Item</span>
        <span style="text-align:right;">Total Tagihan</span>
      </div>
      ${rowsHtml || '<div style="padding:20px;text-align:center;color:#6B7280;">Tidak ada pesanan berstatus Open Bill saat ini.</div>'}
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'DAFTAR OPEN BILL AKTIF',
    badgeColor: 'badge-coral',
    title: 'Pesanan Belum Lunas (Open Bill)',
    subtitle: `Daftar transaksi aktif di meja kasir yang menunggu penyelesaian pembayaran`,
    bodyContent,
  });
}

/**
 * 7. CardBotStatus - Dashboard Status & Performa Bot (/infobot)
 */
export function renderBotStatusCard(data = {}) {
  const bot = data.bot || {};
  const db = data.database || {};
  const staff = data.staff || { roles: {} };
  const ops = data.operations || {};
  const notif = data.notifications || {};
  const mem = bot.memory || {};

  const bodyContent = `
    <!-- Top System Hero -->
    <div style="background:linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(20,20,24,0.9) 100%);border:1.5px solid rgba(16,185,129,0.35);border-radius:24px;padding:24px 28px;margin-bottom:22px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <span style="font-size:11px;font-weight:800;color:#10B981;letter-spacing:1px;text-transform:uppercase;">DIAGNOSTIK KESEHATAN SISTEM REALTIME</span>
          <h3 style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;color:#FFF;margin-top:2px;">
            Komazi Assistant &amp; POS Engine
          </h3>
          <p style="font-size:13px;color:#9CA3AF;margin-top:4px;">
            GrammY v1.35 • Prisma ORM v6.19 • MySQL Database • Node.js ${escapeHtml(bot.nodeVersion || 'v22')}
          </p>
        </div>
        <div style="text-align:right;">
          <span style="font-size:10px;color:#9CA3AF;text-transform:uppercase;">Status Layanan:</span>
          <div style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:800;color:#10B981;background:rgba(16,185,129,0.15);padding:5px 14px;border-radius:10px;border:1px solid rgba(16,185,129,0.3);margin-top:4px;display:flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#10B981;display:inline-block;box-shadow:0 0 8px #10B981;"></span>
            ONLINE
          </div>
        </div>
      </div>
    </div>

    <!-- Key Metrics Grid -->
    <div class="grid-4" style="margin-bottom:22px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>⏱️</span>
          <span>Waktu Aktif (Uptime)</span>
        </div>
        <div class="metric-value font-mono coral" style="font-size:20px;">
          ${escapeHtml(bot.uptime || '0m 0d')}
        </div>
        <div class="metric-sub">Beroperasi tanpa henti</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🗄️</span>
          <span>Latensi Database</span>
        </div>
        <div class="metric-value font-mono emerald" style="font-size:22px;">
          ${escapeHtml(db.latency || '0 ms')}
        </div>
        <div class="metric-sub">MySQL • 34 Model Prisma</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🧠</span>
          <span>Konsumsi RAM</span>
        </div>
        <div class="metric-value font-mono sky" style="font-size:20px;">
          ${escapeHtml(mem.heapUsed || '0 MB')}
        </div>
        <div class="metric-sub">RSS: ${escapeHtml(mem.rss || '0 MB')}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👥</span>
          <span>Staf Tertaut</span>
        </div>
        <div class="metric-value font-mono gold" style="font-size:22px;">
          ${Number(staff.linked || 0)} <span style="font-size:14px;color:#9CA3AF;font-weight:500;">/ ${Number(staff.total || 0)}</span>
        </div>
        <div class="metric-sub">Akun Telegram staf aktif</div>
      </div>
    </div>

    <!-- Detail Panels Grid-2 -->
    <div class="grid-2" style="margin-bottom:10px;">
      <!-- Panel Kiri: Ringkasan Operasional -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px 24px;">
        <div style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;color:#FFF;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <span>☕</span> <span>Statistik Operasional Outlet</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Sesi Shift Kasir Aktif</span>
            <span style="font-weight:700;color:#10B981;">${ops.openShifts || 0} Sesi Terbuka</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Total Transaksi / Pesanan</span>
            <span style="font-weight:700;color:#FFF;">${ops.orders || 0} Pesanan</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Katalog Menu Aktif</span>
            <span style="font-weight:700;color:#FFF;">${ops.products || 0} Produk</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Inventaris Bahan Baku</span>
            <span style="font-weight:700;color:#FFF;">${ops.ingredients || 0} Bahan</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Peringatan Stok Rendah</span>
            <span style="font-weight:700;color:${ops.lowStock > 0 ? '#EF4444' : '#10B981'};">${ops.lowStock || 0} Bahan Kritis</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#9CA3AF;">Coworking Workspace Aktif</span>
            <span style="font-weight:700;color:#38BDF8;">${ops.activeWorkspaces || 0} Tamu Aktif</span>
          </div>
        </div>
      </div>

      <!-- Panel Kanan: Otomasi & Fitur Notifikasi -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px 24px;">
        <div style="font-family:'Outfit',sans-serif;font-size:15px;font-weight:700;color:#FFF;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <span>🔔</span> <span>Otomasi &amp; Notifikasi Cerdas</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Notifikasi Pesanan Baru</span>
            <span style="font-weight:700;color:${notif.transaction ? '#10B981' : '#6B7280'};">${notif.transaction ? 'AKTIF ✅' : 'NONAKTIF'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Peringatan Stok Menipis</span>
            <span style="font-weight:700;color:${notif.lowStock ? '#10B981' : '#6B7280'};">${notif.lowStock ? 'AKTIF ✅' : 'NONAKTIF'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Notifikasi Pembukaan/Tutup Shift</span>
            <span style="font-weight:700;color:${notif.shift ? '#10B981' : '#6B7280'};">${notif.shift ? 'AKTIF ✅' : 'NONAKTIF'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Auto Tutup Buku (22:00 WIB)</span>
            <span style="font-weight:700;color:${notif.dailySummary ? '#10B981' : '#6B7280'};">${notif.dailySummary ? 'AKTIF ✅' : 'NONAKTIF'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:6px;">
            <span style="color:#9CA3AF;">Komazi AI Morning Briefing</span>
            <span style="font-weight:700;color:#10B981;">08:00 WIB ✅</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#9CA3AF;">Sentinel Waktu Workspace</span>
            <span style="font-weight:700;color:#10B981;">Tiap 1 Menit ✅</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'STATUS BOT AKTIF',
    badgeColor: 'badge-emerald',
    title: 'Status & Performa Asisten Bot',
    subtitle: 'Pemantauan realtime kesehatan server, database MySQL, scheduler, dan akun staf',
    bodyContent,
  });
}

