import { wrapCardHtml, formatRupiah, escapeHtml, formatDateWib, formatTimeWib } from '../styles/brandTheme.js';

/**
 * 12. CardWorkspaceMatrix - Status Meja & Okupansi Workspace
 */
export function renderWorkspaceMatrixCard(data = {}) {
  const areas = Array.isArray(data.areas) ? data.areas : [];
  const occupiedCount = areas.filter(a => a.sessions && a.sessions.length > 0).length;
  const availableCount = Math.max(0, areas.length - occupiedCount);
  const occupancyRate = areas.length > 0 ? Math.round((occupiedCount / areas.length) * 100) : 0;

  const areasHtml = areas.map((a) => {
    const session = a.sessions && a.sessions[0];
    const isOccupied = Boolean(session);

    let statusLabel = 'TERSEDIA';
    let statusClass = 'emerald';
    let statusBg = 'rgba(16,185,129,0.15)';
    let statusBorder = 'rgba(16,185,129,0.3)';
    let statusText = '🟢 Tersedia';
    let sessionDetail = `Kapasitas: ${a.capacity || 1} Orang`;

    if (isOccupied) {
      const elapsed = Math.max(1, Math.round((Date.now() - new Date(session.checkInAt).getTime()) / 60000));
      const dur = session.package?.durationMin || 60;
      const rem = dur - elapsed;
      if (rem > 0) {
        statusLabel = `TERISI (${rem}m)`;
        statusClass = 'coral';
        statusBg = 'rgba(255,90,77,0.15)';
        statusBorder = 'rgba(255,90,77,0.3)';
        statusText = '🔴 Terisi';
      } else {
        statusLabel = `OVERTIME (+${Math.abs(rem)}m)`;
        statusClass = 'gold';
        statusBg = 'rgba(245,158,11,0.15)';
        statusBorder = 'rgba(245,158,11,0.3)';
        statusText = '🟡 Overtime';
      }
      sessionDetail = `Tamu: <b>${escapeHtml(session.customerName)}</b> • Sisa ${rem > 0 ? rem : 0} mnt`;
    }

    return `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:700;font-size:14px;color:#FFFFFF;display:flex;align-items:center;gap:6px;">
            <span>${escapeHtml(a.name)}</span>
            <span style="font-size:11px;color:#9CA3AF;font-weight:400;">(${a.type || 'Desk'})</span>
          </div>
          <div style="font-size:11.5px;color:#9CA3AF;margin-top:3px;">
            ${sessionDetail}
          </div>
        </div>
        <div style="font-size:11px;font-weight:700;padding:5px 12px;border-radius:8px;background:${statusBg};border:1px solid ${statusBorder};color:#FFF;">
          ${statusText}
        </div>
      </div>
    `;
  }).join('');

  const bodyContent = `
    <div class="grid-4" style="margin-bottom:20px;">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>📊</span>
          <span>Tingkat Okupansi</span>
        </div>
        <div class="metric-value large coral">
          ${occupancyRate}%
        </div>
        <div class="metric-sub">${occupiedCount} dari ${areas.length} meja aktif</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🟢</span>
          <span>Area Tersedia</span>
        </div>
        <div class="metric-value emerald">
          ${availableCount} Meja
        </div>
        <div class="metric-sub">Siap check-in baru</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>🔴</span>
          <span>Area Terisi</span>
        </div>
        <div class="metric-value">
          ${occupiedCount} Meja
        </div>
        <div class="metric-sub">Sesi berjalan</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>📶</span>
          <span>Koneksi Tamu</span>
        </div>
        <div class="metric-value gold" style="font-size:20px;">
          100 Mbps
        </div>
        <div class="metric-sub">High-Speed VIP WiFi</div>
      </div>
    </div>

    <!-- Matrix Grid of Desks -->
    <div style="background:rgba(20,20,24,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:20px;">
      <div style="font-size:12px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px;">
        KETERSEDIAAN MEJA &amp; RUANGAN WORKSPACE:
      </div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:12px;">
        ${areasHtml || '<div style="color:#6B7280;font-style:italic;">Belum ada area workspace</div>'}
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'WORKSPACE STATUS MATRIX',
    badgeColor: 'badge-teal',
    title: 'Okupansi & Status Workspace Komazi',
    subtitle: `Pemantauan ketersediaan hot desk, private booth, dan meeting room secara realtime`,
    bodyContent,
  });
}

/**
 * 13. CardWorkspaceAccessPass - Pass Akses Tamu Workspace (Digital Pass)
 */
export function renderWorkspaceAccessPassCard(data = {}) {
  const guestName = data.customerName || data.guestName || 'Tamu Komazi';
  const deskName = data.areaName || data.deskName || (data.area ? data.area.name : 'Hot Desk #01');
  const durationLabel = data.durationLabel || `${data.package?.durationMin || 60} Menit`;
  const validUntil = data.endsAtLabel || formatTimeWib();
  const wifiSsid = data.wifiSsid || 'KOMAZI_WORKSPACE_5G';
  const wifiPass = data.wifiPass || 'kopikomazi2026';
  const price = Number(data.package?.price || data.price || 0);

  const bodyContent = `
    <!-- Top Pass Banner -->
    <div style="background:linear-gradient(135deg, rgba(47,163,156,0.18) 0%, rgba(20,20,24,0.85) 100%);border:1.5px solid rgba(47,163,156,0.4);border-radius:22px;padding:24px 28px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div>
          <span style="font-size:11px;font-weight:800;color:#48D1CC;letter-spacing:1px;text-transform:uppercase;">DIGITAL ACCESS PASS</span>
          <h3 style="font-family:'Outfit',sans-serif;font-size:26px;font-weight:800;color:#FFF;margin-top:2px;">
            ${escapeHtml(guestName)}
          </h3>
        </div>
        <div style="text-align:right;">
          <span style="font-size:11px;color:#9CA3AF;text-transform:uppercase;">Area Terpilih:</span>
          <div style="font-family:'Outfit',sans-serif;font-size:22px;font-weight:800;color:#FF5A4D;">
            ${escapeHtml(deskName)}
          </div>
        </div>
      </div>

      <div class="grid-3">
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 16px;">
          <span style="font-size:10.5px;color:#9CA3AF;text-transform:uppercase;">Durasi Sesi</span>
          <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:800;color:#FFF;margin-top:2px;">
            ${escapeHtml(durationLabel)}
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 16px;">
          <span style="font-size:10.5px;color:#9CA3AF;text-transform:uppercase;">Berlaku Hingga</span>
          <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:800;color:#FBBF24;margin-top:2px;">
            ${validUntil} WIB
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 16px;">
          <span style="font-size:10.5px;color:#9CA3AF;text-transform:uppercase;">Tarif Paket</span>
          <div style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:800;color:#10B981;margin-top:2px;">
            ${formatRupiah(price)}
          </div>
        </div>
      </div>
    </div>

    <!-- WiFi Credentials Box -->
    <div style="background:rgba(18,18,22,0.85);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:46px;height:46px;border-radius:14px;background:rgba(47,163,156,0.18);border:1px solid rgba(47,163,156,0.4);display:flex;align-items:center;justify-content:center;color:#48D1CC;font-size:20px;">
          📶
        </div>
        <div>
          <div style="font-size:14px;font-weight:800;color:#FFF;">Kredensial Akses WiFi Khusus Tamu</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:2px;">
            SSID: <code style="color:#48D1CC;font-weight:700;">${escapeHtml(wifiSsid)}</code> • Password: <code style="color:#FFF;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:6px;font-weight:700;">${escapeHtml(wifiPass)}</code>
          </div>
        </div>
      </div>

      <div style="font-size:11.5px;color:#9CA3AF;text-align:right;">
        <span>Free-flow Infused Water</span><br/>
        <span style="color:#10B981;font-weight:700;">Dedicated Fiber 100M</span>
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'VIP ACCESS PASS',
    badgeColor: 'badge-teal',
    title: 'Digital Workspace Access Pass',
    subtitle: `Kupon akses dan kredensial fasilitas kerja resmi Komazi Workspace`,
    bodyContent,
  });
}

/**
 * 14. CardWorkspaceExpiryAlert - Peringatan Waktu Workspace Menipis
 */
export function renderWorkspaceExpiryAlertCard(data = {}) {
  const guestName = data.customerName || 'Tamu';
  const areaName = data.areaName || (data.area ? data.area.name : 'Workspace');
  const remMinutes = Number(data.remainingMinutes || 10);

  const bodyContent = `
    <div class="grid-3">
      <div class="metric-card highlight" style="border-color:rgba(245,158,11,0.4);background:linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(20,20,24,0.85) 100%);">
        <div class="metric-label" style="color:#FBBF24;">
          <span>⏳</span>
          <span>Sisa Waktu Sesi</span>
        </div>
        <div class="metric-value large gold">
          ${remMinutes} <span style="font-size:16px;color:#9CA3AF;font-weight:500;">Menit</span>
        </div>
        <div class="metric-sub">Hitung mundur otomatis</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Nama Tamu</span>
        </div>
        <div class="metric-value">
          ${escapeHtml(guestName)}
        </div>
        <div class="metric-sub">Lokasi: ${escapeHtml(areaName)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>💡</span>
          <span>Tindakan Kasir</span>
        </div>
        <div class="metric-value" style="font-size:16px;">
          Konfirmasi Tamu
        </div>
        <div class="metric-sub">Check-out atau Perpanjangan</div>
      </div>
    </div>

    <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:18px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:22px;">⏰</span>
        <div style="font-size:12.5px;color:#F3F4F6;">
          Harap infokan kepada tamu agar bersiap melakukan check-out atau perpanjangan durasi sebelum terkena tarif overtime.
        </div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#FBBF24;">
        COUNTDOWN: ${remMinutes}M
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'PENGINGAT WAKTU WORKSPACE',
    badgeColor: 'badge-amber',
    title: `Sesi ${areaName} Segera Berakhir`,
    subtitle: `Waktu sewa meja workspace hampir selesai dalam ${remMinutes} menit`,
    bodyContent,
  });
}

/**
 * 15. CardWorkspaceBilling - Tagihan Check-Out Workspace
 */
export function renderWorkspaceBillingCard(data = {}) {
  const guestName = data.customerName || 'Tamu';
  const deskName = data.areaName || 'Workspace';
  const durationMin = Number(data.durationMin || 60);
  const overtimeMin = Number(data.overtimeMin || 0);
  const basePrice = Number(data.basePrice || 0);
  const overtimeFee = Number(data.overtimeFee || 0);
  const totalBill = Number(data.totalBill || (basePrice + overtimeFee));

  const bodyContent = `
    <div class="grid-4">
      <div class="metric-card highlight">
        <div class="metric-label">
          <span>💵</span>
          <span>Total Tagihan Sesi</span>
        </div>
        <div class="metric-value large coral">
          ${formatRupiah(totalBill)}
        </div>
        <div class="metric-sub">Paket + Biaya Overtime</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⏱️</span>
          <span>Durasi Pemakaian</span>
        </div>
        <div class="metric-value">
          ${durationMin} Menit
        </div>
        <div class="metric-sub">Paket awal terdaftar</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>⚠️</span>
          <span>Overtime Pemakaian</span>
        </div>
        <div class="metric-value ${overtimeMin > 0 ? 'gold' : ''}">
          +${overtimeMin} Menit
        </div>
        <div class="metric-sub">Biaya: ${formatRupiah(overtimeFee)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">
          <span>👤</span>
          <span>Tamu Selesai</span>
        </div>
        <div class="metric-value" style="font-size:18px;">
          ${escapeHtml(guestName)}
        </div>
        <div class="metric-sub">Area: ${escapeHtml(deskName)}</div>
      </div>
    </div>

    <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:18px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:22px;">✅</span>
        <div>
          <div style="font-size:13.5px;font-weight:700;color:#FFF;">Sesi Berhasil Di-Checkout</div>
          <div style="font-size:11.5px;color:#9CA3AF;">Meja ${deskName} kini telah kembali berstatus TERSEDIA untuk tamu berikutnya.</div>
        </div>
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:#10B981;">
        STATUS: CHECKED-OUT
      </div>
    </div>
  `;

  return wrapCardHtml({
    badgeText: 'WORKSPACE CHECKOUT BILLING',
    badgeColor: 'badge-emerald',
    title: 'Check-Out Sesi Workspace Selesai',
    subtitle: `Rekonsiliasi durasi dan penagihan akhir sesi tamu di ${deskName}`,
    bodyContent,
  });
}
