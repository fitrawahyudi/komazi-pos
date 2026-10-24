/**
 * Komazi AI Role Helpers
 * Logika isolasi chat, pesan pembuka spesifik hak akses, dan manajemen riwayat obrolan per-role
 */

export function getRoleWelcomeMessage(role = 'CASHIER', name = '') {
  const normalized = (role || 'CASHIER').toUpperCase();
  const trimmedName = (name || '').trim();
  const greeting = trimmedName ? `Halo Kak ${trimmedName}!` : 'Halo Rekan Komazi!';

  if (normalized === 'OWNER') {
    return {
      text: `${greeting} Saya **Komazi AI — Asisten Eksekutif Bisnis** ☕\n\nSelamat bertugas! Saya dapat menyajikan seluruh laporan omset komparatif, margin HPP bahan baku, audit selisih kas kasir, serta performa bisnis kedai secara komprehensif. Silakan tanyakan hal strategis seputar kedai!`,
      followUps: [
        'Bagaimana perbandingan omset hari ini vs kemarin?',
        'Menu apa yang menyumbang pendapatan terbesar?',
        'Apakah ada selisih kas pada shift kasir?',
      ],
    };
  }

  if (normalized === 'MANAGER') {
    return {
      text: `${greeting} Saya **Komazi AI — Asisten Operasional** ☕\n\nSelamat bertugas! Saya memantau volume transaksi operasional harian, peringatan bahan baku menipis, status shift kasir, dan kapasitas workspace aktif. Silakan tanyakan seputar operasional harian kedai!`,
      followUps: [
        'Bahan baku apa yang stoknya di bawah batas minimum?',
        'Siapa kasir yang sedang shift aktif sekarang?',
        'Bagaimana cara tutup shift dan hitung selisih kas?',
      ],
    };
  }

  if (normalized === 'BARISTA') {
    return {
      text: `${greeting} Saya **Komazi AI — Asisten Bar Minuman** ☕\n\nSemangat menyeduh hari ini! Saya memantau ketersediaan bahan kopi, fresh milk, oat milk, sirup, serta pesanan minuman terlaris untuk persiapan bar Anda. Silakan tanyakan seputar stok bar & menu minuman!`,
      followUps: [
        'Apa resep dan takaran Vanilla Latte?',
        'Berapa sisa stok Fresh Milk dan Biji Kopi?',
        'Minuman kopi apa yang paling banyak dipesan hari ini?',
      ],
    };
  }

  if (normalized === 'KITCHEN') {
    return {
      text: `${greeting} Saya **Komazi AI — Asisten Dapur Makanan** 🥐\n\nSemangat di dapur hari ini! Saya memantau ketersediaan bahan pastry, croissant, butter, bahan dapur, serta pesanan makanan terlaris untuk persiapan dapur Anda. Silakan tanyakan seputar stok & menu dapur!`,
      followUps: [
        'Bahan dapur apa yang stoknya paling sedikit saat ini?',
        'Makanan atau pastry apa yang paling laku hari ini?',
        'Bagaimana cara mengatur resep menu di sistem?',
      ],
    };
  }

  // CASHIER (Default)
  return {
    text: `${greeting} Saya **Komazi AI — Asisten POS & Layanan Pelanggan** ☕\n\nSelamat bertugas di kasir! Saya siap membantu memeriksa SOP kasir (split bill, printer thermal, shift), rekomendasi menu pelanggan, peringatan bahan habis/kritis, serta ketersediaan meja workspace. Silakan tanyakan!`,
    followUps: [
      'Bagaimana cara split bill pesanan meja?',
      'Cara pasang printer thermal bluetooth?',
      'Bagaimana cara tutup shift kasir?',
      'Menu apa yang paling laku untuk rekomendasi pelanggan?',
    ],
  };
}

/**
 * Mengisolasi riwayat pesan aktif berdasarkan role pengguna.
 * Memastikan riwayat role sensitif (OWNER/MANAGER) tidak bocor ke role operasional (CASHIER/BARISTA).
 */
export function syncRoleChatHistory({ messagesByRole = {}, targetRole = 'CASHIER', targetName = '' }) {
  const role = (targetRole || 'CASHIER').toUpperCase();
  const currentMap = { ...(messagesByRole || {}) };
  const roleList = currentMap[role] || [];

  const hasUserInteracted = roleList.some((m) => m && m.role === 'user');
  let effectiveMessages = roleList;

  if (!hasUserInteracted || roleList.length === 0) {
    const welcome = getRoleWelcomeMessage(role, targetName);
    effectiveMessages = [
      {
        id: `welcome_${role}`,
        role: 'assistant',
        text: welcome.text,
        provider: 'SYSTEM',
        model: 'Komazi AI',
        timestamp: new Date().toISOString(),
        followUps: welcome.followUps,
      },
    ];
  }

  return {
    activeRole: role,
    activeMessages: effectiveMessages,
    updatedMessagesByRole: {
      ...currentMap,
      [role]: effectiveMessages,
    },
  };
}
