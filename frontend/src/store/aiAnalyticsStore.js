import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';
import { useOrdersStore } from './ordersStore';
import { useStockStore } from './stockStore';
import { formatRupiah } from '../utils/format';

import { useAuthStore } from './authStore';

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

export const useAiAnalyticsStore = create(
  persist(
    (set, get) => ({
  isAssistantOpen: false,
  isLoading: false,
  isQuickInsightLoading: false,
  quickInsight: null,
  messages: [
    {
      id: 'welcome_1',
      role: 'assistant',
      text: getRoleWelcomeMessage('CASHIER').text,
      provider: 'SYSTEM',
      model: 'Komazi AI',
      timestamp: new Date().toISOString(),
      followUps: getRoleWelcomeMessage('CASHIER').followUps,
    },
  ],

  /**
   * Buka modal asisten dan perbarui pesan pembuka dengan sapaan nama jika belum ada percakapan pengguna
   */
  openAssistant: () => {
    const user = useAuthStore.getState().user;
    const userRole = user?.role || 'CASHIER';
    const userName = user?.name || user?.username || '';
    const currentMessages = get().messages || [];
    const hasUserInteracted = currentMessages.some((m) => m.role === 'user');

    if (!hasUserInteracted) {
      const welcome = getRoleWelcomeMessage(userRole, userName);
      set({
        isAssistantOpen: true,
        messages: [
          {
            id: 'welcome_1',
            role: 'assistant',
            text: welcome.text,
            provider: 'SYSTEM',
            model: 'Komazi AI',
            timestamp: new Date().toISOString(),
            followUps: welcome.followUps,
          },
        ],
      });
    } else {
      set({ isAssistantOpen: true });
    }
  },

  closeAssistant: () => {
    set({ isAssistantOpen: false });
  },

  clearChat: () => {
    const user = useAuthStore.getState().user;
    const userRole = user?.role || 'CASHIER';
    const userName = user?.name || user?.username || '';
    const welcome = getRoleWelcomeMessage(userRole, userName);
    set({
      messages: [
        {
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          text: welcome.text,
          provider: 'SYSTEM',
          model: 'Komazi AI',
          timestamp: new Date().toISOString(),
          followUps: welcome.followUps,
        },
      ],
    });
  },

  /**
   * Mengirim pertanyaan ke AI backend dengan memori percakapan sebelumnya dan nama pengguna
   */
  askQuestion: async (userQuery) => {
    const query = userQuery?.trim() || 'Menu apa yang paling laku hari ini?';
    const userMsgId = `user_${Date.now()}`;

    // Ambil riwayat percakapan sebelumnya untuk memori multi-turn
    const previousHistory = get().messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.text && m.id !== 'welcome_1')
      .map((m) => ({ role: m.role, text: m.text }));

    // Tambahkan pesan user ke riwayat
    set((state) => ({
      isLoading: true,
      messages: [
        ...state.messages,
        {
          id: userMsgId,
          role: 'user',
          text: query,
          timestamp: new Date().toISOString(),
        },
      ],
    }));

    try {
      const user = useAuthStore.getState().user;
      const userName = user?.name || user?.username || '';
      // Kirim pertanyaan beserta riwayat percakapan sebelumnya dan nama user
      const res = await api.analytics.askAi({ query, history: previousHistory, userName });

      if (res && res.success && res.data) {
        const d = res.data;
        const assistantMsg = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          text: d.answer,
          provider: d.provider || 'GROQ',
          model: 'Komazi AI',
          latencyTier: d.latencyTier || 'Komazi AI',
          intent: d.intent || null,
          intentMeta: d.intentMeta || null,
          actionHint: d.actionHint || null,
          matchedSop: d.matchedSop || null,
          metrics: d.metrics,
          followUps: [],
          timestamp: d.generatedAt || new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages, assistantMsg],
          isLoading: false,
        }));
        return;
      }
    } catch (err) {
      console.warn('[AIAnalyticsStore] Backend tidak terjangkau, beralih ke client-side fallback:', err);
    }

    // ─── CLIENT-SIDE FALLBACK (Jika Backend Offline / Mode Standalone) ───────────
    try {
      const q = (query || '').toLowerCase().trim();
      const orders = useOrdersStore.getState().orders || [];
      const { getLowStockItems } = useStockStore.getState();
      const validOrders = orders.filter((o) => o.status === 'PAID');

      const productMap = {};
      let totalRevenue = 0;

      validOrders.forEach((o) => {
        totalRevenue += Number(o.total || 0);
        (o.items || []).forEach((item) => {
          const id = item.productId || item.name;
          if (!productMap[id]) {
            productMap[id] = {
              name: item.name || item.productName || 'Produk',
              qty: 0,
              revenue: 0,
            };
          }
          productMap[id].qty += Number(item.qty || 1);
          productMap[id].revenue += Number(item.lineTotal || (item.price * (item.qty || 1)));
        });
      });

      const sorted = Object.values(productMap).sort((a, b) => b.qty - a.qty);
      const top1 = sorted[0];
      const lowStock = getLowStockItems ? getLowStockItems() : [];

      let narrative = '';
      let customFollowUps = [
        'Menu apa yang paling laku hari ini?',
        'Berapa sisa stok bahan menu terlaris?',
        'Berapa total omset dan transaksi hari ini?',
      ];

      // 1. Intent Greeting / Sapaan
      const greetingWords = ['hi', 'halo', 'hello', 'hey', 'pagi', 'siang', 'sore', 'malam', 'assalamualaikum', 'tes', 'test', 'ping', 'bantu'];
      const isGreeting = greetingWords.some((w) => q === w || q.startsWith(`${w} `) || q.endsWith(` ${w}`));

      const authUser = useAuthStore.getState().user;
      const greetingName = authUser?.name ? `Kak ${authUser.name}` : 'Rekan Komazi';

      if (isGreeting || !q) {
        const revFormatted = formatRupiah(totalRevenue);
        const stockAlertText = lowStock.length > 0 ? `${lowStock.length} bahan menipis ⚠️` : 'Aman terkendali ✅';
        narrative = `Halo ${greetingName}! Selamat datang di **Komazi Coffee & Workspace** ☕\n\nSaya **Komazi AI**, asisten data penjualan dan operasional kedai Anda.\n\n📌 **Status Sekilas Kedai Hari Ini:**\n- Total Omset: **${revFormatted}** (${validOrders.length} transaksi)\n- Menu Teratas: **${top1 ? top1.name : 'Belum ada transaksi'}**\n- Stok Bahan Baku: **${stockAlertText}**\n\nSilakan tanyakan hal apa saja seputar operasional, atau klik pertanyaan di bawah!`;
        customFollowUps = [
          'Menu apa yang paling laku hari ini?',
          'Berapa sisa stok bahan menu terlaris?',
          'Berapa total omset dan transaksi hari ini?',
        ];
      }
      // 1b. Intent Data & Penjualan Kemarin
      else if (q.includes('kemarin') || q.includes('yesterday') || q.includes('hari lalu')) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yOrders = orders.filter((o) => {
          if (o.status !== 'PAID' || !o.createdAt) return false;
          const d = new Date(o.createdAt);
          return (
            d.getFullYear() === yesterday.getFullYear() &&
            d.getMonth() === yesterday.getMonth() &&
            d.getDate() === yesterday.getDate()
          );
        });

        const yRev = yOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const yProductMap = {};
        yOrders.forEach((o) => {
          (o.items || []).forEach((item) => {
            const name = item.name || item.productName || 'Produk';
            if (!yProductMap[name]) yProductMap[name] = { name, qty: 0, revenue: 0 };
            yProductMap[name].qty += Number(item.qty || 1);
            yProductMap[name].revenue += Number(item.lineTotal || (item.price * (item.qty || 1)));
          });
        });
        const ySorted = Object.values(yProductMap).sort((a, b) => b.qty - a.qty);

        if (yOrders.length > 0) {
          narrative = `📊 **Ringkasan Penjualan Kemarin:**\n\n- **Total Omset Kemarin**: **${formatRupiah(yRev)}**\n- **Jumlah Transaksi**: **${yOrders.length} transaksi**\n- Rata-rata per Transaksi: **${formatRupiah(Math.round(yRev / yOrders.length))}**\n`;
          if (ySorted.length > 0) {
            narrative += `- **Menu Terlaris Kemarin**: **${ySorted[0].name}** (${ySorted[0].qty} terjual - ${formatRupiah(ySorted[0].revenue)})\n`;
          }
          narrative += `\n💡 **Perbandingan Hari Ini**: Omset hari ini tercatat **${formatRupiah(totalRevenue)}** (${validOrders.length} transaksi).`;
        } else {
          // Cari pesanan sebelum hari ini jika ada
          const pastOrders = orders.filter((o) => {
            if (o.status !== 'PAID' || !o.createdAt) return false;
            const d = new Date(o.createdAt);
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            return d < todayStart;
          }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          if (pastOrders.length > 0) {
            const lastDate = new Date(pastOrders[0].createdAt);
            const lastDateStr = lastDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const sameDayPastOrders = pastOrders.filter((o) => {
              const d = new Date(o.createdAt);
              return (
                d.getFullYear() === lastDate.getFullYear() &&
                d.getMonth() === lastDate.getMonth() &&
                d.getDate() === lastDate.getDate()
              );
            });
            const pRev = sameDayPastOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

            narrative = `📌 **Data Penjualan Kemarin:**\n\nPada hari kalender kemarin, **tidak tercatat transaksi lunas** di sistem (kedai libur/tutup atau belum ada penjualan).\n\n🔍 **Hari Operasional Aktif Terakhir (${lastDateStr}):**\n- **Total Omset**: **${formatRupiah(pRev)}** (${sameDayPastOrders.length} transaksi)\n\n💡 **Omset Hari Ini**: Sementara tercatat **${formatRupiah(totalRevenue)}** (${validOrders.length} transaksi).`;
          } else {
            narrative = `📌 **Data Penjualan Kemarin:**\n\nPada hari kalender kemarin, tidak tercatat transaksi lunas di sistem (kedai libur/tutup atau belum ada penjualan).\n\n💡 **Omset Hari Ini**: Sementara tercatat **${formatRupiah(totalRevenue)}** (${validOrders.length} transaksi).`;
          }
        }
        customFollowUps = [
          'Menu apa yang paling laku hari ini?',
          'Berapa total omset dan transaksi hari ini?',
          'Berapa sisa stok bahan baku?',
        ];
      }
      // 2. Intent Omset / Penjualan Umum
      else if (q.includes('omset') || q.includes('omzet') || q.includes('pendapatan') || q.includes('transaksi') || q.includes('penjualan')) {
        narrative = `💰 **Ringkasan Pendapatan Kedai Hari Ini:**\n\n- **Total Omset**: **${formatRupiah(totalRevenue)}**\n- **Jumlah Transaksi Lunas**: **${validOrders.length} transaksi**\n- Rata-rata per Transaksi: **${validOrders.length > 0 ? formatRupiah(Math.round(totalRevenue / validOrders.length)) : 'Rp 0'}**`;
        customFollowUps = [
          'Menu apa yang paling laku hari ini?',
          'Berapa sisa stok bahan baku?',
        ];
      }
      // 3. Intent Stok / Bahan Baku
      else if (q.includes('stok') || q.includes('bahan') || q.includes('habis') || q.includes('menipis') || q.includes('restock')) {
        if (lowStock.length > 0) {
          narrative = `⚠️ **Peringatan Stok Bahan Baku Menipis (${lowStock.length} bahan):**\n\n`;
          lowStock.forEach((i) => {
            narrative += `- **${i.name}**: Tersisa **${i.currentStock || i.stock} ${i.unit}** (Batas min: ${i.minStock || 0} ${i.unit})\n`;
          });
          narrative += `\nDisarankan segera restock bahan baku tersebut agar tidak menghambat penjualan!`;
        } else {
          narrative = `✅ **Kondisi Bahan Baku**: Seluruh stok bahan baku operasional terpantau aman dan mencukupi.`;
        }
        customFollowUps = [
          'Menu apa yang paling laku hari ini?',
          'Berapa total omset dan transaksi hari ini?',
        ];
      }
      // 4. Intent Menu / Terlaris / Default
      else if (top1) {
        const share = totalRevenue > 0 ? Math.round((top1.revenue / totalRevenue) * 100) : 0;
        narrative = `Hari ini, menu yang paling laku adalah **${top1.name}** dengan penjualan sebanyak **${top1.qty} porsi/cup** dan total omset **${formatRupiah(top1.revenue)}** (berkontribusi **${share}%** dari total omset hari ini).\n\n`;

        if (sorted.length > 1) {
          narrative += '**Urutan Menu Terlaris Berikutnya:**\n';
          sorted.slice(1, 4).forEach((p, idx) => {
            narrative += `- **#${idx + 2} ${p.name}**: terjual ${p.qty} porsi (${formatRupiah(p.revenue)})\n`;
          });
          narrative += '\n';
        }

        if (lowStock.length > 0) {
          narrative += `⚠️ **Peringatan Stok Bahan**: Terdapat **${lowStock.length} bahan baku** dengan stok menipis (misal: ${lowStock[0].name}). Harap segera lakukan restock!`;
        } else {
          narrative += '✅ **Kondisi Bahan Baku**: Stok bahan baku operasional dalam batas aman.';
        }
      } else {
        narrative = 'Belum ada transaksi berstatus lunas tercatat untuk hari ini. Siapkan meja kasir dan bahan baku untuk memulai penjualan!';
      }

      const clientFallbackMsg = {
        id: `ai_local_${Date.now()}`,
        role: 'assistant',
        text: narrative,
        provider: 'LOCAL_FALLBACK',
        model: 'Komazi AI',
        latencyTier: 'Komazi AI (Offline Local)',
        metrics: {
          todayTotalOrders: validOrders.length,
          todayTotalRevenue: totalRevenue,
          topProducts: sorted.slice(0, 5),
        },
        followUps: [],
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, clientFallbackMsg],
        isLoading: false,
      }));
    } catch (e) {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            text: 'Terjadi kendala saat membaca data penjualan. Silakan coba kembali sesaat lagi.',
            provider: 'ERROR',
            model: 'Komazi AI',
            timestamp: new Date().toISOString(),
          },
        ],
        isLoading: false,
      }));
    }
  },

  /**
   * Fetch quick insight for widgets and banners
   */
  fetchQuickInsight: async () => {
    set({ isQuickInsightLoading: true });
    try {
      const res = await api.analytics.getQuickInsight();
      if (res && res.success && res.data) {
        set({ quickInsight: res.data, isQuickInsightLoading: false });
        return;
      }
    } catch {
      // Ignore and use client calculations
    }

    // Client fallback calculation
    try {
      const orders = useOrdersStore.getState().orders || [];
      const now = new Date();
      const todayOrders = orders.filter((o) => {
        if (o.status !== 'PAID' || !o.createdAt) return false;
        const d = new Date(o.createdAt);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      });
      const totalRev = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

      const productMap = {};
      todayOrders.forEach((o) => {
        (o.items || []).forEach((item) => {
          const name = item.name || item.productName || 'Produk';
          if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
          productMap[name].qty += Number(item.qty || 1);
          productMap[name].revenue += Number(item.lineTotal || (item.price * (item.qty || 1)));
        });
      });
      const top = Object.values(productMap).sort((a, b) => b.qty - a.qty)[0] || null;

      set({
        quickInsight: {
          hasSales: todayOrders.length > 0,
          todayRevenue: formatRupiah(totalRev),
          todayOrders: todayOrders.length,
          topProduct: top ? {
            name: top.name,
            qty: top.qty,
            revenue: formatRupiah(top.revenue),
            share: totalRev > 0 ? `${Math.round((top.revenue / totalRev) * 100)}%` : '0%',
          } : null,
          lowStockAlertCount: 0,
        },
        isQuickInsightLoading: false,
      });
    } catch {
      set({ isQuickInsightLoading: false });
    }
  },
}),
  {
    name: 'komazi-ai-chat-history',
    partialize: (state) => ({
      messages: state.messages,
    }),
  }
)
);
