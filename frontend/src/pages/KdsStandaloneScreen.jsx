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
} from 'lucide-react';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { formatOrderType, isDrinkItem } from '../utils/format';

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
  }, [fetchBackendOrders]);

  // Filter pesanan aktif
  const activeOrders = orders.filter((o) => {
    const status = (o.status || '').toUpperCase();
    if (status !== 'PAID' && status !== 'HOLD' && status !== 'OPEN' && status !== 'IN_PROGRESS' && status !== 'PARTIALLY_READY' && status !== 'READY') {
      return false;
    }
    if (status === 'VOIDED' || status === 'REFUNDED' || status === 'SERVED') return false;

    const items = o.items || [];
    const hasDrinks = items.some((i) => (i.station?.type ? i.station.type === 'BAR' : isDrinkItem(i)));
    const hasFood = items.some((i) => (i.station?.type ? i.station.type === 'KITCHEN' : !isDrinkItem(i)));

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
      toast.success(`Item diperbarui: ${res.item?.productName || ''} (${res.item?.status})`);
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
            className="p-2 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] text-neutral-300 hover:text-white border border-komazi-border transition-colors"
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

      {/* 2. STATS BAR */}
      <div className="h-12 px-4 sm:px-6 bg-[#0E0E0E] border-b border-komazi-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-500" />
            <span className="text-xs font-bold text-neutral-400">Antrian:</span>
            <span className="font-mono font-black text-sm text-white">{pendingCount}</span>
          </div>
          <div className="w-px h-4 bg-komazi-border" />
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-xs font-bold text-amber-400">Diproses:</span>
            <span className="font-mono font-black text-sm text-amber-400">{inProgressCount}</span>
          </div>
          <div className="w-px h-4 bg-komazi-border" />
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Siap Saji:</span>
            <span className="font-mono font-black text-sm text-emerald-400">{readyCount}</span>
          </div>
          {holdCount > 0 && (
            <>
              <div className="w-px h-4 bg-komazi-border" />
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-xs font-bold text-blue-400">Hold Bill:</span>
                <span className="font-mono font-black text-sm text-blue-400">{holdCount}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchBackendOrders();
              toast.info('Menyinkronkan data antrean...');
            }}
            className="text-[11px] text-komazi-muted hover:text-white font-bold flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3 text-komazi-coral" />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>
      </div>

      {/* 3. TICKET BOARD (GRID) */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {activeOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-20 h-20 rounded-3xl bg-[#141414] border border-komazi-border flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
              <CheckCircle2 className="w-10 h-10 opacity-80" />
            </div>
            <h2 className="text-xl font-black text-white">Semua Pesanan Selesai!</h2>
            <p className="text-xs text-komazi-muted max-w-sm mt-1">
              Tidak ada antrian pesanan yang perlu disiapkan saat ini. Pesanan baru dari POS akan langsung tampil secara realtime.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {activeOrders.map((order) => {
              const isBar = effectiveStation === 'BAR';
              const status = isBar ? (order.barStatus || 'PENDING') : (order.kitchenStatus || 'PENDING');
              const isOrderHold = ['HOLD', 'OPEN'].includes((order.status || '').toUpperCase());

              const targetMinutes = isBar ? 5 : 10;
              const elapsedSec = Math.max(0, Math.floor((currentTime - new Date(order.createdAt).getTime()) / 1000));
              const elapsedMin = Math.floor(elapsedSec / 60);
              const elapsedSecRemaining = elapsedSec % 60;
              const formattedTime = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSecRemaining).padStart(2, '0')}`;

              const isDelayed = elapsedMin >= targetMinutes;
              const isMedium = elapsedMin >= Math.floor(targetMinutes / 2) && !isDelayed;

              const displayedItems = (order.items || []).filter((item) => {
                if (effectiveStation === 'ALL') return true;
                if (item.station?.type) return item.station.type === effectiveStation;
                const drink = isDrinkItem(item);
                if (effectiveStation === 'BAR') return drink;
                if (effectiveStation === 'KITCHEN') return !drink;
                return true;
              });

              if (displayedItems.length === 0) return null;

              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border flex flex-col justify-between overflow-hidden shadow-2xl transition-all ${
                    isDelayed
                      ? 'bg-[#221010] border-red-500 shadow-red-500/25'
                      : status === 'READY'
                      ? 'bg-[#121E17] border-emerald-500 shadow-emerald-500/15'
                      : status === 'IN_PROGRESS'
                      ? 'bg-[#1E1715] border-amber-500 shadow-amber-500/15'
                      : isOrderHold
                      ? 'bg-[#131722] border-blue-500/70'
                      : 'bg-[#131313] border-komazi-border'
                  }`}
                >
                  {/* Card Header */}
                  <div
                    className={`p-3.5 border-b flex items-start justify-between gap-2 ${
                      isDelayed
                        ? 'bg-red-500/20 border-red-500/30'
                        : status === 'READY'
                        ? 'bg-emerald-500/20 border-emerald-500/30'
                        : status === 'IN_PROGRESS'
                        ? 'bg-amber-500/20 border-amber-500/30'
                        : isOrderHold
                        ? 'bg-blue-500/20 border-blue-500/30'
                        : 'bg-[#1A1A1A] border-komazi-border'
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display font-black text-lg text-white">
                          {order.tableNo ? `MEJA ${order.tableNo}` : order.type === 'TAKE_AWAY' ? 'TAKE AWAY' : 'DINE IN'}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-komazi-muted">
                          {order.invoiceNo}
                        </span>
                        {isOrderHold && (
                          <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300">
                            ⏸ HOLD
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-neutral-300 mt-0.5 truncate max-w-[180px]">
                        {order.customerName || order.label || 'Tamu'}
                      </p>
                    </div>

                    {/* Timer Pill & Delay Tag */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono font-bold text-xs shadow-md ${
                          isDelayed
                            ? 'bg-red-500 text-white animate-pulse shadow-red-500/30'
                            : isMedium
                            ? 'bg-amber-500 text-black'
                            : 'bg-[#252525] text-neutral-300 border border-white/10'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formattedTime}</span>
                      </div>
                      {isDelayed && (
                        <span className="text-[8px] font-black uppercase tracking-wider text-red-400 bg-red-950/80 px-1 py-0.5 rounded border border-red-800 animate-pulse">
                          ⚠ DELAYED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items List Body (Item-Level Status & Bump) */}
                  <div className="p-3.5 space-y-2 flex-1 overflow-y-auto max-h-[360px]">
                    {displayedItems.map((item, idx) => {
                      const itemStatus = (item.status || 'PENDING').toUpperCase();
                      const isItemDone = itemStatus === 'SERVED';
                      const isItemReady = itemStatus === 'READY';
                      const isItemPrep = itemStatus === 'PREPARING';

                      return (
                        <div
                          key={item.id || idx}
                          className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                            isItemDone
                              ? 'bg-black/30 border-white/5 opacity-40 line-through'
                              : isItemReady
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : isItemPrep
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : 'bg-[#1A1A1A] border-komazi-border'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-komazi-surface border border-komazi-border flex items-center justify-center font-mono font-bold text-xs text-komazi-coral shrink-0">
                                {item.qty}x
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-xs text-white leading-tight">
                                  {item.productName || item.name}
                                </p>
                                {item.variantName && (
                                  <p className="text-[10px] text-komazi-coral font-semibold mt-0.5">
                                    Varian: {item.variantName}
                                  </p>
                                )}
                                {item.modifiers && (
                                  <p className="text-[10px] text-komazi-teal-light font-medium mt-0.5">
                                    + {item.modifiers}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Item BUMP button */}
                            {!isItemDone ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.id) handleBumpItem(item.id, effectiveStation);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 ${
                                  isItemReady
                                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                                    : isItemPrep
                                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                                    : 'bg-[#222222] text-neutral-400 hover:text-white border border-neutral-700'
                                }`}
                              >
                                <span>{itemStatus}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-neutral-500 px-1 py-0.5">
                                SERVED
                              </span>
                            )}
                          </div>

                          {item.note && (
                            <div className="mt-1 p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Catatan: {item.note}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Footer (Ticket-Level BUMP) */}
                  <div className="p-3 border-t border-komazi-border bg-[#111111]">
                    <button
                      type="button"
                      onClick={() => handleBumpTicket(order.id, effectiveStation)}
                      className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${
                        status === 'READY'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                          : status === 'IN_PROGRESS'
                          ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                          : 'bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-komazi-coral/20'
                      }`}
                    >
                      {status === 'READY' ? (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Selesai Saji (Complete)</span>
                        </>
                      ) : status === 'IN_PROGRESS' ? (
                        <>
                          <Bell className="w-4 h-4 stroke-[2.5]" />
                          <span>Siap Saji (Ready)</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Mulai Proses (Start)</span>
                        </>
                      )}
                    </button>

                    {isOrderHold && (
                      <p className="text-[10px] text-blue-400/80 text-center font-medium mt-1.5">
                        ⏸ Hold Bill — belum bayar kasir
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
