import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHasPhysicalKeyboard } from '../hooks/useHasPhysicalKeyboard';
import { usePosStore } from '../store/posStore';
import { useCartStore } from '../store/cartStore';
import { useUiStore } from '../store/uiStore';
import { useOrdersStore } from '../store/ordersStore';
import { formatRupiah } from '../utils/format';
import ProductCard from '../components/pos/ProductCard';
import ProductVariantModal from '../components/pos/ProductVariantModal';
import DynamicPriceModal from '../components/pos/DynamicPriceModal';
import CartSidebar from '../components/pos/CartSidebar';
import PaymentModal from '../components/pos/PaymentModal';
import ThermalReceiptModal from '../components/pos/ThermalReceiptModal';
import SplitBillModal from '../components/pos/SplitBillModal';
import OpenBillsModal from '../components/pos/OpenBillsModal';
import MergeBillModal from '../components/pos/MergeBillModal';
import PosMenuSkeleton from '../components/ui/loading/skeletons/PosMenuSkeleton';
import OpenShiftGateModal from '../components/shift/OpenShiftGateModal';
import ShiftModal from '../components/shift/ShiftModal';
import ActiveShiftAttendanceGateModal from '../components/shift/ActiveShiftAttendanceGateModal';
import AttendanceVerificationModal from '../components/hris/AttendanceVerificationModal';
import { Search, Sparkles, X, ShoppingBag, ArrowRight, RefreshCw, UtensilsCrossed, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { useShiftStore } from '../store/shiftStore';
import { useAuthStore } from '../store/authStore';
import { useHrisStore } from '../store/hrisStore';
import { useSettingsStore } from '../store/settingsStore';
import { toast } from '../store/toastStore';

export default function PosPage() {
  const {
    products,
    categories,
    selectedCategoryId,
    searchQuery,
    setSelectedCategoryId,
    setSearchQuery,
    isLoading,
  } = usePosStore();

  const { addItem, getCartSummary, attachedWorkspaceSession, syncOpenBillsWithBackendOrders } = useCartStore();
  const { isMobileCartOpen, setMobileCartOpen, toggleMobileCart } = useUiStore();
  const { activeShift, fetchActiveShift } = useShiftStore();
  const { user } = useAuthStore();
  const { myTodaySchedule, fetchMyTodaySchedule, myTodayAttendance, fetchTodayAttendance } = useHrisStore();

  const { settings } = useSettingsStore();
  const isAttendanceEnforced = settings?.enforceAttendanceGuard !== false && settings?.enforceAttendanceGuard !== 'false';
  const hasActiveShift = Boolean(activeShift && !activeShift.isClosed);
  const isOwner = user?.role === 'OWNER';
  const isScheduleBlocked = !isOwner && myTodaySchedule !== null && !myTodaySchedule?.isScheduled;
  const hasClockedIn = isOwner || !isAttendanceEnforced || Boolean(myTodaySchedule?.hasClockedIn || myTodayAttendance?.clockIn);
  const isAttendanceBlocked = !isOwner && isAttendanceEnforced && !isScheduleBlocked && myTodaySchedule !== null && !hasClockedIn;

  const [activeModalProduct, setActiveModalProduct] = useState(null);
  const [activeDynamicProduct, setActiveDynamicProduct] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [isOpenBillsOpen, setIsOpenBillsOpen] = useState(false);
  const [isMergeBillOpen, setIsMergeBillOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [completedOrderReceipt, setCompletedOrderReceipt] = useState(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [isAttendanceGateDismissed, setIsAttendanceGateDismissed] = useState(false);

  useEffect(() => {
    // Auto-close sidebar navigasi dan mobile cart saat pindah ke tab Transaksi POS
    useUiStore.getState().setSidebarCollapsed(true);
    useUiStore.getState().setMobileSidebarOpen(false);
    useUiStore.getState().setMobileCartOpen(false);

    let lastSync = Date.now();
    // Sinkronisasi pesanan tertahan dengan backend MySQL
    const sync = async () => {
      try {
        await useOrdersStore.getState().fetchOrders?.();
        if (typeof syncOpenBillsWithBackendOrders === 'function') {
          syncOpenBillsWithBackendOrders(false);
        }
      } catch (e) {
        console.warn('POS initial orders sync warning:', e);
      }
    };
    sync();
    fetchActiveShift?.();
    fetchMyTodaySchedule?.();
    if (user?.id) {
      fetchTodayAttendance?.(user.id);
    }

    // Pastikan katalog menu dan kategori terisi
    const { products: curProds, categories: curCats, fetchProducts, fetchCategories } = usePosStore.getState();
    if (!curProds || curProds.length === 0) {
      fetchProducts?.();
    }
    if (!curCats || curCats.length === 0) {
      fetchCategories?.();
    }

    // Auto-sync saat window/tab kembali aktif (dibatasi minimal selisih 4 detik)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSync > 4000) {
        lastSync = Date.now();
        sync();
        fetchActiveShift?.();
        const pState = usePosStore.getState();
        if (!pState.products || pState.products.length === 0) {
          pState.fetchProducts?.();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [syncOpenBillsWithBackendOrders, fetchActiveShift]);



  const searchInputRef = useRef(null);
  const summary = getCartSummary();
  const hasCartItems = summary.totalQty > 0 || !!attachedWorkspaceSession;
  const hasKeyboard = useHasPhysicalKeyboard();

  // Keyboard shortcut: F2 to focus search, F9 to open payment (only on desktop/laptop)
  useEffect(() => {
    if (!hasKeyboard) return;

    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (isScheduleBlocked) {
          toast.error('Jadwal kerja Anda belum diatur untuk hari ini. Anda tidak dapat melakukan transaksi.');
          return;
        }
        if (isAttendanceBlocked) {
          toast.error('Anda wajib melakukan presensi terlebih dahulu sebelum dapat bertransaksi pada sesi ini.');
          setShowVerifyModal(true);
          return;
        }
        if (summary.grandTotal > 0) {
          setIsPaymentOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [summary.grandTotal, hasKeyboard, isScheduleBlocked, isAttendanceBlocked]);

  // Handle product click
  const handleSelectProduct = (product) => {
    if (isScheduleBlocked) {
      toast.error('Jadwal kerja Anda belum diatur untuk hari ini. Anda tidak dapat melakukan transaksi.');
      return;
    }
    if (isAttendanceBlocked) {
      toast.error('Anda wajib melakukan presensi terlebih dahulu sebelum dapat bertransaksi pada sesi ini.');
      setShowVerifyModal(true);
      return;
    }
    if (!hasActiveShift) {
      toast.error('Wajib membuka sesi kasir terlebih dahulu sebelum menambahkan menu');
      return;
    }

    if (product.isDynamicPrice) {
      setActiveDynamicProduct(product);
      return;
    }

    const hasOptions =
      (product.variants && product.variants.length > 0) ||
      (product.modifiers && product.modifiers.length > 0);

    if (hasOptions) {
      setActiveModalProduct(product);
    } else {
      // Add directly
      addItem(product);
    }
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory =
        selectedCategoryId === 'all' || p.categoryId === Number(selectedCategoryId);
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchCategory && matchSearch && p.isActive !== false;
    });
  }, [products, selectedCategoryId, searchQuery]);

  return (
    <div className="flex h-full w-full overflow-hidden select-none relative">
      {/* LEFT: Menu Catalog & Categories */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Schedule Blocked Alert */}
        {isScheduleBlocked && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-3 text-amber-300 text-xs shadow-sm animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <strong className="block text-amber-200">Jadwal Kerja Belum Diatur</strong>
              <span>
                Jadwal kerja Anda belum diatur untuk hari ini. Anda tidak dapat membuka sesi kasir ataupun melakukan transaksi hingga jadwal dibuat oleh Owner atau Manajer.
              </span>
            </div>
          </div>
        )}

        {/* Search Bar & Mobile Cart Toggle */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={hasKeyboard ? 'Cari menu, kopi, makanan... (F2)' : 'Cari menu, kopi, makanan...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral focus:outline-none shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Cart button for mobile header */}
          {/* <button
            type="button"
            onClick={toggleMobileCart}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md shrink-0 relative active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Keranjang</span>
            {summary.totalQty > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-komazi-coral text-[10px] font-black flex items-center justify-center">
                {summary.totalQty}
              </span>
            )}
          </button> */}

          {/* Quick Counter (desktop) */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-muted shrink-0">
            <span>
              <strong className="text-komazi-text">{filteredProducts.length}</strong> Menu
            </span>
          </div>
        </div>

        {/* Categories Bar */}
        <div
          className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar shrink-0 scroll-smooth touch-pan-x"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 min-h-[38px] cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-komazi-coral text-white shadow-md shadow-komazi-coral/25 font-bold'
                : 'bg-komazi-surface text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 border border-komazi-border'
            }`}
          >
            Semua Kategori
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 min-h-[38px] cursor-pointer ${
                  isSelected
                    ? 'bg-komazi-coral text-white shadow-md shadow-komazi-coral/25 font-bold'
                    : 'bg-komazi-surface text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 border border-komazi-border'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid with Dynamic Safe Bottom Spacing */}
        <div
          className={`flex-1 overflow-y-auto pr-1 no-scrollbar transition-all ${
            hasCartItems
              ? 'pb-40 sm:pb-36 lg:pb-8'
              : 'pb-24 sm:pb-20 lg:pb-8'
          }`}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {isLoading && products.length === 0 ? (
            <PosMenuSkeleton count={8} />
          ) : products.length === 0 ? (
            /* Catalog is empty */
            <div className="h-64 sm:h-72 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-center text-komazi-coral shadow-inner">
                <UtensilsCrossed className="w-7 h-7 opacity-80" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm sm:text-base text-komazi-text">Katalog Menu Belum Tersedia</p>
                <p className="text-xs text-komazi-muted max-w-xs leading-relaxed">
                  Belum ada menu yang dapat ditampilkan. Silakan segarkan halaman atau periksa pengaturan menu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => usePosStore.getState().fetchProducts?.()}
                className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Menu</span>
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Search / Filter yields no results */
            <div className="h-64 sm:h-72 flex flex-col items-center justify-center text-center p-6 space-y-3 text-komazi-muted">
              <div className="w-14 h-14 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-center text-komazi-muted">
                <Search className="w-7 h-7 opacity-60" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm sm:text-base text-komazi-text">Menu Tidak Ditemukan</p>
                <p className="text-xs text-komazi-muted max-w-xs leading-relaxed">
                  {searchQuery
                    ? `Tidak ada menu yang sesuai dengan "${searchQuery}".`
                    : 'Tidak ada menu yang tersedia pada kategori ini.'}
                </p>
              </div>
              {(searchQuery || selectedCategoryId !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategoryId('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface-3 border border-komazi-border hover:border-komazi-coral text-komazi-text font-semibold text-xs active:scale-95 transition-all"
                >
                  Tampilkan Semua Menu
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={handleSelectProduct}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom Cart Bar for Mobile & Tablet Portrait (Floats safely above BottomNav) */}
      {hasCartItems && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 animate-in slide-in-from-bottom duration-200">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="w-full p-3 sm:p-3.5 rounded-2xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center justify-between shadow-2xl shadow-komazi-coral/30 border border-white/20 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px] opacity-90">{summary.totalQty} Menu di Keranjang</p>
                <p className="font-mono text-sm sm:text-base font-black tracking-wide">
                  {formatRupiah(summary.grandTotal)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-black/25 px-3 py-1.5 rounded-xl font-bold">
              <span>Buka Keranjang</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      )}

      {/* RIGHT: Cart Sidebar (Desktop DOCKED) */}
      <div className="hidden lg:flex h-full">
        <CartSidebar
          onOpenPayment={() => {
            if (isScheduleBlocked) {
              toast.error('Jadwal kerja Anda belum diatur untuk hari ini. Anda tidak dapat melakukan transaksi.');
              return;
            }
            setIsPaymentOpen(true);
          }}
          onOpenSplitBill={() => setIsSplitBillOpen(true)}
          onOpenOpenBills={() => setIsOpenBillsOpen(true)}
          onOpenMergeBill={() => setIsMergeBillOpen(true)}
        />
      </div>

      {/* Mobile/Tablet Cart Drawer (SLIDE-OVER BOTTOM SHEET) */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileCartOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative ml-auto w-full sm:w-96 max-w-full h-full bg-komazi-surface shadow-2xl z-10 animate-in slide-in-from-right duration-200 flex flex-col">
            <CartSidebar
              onCloseMobile={() => setMobileCartOpen(false)}
              onOpenPayment={() => {
                setMobileCartOpen(false);
                if (isScheduleBlocked) {
                  toast.error('Jadwal kerja Anda belum diatur untuk hari ini. Anda tidak dapat melakukan transaksi.');
                  return;
                }
                setIsPaymentOpen(true);
              }}
              onOpenSplitBill={() => {
                setMobileCartOpen(false);
                setIsSplitBillOpen(true);
              }}
              onOpenOpenBills={() => {
                setMobileCartOpen(false);
                setIsOpenBillsOpen(true);
              }}
              onOpenMergeBill={() => {
                setMobileCartOpen(false);
                setIsMergeBillOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {activeDynamicProduct && (
        <DynamicPriceModal
          product={activeDynamicProduct}
          onClose={() => setActiveDynamicProduct(null)}
          onSubmit={({ product, customPrice, selectedVariant, selectedModifiers, note }) => {
            addItem(product, selectedVariant, selectedModifiers, note, customPrice);
            setActiveDynamicProduct(null);
          }}
        />
      )}

      {activeModalProduct && (
        <ProductVariantModal
          product={activeModalProduct}
          onClose={() => setActiveModalProduct(null)}
          onAddToCart={(prod, variant, modifiers, note) => {
            addItem(prod, variant, modifiers, note);
          }}
        />
      )}

      {isPaymentOpen && (
        <PaymentModal
          onClose={() => setIsPaymentOpen(false)}
          onSuccessOrder={(order) => {
            setIsPaymentOpen(false);
            setCompletedOrderReceipt(order);
          }}
        />
      )}

      {isSplitBillOpen && (
        <SplitBillModal
          onClose={() => setIsSplitBillOpen(false)}
          onProceedPayment={() => {
            setIsSplitBillOpen(false);
            setIsPaymentOpen(true);
          }}
        />
      )}

      {isOpenBillsOpen && (
        <OpenBillsModal
          onClose={() => setIsOpenBillsOpen(false)}
        />
      )}

      {isMergeBillOpen && (
        <MergeBillModal
          onClose={() => setIsMergeBillOpen(false)}
        />
      )}

      {completedOrderReceipt && (
        <ThermalReceiptModal
          order={completedOrderReceipt}
          onClose={() => setCompletedOrderReceipt(null)}
        />
      )}

      {/* Shift Management Modal */}
      {isShiftModalOpen && (
        <ShiftModal
          onClose={() => {
            setIsShiftModalOpen(false);
            fetchActiveShift?.();
          }}
        />
      )}

      {/* Mandatory Open Shift Gate Modal (Saat belum ada shift aktif) */}
      <OpenShiftGateModal
        isOpen={!hasActiveShift}
        onClose={() => {
          fetchActiveShift?.();
        }}
      />

      {/* Active Shift Attendance Gate Modal (Saat sesi sudah dibuka staf lain tapi staf ini belum presensi) */}
      <ActiveShiftAttendanceGateModal
        isOpen={hasActiveShift && isAttendanceBlocked && !isAttendanceGateDismissed}
        onClose={() => setIsAttendanceGateDismissed(true)}
        onTriggerVerify={() => setShowVerifyModal(true)}
        activeShift={activeShift}
      />

      {/* Verification Modal: Kamera Selfie & GPS */}
      <AttendanceVerificationModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onSuccess={async () => {
          setShowVerifyModal(false);
          setIsAttendanceGateDismissed(false);
          await fetchMyTodaySchedule?.();
          if (user?.id) await fetchTodayAttendance?.(user.id);
          toast.success('Presensi berhasil diverifikasi! Sesi kasir siap digunakan.');
        }}
      />
    </div>
  );
}
