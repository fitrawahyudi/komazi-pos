import React, { useState, useRef, useEffect } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useCustomerStore } from '../../store/customerStore';
import { useShiftStore } from '../../store/shiftStore';
import { useAuthStore } from '../../store/authStore';
import { useHrisStore } from '../../store/hrisStore';
import { formatRupiah } from '../../utils/format';
import {
  Trash2,
  Plus,
  Minus,
  Percent,
  BookmarkCheck,
  CreditCard,
  Utensils,
  ShoppingBag,
  Laptop,
  X,
  AlertCircle,
  Split,
  GitMerge,
  UserSearch,
  UserCheck,
  ChevronDown,
  FileText,
  Gift,
  Sparkles,
  Clock,
  Pencil,
} from 'lucide-react';
import PromptModal from '../ui/PromptModal';
import AlertModal from '../ui/AlertModal';
import AttendanceVerificationModal from '../hris/AttendanceVerificationModal';
import DynamicPriceModal from './DynamicPriceModal';
import { toast } from '../../store/toastStore';
import { useHasPhysicalKeyboard } from '../../hooks/useHasPhysicalKeyboard';
import { scrollInputIntoViewOnFocus } from '../../utils/keyboard';

export default function CartSidebar({
  onOpenPayment,
  onOpenOpenBills,
  onOpenSplitBill,
  onOpenMergeBill,
  onCloseMobile,
}) {
  const hasKeyboard = useHasPhysicalKeyboard();
  const {
    items,
    orderType,
    tableNo,
    customerName,
    selectedCustomerId,
    discountType,
    discountValue,
    redeemedPoints,
    setRedeemedPoints,
    attachedWorkspaceSession,
    setOrderType,
    setTableNo,
    setCustomerName,
    setSelectedCustomer,
    setDiscount,
    updateItemQty,
    updateItemPrice,
    updateItemNote,
    removeItem,
    clearCart,
    clearWorkspaceSession,
    getCartSummary,
    saveCurrentAsOpenBill,
    openBills,
    currentHoldBillId,
    currentBackendOrderId,
  } = useCartStore();

  const [editingDynamicItem, setEditingDynamicItem] = useState(null);

  const { activeShift } = useShiftStore();
  const hasActiveShift = Boolean(activeShift && !activeShift.isClosed);

  const user = useAuthStore((state) => state.user);
  const myTodaySchedule = useHrisStore((state) => state.myTodaySchedule);
  const myTodayAttendance = useHrisStore((state) => state.myTodayAttendance);
  const fetchMyTodaySchedule = useHrisStore((state) => state.fetchMyTodaySchedule);
  const fetchTodayAttendance = useHrisStore((state) => state.fetchTodayAttendance);

  const { settings } = useSettingsStore();
  const isAttendanceEnforced = settings?.enforceAttendanceGuard !== false && settings?.enforceAttendanceGuard !== 'false';
  const isOwner = user?.role === 'OWNER';
  const isScheduleBlocked = !isOwner && myTodaySchedule !== null && !myTodaySchedule?.isScheduled;
  const hasClockedIn = isOwner || !isAttendanceEnforced || Boolean(myTodaySchedule?.hasClockedIn || myTodayAttendance?.clockIn);
  const isAttendanceBlocked = !isOwner && isAttendanceEnforced && !isScheduleBlocked && myTodaySchedule !== null && !hasClockedIn;

  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const isEditingOpenBill = Boolean(currentHoldBillId || currentBackendOrderId);
  const candidateBillsCount = (openBills || []).filter((b) => {
    if (currentHoldBillId && (b.id === currentHoldBillId || b.billId === currentHoldBillId)) {
      return false;
    }
    if (currentBackendOrderId && b.backendOrderId === currentBackendOrderId) {
      return false;
    }
    return true;
  }).length;

  const { customers, fetchCustomers } = useCustomerStore();
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [tempDiscountType, setTempDiscountType] = useState(discountType);
  const [tempDiscountVal, setTempDiscountVal] = useState(discountValue);
  const [isHoldBillPromptOpen, setIsHoldBillPromptOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // Fetch customers if not loaded
  useEffect(() => {
    if (customers.length === 0 && typeof fetchCustomers === 'function') {
      fetchCustomers().catch(() => {});
    }
  }, [customers.length, fetchCustomers]);

  // Customer picker state
  const [customerSearch, setCustomerSearch] = useState('Tamu Umum');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerInputRef = useRef(null);

  // Filter customers based on search
  const filteredCustomers = customers.filter(
    (c) =>
      c.isActive !== false &&
      (c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch)))
  );

  const selectedCustomerObj = selectedCustomerId
    ? customers.find((c) => c.id === selectedCustomerId)
    : null;

  const tierColors = {
    SILVER: 'text-slate-300 bg-slate-500/15 border-slate-500/30',
    GOLD: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
    PLATINUM: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerInputRef.current && !customerInputRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const summary = getCartSummary();
  const isEmpty = items.length === 0 && !attachedWorkspaceSession;

  const handleApplyDiscount = () => {
    setRedeemedPoints(0); // Reset penukaran poin jika kasir memasukkan diskon custom/promo
    setDiscount(tempDiscountType, tempDiscountVal);
    setIsDiscountOpen(false);
  };

  const handleRedeemLoyaltyPoints = (pointsToUse) => {
    if (!selectedCustomerObj || pointsToUse <= 0) return;
    const maxDiscountAllowed = summary.subtotal;
    const discountFromPoints = Math.min(maxDiscountAllowed, pointsToUse * 1000);
    const actualPointsUsed = Math.min(pointsToUse, Math.floor(discountFromPoints / 1000));

    setRedeemedPoints(actualPointsUsed);
    setDiscount('NOMINAL', discountFromPoints);
    setTempDiscountType('NOMINAL');
    setTempDiscountVal(discountFromPoints);
    setIsDiscountOpen(false);
    toast.success(`Berhasil menukarkan ${actualPointsUsed} poin loyalti (${formatRupiah(discountFromPoints)})!`);
  };

  const handleConfirmHoldBill = (label) => {
    saveCurrentAsOpenBill(label);
    toast.success(`Pesanan "${label}" berhasil disimpan ke Open Bills!`);
  };

  return (
    <aside className="w-full lg:w-96 border-l border-komazi-border bg-komazi-surface flex flex-col justify-between select-none h-full shrink-0">
      {/* Mobile Top Header (only on mobile view) */}
      <div className="lg:hidden flex items-center justify-between p-3.5 border-b border-komazi-border bg-komazi-surface-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-komazi-coral" />
          <h3 className="font-bold text-sm text-komazi-text">
            Keranjang ({summary.totalQty} item)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenOpenBills}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
              openBills.length > 0
                ? 'bg-komazi-coral/15 border-komazi-coral/40 text-komazi-coral hover:bg-komazi-coral/25'
                : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-white'
            }`}
            title="Lihat Daftar Pesanan Tertahan (Open Bills)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Bill ({openBills.length})</span>
          </button>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg bg-komazi-surface text-komazi-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 1. Header: Order Type (Dine-in / Take-away) & Inputs */}
      <div className="p-3.5 border-b border-komazi-border space-y-3 bg-komazi-surface/90">
        {/* Desktop Header bar: Title & Quick Open Bills button */}
        <div className="hidden lg:flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-komazi-coral" />
            <h3 className="font-bold text-sm text-komazi-text">
              Keranjang ({summary.totalQty} item)
            </h3>
          </div>
        </div>

        {/* Banner Status Edit Tagihan Tertahan */}
        {isEditingOpenBill && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="font-bold truncate">
                Mengedit: {tableNo ? `Meja ${tableNo}` : (customerName || 'Tagihan Tertahan')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => clearCart(false)}
              className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-bold border border-amber-500/30 transition-colors shrink-0"
              title="Batal edit dan bersihkan keranjang tanpa membatalkan order di server"
            >
              Batal Edit
            </button>
          </div>
        )}

        {/* Banner Open Bills (jika ada pesanan tertahan) */}
        {openBills.length > 0 && !isEditingOpenBill && (
          <button
            type="button"
            onClick={onOpenOpenBills}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-komazi-coral/10 border border-komazi-coral/30 hover:bg-komazi-coral/20 hover:border-komazi-coral/50 text-komazi-coral transition-colors text-xs font-semibold group shadow-sm"
            title="Lihat daftar pesanan tertahan"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-komazi-coral opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-komazi-coral"></span>
              </span>
              <FileText className="w-3.5 h-3.5 text-komazi-coral shrink-0" />
              <span className="truncate">{openBills.length} Pesanan Tertahan</span>
            </div>
            <span className="text-[11px] font-bold text-komazi-coral flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
              Buka
            </span>
          </button>
        )}

        {/* Order Type Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-komazi-surface-2 border border-komazi-border">
          <button
            type="button"
            onClick={() => setOrderType('DINE_IN')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              orderType === 'DINE_IN'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Dine-In</span>
          </button>

          <button
            type="button"
            onClick={() => setOrderType('TAKE_AWAY')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              orderType === 'TAKE_AWAY'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Take-Away</span>
          </button>
        </div>

        {/* Customer & Table details */}
        <div className="grid grid-cols-3 gap-2">
          {orderType === 'DINE_IN' && (
            <div className="col-span-1">
              <input
                type="text"
                placeholder="No Meja"
                value={tableNo}
                onChange={(e) => setTableNo(e.target.value)}
                onFocus={scrollInputIntoViewOnFocus}
                className="w-full rounded-xl bg-komazi-surface-2 border border-komazi-border px-3 py-1.5 text-xs text-center font-bold text-komazi-coral placeholder-komazi-muted/50 focus:border-komazi-coral focus:outline-none"
              />
            </div>
          )}

          {/* ── Customer Picker ── */}
          <div className={orderType === 'DINE_IN' ? 'col-span-2' : 'col-span-3'} ref={customerInputRef}>
            {/* If a registered customer is selected, show chip */}
            {selectedCustomerObj ? (
              <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs font-medium ${
                tierColors[selectedCustomerObj.tier] || tierColors.SILVER
              }`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-bold truncate">{selectedCustomerObj.name}</span>
                  <span className="opacity-60 shrink-0">
                    • {selectedCustomerObj.points} poin
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null, '');
                    setCustomerSearch('');
                  }}
                  className="ml-1 p-0.5 rounded hover:opacity-70 shrink-0"
                  title="Ganti pelanggan"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                {/* Search input */}
                <div className="relative">
                  <UserSearch className="w-3.5 h-3.5 text-komazi-muted absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Cari / ketik nama pelanggan..."
                    value={customerSearch || customerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerSearch(val);
                      setCustomerName(val); // allow manual free-text
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={(e) => {
                      setIsCustomerDropdownOpen(true);
                      scrollInputIntoViewOnFocus(e);
                    }}
                    className="w-full pl-7 pr-7 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted/50 focus:border-komazi-coral focus:outline-none"
                  />
                  <ChevronDown className="w-3.5 h-3.5 text-komazi-muted absolute right-2.5 top-2 pointer-events-none" />
                </div>

                {/* Dropdown */}
                {isCustomerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-komazi-surface border border-komazi-border rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c.id, c.name);
                            setCustomerSearch('');
                            setIsCustomerDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-komazi-surface-2 transition-colors text-left group"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-komazi-text truncate group-hover:text-komazi-coral">
                              {c.name}
                            </p>
                            <p className="text-[10px] text-komazi-muted">
                              {c.phone} • {c.points} poin
                            </p>
                          </div>
                          <span className={`shrink-0 ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            tierColors[c.tier] || tierColors.SILVER
                          }`}>
                            {c.tier}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-center">
                        <p className="text-xs text-komazi-muted">
                          {customerSearch
                            ? `"${customerSearch}" — akan dicatat sebagai tamu`
                            : 'Tidak ada pelanggan terdaftar'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* Attached Workspace Session Banner (if bundled) */}
        {attachedWorkspaceSession && (
          <div className="p-3 rounded-xl bg-komazi-teal/15 border border-komazi-teal/40 space-y-1 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-komazi-teal-light text-xs font-bold">
                <Laptop className="w-4 h-4" />
                <span>WORKSPACE: {attachedWorkspaceSession.areaName}</span>
              </div>
              <button
                onClick={clearWorkspaceSession}
                title="Lepas sesi workspace"
                className="text-komazi-muted hover:text-danger p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-komazi-muted">
              {attachedWorkspaceSession.packageName} • {attachedWorkspaceSession.customerName}
            </p>
            <div className="flex justify-between items-center pt-1 font-mono font-bold text-xs text-komazi-teal-light">
              <span>Tarif Sesi:</span>
              <span>{formatRupiah(attachedWorkspaceSession.charge)}</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-komazi-muted space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-center text-komazi-muted/60">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-sm text-komazi-text">Keranjang Kosong</p>
              <p className="text-xs text-komazi-muted mt-1">
                Pilih menu di samping{hasKeyboard && <> atau tekan <kbd className="bg-komazi-surface-2 px-1.5 py-0.5 rounded border text-[10px]">F2</kbd> untuk mencari</>}
              </p>
            </div>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.key}
              className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2 group transition-colors hover:border-komazi-muted/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-semibold text-xs text-komazi-text leading-tight">
                      {item.name}
                    </h4>
                  </div>
                  {item.variant && (
                    <span className="inline-block mt-0.5 text-[10px] font-semibold text-komazi-coral bg-komazi-coral-soft px-1.5 py-0.2 rounded">
                      {item.variant.name}
                    </span>
                  )}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <p className="text-[10px] text-komazi-teal-light mt-0.5">
                      +{item.modifiers.map((m) => m.name).join(', ')}
                    </p>
                  )}
                  {item.note && (
                    <p className="text-[10px] text-komazi-muted italic mt-0.5">
                      "{item.note}"
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="opacity-40 group-hover:opacity-100 text-komazi-muted hover:text-danger p-1 transition-opacity"
                  title="Hapus item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Price & Qty Controls */}
              <div className="flex items-center justify-between pt-1 border-t border-komazi-border/50">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs text-komazi-coral tabular-nums">
                    {formatRupiah(item.lineTotal)}
                  </span>
                  {item.isDynamicPrice && (
                    <button
                      type="button"
                      onClick={() => setEditingDynamicItem(item)}
                      className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 transition-colors border border-amber-500/20"
                      title="Ubah harga dinamis menu ini"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-komazi-surface border border-komazi-border rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => updateItemQty(item.key, item.qty - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-komazi-surface-2 text-komazi-text hover:bg-komazi-border transition-colors active:scale-95"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold font-mono text-komazi-text">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateItemQty(item.key, item.qty + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-md bg-komazi-surface-2 text-komazi-text hover:bg-komazi-border transition-colors active:scale-95"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Summary & Financial Breakdown */}
      <div className="p-3.5 border-t border-komazi-border bg-komazi-surface/95 space-y-2.5">
        {/* Discount button trigger */}
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setTempDiscountType(discountType);
              setTempDiscountVal(discountValue);
              setIsDiscountOpen(!isDiscountOpen);
            }}
            className="flex items-center gap-1.5 text-komazi-teal-light font-semibold hover:underline"
          >
            <Percent className="w-3.5 h-3.5" />
            <span>
              {summary.discountAmount > 0
                ? `Diskon Aktif: -${formatRupiah(summary.discountAmount)}`
                : 'Tambah Diskon / Promo'}
            </span>
          </button>

          {!isEmpty && (
            <button
              type="button"
              onClick={() => setIsClearConfirmOpen(true)}
              className="text-[11px] text-komazi-muted hover:text-danger hover:underline transition-colors flex items-center gap-1 active:scale-95"
              title="Kosongkan seluruh item pesanan dari keranjang"
            >
              <Trash2 className="w-3 h-3" />
              <span>Kosongkan</span>
            </button>
          )}
        </div>

        {/* Discount Popover Box */}
        {isDiscountOpen && (
          <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2.5 animate-in fade-in">
            {/* Opsi Tukar Poin Loyalty Member */}
            {selectedCustomerObj && selectedCustomerObj.points > 0 && (
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> Poin Member: {selectedCustomerObj.points} Pts
                  </span>
                  <span className="text-[10px] text-komazi-muted">1 Poin = Rp 1.000</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-komazi-text font-medium">
                    Maks Potongan: <b className="text-amber-400 font-mono">{formatRupiah(Math.min(summary.subtotal, selectedCustomerObj.points * 1000))}</b>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const maxPointsNeeded = Math.ceil(summary.subtotal / 1000);
                      const pointsToUse = Math.min(selectedCustomerObj.points, maxPointsNeeded);
                      handleRedeemLoyaltyPoints(pointsToUse);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all shadow-sm active:scale-95 flex items-center gap-1 ${
                      redeemedPoints > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    <Gift className="w-3 h-3" />
                    <span>{redeemedPoints > 0 ? `${redeemedPoints} Pts Terpasang ✓` : 'Tukar Poin'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTempDiscountType('NOMINAL')}
                className={`flex-1 py-1 text-xs rounded-lg font-semibold ${
                  tempDiscountType === 'NOMINAL'
                    ? 'bg-komazi-teal text-white'
                    : 'bg-komazi-surface text-komazi-muted'
                }`}
              >
                Rupiah (Rp)
              </button>
              <button
                type="button"
                onClick={() => setTempDiscountType('PERCENT')}
                className={`flex-1 py-1 text-xs rounded-lg font-semibold ${
                  tempDiscountType === 'PERCENT'
                    ? 'bg-komazi-teal text-white'
                    : 'bg-komazi-surface text-komazi-muted'
                }`}
              >
                Persen (%)
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={tempDiscountVal}
                onChange={(e) => setTempDiscountVal(e.target.value)}
                onFocus={scrollInputIntoViewOnFocus}
                placeholder={tempDiscountType === 'PERCENT' ? 'Contoh: 10' : 'Contoh: 15000'}
                className="flex-1 rounded-lg bg-komazi-surface border border-komazi-border px-2.5 py-1 text-xs text-komazi-text font-mono"
              />
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="px-3 py-1 bg-komazi-teal hover:bg-komazi-teal-light text-white text-xs font-bold rounded-lg"
              >
                Terapkan
              </button>
            </div>
          </div>
        )}

        {/* Calculation breakdown */}
        <div className="space-y-1 text-xs text-komazi-muted pt-1 border-t border-komazi-border/50">
          <div className="flex justify-between">
            <span>Subtotal ({summary.totalQty} item):</span>
            <span className="font-mono text-komazi-text tabular-nums">
              {formatRupiah(summary.subtotal)}
            </span>
          </div>

          {summary.discountAmount > 0 && (
            <div className="flex justify-between text-success">
              <span>Potongan Diskon{redeemedPoints > 0 ? ' (Poin Member)' : ''}:</span>
              <span className="font-mono tabular-nums">
                -{formatRupiah(summary.discountAmount)}
              </span>
            </div>
          )}

          {settings.serviceFeeEnabled && (
            <div className="flex justify-between">
              <span>Service Fee ({settings.serviceFeePercentage}%):</span>
              <span className="font-mono text-komazi-text tabular-nums">
                {formatRupiah(summary.serviceFee)}
              </span>
            </div>
          )}

          {settings.taxEnabled && (
            <div className="flex justify-between">
              <span>PB1 / PPN ({settings.taxPercentage}%):</span>
              <span className="font-mono text-komazi-text tabular-nums">
                {formatRupiah(summary.tax)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-2 border-t border-komazi-border text-sm">
            <span className="font-bold text-komazi-text">TOTAL AKHIR:</span>
            <span className="font-display font-black text-xl text-komazi-coral tabular-nums font-mono">
              {formatRupiah(summary.grandTotal)}
            </span>
          </div>
        </div>

        {/* 4. Action Buttons */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={isEmpty || !hasActiveShift}
              onClick={() => {
                if (!hasActiveShift) {
                  toast.error('Buka sesi kasir terlebih dahulu!');
                  return;
                }
                if (isAttendanceBlocked) {
                  toast.error('Anda wajib melakukan presensi terlebih dahulu sebelum dapat menyimpan pesanan.');
                  setShowVerifyModal(true);
                  return;
                }
                if (isEditingOpenBill) {
                  const label = tableNo ? `Meja ${tableNo} - ${customerName || 'Tamu'}` : (customerName || '');
                  saveCurrentAsOpenBill(label);
                  toast.success(`Perubahan pesanan berhasil disimpan ke KDS!`);
                } else {
                  setIsHoldBillPromptOpen(true);
                }
              }}
              title={
                !hasActiveShift
                  ? 'Wajib buka sesi kasir terlebih dahulu'
                  : isEditingOpenBill
                  ? 'Simpan perubahan pesanan ke dapur/bar'
                  : 'Simpan pesanan sementara (Bayar Nanti)'
              }
              className={`flex items-center justify-center gap-1 p-2 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                isEditingOpenBill
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-muted/50'
              }`}
            >
              <BookmarkCheck className={`w-3.5 h-3.5 shrink-0 ${isEditingOpenBill ? 'text-amber-400' : 'text-komazi-teal-light'}`} />
              <span className="truncate">{isEditingOpenBill ? 'Simpan' : 'Hold'}</span>
            </button>

            <button
              type="button"
              disabled={isEmpty || items.length === 0 || !hasActiveShift}
              onClick={onOpenSplitBill}
              title={!hasActiveShift ? 'Wajib buka sesi kasir terlebih dahulu' : 'Pisah tagihan pembayaran'}
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 text-[11px] sm:text-xs font-semibold"
            >
              <Split className="w-3.5 h-3.5 text-komazi-coral shrink-0" />
              <span className="truncate">Split</span>
            </button>

            <button
              type="button"
              disabled={!isEditingOpenBill || candidateBillsCount === 0 || !hasActiveShift}
              onClick={onOpenMergeBill}
              title={
                !hasActiveShift
                  ? 'Wajib buka sesi kasir terlebih dahulu'
                  : !isEditingOpenBill
                  ? 'Buka dan lanjutkan pesanan hold bill terlebih dahulu untuk menggabungkan tagihan'
                  : candidateBillsCount === 0
                  ? 'Tidak ada tagihan tertahan lain untuk digabungkan'
                  : `Gabung tagihan (${candidateBillsCount} tagihan tersedia)`
              }
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-teal/50 hover:bg-komazi-teal/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 text-[11px] sm:text-xs font-semibold"
            >
              <GitMerge className="w-3.5 h-3.5 text-komazi-teal-light shrink-0" />
              <span className="truncate">Gabung</span>
              {isEditingOpenBill && candidateBillsCount > 0 && (
                <span className="px-1 py-0.2 rounded-full bg-komazi-teal/20 text-komazi-teal-light text-[9px] font-bold">
                  {candidateBillsCount}
                </span>
              )}
            </button>
          </div>

          {/* Schedule Blocked Alert in Cart */}
          {isScheduleBlocked && (
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Jadwal kerja belum diatur. Transaksi tidak diizinkan.</span>
            </div>
          )}

          <button
            type="button"
            disabled={isEmpty || !hasActiveShift || isScheduleBlocked || isAttendanceBlocked}
            onClick={() => {
              if (isScheduleBlocked) {
                toast.error('Jadwal kerja Anda belum diatur untuk hari ini. Silakan hubungi Owner atau Manajer.');
                return;
              }
              if (isAttendanceBlocked) {
                toast.error('Anda wajib melakukan presensi terlebih dahulu sebelum dapat bertransaksi pada sesi ini.');
                setShowVerifyModal(true);
                return;
              }
              if (!hasActiveShift) {
                toast.error('Wajib buka sesi kasir terlebih dahulu');
                return;
              }
              onOpenPayment();
            }}
            title={
              isScheduleBlocked
                ? 'Jadwal kerja Anda belum diatur untuk hari ini'
                : isAttendanceBlocked
                ? 'Presensi kehadiran diperlukan sebelum bertransaksi'
                : !hasActiveShift
                ? 'Wajib buka sesi kasir terlebih dahulu sebelum bayar'
                : undefined
            }
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] ${
              isScheduleBlocked || isAttendanceBlocked
                ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
                : 'bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-komazi-coral/20 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <CreditCard className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isScheduleBlocked
                ? 'Jadwal Belum Diatur'
                : isAttendanceBlocked
                ? 'Presensi Diperlukan'
                : `BAYAR${hasKeyboard ? ' (F9)' : ''}`}
            </span>
          </button>
        </div>
      </div>

      {/* Custom Hold Bill Prompt Modal */}
      <PromptModal
        isOpen={isHoldBillPromptOpen}
        onClose={() => setIsHoldBillPromptOpen(false)}
        onConfirm={handleConfirmHoldBill}
        title="Simpan Pesanan"
        message="Beri catatan nama pelanggan atau nomor meja untuk tagihan tertahan ini:"
        placeholder="Contoh: Mardiah (Meja 02)"
        defaultValue={customerName ? `${customerName} (Meja ${tableNo || '-'})` : `Meja ${tableNo || 'Takeaway'}`}
        confirmText="Simpan Bill"
        icon={BookmarkCheck}
      />

      {/* Clear Cart Confirmation Modal */}
      <AlertModal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={() => {
          clearCart();
          setIsClearConfirmOpen(false);
          toast.info('Keranjang pesanan telah dikosongkan');
        }}
        type="danger"
        title="Kosongkan Keranjang?"
        message="Seluruh item pesanan yang telah dipilih akan dihapus dari keranjang. Anda yakin ingin mengosongkannya?"
        confirmText="Ya, Kosongkan"
        cancelText="Batal"
      />

      {/* Attendance Verification Modal */}
      <AttendanceVerificationModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onSuccess={async () => {
          setShowVerifyModal(false);
          await fetchMyTodaySchedule?.();
          if (user?.id) await fetchTodayAttendance?.(user.id);
          toast.success('Presensi berhasil diverifikasi! Anda siap melayani transaksi.');
        }}
      />

      {/* Dynamic Price Edit Modal */}
      {editingDynamicItem && (
        <DynamicPriceModal
          product={editingDynamicItem}
          initialPrice={editingDynamicItem.baseCustomPrice || editingDynamicItem.unitPrice}
          initialVariant={editingDynamicItem.variant}
          initialModifiers={editingDynamicItem.modifiers}
          initialNote={editingDynamicItem.note}
          isEditMode={true}
          onClose={() => setEditingDynamicItem(null)}
          onSubmit={({ customPrice, note }) => {
            updateItemPrice(editingDynamicItem.key, customPrice);
            if (note !== undefined && note !== editingDynamicItem.note) {
              updateItemNote(editingDynamicItem.key, note);
            }
            toast.success(`Harga ${editingDynamicItem.name} diperbarui ke ${formatRupiah(customPrice)}!`);
            setEditingDynamicItem(null);
          }}
        />
      )}
    </aside>
  );
}
