import React, { useState, useEffect, useCallback } from 'react';
import { useOrdersStore } from '../store/ordersStore';
import { useAuthStore } from '../store/authStore';
import { useKdsSocket } from '../hooks/useKdsSocket';
import { playKitchenChime } from '../utils/audio';
import { formatDateTime, formatOrderType, isDrinkItem } from '../utils/format';
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
  Tv,
  ExternalLink,
  Layers,
  Pause,
  RotateCcw,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from '../store/toastStore';
import Pagination from '../components/ui/Pagination';

// ─── Single Order Ticket ──────────────────────────────────────────────────────
function OrderTicket({
  order,
  station,
  currentTime,
  onBumpItem,
  onBumpTicket,
  onRequeueStatus,
}) {
  const isBar = station === 'BAR';
  const status = isBar
    ? (order.barStatus || order.kitchenStatus || 'PENDING')
    : (order.kitchenStatus || 'PENDING');
  const isHold = ['HOLD', 'OPEN'].includes((order.status || '').toUpperCase());

  // Elapsed timer berbasis server timestamp (tahan refresh)
  const createdTimestamp = new Date(order.createdAt).getTime();
  const elapsedSeconds = Math.max(0, Math.floor((currentTime - createdTimestamp) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingSeconds = elapsedSeconds % 60;
  const timeFormatted = `${String(elapsedMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;

  // Target waktu delay: 5 menit untuk Bar, 10 menit untuk Dapur (Section 22)
  const targetMinutes = isBar ? 5 : 10;
  const isDelayed = elapsedMinutes >= targetMinutes && status !== 'SERVED';
  const isWarning = elapsedMinutes >= Math.floor(targetMinutes / 2) && !isDelayed && status !== 'SERVED';

  // Filter items sesuai station
  const displayedItems = (order.items || []).filter((item) => {
    if (station === 'ALL') return true;
    if (item.station?.type) {
      return item.station.type === station;
    }
    const drink = isDrinkItem(item);
    if (station === 'BAR') return drink;
    if (station === 'KITCHEN') return !drink;
    return true;
  });

  if (displayedItems.length === 0) return null;

  const borderColor =
    status === 'SERVED'
      ? 'border-neutral-800 opacity-70'
      : isDelayed
      ? 'border-red-500 shadow-red-500/10'
      : status === 'READY'
      ? 'border-emerald-500/80 shadow-emerald-500/10'
      : status === 'IN_PROGRESS'
      ? 'border-amber-500/80 shadow-amber-500/10'
      : isHold
      ? 'border-blue-500/60'
      : 'border-komazi-border';

  const headerBg =
    status === 'SERVED'
      ? 'bg-neutral-900/60 border-neutral-800'
      : isDelayed
      ? 'bg-red-500/15 border-red-500/30'
      : status === 'READY'
      ? 'bg-emerald-500/15 border-emerald-500/30'
      : status === 'IN_PROGRESS'
      ? 'bg-amber-500/15 border-amber-500/30'
      : isHold
      ? 'bg-blue-500/10 border-blue-500/25'
      : 'bg-komazi-surface-2 border-komazi-border';

  return (
    <div
      className={`rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xl transition-all bg-komazi-surface ${borderColor}`}
    >
      {/* Header */}
      <div className={`p-3.5 border-b flex items-start justify-between gap-2 ${headerBg}`}>
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono font-black text-sm text-komazi-text">
              {order.invoiceNo}
            </span>
            {isHold && (
              <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center gap-1">
                <Pause className="w-2.5 h-2.5" />
                HOLD
              </span>
            )}
            {status === 'SERVED' && (
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                SELESAI
              </span>
            )}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-komazi-surface border border-komazi-border text-komazi-muted">
              {formatOrderType(order.type || order.orderType)}
            </span>
          </div>

          <p className="text-xs font-bold text-komazi-text mt-1">
            {order.customerName || (order.label ? order.label : 'Pelanggan')}
            {order.tableNo ? ` • Meja ${order.tableNo}` : ''}
          </p>
        </div>

        {/* Timer & Delay Warning Badge (Section 21 & 22) */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
              status === 'SERVED'
                ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                : isDelayed
                ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/20'
                : isWarning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-komazi-surface text-komazi-muted border border-komazi-border'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{timeFormatted}</span>
          </div>

          {isDelayed && (
            <span className="text-[9px] font-black uppercase tracking-wider text-red-400 bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800 animate-pulse">
              ⚠ DELAYED ({targetMinutes}m)
            </span>
          )}
        </div>
      </div>

      {/* Items List (Item-Level BUMP Support - Section 15) */}
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
                  ? 'bg-neutral-900/40 border-neutral-800 opacity-40 line-through'
                  : isItemReady
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : isItemPrep
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-komazi-surface-2 border-komazi-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-md bg-komazi-surface border border-komazi-border flex items-center justify-center font-mono font-black text-xs text-komazi-coral shrink-0">
                    {item.qty}x
                  </span>
                  <div>
                    <p className="font-bold text-xs text-komazi-text">
                      {item.productName || item.name}
                    </p>
                    {item.variantName && (
                      <p className="text-[10px] text-komazi-coral font-semibold">
                        Varian: {item.variantName}
                      </p>
                    )}
                    {item.modifiers && (
                      <p className="text-[10px] text-komazi-teal-light">+ {item.modifiers}</p>
                    )}
                  </div>
                </div>

                {/* Item-level BUMP Button */}
                {!isItemDone && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.id) onBumpItem(item.id, station);
                    }}
                    title={`Bump status ${item.productName || item.name}`}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 ${
                      isItemReady
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                        : isItemPrep
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                        : 'bg-komazi-surface text-komazi-muted hover:text-white border border-komazi-border'
                    }`}
                  >
                    <span>{itemStatus}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                {isItemDone && (
                  <span className="text-[10px] font-bold text-neutral-500 px-1.5 py-0.5 rounded">
                    SERVED
                  </span>
                )}
              </div>

              {item.note && (
                <div className="mt-1 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>Catatan: {item.note}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer (Ticket-Level BUMP - Section 15 & 16) */}
      <div className="p-3 border-t border-komazi-border bg-komazi-surface-2/70 space-y-1.5">
        {status !== 'SERVED' ? (
          <button
            type="button"
            onClick={() => onBumpTicket(order.id, station)}
            className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
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
                BUMP TIKET (Selesai Saji)
              </>
            ) : status === 'IN_PROGRESS' ? (
              <>
                <Bell className="w-3.5 h-3.5" />
                BUMP TIKET (Siap Saji)
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                BUMP TIKET (Mulai Proses)
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onRequeueStatus(order.id, station)}
            className="w-full py-2 rounded-xl bg-komazi-surface hover:bg-komazi-surface-2 text-komazi-muted hover:text-komazi-text border border-komazi-border font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Kembalikan ke Antrean
          </button>
        )}

        {isHold && status !== 'SERVED' && (
          <p className="text-[10px] text-blue-400/80 text-center font-medium">
            ⏸ Hold Bill — belum bayar kasir, dapat disiapkan terlebih dahulu
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Station Panel ────────────────────────────────────────────────────────────
function StationPanel({
  title,
  icon: Icon,
  accentColor,
  orders,
  station,
  currentTime,
  onBumpItem,
  onBumpTicket,
  onRequeueStatus,
}) {
  const stationOrders = orders.filter((order) => {
    const items = order.items || [];
    if (station === 'BAR') {
      return items.some((i) => (i.station?.type ? i.station.type === 'BAR' : isDrinkItem(i)));
    }
    if (station === 'KITCHEN') {
      return items.some((i) => (i.station?.type ? i.station.type === 'KITCHEN' : !isDrinkItem(i)));
    }
    return true;
  });

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Panel Header */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border mb-4 ${accentColor.header}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accentColor.icon}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className={`font-black text-sm tracking-wide ${accentColor.title}`}>{title}</h2>
            <p className="text-[10px] text-komazi-muted uppercase font-bold tracking-wider">
              {stationOrders.length} Pesanan
            </p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-black border ${accentColor.badge}`}>
          {stationOrders.filter((o) => {
            const st = station === 'BAR' ? (o.barStatus || 'PENDING') : (o.kitchenStatus || 'PENDING');
            return st === 'PENDING';
          }).length} ANTRIAN
        </div>
      </div>

      {/* Orders Grid */}
      {stationOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 rounded-2xl border border-dashed border-komazi-border bg-komazi-surface/30 space-y-3">
          <CheckCircle2 className={`w-12 h-12 opacity-40 ${accentColor.title}`} />
          <div>
            <p className="font-bold text-sm text-komazi-text">Tidak Ada Antrian</p>
            <p className="text-xs text-komazi-muted mt-1">
              Pesanan baru akan muncul otomatis di sini
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 content-start overflow-y-auto">
          {stationOrders.map((order) => (
            <OrderTicket
              key={order.id}
              order={order}
              station={station}
              currentTime={currentTime}
              onBumpItem={onBumpItem}
              onBumpTicket={onBumpTicket}
              onRequeueStatus={onRequeueStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main KDS Page ────────────────────────────────────────────────────────────
export default function KdsPage() {
  const { user } = useAuthStore();
  const {
    orders,
    createSampleKdsOrder,
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

  const [viewMode, setViewMode] = useState(() => {
    if (isBarista) return 'BAR';
    if (isKitchen) return 'KITCHEN';
    return 'SPLIT';
  });

  const [statusTab, setStatusTab] = useState('ACTIVE');
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Pagination for Served / Historical Orders
  const [servedPage, setServedPage] = useState(1);
  const [servedPerPage, setServedPerPage] = useState(10);

  useEffect(() => {
    setServedPage(1);
  }, [statusTab, viewMode]);

  const effectiveViewMode = isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : viewMode;
  const socketStationCode = isBarista ? 'BAR_MAIN' : isKitchen ? 'KITCHEN_MAIN' : 'ALL';

  // Realtime Socket listener
  const { isConnected } = useKdsSocket({
    stationCode: socketStationCode,
    onOrderNew: (newOrder) => {
      playKitchenChime();
      applySocketNewOrder(newOrder);
      toast.info(`🔔 Pesanan baru masuk: ${newOrder.invoiceNo}`);
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

  // Clock interval untuk elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sinkronisasi awal & event bus local
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

  // Handler BUMP Item (Section 15)
  const handleBumpItem = async (itemId, station) => {
    const targetStation = station || (isBarista ? 'BAR' : 'KITCHEN');
    const res = await bumpItem(itemId, targetStation);
    if (res.success) {
      toast.success(`Item diperbarui: ${res.item?.productName || ''} (${res.item?.status})`);
    } else {
      toast.error('Gagal memperbarui status item');
    }
  };

  // Handler BUMP Tiket (Section 15 & 16)
  const handleBumpTicket = async (orderId, station) => {
    const targetStation = station || (isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : null);
    const res = await bumpTicket(orderId, targetStation);
    if (res.success) {
      toast.success(`Tiket pesanan ${res.order?.invoiceNo || ''} berhasil di-BUMP!`);
    } else {
      // Fallback update kitchen status lokal
      const currentOrder = orders.find((o) => o.id === orderId);
      if (currentOrder) {
        const curStatus = targetStation === 'BAR'
          ? (currentOrder.barStatus || 'PENDING')
          : (currentOrder.kitchenStatus || 'PENDING');
        const next = curStatus === 'PENDING' ? 'IN_PROGRESS' : curStatus === 'IN_PROGRESS' ? 'READY' : 'SERVED';
        updateKitchenStatus(orderId, next, targetStation);
      }
    }
  };

  const handleRequeueStatus = (orderId, station) => {
    const targetStation = station || (isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : 'ALL');
    updateKitchenStatus(orderId, 'PENDING', targetStation);
    toast.info('Pesanan dikembalikan ke antrean aktif.');
  };

  const handleCreateTestOrder = () => {
    const newOrd = createSampleKdsOrder();
    setStatusTab('ACTIVE');
    toast.success(`Pesanan tes ${newOrd.invoiceNo} (Kopi + Croissant) berhasil dibuat!`);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    useOrdersStore.persist.rehydrate();
    const res = await fetchBackendOrders();
    setIsSyncing(false);
    if (res?.count > 0) {
      toast.success(`${res.count} pesanan tersinkronisasi dari server!`);
    } else {
      toast.info('Antrean KDS sudah tersinkronisasi terbaru.');
    }
  };

  // Filter orders sesuai role, station, dan statusTab
  const displayedOrders = orders.filter((o) => {
    const status = (o.status || '').toUpperCase();
    if (status !== 'PAID' && status !== 'HOLD' && status !== 'OPEN' && status !== 'IN_PROGRESS' && status !== 'PARTIALLY_READY' && status !== 'READY' && status !== 'SERVED') {
      return false;
    }
    if (status === 'VOIDED' || status === 'REFUNDED') return false;

    const items = o.items || [];
    const hasDrinks = items.some((i) => (i.station?.type ? i.station.type === 'BAR' : isDrinkItem(i)));
    const hasFood = items.some((i) => (i.station?.type ? i.station.type === 'KITCHEN' : !isDrinkItem(i)));

    const barStatus = o.barStatus || 'PENDING';
    const kitchenStatus = o.kitchenStatus || 'PENDING';

    const barActive = hasDrinks && barStatus !== 'SERVED';
    const kitchenActive = hasFood && kitchenStatus !== 'SERVED';
    const barServed = hasDrinks && barStatus === 'SERVED';
    const kitchenServed = hasFood && kitchenStatus === 'SERVED';

    if (statusTab === 'SERVED') {
      if (isBarista || effectiveViewMode === 'BAR') return barServed;
      if (isKitchen || effectiveViewMode === 'KITCHEN') return kitchenServed;
      return barServed || kitchenServed;
    }

    if (isBarista || effectiveViewMode === 'BAR') return barActive;
    if (isKitchen || effectiveViewMode === 'KITCHEN') return kitchenActive;
    return barActive || kitchenActive;
  });

  const paginatedOrders = React.useMemo(() => {
    if (statusTab !== 'SERVED') return displayedOrders;
    const start = (servedPage - 1) * servedPerPage;
    return displayedOrders.slice(start, start + servedPerPage);
  }, [displayedOrders, statusTab, servedPage, servedPerPage]);

  const activeOrdersAll = orders.filter((o) => {
    const s = (o.status || '').toUpperCase();
    if (s === 'VOIDED' || s === 'REFUNDED') return false;
    const items = o.items || [];
    const barActive = items.some((i) => (i.station?.type ? i.station.type === 'BAR' : isDrinkItem(i))) && (o.barStatus || 'PENDING') !== 'SERVED';
    const kitchenActive = items.some((i) => (i.station?.type ? i.station.type === 'KITCHEN' : !isDrinkItem(i))) && (o.kitchenStatus || 'PENDING') !== 'SERVED';
    return barActive || kitchenActive;
  });

  const pendingCount = activeOrdersAll.filter((o) => {
    const barP = (o.barStatus || 'PENDING') === 'PENDING';
    const kitchP = (o.kitchenStatus || 'PENDING') === 'PENDING';
    if (isBarista || effectiveViewMode === 'BAR') return barP;
    if (isKitchen || effectiveViewMode === 'KITCHEN') return kitchP;
    return barP || kitchP;
  }).length;

  const inProgressCount = activeOrdersAll.filter((o) => {
    const barP = (o.barStatus || 'PENDING') === 'IN_PROGRESS';
    const kitchP = (o.kitchenStatus || 'PENDING') === 'IN_PROGRESS';
    if (isBarista || effectiveViewMode === 'BAR') return barP;
    if (isKitchen || effectiveViewMode === 'KITCHEN') return kitchP;
    return barP || kitchP;
  }).length;

  const readyCount = activeOrdersAll.filter((o) => {
    const barR = (o.barStatus || 'PENDING') === 'READY';
    const kitchR = (o.kitchenStatus || 'PENDING') === 'READY';
    if (isBarista || effectiveViewMode === 'BAR') return barR;
    if (isKitchen || effectiveViewMode === 'KITCHEN') return kitchR;
    return barR || kitchR;
  }).length;

  const holdCount = activeOrdersAll.filter((o) => ['HOLD', 'OPEN'].includes((o.status || '').toUpperCase())).length;

  const viewButtons = [
    { key: 'SPLIT', label: 'Split View', icon: Layers },
    { key: 'BAR', label: 'Barista / Bar', icon: Coffee },
    { key: 'KITCHEN', label: 'Dapur', icon: Utensils },
    { key: 'ALL', label: 'Semua', icon: ChefHat },
  ];

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-5 max-w-[1600px] mx-auto select-none">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
              {isBarista ? (
                <>
                  <Coffee className="w-6 h-6 text-komazi-teal-light" />
                  <span>Bar Display System (BDS)</span>
                </>
              ) : isKitchen ? (
                <>
                  <Utensils className="w-6 h-6 text-amber-400" />
                  <span>Kitchen Display System (KDS)</span>
                </>
              ) : (
                <>
                  <ChefHat className="w-6 h-6 text-komazi-coral" />
                  <span>Kitchen & Bar Display System (KDS)</span>
                </>
              )}
            </h1>

            {/* Socket Status Indicator (Section 11 & 28) */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
              }`}
              title={isConnected ? 'Socket.IO Realtime Terhubung' : 'Terputus dari server Socket.IO'}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span>Realtime</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-400" />
                  <span>Reconnecting</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-komazi-muted mt-0.5">
            {isBarista
              ? 'Antrean khusus barista — pesanan minuman (kopi, teh, latte) tampil otomatis.'
              : isKitchen
              ? 'Antrean khusus dapur — pesanan makanan, pastry & snack tampil otomatis.'
              : 'Antrean pesanan dapur & bar secara real-time.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Quick Test Order Button */}
          <button
            type="button"
            onClick={handleCreateTestOrder}
            title="Kirim 1 pesanan contoh (Kopi & Croissant) ke KDS"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md shadow-komazi-coral/20 transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Test Pesanan</span>
          </button>

          {/* Sync Button */}
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            title="Sinkronkan dengan pesanan server & kasir"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-bold border border-komazi-border transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-komazi-coral' : ''}`} />
            <span className="hidden sm:inline">Sinkron</span>
          </button>

          {/* Station Mode Indicator or Switcher */}
          {isBarista ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-komazi-teal/15 border border-komazi-teal/30 text-komazi-teal-light text-xs font-bold shadow-sm">
              <Coffee className="w-4 h-4" />
              <span>Khusus Barista</span>
            </div>
          ) : isKitchen ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-sm">
              <Utensils className="w-4 h-4" />
              <span>Khusus Dapur</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-komazi-surface p-1 rounded-2xl border border-komazi-border">
              {viewButtons.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewMode(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    effectiveViewMode === key
                      ? 'bg-komazi-coral text-white shadow-sm'
                      : 'text-komazi-muted hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Standalone Fullscreen KDS/BDS */}
          <button
            type="button"
            onClick={() => window.open('/kds-screen', '_blank')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-bold border border-komazi-border shadow-sm transition-colors"
          >
            <Tv className="w-4 h-4 text-komazi-coral" />
            <span className="hidden md:inline">Layar TV</span>
            <ExternalLink className="w-3 h-3 text-komazi-muted" />
          </button>
        </div>
      </div>

      {/* ── Status Tab Toggle & Stats Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-komazi-surface p-1 rounded-2xl border border-komazi-border w-fit">
          <button
            type="button"
            onClick={() => setStatusTab('ACTIVE')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusTab === 'ACTIVE'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            Antrean Aktif ({activeOrdersAll.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusTab('SERVED')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusTab === 'SERVED'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            Riwayat Selesai
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Antrian', value: pendingCount, color: 'text-komazi-muted', bg: 'bg-komazi-surface-2 border-komazi-border' },
          { label: 'Diproses', value: inProgressCount, color: 'text-komazi-coral', bg: 'bg-komazi-coral/10 border-komazi-coral/30' },
          { label: 'Siap Saji', value: readyCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
          { label: 'Hold Bill', value: holdCount, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${bg}`}>
            <span className="text-xs text-komazi-muted font-medium">{label}</span>
            <span className={`font-black text-2xl font-mono tabular-nums ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      {displayedOrders.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-komazi-border bg-komazi-surface/50 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-center text-komazi-muted mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9 text-emerald-400 opacity-80" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-komazi-text">
              {statusTab === 'SERVED'
                ? 'Belum Ada Pesanan yang Selesai'
                : isBarista
                ? 'Semua Pesanan Bar Selesai!'
                : isKitchen
                ? 'Semua Pesanan Dapur Selesai!'
                : 'Antrean Dapur & Bar Sedang Kosong'}
            </h2>
            <p className="text-xs text-komazi-muted max-w-md mx-auto">
              {statusTab === 'SERVED'
                ? 'Pesanan yang telah diselesaikan akan tampil di sini.'
                : 'Tidak ada pesanan aktif. Pesanan baru dari POS akan langsung masuk secara realtime.'}
            </p>
          </div>
        </div>
      ) : effectiveViewMode === 'SPLIT' && !isBarista && !isKitchen ? (
        <div className="flex flex-col lg:flex-row gap-5">
          <StationPanel
            title="☕ Barista / Bar"
            icon={Coffee}
            station="BAR"
            accentColor={{
              header: 'bg-komazi-teal/10 border-komazi-teal/30',
              icon: 'bg-komazi-teal/20 border border-komazi-teal/30 text-komazi-teal-light',
              title: 'text-komazi-teal-light',
              badge: 'bg-komazi-teal/10 border-komazi-teal/30 text-komazi-teal-light',
            }}
            orders={displayedOrders}
            currentTime={currentTime}
            onBumpItem={handleBumpItem}
            onBumpTicket={handleBumpTicket}
            onRequeueStatus={handleRequeueStatus}
          />

          <div className="w-px bg-komazi-border shrink-0 self-stretch hidden lg:block" />

          <StationPanel
            title="🍳 Dapur / Snack"
            icon={Utensils}
            station="KITCHEN"
            accentColor={{
              header: 'bg-amber-500/10 border-amber-500/30',
              icon: 'bg-amber-500/15 border border-amber-500/30 text-amber-400',
              title: 'text-amber-400',
              badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
            }}
            orders={displayedOrders}
            currentTime={currentTime}
            onBumpItem={handleBumpItem}
            onBumpTicket={handleBumpTicket}
            onRequeueStatus={handleRequeueStatus}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginatedOrders.map((order) => {
              const stationFilter = isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : effectiveViewMode;
              const hasItems = (order.items || []).some((item) => {
                if (stationFilter === 'ALL') return true;
                if (item.station?.type) return item.station.type === stationFilter;
                const drink = isDrinkItem(item);
                if (stationFilter === 'BAR') return drink;
                if (stationFilter === 'KITCHEN') return !drink;
                return true;
              });
              if (!hasItems) return null;
              return (
                <OrderTicket
                  key={order.id}
                  order={order}
                  station={stationFilter}
                  currentTime={currentTime}
                  onBumpItem={handleBumpItem}
                  onBumpTicket={handleBumpTicket}
                  onRequeueStatus={handleRequeueStatus}
                />
              );
            })}
          </div>

          {statusTab === 'SERVED' && displayedOrders.length > 0 && (
            <div className="pt-2">
              <Pagination
                currentPage={servedPage}
                totalItems={displayedOrders.length}
                itemsPerPage={servedPerPage}
                onPageChange={setServedPage}
                onItemsPerPageChange={(newLimit) => {
                  setServedPerPage(newLimit);
                  setServedPage(1);
                }}
                itemLabel="pesanan selesai"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
