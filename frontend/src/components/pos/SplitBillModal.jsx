import React, { useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useOrdersStore } from '../../store/ordersStore';
import { formatRupiah } from '../../utils/format';
import {
  Split,
  Users,
  CheckSquare,
  Square,
  ArrowRight,
  X,
  CreditCard,
  Plus,
  Minus,
  CheckCheck,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { toast } from '../../store/toastStore';

export default function SplitBillModal({ onClose, onProceedPayment }) {
  const { items, getCartSummary } = useCartStore();

  const [mode, setMode] = useState('items'); // 'items' | 'equal'
  const [selectedQtys, setSelectedQtys] = useState({});
  const [splitCount, setSplitCount] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const summary = getCartSummary();

  // Helper untuk mendapatkan key unik stabil untuk tiap item
  const getItemKey = (item, index) => {
    return (
      item.key ||
      `${item.productId || item.id || 'item'}_${item.variant?.name || item.variant?.id || 'none'}_${item.note || ''}_${index}`
    );
  };

  // Toggle checklist item (jika 0 -> full qty, jika > 0 -> 0)
  const toggleSelectItem = (itemKey, maxQty) => {
    if (isSubmitting) return;
    setSelectedQtys((prev) => {
      const current = prev[itemKey] || 0;
      return {
        ...prev,
        [itemKey]: current > 0 ? 0 : maxQty,
      };
    });
  };

  // Stepper: tambah kuantiti Batch 1
  const handleIncreaseQty = (e, itemKey, maxQty) => {
    e.stopPropagation();
    if (isSubmitting) return;
    setSelectedQtys((prev) => {
      const current = prev[itemKey] || 0;
      return {
        ...prev,
        [itemKey]: Math.min(maxQty, current + 1),
      };
    });
  };

  // Stepper: kurangi kuantiti Batch 1
  const handleDecreaseQty = (e, itemKey) => {
    e.stopPropagation();
    if (isSubmitting) return;
    setSelectedQtys((prev) => {
      const current = prev[itemKey] || 0;
      return {
        ...prev,
        [itemKey]: Math.max(0, current - 1),
      };
    });
  };

  // Pintasan: Pilih Semua
  const handleSelectAll = () => {
    if (isSubmitting) return;
    const allSelected = {};
    items.forEach((item, index) => {
      const key = getItemKey(item, index);
      allSelected[key] = Number(item.qty) || 1;
    });
    setSelectedQtys(allSelected);
  };

  // Pintasan: Kosongkan Pilihan
  const handleDeselectAll = () => {
    if (isSubmitting) return;
    setSelectedQtys({});
  };

  // Hitung pembagian item Batch 1 vs Batch 2 (Sisa)
  const batch1Items = [];
  const remainingItems = [];

  items.forEach((item, index) => {
    const key = getItemKey(item, index);
    const itemQty = Number(item.qty) || 1;
    const unitPrice = Number(item.unitPrice) || 0;
    const chosenQty = Math.max(0, Math.min(itemQty, selectedQtys[key] || 0));
    const leftQty = itemQty - chosenQty;

    if (chosenQty > 0) {
      batch1Items.push({
        ...item,
        key: item.key || key,
        qty: chosenQty,
        lineTotal: chosenQty * unitPrice,
      });
    }

    if (leftQty > 0) {
      remainingItems.push({
        ...item,
        key: `${item.key || key}_split_rem`,
        qty: leftQty,
        lineTotal: leftQty * unitPrice,
      });
    }
  });

  const selectedSubtotal = batch1Items.reduce((sum, i) => sum + i.lineTotal, 0);
  const remainingSubtotal = remainingItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const totalSelectedPortions = batch1Items.reduce((sum, i) => sum + i.qty, 0);
  const totalRemainingPortions = remainingItems.reduce((sum, i) => sum + i.qty, 0);

  const isNoneSelected = batch1Items.length === 0;
  const isAllSelected = items.length > 0 && remainingItems.length === 0;

  // Eksekusi Split Bill
  const handleProceedItemSplit = async () => {
    if (isSubmitting) return;

    if (isNoneSelected) {
      toast.error('Pilih setidaknya 1 item / porsi untuk pembayaran pertama');
      return;
    }

    // Jika seluruh item terpilih (100%), arahkan langsung ke pembayaran normal
    if (isAllSelected) {
      toast.info('Seluruh menu dipilih, melanjutkan pembayaran normal.');
      onProceedPayment();
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const cartState = useCartStore.getState();
      const splitBillId = `${Date.now()}`;
      const rawTableNo = (cartState.tableNo || '').trim();
      const resolvedTableLabel = rawTableNo && rawTableNo !== '-' ? `Meja ${rawTableNo}` : 'Takeaway';
      const splitLabel = `${resolvedTableLabel} (Sisa Split Bill)`;

      const splitOpenBill = {
        id: `SPLIT-${splitBillId}`,
        billId: splitBillId,
        label: splitLabel,
        items: remainingItems,
        orderType: cartState.orderType,
        tableNo: rawTableNo,
        customerName: cartState.customerName,
        discountType: cartState.discountType,
        discountValue: 0,
        savedAt: new Date().toISOString(),
        total: remainingSubtotal,
      };

      // 1. Simpan sisa tagihan (Batch 2) langsung ke backend/KDS sebagai hold order
      //    Gunakan await agar ID order backend & nomor invoice didapatkan secara sinkron
      const savedHold = await useOrdersStore.getState().createHoldOrder({
        ...splitOpenBill,
        backendOrderId: null,
        label: splitLabel,
        type: splitOpenBill.orderType,
        tableNo: rawTableNo || null,
        customerName: cartState.customerName || 'Tamu',
        items: splitOpenBill.items.map((i) => ({
          productId: Number(i.productId || i.id),
          productName: i.name,
          name: i.name,
          categoryName: i.categoryName || null,
          variantName: i.variant?.name || i.variantName || null,
          modifiers: i.modifiers?.map((m) => m.name || m).join(', ') || null,
          qty: Number(i.qty) || 1,
          unitPrice: Number(i.unitPrice) || 0,
          lineTotal: Number(i.lineTotal) || 0,
          note: i.note || null,
        })),
      });

      if (savedHold) {
        const actualBackendId =
          savedHold.backendOrderId ||
          (typeof savedHold.id === 'number' && savedHold.id < 1000000000000 ? savedHold.id : null);
        if (actualBackendId) {
          splitOpenBill.backendOrderId = actualBackendId;
          splitOpenBill.id = `BILL-${actualBackendId}`;
        }
        if (savedHold.invoiceNo) {
          splitOpenBill.invoiceNo = savedHold.invoiceNo;
        }
      }

      // 2. Simpan Batch 1 ke keranjang lokal aktif untuk segera dibayar,
      //    dan simpan sisa (Batch 2) ke daftar Open Bills
      useCartStore.setState((state) => ({
        items: batch1Items,
        openBills: [
          splitOpenBill,
          ...state.openBills.filter((b) =>
            b.id !== splitOpenBill.id &&
            b.billId !== splitOpenBill.billId &&
            (!splitOpenBill.backendOrderId || b.backendOrderId !== splitOpenBill.backendOrderId)
          ),
        ],
      }));

      toast.success('Sisa tagihan (Batch 2) berhasil disimpan ke Open Bills & KDS!');
      onProceedPayment();
      onClose();
    } catch (err) {
      console.error('[SplitBill] Error saving Batch 2 hold order:', err);
      toast.error('Gagal menyimpan sisa tagihan: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mode: Bagi Rata (Equal Split)
  const count = Math.max(2, Number(splitCount) || 2);
  const equalAmount = Math.ceil(summary.grandTotal / count);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="min-h-full flex items-center justify-center">
        <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-komazi-border shrink-0 bg-komazi-surface">
            <div className="flex items-center gap-2">
              <Split className="w-5 h-5 text-komazi-coral" />
              <h3 className="font-bold text-base text-komazi-text">Pisah Tagihan (Split Bill)</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-komazi-muted hover:text-white rounded-lg hover:bg-komazi-surface-2 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Selector */}
          <div className="flex border-b border-komazi-border bg-komazi-surface-2/50 p-2 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMode('items')}
              disabled={isSubmitting}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'items'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Pisah per Menu / Qty</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('equal')}
              disabled={isSubmitting}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'equal'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Bagi Rata (Equal Split)</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mode === 'items' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-komazi-muted leading-relaxed">
                    Pilih menu dan atur jumlah kuantiti yang akan dibayar pada <strong>Batch 1</strong>.
                  </p>
                  {/* Pintasan Pilih Semua / Kosongkan */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      disabled={isSubmitting}
                      className="px-2 py-1 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-[11px] font-semibold text-komazi-text flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-komazi-coral" />
                      <span>Semua</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      disabled={isSubmitting}
                      className="px-2 py-1 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-[11px] font-semibold text-komazi-muted hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Kosongkan</span>
                    </button>
                  </div>
                </div>

                {/* List Item */}
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const itemKey = getItemKey(item, index);
                    const itemQty = Number(item.qty) || 1;
                    const chosenQty = selectedQtys[itemKey] || 0;
                    const isChecked = chosenQty > 0;

                    return (
                      <div
                        key={itemKey}
                        onClick={() => toggleSelectItem(itemKey, itemQty)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-komazi-coral/10 border-komazi-coral shadow-sm'
                            : 'bg-komazi-surface-2 border-komazi-border hover:border-komazi-muted/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          {/* Checkbox & Item Info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 text-komazi-coral">
                              {isChecked ? (
                                <CheckSquare className="w-5 h-5 text-komazi-coral" />
                              ) : (
                                <Square className="w-5 h-5 text-komazi-muted" />
                              )}
                            </div>
                            <div className="truncate">
                              <p className="font-bold text-xs text-komazi-text truncate">
                                {item.name}
                              </p>
                              <p className="text-[11px] text-komazi-muted truncate">
                                Total: {itemQty}x • {formatRupiah(item.unitPrice)}
                                {item.variant ? ` (${item.variant.name})` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Stepper Qty (jika item.qty > 1) & Harga */}
                          <div className="flex items-center gap-3 shrink-0">
                            {itemQty > 1 && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center bg-komazi-surface border border-komazi-border rounded-lg p-0.5"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => handleDecreaseQty(e, itemKey)}
                                  disabled={chosenQty <= 0 || isSubmitting}
                                  className="w-6 h-6 flex items-center justify-center rounded text-komazi-muted hover:text-white disabled:opacity-30 disabled:hover:text-komazi-muted hover:bg-komazi-surface-2 transition-colors"
                                  title="Kurangi qty"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-8 text-center text-xs font-mono font-bold text-komazi-text">
                                  {chosenQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleIncreaseQty(e, itemKey, itemQty)}
                                  disabled={chosenQty >= itemQty || isSubmitting}
                                  className="w-6 h-6 flex items-center justify-center rounded text-komazi-muted hover:text-white disabled:opacity-30 disabled:hover:text-komazi-muted hover:bg-komazi-surface-2 transition-colors"
                                  title="Tambah qty"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Subtotal Item */}
                            <div className="text-right min-w-[70px]">
                              <p
                                className={`font-mono text-xs font-bold ${
                                  isChecked ? 'text-komazi-coral' : 'text-komazi-muted'
                                }`}
                              >
                                {isChecked
                                  ? formatRupiah(chosenQty * (Number(item.unitPrice) || 0))
                                  : formatRupiah(Number(item.lineTotal) || itemQty * Number(item.unitPrice))}
                              </p>
                              {itemQty > 1 && isChecked && (
                                <p className="text-[10px] text-komazi-muted">
                                  {chosenQty} dari {itemQty} pcs
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Split Summary */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-komazi-coral/10 border border-komazi-coral/30">
                    <p className="text-[10px] uppercase font-bold text-komazi-coral">
                      Bayar Sekarang (Batch 1)
                    </p>
                    <p className="text-base font-black font-mono text-komazi-coral mt-1">
                      {formatRupiah(selectedSubtotal)}
                    </p>
                    <p className="text-[10px] text-komazi-muted">
                      {batch1Items.length} menu ({totalSelectedPortions} porsi)
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                    <p className="text-[10px] uppercase font-bold text-komazi-muted">
                      Sisa Tagihan (Batch 2)
                    </p>
                    <p className="text-base font-black font-mono text-komazi-text mt-1">
                      {formatRupiah(remainingSubtotal)}
                    </p>
                    <p className="text-[10px] text-komazi-muted">
                      {remainingItems.length} menu ({totalRemainingPortions} porsi)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Equal split */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center space-y-2">
                  <p className="text-xs text-komazi-muted">Total Tagihan Saat Ini:</p>
                  <p className="text-2xl font-black font-mono text-komazi-coral">
                    {formatRupiah(summary.grandTotal)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5">
                    Bagi untuk berapa orang?
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSplitCount(n)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                          splitCount === n
                            ? 'bg-komazi-coral text-white border-komazi-coral'
                            : 'bg-komazi-surface-2 text-komazi-text border-komazi-border hover:bg-komazi-border'
                        }`}
                      >
                        {n} Orang
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-komazi-teal/15 border border-komazi-teal-light/30 space-y-1">
                  <div className="flex justify-between items-center text-xs text-komazi-muted">
                    <span>Nominal per Orang:</span>
                    <span className="font-bold text-komazi-teal-light">
                      ({summary.grandTotal.toLocaleString()} ÷ {count})
                    </span>
                  </div>
                  <p className="text-xl font-black font-mono text-komazi-teal-light">
                    {formatRupiah(equalAmount)} <span className="text-xs font-normal">/ orang</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-komazi-border bg-komazi-surface flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs transition-colors disabled:opacity-50"
            >
              Batal
            </button>

            {mode === 'items' ? (
              isAllSelected ? (
                <button
                  type="button"
                  onClick={handleProceedItemSplit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Bayar Penuh / Normal</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleProceedItemSplit}
                  disabled={isNoneSelected || isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan sisa tagihan...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {isNoneSelected
                          ? 'Pilih Minimal 1 Menu'
                          : `Bayar Batch 1 (${formatRupiah(selectedSubtotal)})`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  toast.info(`Bagi rata Rp ${formatRupiah(equalAmount)} per orang dicatat.`);
                  onProceedPayment();
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-colors"
              >
                Lanjut ke Pembayaran
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
