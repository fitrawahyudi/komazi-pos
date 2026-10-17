import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useOrdersStore } from '../store/ordersStore';
import { useAuthStore } from '../store/authStore';
import { useKdsSocket } from '../hooks/useKdsSocket';
import { usePersistentState } from '../hooks/usePersistentState';
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
  Search,
  Filter,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  SearchX,
  AlertTriangle,
  Flame,
  ChevronDown,
  ShoppingBag,
  Bike,
  Store,
} from 'lucide-react';
import { toast } from '../store/toastStore';
import OrderTicket from '../components/kds/OrderTicket';
import Pagination from '../components/ui/Pagination';

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
  canBump = true,
  hasActiveFilters = false,
}) {
  const stationOrders = orders.filter((order) => {
    const items = order.items || [];
    if (station === 'BAR') {
      return items.some((i) => i.station?.type === 'BAR' || isDrinkItem(i));
    }
    if (station === 'KITCHEN') {
      return items.some((i) => !(i.station?.type === 'BAR' || isDrinkItem(i)));
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
          {hasActiveFilters ? (
            <SearchX className="w-12 h-12 opacity-60 text-komazi-coral" />
          ) : (
            <CheckCircle2 className={`w-12 h-12 opacity-40 ${accentColor.title}`} />
          )}
          <div>
            <p className="font-bold text-sm text-komazi-text">
              {hasActiveFilters ? 'Tidak Ada Antrian yang Cocok' : 'Tidak Ada Antrian'}
            </p>
            <p className="text-xs text-komazi-muted mt-1">
              {hasActiveFilters
                ? 'Tidak ada pesanan aktif di stasiun ini yang sesuai filter.'
                : 'Pesanan baru akan muncul otomatis di sini'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start content-start overflow-y-auto">
          {stationOrders.map((order) => (
            <OrderTicket
              key={order.id}
              order={order}
              station={station}
              currentTime={currentTime}
              onBumpItem={onBumpItem}
              onBumpTicket={onBumpTicket}
              onRequeueStatus={onRequeueStatus}
              canBump={canBump}
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
  const isOwner = user?.role === 'OWNER';
  const isCashier = user?.role === 'CASHIER';
  const canBump = isKitchen || isBarista;

  const [viewMode, setViewMode] = usePersistentState('kds_viewMode', () => {
    if (isBarista) return 'BAR';
    if (isKitchen) return 'KITCHEN';
    return 'SPLIT';
  });

  const [statusTab, setStatusTab] = usePersistentState('kds_statusTab', 'ACTIVE');
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // ─── Search & Filters State ───
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = usePersistentState('kds_statusFilter', 'ALL'); // 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELAYED' | 'HOLD'
  const [orderTypeFilter, setOrderTypeFilter] = usePersistentState('kds_orderTypeFilter', 'ALL'); // 'ALL' | 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY'
  const [sortBy, setSortBy] = usePersistentState('kds_sortBy', 'FIFO'); // 'FIFO' | 'NEWEST' | 'DELAY'
  const [selectedProductFilter, setSelectedProductFilter] = useState(null);
  const [showItemSummary, setShowItemSummary] = usePersistentState('kds_showItemSummary', false);

  const searchInputRef = useRef(null);

  // Pagination for Served / Historical Orders
  const [servedPage, setServedPage] = useState(1);
  const [servedPerPage, setServedPerPage] = usePersistentState('kds_servedPerPage', 10);

  useEffect(() => {
    setServedPage(1);
  }, [
    statusTab,
    viewMode,
    searchQuery,
    statusFilter,
    orderTypeFilter,
    selectedProductFilter,
    sortBy,
  ]);

  const effectiveViewMode = isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : viewMode;
  const socketStationCode = isBarista ? 'BAR_MAIN' : isKitchen ? 'KITCHEN_MAIN' : 'ALL';

  // Keyboard shortcut: '/' or 'Ctrl+K' focuses search, 'Escape' clears
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          if (searchQuery) setSearchQuery('');
          else e.target.blur();
        }
        return;
      }
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

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

  // Clock interval untuk evaluasi delay pesanan (per 15 detik)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
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
  }, []);

  // Evaluasi keterlambatan pesanan (>5 menit untuk Bar, >10 menit untuk Dapur)
  const getIsOrderDelayed = useCallback(
    (order) => {
      const isBar = isBarista || effectiveViewMode === 'BAR';
      const targetMin = isBar ? 5 : 10;
      const createdTs = new Date(order.createdAt).getTime();
      const elapsed = Math.max(0, Math.floor((currentTime - createdTs) / 60000));
      const st = isBar ? (order.barStatus || 'PENDING') : (order.kitchenStatus || 'PENDING');
      return elapsed >= targetMin && st !== 'SERVED';
    },
    [isBarista, effectiveViewMode, currentTime]
  );

  // Handler BUMP Item
  const handleBumpItem = async (itemId, station) => {
    if (!canBump) {
      toast.error('Hanya staf dapur dan barista yang dapat melakukan BUMP.');
      return;
    }
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

  // Handler BUMP Tiket
  const handleBumpTicket = async (orderId, station) => {
    if (!canBump) {
      toast.error('Hanya staf dapur dan barista yang dapat melakukan BUMP.');
      return;
    }
    const targetStation = station || (isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : null);
    const res = await bumpTicket(orderId, targetStation);
    if (res.success) {
      toast.success(`Tiket pesanan ${res.order?.invoiceNo || ''} berhasil di-BUMP!`);
    } else {
      const currentOrder = orders.find((o) => o.id === orderId);
      if (currentOrder) {
        const curStatus =
          targetStation === 'BAR'
            ? currentOrder.barStatus || 'PENDING'
            : currentOrder.kitchenStatus || 'PENDING';
        const next =
          curStatus === 'PENDING'
            ? 'IN_PROGRESS'
            : curStatus === 'IN_PROGRESS'
            ? 'READY'
            : 'SERVED';
        updateKitchenStatus(orderId, next, targetStation);
      }
    }
  };

  const handleRequeueStatus = (orderId, station) => {
    if (!canBump) {
      toast.error('Hanya staf dapur dan barista yang dapat mengembalikan pesanan.');
      return;
    }
    const targetStation = station || (isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : 'ALL');
    updateKitchenStatus(orderId, 'PENDING', targetStation);
    toast.info('Pesanan dikembalikan ke antrean aktif.');
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

  // Seluruh pesanan aktif stasiun tanpa filter search/status (untuk dasar agregasi & statistik)
  const activeOrdersAll = useMemo(() => {
    return orders.filter((o) => {
      const s = (o.status || '').toUpperCase();
      if (s === 'VOIDED' || s === 'REFUNDED') return false;
      const items = o.items || [];
      const barActive =
        items.some((i) => i.station?.type === 'BAR' || isDrinkItem(i)) &&
        (o.barStatus || 'PENDING') !== 'SERVED';
      const kitchenActive =
        items.some((i) => !(i.station?.type === 'BAR' || isDrinkItem(i))) &&
        (o.kitchenStatus || 'PENDING') !== 'SERVED';

      if (isBarista || effectiveViewMode === 'BAR') return barActive;
      if (isKitchen || effectiveViewMode === 'KITCHEN') return kitchenActive;
      return barActive || kitchenActive;
    });
  }, [orders, isBarista, isKitchen, effectiveViewMode]);

  // Statistik KDS
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

  const holdCount = activeOrdersAll.filter((o) =>
    ['HOLD', 'OPEN'].includes((o.status || '').toUpperCase())
  ).length;

  const delayedCount = activeOrdersAll.filter(getIsOrderDelayed).length;

  // Ringkasan item menu per produksi (Batch Cook Summary)
  const aggregatedItems = useMemo(() => {
    const counts = {};
    activeOrdersAll.forEach((order) => {
      const items = order.items || [];
      items.forEach((item) => {
        const isDrink = item.station?.type === 'BAR' || isDrinkItem(item);
        if (isBarista || effectiveViewMode === 'BAR') {
          if (!isDrink) return;
        } else if (isKitchen || effectiveViewMode === 'KITCHEN') {
          if (isDrink) return;
        }

        const itemStatus = (item.status || 'PENDING').toUpperCase();
        if (itemStatus === 'SERVED') return;

        const key = item.productName || 'Item';
        if (!counts[key]) {
          counts[key] = {
            name: key,
            qty: 0,
            isDrink,
            orderIds: new Set(),
          };
        }
        counts[key].qty += Number(item.quantity) || 1;
        counts[key].orderIds.add(order.id);
      });
    });

    return Object.values(counts)
      .map((c) => ({
        ...c,
        ordersCount: c.orderIds.size,
      }))
      .sort((a, b) => b.qty - a.qty);
  }, [activeOrdersAll, isBarista, isKitchen, effectiveViewMode]);

  // Filter orders sesuai role, station, statusTab, Search Query, Status, Tipe Pesanan, dan Menu
  const displayedOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const status = (o.status || '').toUpperCase();
        if (
          status !== 'PAID' &&
          status !== 'HOLD' &&
          status !== 'OPEN' &&
          status !== 'IN_PROGRESS' &&
          status !== 'PARTIALLY_READY' &&
          status !== 'READY' &&
          status !== 'SERVED'
        ) {
          return false;
        }
        if (status === 'VOIDED' || status === 'REFUNDED') return false;

        const items = o.items || [];
        const hasDrinks = items.some((i) => i.station?.type === 'BAR' || isDrinkItem(i));
        const hasFood = items.some((i) => !(i.station?.type === 'BAR' || isDrinkItem(i)));

        const barStatus = o.barStatus || 'PENDING';
        const kitchenStatus = o.kitchenStatus || 'PENDING';

        const barActive = hasDrinks && barStatus !== 'SERVED';
        const kitchenActive = hasFood && kitchenStatus !== 'SERVED';
        const barServed = hasDrinks && barStatus === 'SERVED';
        const kitchenServed = hasFood && kitchenStatus === 'SERVED';

        // 1. Tab Status Filter
        if (statusTab === 'SERVED') {
          const matchTab =
            isBarista || effectiveViewMode === 'BAR'
              ? barServed
              : isKitchen || effectiveViewMode === 'KITCHEN'
              ? kitchenServed
              : barServed || kitchenServed;
          if (!matchTab) return false;
        } else {
          const matchTab =
            isBarista || effectiveViewMode === 'BAR'
              ? barActive
              : isKitchen || effectiveViewMode === 'KITCHEN'
              ? kitchenActive
              : barActive || kitchenActive;
          if (!matchTab) return false;
        }

        // 2. Search Query Filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchInv = (o.invoiceNo || '').toLowerCase().includes(q);
          const matchCust = (o.customerName || '').toLowerCase().includes(q);
          const matchTable = (o.tableNumber || '').toLowerCase().includes(q);
          const matchNotes = (o.notes || '').toLowerCase().includes(q);
          const matchType = (o.orderType || '').toLowerCase().includes(q);
          const matchItems = items.some(
            (i) =>
              (i.productName || '').toLowerCase().includes(q) ||
              (i.variantName || '').toLowerCase().includes(q) ||
              (i.notes || '').toLowerCase().includes(q)
          );
          if (!matchInv && !matchCust && !matchTable && !matchNotes && !matchType && !matchItems) {
            return false;
          }
        }

        // 3. Order Type Filter
        if (orderTypeFilter !== 'ALL') {
          if ((o.orderType || '').toUpperCase() !== orderTypeFilter) {
            return false;
          }
        }

        // 4. Quick Status Filter (hanya berlaku pada Tab Antrean Aktif)
        if (statusTab === 'ACTIVE' && statusFilter !== 'ALL') {
          if (statusFilter === 'HOLD') {
            if (!['HOLD', 'OPEN'].includes((o.status || '').toUpperCase())) return false;
          } else if (statusFilter === 'DELAYED') {
            if (!getIsOrderDelayed(o)) return false;
          } else {
            const currentStationStatus =
              isBarista || effectiveViewMode === 'BAR'
                ? o.barStatus || 'PENDING'
                : o.kitchenStatus || 'PENDING';
            if (currentStationStatus !== statusFilter) return false;
          }
        }

        // 5. Product Filter (dari Ringkasan Item)
        if (selectedProductFilter) {
          const hasProduct = items.some(
            (i) => (i.productName || '').toLowerCase() === selectedProductFilter.toLowerCase()
          );
          if (!hasProduct) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'NEWEST') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'DELAY') {
          const aDelayed = getIsOrderDelayed(a) ? 1 : 0;
          const bDelayed = getIsOrderDelayed(b) ? 1 : 0;
          if (bDelayed !== aDelayed) return bDelayed - aDelayed;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        // Default: 'FIFO' (First In, First Out / Terlama Masuk)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [
    orders,
    statusTab,
    isBarista,
    isKitchen,
    effectiveViewMode,
    searchQuery,
    orderTypeFilter,
    statusFilter,
    selectedProductFilter,
    sortBy,
    getIsOrderDelayed,
  ]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      statusFilter !== 'ALL' ||
      orderTypeFilter !== 'ALL' ||
      selectedProductFilter ||
      sortBy !== 'FIFO'
  );

  const resetAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setOrderTypeFilter('ALL');
    setSelectedProductFilter(null);
    setSortBy('FIFO');
  };

  const paginatedOrders = useMemo(() => {
    if (statusTab !== 'SERVED') return displayedOrders;
    const start = (servedPage - 1) * servedPerPage;
    return displayedOrders.slice(start, start + servedPerPage);
  }, [displayedOrders, statusTab, servedPage, servedPerPage]);

  const viewButtons = [
    { key: 'SPLIT', label: 'Split View', icon: Layers },
    { key: 'BAR', label: 'Barista / Bar', icon: Coffee },
    { key: 'KITCHEN', label: 'Dapur', icon: Utensils },
    { key: 'ALL', label: 'Semua', icon: ChefHat },
  ];

  const statusFilterOptions = [
    { key: 'ALL', label: 'Semua Status' },
    { key: 'PENDING', label: 'Menunggu', icon: Clock, count: pendingCount, color: 'text-neutral-400' },
    { key: 'IN_PROGRESS', label: 'Diproses', icon: Flame, count: inProgressCount, color: 'text-komazi-coral' },
    { key: 'READY', label: 'Siap Saji', icon: CheckCircle2, count: readyCount, color: 'text-emerald-400' },
    {
      key: 'DELAYED',
      label: 'Terlambat',
      icon: AlertTriangle,
      count: delayedCount,
      color: 'text-red-400',
      badgePulse: delayedCount > 0,
    },
    { key: 'HOLD', label: 'Hold Bill', icon: Pause, count: holdCount, color: 'text-blue-400' },
  ];

  const orderTypeOptions = [
    { key: 'ALL', label: 'Semua Tipe' },
    { key: 'DINE_IN', label: 'Makan di Tempat (Dine In)', icon: Store },
    { key: 'TAKE_AWAY', label: 'Bungkus (Take Away)', icon: ShoppingBag },
    { key: 'DELIVERY', label: 'Pengiriman (Delivery)', icon: Bike },
  ];

  const sortOptions = [
    { key: 'FIFO', label: 'Terlama Masuk (FIFO - Standar)' },
    { key: 'NEWEST', label: 'Terbaru Masuk' },
    { key: 'DELAY', label: 'Prioritas Terlambat' },
  ];

  if (isCashier) {
    return <Navigate to="/pos" replace />;
  }

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
                  <span>Bar Display System</span>
                </>
              ) : isKitchen ? (
                <>
                  <Utensils className="w-6 h-6 text-amber-400" />
                  <span>Kitchen Display System</span>
                </>
              ) : (
                <>
                  <ChefHat className="w-6 h-6 text-komazi-coral" />
                  <span>Kitchen & Bar Display System</span>
                </>
              )}
            </h1>

            {/* Socket Status Indicator */}
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

      {/* ── Stats Bar (Clickable for Instant Filter) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            key: 'PENDING',
            label: 'Antrian',
            value: pendingCount,
            color: 'text-neutral-300',
            bg: 'bg-komazi-surface-2 border-komazi-border',
            activeBg: 'bg-neutral-800/80 border-neutral-500 ring-2 ring-neutral-400/40',
          },
          {
            key: 'IN_PROGRESS',
            label: 'Diproses',
            value: inProgressCount,
            color: 'text-komazi-coral',
            bg: 'bg-komazi-coral/10 border-komazi-coral/30',
            activeBg: 'bg-komazi-coral/25 border-komazi-coral ring-2 ring-komazi-coral/50',
          },
          {
            key: 'READY',
            label: 'Siap Saji',
            value: readyCount,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/30',
            activeBg: 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/50',
          },
          {
            key: 'DELAYED',
            label: 'Terlambat (>5/10m)',
            value: delayedCount,
            color: 'text-red-400',
            bg: delayedCount > 0 ? 'bg-red-500/15 border-red-500/40 animate-pulse' : 'bg-red-500/10 border-red-500/30',
            activeBg: 'bg-red-500/30 border-red-500 ring-2 ring-red-500/50',
          },
          {
            key: 'HOLD',
            label: 'Hold Bill',
            value: holdCount,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/30',
            activeBg: 'bg-blue-500/25 border-blue-400 ring-2 ring-blue-400/50',
          },
        ].map(({ key, label, value, color, bg, activeBg }) => {
          const isSelected = statusTab === 'ACTIVE' && statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (statusTab !== 'ACTIVE') setStatusTab('ACTIVE');
                setStatusFilter(isSelected ? 'ALL' : key);
              }}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                isSelected ? activeBg : bg
              } hover:brightness-110 active:scale-[0.98] cursor-pointer`}
              title={`Klik untuk memfilter status: ${label}`}
            >
              <div className="min-w-0">
                <span className="text-[11px] text-komazi-muted font-medium block truncate">{label}</span>
                <span className={`font-black text-xl font-mono tabular-nums ${color}`}>{value}</span>
              </div>
              {isSelected && (
                <div className="w-2 h-2 rounded-full bg-komazi-coral shrink-0 ml-1 shadow-sm" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Control Bar ── */}
      <div className="bg-komazi-surface border border-komazi-border rounded-2xl p-3 sm:p-4 space-y-3 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 1. Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-komazi-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari meja, no invoice (#12), nama pemesan, atau menu (tekan '/' untuk cari)..."
              className="w-full bg-komazi-surface-2 border border-komazi-border text-xs rounded-xl pl-10 pr-9 py-2.5 text-komazi-text placeholder:text-komazi-muted focus:outline-none focus:border-komazi-coral focus:ring-1 focus:ring-komazi-coral transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-komazi-muted hover:text-white transition-colors p-0.5 rounded-md"
                title="Hapus pencarian (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Order Type, Sorting Dropdowns & Batch Summary */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tipe Pesanan Filter */}
            <div className="relative">
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value)}
                className="appearance-none bg-komazi-surface-2 hover:bg-komazi-surface-3 border border-komazi-border text-xs font-bold text-komazi-text rounded-xl pl-3 pr-8 py-2.5 cursor-pointer focus:outline-none focus:border-komazi-coral transition-colors"
                title="Filter berdasarkan tipe pesanan"
              >
                {orderTypeOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-komazi-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Urutan (Sorting) */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-komazi-surface-2 hover:bg-komazi-surface-3 border border-komazi-border text-xs font-bold text-komazi-text rounded-xl pl-3 pr-8 py-2.5 cursor-pointer focus:outline-none focus:border-komazi-coral transition-colors"
                title="Urutan antrean tiket"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-komazi-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Batch Summary Toggle */}
            {statusTab === 'ACTIVE' && aggregatedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowItemSummary((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  showItemSummary || selectedProductFilter
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-sm'
                    : 'bg-komazi-surface-2 hover:bg-komazi-surface-3 border-komazi-border text-komazi-muted hover:text-white'
                }`}
                title="Tampilkan ringkasan total item per menu (Batch Cooking)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Ringkasan Menu</span>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-400/20 text-[10px] font-black text-amber-300">
                  {aggregatedItems.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Status Filter Pills (Only in ACTIVE tab) */}
        {statusTab === 'ACTIVE' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-komazi-border/50">
            <span className="text-[11px] font-bold text-komazi-muted shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-komazi-coral" /> Status:
            </span>
            {statusFilterOptions.map((opt) => {
              const isActive = statusFilter === opt.key;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatusFilter(isActive && opt.key !== 'ALL' ? 'ALL' : opt.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 ${
                    isActive
                      ? 'bg-komazi-coral text-white border-komazi-coral shadow-sm'
                      : 'bg-komazi-surface-2 hover:bg-komazi-surface-3 border-komazi-border text-komazi-muted hover:text-white'
                  }`}
                >
                  {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : opt.color}`} />}
                  <span>{opt.label}</span>
                  {opt.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : opt.badgePulse
                          ? 'bg-red-500/20 text-red-400 animate-pulse'
                          : 'bg-komazi-border text-neutral-400'
                      }`}
                    >
                      {opt.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Batch Production / Item Summary Strip */}
        {(showItemSummary || selectedProductFilter) && statusTab === 'ACTIVE' && aggregatedItems.length > 0 && (
          <div className="p-2.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border/80 space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-komazi-text uppercase tracking-wider">
                  Total Item Antrean (Klik untuk Filter Tiket):
                </span>
              </div>
              {selectedProductFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedProductFilter(null)}
                  className="text-[11px] text-komazi-coral hover:underline font-bold"
                >
                  Tampilkan Semua Menu
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {aggregatedItems.map((item) => {
                const isSelected = selectedProductFilter?.toLowerCase() === item.name.toLowerCase();
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedProductFilter(isSelected ? null : item.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold shadow-sm ring-1 ring-emerald-500/50'
                        : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-border/80'
                    }`}
                  >
                    <span>{item.isDrink ? '☕' : '🍳'}</span>
                    <span className="truncate max-w-[150px]">{item.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono font-black text-[10px] ${
                        isSelected ? 'bg-emerald-500/30 text-white' : 'bg-komazi-surface-2 text-komazi-coral'
                      }`}
                    >
                      x{item.qty}
                    </span>
                    {isSelected && <X className="w-3 h-3 text-emerald-300 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Filters Pill Bar & Summary Counter */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs border-t border-komazi-border/50">
            <span className="text-komazi-muted text-[11px] font-semibold flex items-center gap-1">
              <Filter className="w-3 h-3 text-komazi-coral" /> Filter Aktif:
            </span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-komazi-text text-xs">
                <span>
                  Cari: <strong className="text-komazi-coral">"{searchQuery}"</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-komazi-text text-xs">
                <span>
                  Status:{' '}
                  <strong className="text-komazi-coral">
                    {statusFilterOptions.find((o) => o.key === statusFilter)?.label}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {orderTypeFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-komazi-text text-xs">
                <span>
                  Tipe:{' '}
                  <strong className="text-komazi-coral">
                    {orderTypeOptions.find((o) => o.key === orderTypeFilter)?.label}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setOrderTypeFilter('ALL')}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedProductFilter && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                <span>
                  Menu: <strong className="text-emerald-400">"{selectedProductFilter}"</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProductFilter(null)}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {sortBy !== 'FIFO' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-komazi-text text-xs">
                <span>
                  Urut:{' '}
                  <strong className="text-komazi-coral">
                    {sortOptions.find((o) => o.key === sortBy)?.label}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSortBy('FIFO')}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-[11px] text-komazi-coral hover:underline font-bold ml-1"
            >
              Reset Semua
            </button>
            <span className="ml-auto text-[11px] text-komazi-muted font-medium">
              Menampilkan {displayedOrders.length} dari{' '}
              {statusTab === 'ACTIVE' ? activeOrdersAll.length : orders.length} pesanan
            </span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {displayedOrders.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-komazi-border bg-komazi-surface/50 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-center text-komazi-muted mx-auto shadow-inner">
            {hasActiveFilters ? (
              <SearchX className="w-8 h-8 text-komazi-coral opacity-80" />
            ) : (
              <CheckCircle2 className="w-9 h-9 text-emerald-400 opacity-80" />
            )}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-komazi-text">
              {hasActiveFilters
                ? 'Tidak Ada Pesanan yang Cocok'
                : statusTab === 'SERVED'
                ? 'Belum Ada Pesanan yang Selesai'
                : isBarista
                ? 'Semua Pesanan Bar Selesai!'
                : isKitchen
                ? 'Semua Pesanan Dapur Selesai!'
                : 'Antrean Dapur & Bar Sedang Kosong'}
            </h2>
            <p className="text-xs text-komazi-muted max-w-md mx-auto">
              {hasActiveFilters
                ? 'Coba sesuaikan kata kunci pencarian atau reset filter aktif.'
                : statusTab === 'SERVED'
                ? 'Pesanan yang telah diselesaikan akan tampil di sini.'
                : 'Tidak ada pesanan aktif. Pesanan baru dari POS akan langsung masuk secara realtime.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs transition-colors shadow-md inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter & Pencarian</span>
            </button>
          )}
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
            canBump={canBump}
            hasActiveFilters={hasActiveFilters}
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
            canBump={canBump}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
            {paginatedOrders.map((order) => {
              const stationFilterMode = isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : effectiveViewMode;
              const hasItems = (order.items || []).some((item) => {
                if (stationFilterMode === 'ALL') return true;
                const isBar = item.station?.type === 'BAR' || isDrinkItem(item);
                if (stationFilterMode === 'BAR') return isBar;
                if (stationFilterMode === 'KITCHEN') return !isBar;
                return true;
              });
              if (!hasItems) return null;
              return (
                <OrderTicket
                  key={order.id}
                  order={order}
                  station={stationFilterMode}
                  currentTime={currentTime}
                  onBumpItem={handleBumpItem}
                  onBumpTicket={handleBumpTicket}
                  onRequeueStatus={handleRequeueStatus}
                  canBump={canBump}
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
