import React, { useState, useRef, useEffect } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useCustomerStore } from '../../store/customerStore';
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
  UserSearch,
  UserCheck,
  ChevronDown,
  Star,
  FileText,
} from 'lucide-react';
import PromptModal from '../ui/PromptModal';
import { toast } from '../../store/toastStore';
import { useHasPhysicalKeyboard } from '../../hooks/useHasPhysicalKeyboard';

export default function CartSidebar({ onOpenPayment, onOpenOpenBills, onOpenSplitBill, onCloseMobile }) {
  const hasKeyboard = useHasPhysicalKeyboard();
  const {
    items,
    orderType,
    tableNo,
    customerName,
    selectedCustomerId,
    discountType,
    discountValue,
    attachedWorkspaceSession,
    setOrderType,
    setTableNo,
    setCustomerName,
    setSelectedCustomer,
    setDiscount,
    updateItemQty,
    removeItem,
    clearCart,
    clearWorkspaceSession,
    getCartSummary,
    saveCurrentAsOpenBill,
    openBills,
  } = useCartStore();

  const { customers } = useCustomerStore();
  const { settings } = useSettingsStore();
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [tempDiscountType, setTempDiscountType] = useState(discountType);
  const [tempDiscountVal, setTempDiscountVal] = useState(discountValue);
  const [isHoldBillPromptOpen, setIsHoldBillPromptOpen] = useState(false);

  // Customer picker state
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerInputRef = useRef(null);

  // Filter customers based on search
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
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
    setDiscount(tempDiscountType, tempDiscountVal);
    setIsDiscountOpen(false);
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

      {/* 1. Header: Order Type (Dine-in / Take-away) & Inputs */}
      <div className="p-3.5 border-b border-komazi-border space-y-3 bg-komazi-surface/90">
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
                    onFocus={() => setIsCustomerDropdownOpen(true)}
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
                  <h4 className="font-semibold text-xs text-komazi-text leading-tight">
                    {item.name}
                  </h4>
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
                <span className="font-mono font-bold text-xs text-komazi-coral tabular-nums">
                  {formatRupiah(item.lineTotal)}
                </span>

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
              onClick={clearCart}
              className="text-[11px] text-komazi-muted hover:text-danger"
            >
              Kosongkan
            </button>
          )}
        </div>

        {/* Discount Popover Box */}
        {isDiscountOpen && (
          <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2 animate-in fade-in">
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
              <span>Potongan Diskon:</span>
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isEmpty}
              onClick={() => setIsHoldBillPromptOpen(true)}
              title="Simpan pesanan sementara (Bayar Nanti)"
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-komazi-teal-light" />
              <span>Hold Bill</span>
            </button>

            <button
              type="button"
              disabled={isEmpty || items.length === 0}
              onClick={onOpenSplitBill}
              title="Pisah tagihan pembayaran"
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-semibold"
            >
              <Split className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Split Bill</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isEmpty}
            onClick={onOpenPayment}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-sm shadow-lg shadow-komazi-coral/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            <CreditCard className="w-4 h-4 stroke-[2.5]" />
            <span>BAYAR{hasKeyboard ? ' (F9)' : ''}</span>
          </button>
        </div>
      </div>

      {/* Custom Hold Bill Prompt Modal */}
      <PromptModal
        isOpen={isHoldBillPromptOpen}
        onClose={() => setIsHoldBillPromptOpen(false)}
        onConfirm={handleConfirmHoldBill}
        title="Simpan Pesanan (Hold Bill)"
        message="Beri catatan nama pelanggan atau nomor meja untuk tagihan tertahan ini:"
        placeholder="Contoh: Mardiah (Meja 02)"
        defaultValue={customerName ? `${customerName} (Meja ${tableNo || '-'})` : `Meja ${tableNo || 'Takeaway'}`}
        confirmText="Simpan Bill"
        icon={BookmarkCheck}
      />
    </aside>
  );
}
