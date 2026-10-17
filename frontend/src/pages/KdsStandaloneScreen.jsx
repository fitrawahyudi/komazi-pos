import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrdersStore } from '../store/ordersStore';
import { useKdsSocket } from '../hooks/useKdsSocket';
import { playKitchenChime } from '../utils/audio';
import {
  ChefHat,
  Coffee,
  Clock,
  CheckCircle2,
  Play,
  Check,
  AlertCircle,
  Bell,
  Utensils,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  ArrowLeft,
  Flame,
  Radio,
  LogOut,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Wifi,
  WifiOff,
  Search,
  X,
  SearchX,
  Filter,
} from 'lucide-react';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { formatOrderType, isDrinkItem } from '../utils/format';
import OrderTicket from '../components/kds/OrderTicket';

export default function KdsStandaloneScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    orders,
    createSampleKdsOrder,
    resetKdsOrders,
    fetchBackendOrders,
    bumpItem,
    bumpTicket,
    updateKitchenStatus,
    applySocketNewOrder,
    applySocketItemUpdated,
    applySocketOrderUpdated,
  } = useOrdersStore();

  const isBarista = user?.role === 'BARISTA';
  const isKitchen = user?.role === 'KITCHEN';
  const isStaffOnly = isBarista || isKitchen;
  const isOwner = user?.role === 'OWNER';
  const isCashier = user?.role === 'CASHIER';

  // Guard: Kasir dilarang mengakses layar operasional KDS dapur
  useEffect(() => {
    if (isCashier) {
      toast.error('Akses ditolak: Kasir tidak memiliki akses ke layar produksi KDS');
      navigate('/pos', { replace: true });
    }
  }, [isCashier, navigate]);

  const [stationFilter, setStationFilter] = useState(() => {
    if (isBarista) return 'BAR';
    if (isKitchen) return 'KITCHEN';
    return 'ALL';
  });

  const effectiveStation = isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : stationFilter;
  const socketStationCode = isBarista ? 'BAR_MAIN' : isKitchen ? 'KITCHEN_MAIN' : 'ALL';

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [clockString, setClockString] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'READY' | 'HOLD'

  // Digital clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.getTime());
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setClockString(`${hours}:${minutes}:${seconds} WIB`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Realtime Socket listener
  const { isConnected } = useKdsSocket({
    stationCode: socketStationCode,
    onOrderNew: (newOrder) => {
      if (isSoundEnabled) playKitchenChime();
      applySocketNewOrder(newOrder);
      toast.info(`🔔 Pesanan baru: ${newOrder.invoiceNo}`);
    },
    onOrderItemUpdated: (payload) => {
      applySocketItemUpdated(payload);
    },
    onOrderUpdated: (updatedOrder) => {
      applySocketOrderUpdated(updatedOrder);
    },
    onReconnect: () => {
      fetchBackendOrders();
    },
  });

  // Initial mount & sync
  useEffect(() => {
    fetchBackendOrders();
    const handleSync = () => {
      useOrdersStore.persist.rehydrate();
    };
    window.addEventListener('komazi:orders-updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('komazi:orders-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Filter pesanan aktif
  const activeOrders = orders.filter((o) => {
    const status = (o.status || '').toUpperCase();
    if (status !== 'PAID' && status !== 'HOLD' && status !== 'OPEN' && status !== 'IN_PROGRESS' && status !== 'PARTIALLY_READY' && status !== 'READY') {
      return false;
    }
    if (status === 'VOIDED' || status === 'REFUNDED' || status === 'SERVED') return false;

    const items = o.items || [];
    const hasDrinks = items.some((i) => i.station?.type === 'BAR' || isDrinkItem(i));
    const hasFood = items.some((i) => !(i.station?.type === 'BAR' || isDrinkItem(i)));

    const barStatus = o.barStatus || 'PENDING';
    const kitchenStatus = o.kitchenStatus || 'PENDING';

    const barActive = hasDrinks && barStatus !== 'SERVED';
    const kitchenActive = hasFood && kitchenStatus !== 'SERVED';

    if (isBarista || effectiveStation === 'BAR') {
      return barActive;
    }
    if (isKitchen || effectiveStation === 'KITCHEN') {
      return kitchenActive;
    }
    return barActive || kitchenActive;
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleBumpItem = async (itemId, station) => {
    const targetStation = station || (isBarista ? 'BAR' : 'KITCHEN');
    const res = await bumpItem(itemId, targetStation);
    if (res.success) {
      const itemName = res.item?.productName || res.item?.name || 'Item';
      const statusMap = {
        PENDING: 'Menunggu',
        PREPARING: 'Diproses',
        IN_PROGRESS: 'Diproses',
        READY: 'Siap Saji',
        SERVED: 'Disajikan',
        COMPLETED: 'Selesai',
      };
      const statusLabel = statusMap[res.item?.status] || res.item?.status || 'Diproses';
      toast.success(`Item diperbarui: ${itemName} (${statusLabel})`);
    } else {
      toast.error('Gagal memperbarui status item');
    }
  };

  const handleBumpTicket = async (orderId, station) => {
    const targetStation = station || (isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : null);
    const res = await bumpTicket(orderId, targetStation);
    if (res.success) {
      if (isSoundEnabled) playKitchenChime();
      toast.success(`Tiket ${res.order?.invoiceNo || ''} berhasil di-BUMP!`);
    } else {
      // Fallback
      const currentOrder = orders.find((o) => o.id === orderId);
      if (currentOrder) {
        const curStatus = targetStation === 'BAR' ? (currentOrder.barStatus || 'PENDING') : (currentOrder.kitchenStatus || 'PENDING');
        const next = curStatus === 'PENDING' ? 'IN_PROGRESS' : curStatus === 'IN_PROGRESS' ? 'READY' : 'SERVED';
        updateKitchenStatus(orderId, next, targetStation);
      }
    }
  };

  // Status counts
  const pendingCount = activeOrders.filter((o) => {
    const barPending = (o.barStatus || 'PENDING') === 'PENDING';
    const kitchenPending = (o.kitchenStatus || 'PENDING') === 'PENDING';
    if (effectiveStation === 'BAR' || isBarista) return barPending;
    if (effectiveStation === 'KITCHEN' || isKitchen) return kitchenPending;
    return barPending || kitchenPending;
  }).length;

  const inProgressCount = activeOrders.filter((o) => {
    const barProg = (o.barStatus || 'PENDING') === 'IN_PROGRESS';
    const kitchenProg = (o.kitchenStatus || 'PENDING') === 'IN_PROGRESS';
    if (effectiveStation === 'BAR' || isBarista) return barProg;
    if (effectiveStation === 'KITCHEN' || isKitchen) return kitchenProg;
    return barProg || kitchenProg;
  }).length;

  const readyCount = activeOrders.filter((o) => {
    const barReady = (o.barStatus || 'PENDING') === 'READY';
    const kitchenReady = (o.kitchenStatus || 'PENDING') === 'READY';
    if (effectiveStation === 'BAR' || isBarista) return barReady;
    if (effectiveStation === 'KITCHEN' || isKitchen) return kitchenReady;
    return barReady || kitchenReady;
  }).length;

  const holdCount = activeOrders.filter((o) => ['HOLD', 'OPEN'].includes((o.status || '').toUpperCase())).length;

  // Filter pesanan sesuai search & quick status filter
  const displayedOrders = activeOrders.filter((o) => {
    // 1. Status Filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'HOLD') {
        if (!['HOLD', 'OPEN'].includes((o.status || '').toUpperCase())) return false;
      } else {
        const curStatus =
          isBarista || effectiveStation === 'BAR'
            ? o.barStatus || 'PENDING'
            : o.kitchenStatus || 'PENDING';
        if (curStatus !== statusFilter) return false;
      }
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchInv = (o.invoiceNo || '').toLowerCase().includes(q);
      const matchCust = (o.customerName || '').toLowerCase().includes(q);
      const matchTable = (o.tableNumber || '').toLowerCase().includes(q);
      const matchNotes = (o.notes || '').toLowerCase().includes(q);
      const matchItems = (o.items || []).some(
        (i) =>
          (i.productName || '').toLowerCase().includes(q) ||
          (i.variantName || '').toLowerCase().includes(q) ||
          (i.notes || '').toLowerCase().includes(q)
      );
      if (!matchInv && !matchCust && !matchTable && !matchNotes && !matchItems) {
        return false;
      }
    }

    return true;
  });

  const hasScreenFilters = statusFilter !== 'ALL' || Boolean(searchQuery.trim());
  const hasActiveScreenFilters = hasScreenFilters;

  return (
    <div className="fixed inset-0 z-50 bg-[#080808] text-komazi-text flex flex-col overflow-hidden select-none font-sans">
      {/* 1. TOP BAR */}
      <header className="h-16 px-4 sm:px-6 bg-[#111111] border-b border-komazi-border flex items-center justify-between shrink-0 shadow-lg">
        {/* Left: Branding & Station Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/20 border border-komazi-coral/40 flex items-center justify-center text-komazi-coral shadow-inner">
              {isBarista ? (
                <Coffee className="w-5 h-5 text-komazi-teal-light" />
              ) : isKitchen ? (
                <Utensils className="w-5 h-5 text-amber-400" />
              ) : (
                <ChefHat className="w-5 h-5 text-komazi-coral" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-base text-white tracking-wider">
                  {isBarista ? 'KOMAZI' : isKitchen ? 'KOMAZI' : 'KOMAZI KDS & BDS'}
                </span>

                {/* Socket Realtime Badge */}
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-colors ${
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : 'bg-red-500/15 text-red-400 border-red-500/40 animate-pulse'
                  }`}
                  title={isConnected ? 'Realtime Connected' : 'Reconnecting to Server'}
                >
                  {isConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>
              </div>
              <p className="text-[10px] text-komazi-muted font-bold tracking-wider uppercase">
                {isBarista ? 'Barista Display' : isKitchen ? 'Kitchen Display' : 'Dapur & Bar Monitor'}
              </p>
            </div>
          </div>

          {/* Station Switcher (Manager/Owner only) */}
          {!isStaffOnly && (
            <div className="hidden lg:flex items-center bg-[#181818] p-1 rounded-xl border border-komazi-border ml-2">
              {[
                { key: 'ALL', label: 'Semua Station', icon: Flame },
                { key: 'KITCHEN', label: 'Dapur (KDS)', icon: Utensils },
                { key: 'BAR', label: 'Bar (BDS)', icon: Coffee },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStationFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    stationFilter === key
                      ? 'bg-komazi-coral text-white shadow-md'
                      : 'text-komazi-muted hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: Live Clock & Orders Count */}
        <div className="hidden md:flex items-center gap-4">
          <div className="px-3.5 py-1.5 rounded-xl bg-[#181818] border border-komazi-border font-mono font-black text-sm text-amber-400 tracking-widest shadow-inner">
            {clockString}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-neutral-300">
              {activeOrders.length} Pesanan Aktif
            </span>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`p-2 rounded-xl border transition-colors ${
              isSoundEnabled
                ? 'bg-[#1A1A1A] text-emerald-400 border-emerald-500/30'
                : 'bg-[#1A1A1A] text-neutral-500 border-komazi-border'
            }`}
            title={isSoundEnabled ? 'Suara Lonceng Aktif' : 'Suara Lonceng Dimatikan'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex p-2 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] text-neutral-300 hover:text-white border border-komazi-border transition-colors"
            title="Toggle Layar Penuh (Fullscreen TV)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {!isStaffOnly ? (
            <button
              type="button"
              onClick={() => navigate('/kds')}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] text-neutral-300 hover:text-white border border-komazi-border text-xs font-bold transition-colors"
              title="Buka KDS dengan Navigasi Sidebar"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kembali</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40 text-xs font-bold transition-colors"
              title="Keluar dari akun KDS"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. STATS BAR & QUICK FILTER */}
      <div className="h-12 px-4 sm:px-6 bg-[#0E0E0E] border-b border-komazi-border flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar">
          {/* Antrian Filter Button */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-neutral-800 text-white border border-neutral-600 shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Filter pesanan Menunggu / Pending"
          >
            <span className="w-2 h-2 rounded-full bg-neutral-500" />
            <span>Antrian:</span>
            <span className="font-mono font-black text-white">{pendingCount}</span>
          </button>

          <div className="w-px h-4 bg-komazi-border hidden sm:block" />

          {/* Diproses Filter Button */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                : 'text-amber-400 hover:text-amber-300'
            }`}
            title="Filter pesanan Sedang Diproses"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Diproses:</span>
            <span className="font-mono font-black text-amber-400">{inProgressCount}</span>
          </button>

          <div className="w-px h-4 bg-komazi-border hidden sm:block" />

          {/* Siap Saji Filter Button */}
          <button
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === 'READY' ? 'ALL' : 'READY'))}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'READY'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
            title="Filter pesanan Siap Saji"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Siap Saji:</span>
            <span className="font-mono font-black text-emerald-400">{readyCount}</span>
          </button>

          {holdCount > 0 && (
            <>
              <div className="w-px h-4 bg-komazi-border hidden sm:block" />
              <button
                type="button"
                onClick={() => setStatusFilter((prev) => (prev === 'HOLD' ? 'ALL' : 'HOLD'))}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'HOLD'
                    ? 'bg-blue-500/25 text-blue-300 border border-blue-500/50 shadow-sm'
                    : 'text-blue-400 hover:text-blue-300'
                }`}
                title="Filter pesanan Hold Bill"
              >
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Hold:</span>
                <span className="font-mono font-black text-blue-400">{holdCount}</span>
              </button>
            </>
          )}

          {hasScreenFilters && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="text-[10px] text-komazi-coral hover:underline font-bold ml-1 px-1.5 py-0.5 rounded bg-komazi-coral/10 border border-komazi-coral/30"
            >
              Reset
            </button>
          )}
        </div>

        {/* Right Search Input & Refresh Button */}
        <div className="flex items-center gap-2">
          {/* Quick Search Field */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari meja/invoice..."
              className="w-32 sm:w-44 bg-[#181818] border border-komazi-border text-[11px] rounded-lg pl-8 pr-7 py-1 text-white placeholder:text-neutral-500 focus:outline-none focus:border-komazi-coral transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-neutral-400 hover:text-white"
                title="Hapus pencarian"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              fetchBackendOrders();
              toast.info('Menyinkronkan data antrean...');
            }}
            className="text-[11px] text-komazi-muted hover:text-white font-bold flex items-center gap-1 transition-colors shrink-0"
            title="Sinkronkan antrean"
          >
            <RotateCcw className="w-3 h-3 text-komazi-coral" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 3. TICKET BOARD (GRID) */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {displayedOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-20 h-20 rounded-3xl bg-[#141414] border border-komazi-border flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
              {hasScreenFilters ? (
                <SearchX className="w-10 h-10 text-komazi-coral opacity-80" />
              ) : (
                <CheckCircle2 className="w-10 h-10 opacity-80" />
              )}
            </div>
            <h2 className="text-xl font-black text-white">
              {hasScreenFilters ? 'Tidak Ada Tiket yang Cocok' : 'Semua Pesanan Selesai!'}
            </h2>
            <p className="text-xs text-komazi-muted max-w-sm mt-1">
              {hasScreenFilters
                ? 'Tidak ditemukan tiket aktif dengan kata kunci atau filter status tersebut.'
                : 'Tidak ada antrian pesanan yang perlu disiapkan saat ini. Pesanan baru dari POS akan langsung tampil secara realtime.'}
            </p>
            {hasScreenFilters && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs transition-colors shadow-md"
              >
                Reset Filter & Pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-start">
            {displayedOrders.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                station={effectiveStation}
                currentTime={currentTime}
                onBumpItem={handleBumpItem}
                onBumpTicket={handleBumpTicket}
                tvMode={true}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
