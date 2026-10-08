import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHasPhysicalKeyboard } from '../hooks/useHasPhysicalKeyboard';
import { usePosStore } from '../store/posStore';
import { useCartStore } from '../store/cartStore';
import { useUiStore } from '../store/uiStore';
import { formatRupiah } from '../utils/format';
import ProductCard from '../components/pos/ProductCard';
import ProductVariantModal from '../components/pos/ProductVariantModal';
import CartSidebar from '../components/pos/CartSidebar';
import PaymentModal from '../components/pos/PaymentModal';
import ThermalReceiptModal from '../components/pos/ThermalReceiptModal';
import SplitBillModal from '../components/pos/SplitBillModal';
import OpenBillsModal from '../components/pos/OpenBillsModal';
import { Search, Sparkles, Filter, X, ShoppingBag, ArrowRight, FileText } from 'lucide-react';

export default function PosPage() {
  const {
    products,
    categories,
    selectedCategoryId,
    searchQuery,
    setSelectedCategoryId,
    setSearchQuery,
  } = usePosStore();

  const { items, addItem, getCartSummary, attachedWorkspaceSession, openBills, syncOpenBillsWithBackendOrders } = useCartStore();
  const { isMobileCartOpen, setMobileCartOpen, toggleMobileCart } = useUiStore();

  const [activeModalProduct, setActiveModalProduct] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [isOpenBillsOpen, setIsOpenBillsOpen] = useState(false);
  const [completedOrderReceipt, setCompletedOrderReceipt] = useState(null);

  useEffect(() => {
    if (typeof syncOpenBillsWithBackendOrders === 'function') {
      syncOpenBillsWithBackendOrders();
    }
  }, [syncOpenBillsWithBackendOrders]);

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
        if (summary.grandTotal > 0) {
          setIsPaymentOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [summary.grandTotal, hasKeyboard]);

  // Handle product click
  const handleSelectProduct = (product) => {
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

          {/* Quick Hold Bill button for mobile header */}
          <button
            type="button"
            onClick={() => setIsOpenBillsOpen(true)}
            className={`lg:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold shrink-0 relative active:scale-95 transition-all ${
              openBills.length > 0
                ? 'bg-komazi-coral-soft border-komazi-coral/40 text-komazi-coral animate-pulse'
                : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-white'
            }`}
            title="Daftar Pesanan Tertahan (Hold Bill)"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Hold</span>
            {openBills.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-komazi-coral text-white text-[10px] font-black flex items-center justify-center">
                {openBills.length}
              </span>
            )}
          </button>

          {/* Quick Cart button for mobile header */}
          <button
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
          </button>

          {/* Quick Counter (desktop) */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-muted shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-komazi-coral" />
            <span>
              <strong className="text-komazi-text">{filteredProducts.length}</strong> Menu
            </span>
          </div>
        </div>

        {/* Categories Bar */}
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 min-h-[38px] ${
              selectedCategoryId === 'all'
                ? 'bg-komazi-coral text-white shadow-md shadow-komazi-coral/20'
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
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 min-h-[38px] ${
                  isSelected
                    ? 'bg-komazi-coral text-white shadow-md shadow-komazi-coral/20'
                    : 'bg-komazi-surface text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 border border-komazi-border'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid */}
        <div
          className="flex-1 overflow-y-auto pr-1 pb-24 lg:pb-6 no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-komazi-muted space-y-2">
              <Search className="w-10 h-10 text-komazi-muted/40" />
              <p className="font-semibold text-sm text-komazi-text">Menu Tidak Ditemukan</p>
              <p className="text-xs">Coba kata kunci lain atau pilih kategori Semua.</p>
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

      {/* Floating Bottom Cart Bar for Mobile & Tablet Portrait */}
      {hasCartItems && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-14 left-3 right-3 z-20 animate-in slide-in-from-bottom duration-200">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="w-full p-3.5 rounded-2xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center justify-between shadow-2xl shadow-komazi-coral/30 border border-white/20 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[11px] opacity-90">{summary.totalQty} Produk Dipilih</p>
                <p className="font-mono text-sm font-black tracking-wide">
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
          onOpenPayment={() => setIsPaymentOpen(true)}
          onOpenSplitBill={() => setIsSplitBillOpen(true)}
          onOpenOpenBills={() => setIsOpenBillsOpen(true)}
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
            />
          </div>
        </div>
      )}

      {/* Modals */}
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

      {completedOrderReceipt && (
        <ThermalReceiptModal
          order={completedOrderReceipt}
          onClose={() => setCompletedOrderReceipt(null)}
        />
      )}
    </div>
  );
}
