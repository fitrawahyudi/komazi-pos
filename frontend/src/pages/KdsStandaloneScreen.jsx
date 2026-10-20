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
  Sparkles,
  RotateCcw,
  ArrowRight,
  Wifi,
  WifiOff,
  Search,
  X,
  SearchX,
  Filter,
  Settings,
  User,
  Printer,
} from 'lucide-react';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { formatOrderType, isDrinkItem } from '../utils/format';
import OrderTicket from '../components/kds/OrderTicket';
import KdsHistoryTable from '../components/kds/KdsHistoryTable';
import KdsPrinterModal from '../components/kds/KdsPrinterModal';
import KdsPrintActionModal from '../components/kds/KdsPrintActionModal';
import { usePrinterStore } from '../store/printerStore';
import NotificationService from '../services/notification.service';
import EditProfileModal from '../components/profile/EditProfileModal';

export default function KdsStandaloneScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('profile');
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [printOrderTarget, setPrintOrderTarget] = useState(null);
  const { isConnected: isPrinterConnected, connectedDeviceName } = usePrinterStore();
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
  const [screenTab, setScreenTab] = useState('ACTIVE'); // 'ACTIVE' | 'HISTORY'
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'READY' | 'HOLD'
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);


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
      // Periksa apakah pesanan relevan untuk stasiun aktif
      const items = newOrder.items || [];
      const hasDrinks = items.some((i) => i.station?.type === 'BAR' || isDrinkItem(i));
      const hasFood = items.some((i) => !(i.station?.type === 'BAR' || isDrinkItem(i)));

      let isRelevant = true;
      if (isBarista || effectiveStation === 'BAR') {
        isRelevant = hasDrinks;
      } else if (isKitchen || effectiveStation === 'KITCHEN') {
        isRelevant = hasFood;
      }

      if (isRelevant) {
        if (isSoundEnabled) playKitchenChime();
        const stationTitle = isBarista ? 'Bar (BDS)' : isKitchen ? 'Dapur (KDS)' : 'KDS';
        NotificationService.notifyNewKdsOrder(newOrder, stationTitle).catch(() => {});

        // Otomatis cetak tiket dapur jika auto-print aktif & printer Bluetooth terhubung
        const {
          autoPrintKitchenOnCheckout,
          isConnected: isPrinterConnected,
          printKitchenTicketForOrder,
        } = usePrinterStore.getState();

        if (autoPrintKitchenOnCheckout && isPrinterConnected) {
          let relevantItems = items;
          if (isBarista || effectiveStation === 'BAR') {
            relevantItems = items.filter((i) => i.station?.type === 'BAR' || isDrinkItem(i));
          } else if (isKitchen || effectiveStation === 'KITCHEN') {
            relevantItems = items.filter((i) => !(i.station?.type === 'BAR' || isDrinkItem(i)));
          }

          printKitchenTicketForOrder(newOrder, {
            stationName: stationTitle,
            items: relevantItems.length > 0 ? relevantItems : items,
          })
            .then((res) => {
              if (res?.success) {
                toast.success(`🖨️ Tiket dapur otomatis dicetak: ${newOrder.invoiceNo}`);
              }
            })
            .catch((err) => {
              console.error('[KDS Standalone] Gagal cetak otomatis tiket:', err);
            });
        }
      }

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
    NotificationService.init().catch(() => {});

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

  const handleRequeueStatus = (orderId, station) => {
    const targetStation = station || (isBarista ? 'BAR' : isKitchen ? 'KITCHEN' : 'ALL');
    updateKitchenStatus(orderId, 'PENDING', targetStation);
    toast.info('Pesanan dikembalikan ke antrean aktif.');
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
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#111111] border-b border-komazi-border flex items-center justify-between shrink-0 shadow-lg z-20">
        {/* Left: Branding & Station Toggle */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-komazi-coral/20 border border-komazi-coral/40 flex items-center justify-center text-komazi-coral shadow-inner shrink-0">
              {isBarista ? (
                <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-komazi-teal-light" />
              ) : isKitchen ? (
                <Utensils className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              ) : (
                <ChefHat className="w-4 h-4 sm:w-5 sm:h-5 text-komazi-coral" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-display font-black text-sm sm:text-base text-white tracking-wider truncate">
                  {isBarista ? 'KOMAZI' : isKitchen ? 'KOMAZI' : 'KOMAZI'}
                </span>

                {/* Socket Realtime Badge */}
                <div
                  className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] font-bold border transition-colors shrink-0 ${
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : 'bg-red-500/15 text-red-400 border-red-500/40 animate-pulse'
                  }`}
                  title={isConnected ? 'Realtime Connected' : 'Reconnecting to Server'}
                >
                  {isConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  <span>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
              </div>
              <p className="text-[9px] sm:text-[10px] text-komazi-muted font-bold tracking-wider uppercase truncate">
                {isBarista ? 'Barista Display' : isKitchen ? 'Kitchen Display' : 'Dapur & Bar'}
              </p>
            </div>
          </div>

          {/* Station Switcher (Manager/Owner only on large screen) */}
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

        {/* Center: Tabs & Live Clock (Desktop & Tablet only) */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Active vs History Tab */}
          <div className="flex items-center bg-[#181818] p-1 rounded-xl border border-komazi-border shadow-inner">
            <button
              type="button"
              onClick={() => setScreenTab('ACTIVE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                screenTab === 'ACTIVE'
                  ? 'bg-komazi-coral text-white shadow-md'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              <span>Antrean Aktif ({activeOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setScreenTab('HISTORY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                screenTab === 'HISTORY'
                  ? 'bg-komazi-coral text-white shadow-md'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              <span>Riwayat Selesai</span>
            </button>
          </div>

          <div className="hidden xl:flex px-3.5 py-1.5 rounded-xl bg-[#181818] border border-komazi-border font-mono font-black text-sm text-amber-400 tracking-widest shadow-inner">
            {clockString}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Bluetooth Thermal Printer Button with Status Badge */}
          <button
            type="button"
            onClick={() => setIsPrinterModalOpen(true)}
            className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm ${
              isPrinterConnected
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                : 'bg-[#1A1A1A] hover:bg-[#252525] text-neutral-400 border-komazi-border hover:text-white'
            }`}
            title={
              isPrinterConnected
                ? `Printer Bluetooth Terhubung: ${connectedDeviceName || 'Printer'}`
                : 'Hubungkan Printer Bluetooth / Pengaturan Struk'
            }
          >
            <Printer className="w-4 h-4" />
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isPrinterConnected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
              }`}
            />
            <span className="hidden xl:inline">
              {isPrinterConnected ? 'Printer' : 'Hubungkan Printer'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
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
            className="hidden sm:inline-flex p-2 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] text-neutral-300 hover:text-white border border-komazi-border transition-colors cursor-pointer"
            title="Toggle Layar Penuh (Fullscreen TV)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* User Profile & Settings Button */}
          <button
            type="button"
            onClick={() => {
              setSettingsInitialTab('profile');
              setIsSettingsModalOpen(true);
            }}
            className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] border border-komazi-border text-xs font-bold text-neutral-200 transition-colors shadow-sm cursor-pointer"
            title="Pengaturan KDS, Notifikasi Android & Edit Profil"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-6 h-6 rounded-lg object-cover border border-komazi-border shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-lg bg-komazi-coral/20 border border-komazi-coral/30 text-komazi-coral flex items-center justify-center font-bold text-[10px] shrink-0">
                {user?.name ? user.name.slice(0, 1).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
            )}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-white truncate max-w-[100px]">
                {user?.name || (isKitchen ? 'Staf Dapur' : isBarista ? 'Barista' : 'KDS')}
              </span>
              <span className="text-[9px] text-komazi-muted uppercase font-semibold">
                {isKitchen ? 'Dapur' : isBarista ? 'Bar' : user?.role || 'KDS'}
              </span>
            </div>
            <Settings className="w-3.5 h-3.5 text-komazi-muted hidden sm:inline ml-0.5" />
          </button>

          {!isStaffOnly && (
            <button
              type="button"
              onClick={() => navigate('/kds')}
              className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] text-neutral-300 hover:text-white border border-komazi-border text-xs font-bold transition-colors cursor-pointer"
              title="Buka KDS dengan Navigasi Sidebar"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kembali</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Sub-Header: Segmented Tab Bar (< sm) */}
      <div className="flex sm:hidden w-full px-3 py-2 bg-[#0C0C0C] border-b border-komazi-border shrink-0 z-10">
        <div className="grid grid-cols-2 w-full bg-[#181818] p-1 rounded-xl border border-komazi-border shadow-inner gap-1">
          <button
            type="button"
            onClick={() => setScreenTab('ACTIVE')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              screenTab === 'ACTIVE'
                ? 'bg-komazi-coral text-white shadow-md'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <span>Antrean Aktif</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                screenTab === 'ACTIVE'
                  ? 'bg-white/20 text-white'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {activeOrders.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setScreenTab('HISTORY')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              screenTab === 'HISTORY'
                ? 'bg-komazi-coral text-white shadow-md'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <span>Riwayat Selesai</span>
          </button>
        </div>
      </div>


      {/* 2. BODY CONTENT: ACTIVE TICKET BOARD VS RIWAYAT TABLE */}
      {screenTab === 'HISTORY' ? (
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <KdsHistoryTable
            orders={orders}
            station={effectiveStation}
            onRecall={handleRequeueStatus}
            onPrint={(order) => setPrintOrderTarget(order)}
            canBump={true}
            onRefresh={async () => {
              setIsSyncing(true);
              await fetchBackendOrders();
              setIsSyncing(false);
              toast.info('Data riwayat tersinkronisasi.');
            }}
            isRefreshing={isSyncing}
            isStandalone={true}
          />
        </main>
      ) : (
        <>
          {/* STATS BAR & QUICK FILTER */}
          <div className="h-12 px-3 sm:px-6 bg-[#0E0E0E] border-b border-komazi-border flex items-center justify-between gap-2 sm:gap-3 shrink-0">
            {isMobileSearchOpen ? (
              <div className="flex sm:hidden items-center gap-2 w-full animate-in fade-in duration-150">
                <div className="relative flex-1 flex items-center">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari meja, invoice, menu..."
                    className="w-full bg-[#181818] border border-komazi-border text-xs rounded-lg pl-8 pr-7 py-1.5 text-white placeholder:text-neutral-500 focus:outline-none focus:border-komazi-coral transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-neutral-400 hover:text-white"
                      title="Hapus pencarian"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#1A1A1A] border border-komazi-border text-xs font-bold text-neutral-300 hover:text-white shrink-0 cursor-pointer"
                >
                  Batal
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar py-0.5 max-w-[calc(100%-70px)] sm:max-w-none">
                  {/* Antrian Filter Button */}
                  <button
                    type="button"
                    onClick={() => setStatusFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
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
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
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
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
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
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
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
                      className="text-[10px] text-komazi-coral hover:underline font-bold ml-1 px-1.5 py-0.5 rounded bg-komazi-coral/10 border border-komazi-coral/30 shrink-0 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Right Controls: Desktop search, Mobile search toggle icon + Refresh */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {/* Mobile Search Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileSearchOpen(true)}
                    className={`flex sm:hidden p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      searchQuery
                        ? 'bg-komazi-coral/20 text-komazi-coral border-komazi-coral/40'
                        : 'bg-[#181818] hover:bg-[#222222] text-neutral-400 border-komazi-border hover:text-white'
                    }`}
                    title="Cari Meja / Invoice"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>

                  {/* Desktop Persistent Search Input */}
                  <div className="hidden sm:flex relative items-center">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari meja/invoice..."
                      className="w-36 md:w-48 bg-[#181818] border border-komazi-border text-[11px] rounded-lg pl-8 pr-7 py-1 text-white placeholder:text-neutral-500 focus:outline-none focus:border-komazi-coral transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 text-neutral-400 hover:text-white cursor-pointer"
                        title="Hapus pencarian"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsSyncing(true);
                      await fetchBackendOrders();
                      setIsSyncing(false);
                      toast.info('Menyinkronkan data antrean...');
                    }}
                    disabled={isSyncing}
                    className="p-1.5 sm:p-2 rounded-lg bg-[#181818] hover:bg-[#222222] border border-komazi-border text-neutral-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                    title="Sinkronkan antrean"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 text-komazi-coral ${isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* TICKET BOARD (GRID) */}
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
                    : 'Tidak ada antrian pesanan yang perlu disiapkan saat ini.'}
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
                    onRequeueStatus={handleRequeueStatus}
                    onPrintTicket={(orderToPrint) => setPrintOrderTarget(orderToPrint)}
                    tvMode={true}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {/* Edit Profile & KDS Settings Modal */}
      {isSettingsModalOpen && (
        <EditProfileModal
          onClose={() => setIsSettingsModalOpen(false)}
          initialTab={settingsInitialTab}
          isKdsMode={true}
          kdsProps={{
            isSoundEnabled,
            setIsSoundEnabled,
            stationFilter: effectiveStation,
            setStationFilter,
            isFullscreen,
            toggleFullscreen,
            isStaffOnly,
          }}
        />
      )}

      {/* Modal Pengaturan Printer & Struk Bluetooth */}
      <KdsPrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />

      {/* Modal Pilihan Cetak Tiket Dapur / Struk Pembayaran */}
      <KdsPrintActionModal
        isOpen={Boolean(printOrderTarget)}
        onClose={() => setPrintOrderTarget(null)}
        order={printOrderTarget}
        station={effectiveStation}
        onOpenPrinterSettings={() => setIsPrinterModalOpen(true)}
      />
    </div>
  );
}
