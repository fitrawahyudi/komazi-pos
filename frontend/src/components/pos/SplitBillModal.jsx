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
  Calculator,
} from 'lucide-react';
import { toast } from '../../store/toastStore';

export default function SplitBillModal({ onClose, onProceedPayment }) {
  const { items, getCartSummary, saveCurrentAsOpenBill, removeItem, addItem, updateItemQty } =
    useCartStore();

  const [mode, setMode] = useState('items'); // 'items' | 'equal'
  const [selectedKeys, setSelectedKeys] = useState({});
  const [splitCount, setSplitCount] = useState(2);
  const [paidSplitRounds, setPaidSplitRounds] = useState([]);

  const summary = getCartSummary();

  // Mode: Split by items
  const toggleSelectItem = (key) => {
    setSelectedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectedItems = items.filter((i) => selectedKeys[i.key]);
  const remainingItems = items.filter((i) => !selectedKeys[i.key]);

  const selectedSubtotal = selectedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const remainingSubtotal = remainingItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const handleProceedItemSplit = () => {
    if (selectedItems.length === 0) {
      toast.error('Pilih setidaknya 1 item untuk pembayaran pertama');
      return;
    }
    if (remainingItems.length === 0) {
      toast.info('Seluruh item dipilih, lakukan pembayaran normal.');
      onProceedPayment();
      onClose();
      return;
    }

    // Save remaining items to open bills
    // First, clear remaining items from current cart so cart only contains selected items
    remainingItems.forEach((rem) => {
      removeItem(rem.key);
    });

    // Auto-save the remaining as open bill and push to KDS
    const cartState = useCartStore.getState();
    const splitBillId = `${Date.now()}`;
    const splitOpenBill = {
      id: `SPLIT-${splitBillId}`,
      billId: splitBillId,
      label: `Sisa Tagihan Meja ${cartState.tableNo || ''} (Split Bill)`,
      items: remainingItems,
      orderType: cartState.orderType,
      tableNo: cartState.tableNo,
      customerName: cartState.customerName,
      discountType: cartState.discountType,
      discountValue: 0,
      savedAt: new Date().toISOString(),
      total: remainingSubtotal,
    };

    useCartStore.setState((state) => ({
      openBills: [splitOpenBill, ...state.openBills],
    }));

    // Otomatis kirim sisa tagihan ke KDS sebagai hold order
    useOrdersStore.getState().createHoldOrder({
      ...splitOpenBill,
      type: splitOpenBill.orderType,
      items: splitOpenBill.items.map((i) => ({
        productId: i.productId,
        productName: i.name,
        name: i.name,
        categoryName: i.categoryName || null,
        variantName: i.variant?.name || null,
        modifiers: i.modifiers?.map((m) => m.name).join(', ') || null,
        qty: i.qty,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        note: i.note || null,
      })),
    }).then((savedHold) => {
      if (savedHold?.id && typeof savedHold.id === 'number') {
        useCartStore.setState((s) => ({
          openBills: s.openBills.map((b) => b.id === splitOpenBill.id ? { ...b, backendOrderId: savedHold.id, invoiceNo: savedHold.invoiceNo } : b)
        }));
      }
    }).catch(() => {});

    toast.success('Sisa tagihan otomatis disimpan ke Open Bills & KDS!');
    onProceedPayment();
    onClose();
  };

  // Mode: Equal Split
  const count = Math.max(2, Number(splitCount) || 2);
  const equalAmount = Math.ceil(summary.grandTotal / count);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border">
          <div className="flex items-center gap-2">
            <Split className="w-5 h-5 text-komazi-coral" />
            <h3 className="font-bold text-base text-komazi-text">Pisah Tagihan (Split Bill)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex border-b border-komazi-border bg-komazi-surface-2/50 p-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('items')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              mode === 'items'
                ? 'bg-komazi-coral text-white shadow-sm'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Pisah per Menu / Item</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('equal')}
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
              <p className="text-xs text-komazi-muted">
                Centang item yang ingin dibayar pada pembayaran gelombang pertama (Batch 1).
                Item yang tidak dicentang otomatis disimpan sebagai <strong>Open Bill</strong> untuk dibayar nanti.
              </p>

              <div className="space-y-2">
                {items.map((item) => {
                  const isChecked = !!selectedKeys[item.key];
                  return (
                    <div
                      key={item.key}
                      onClick={() => toggleSelectItem(item.key)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-komazi-coral/10 border-komazi-coral text-white'
                          : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:border-komazi-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-komazi-coral shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-komazi-muted shrink-0" />
                        )}
                        <div>
                          <p className="font-bold text-xs text-komazi-text">{item.name}</p>
                          <p className="text-[11px] text-komazi-muted">
                            {item.qty}x • {formatRupiah(item.unitPrice)}
                            {item.variant ? ` (${item.variant.name})` : ''}
                          </p>
                        </div>
                      </div>

                      <span className="font-mono text-xs font-bold text-komazi-text">
                        {formatRupiah(item.lineTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Split Summary */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-komazi-coral/10 border border-komazi-coral/30">
                  <p className="text-[10px] uppercase font-bold text-komazi-coral">Bayar Sekarang (Batch 1)</p>
                  <p className="text-base font-black font-mono text-komazi-coral mt-1">
                    {formatRupiah(selectedSubtotal)}
                  </p>
                  <p className="text-[10px] text-komazi-muted">{selectedItems.length} menu dipilih</p>
                </div>
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <p className="text-[10px] uppercase font-bold text-komazi-muted">Sisa Tagihan (Batch 2)</p>
                  <p className="text-base font-black font-mono text-komazi-text mt-1">
                    {formatRupiah(remainingSubtotal)}
                  </p>
                  <p className="text-[10px] text-komazi-muted">{remainingItems.length} menu tersisa</p>
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
            className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
          >
            Batal
          </button>

          {mode === 'items' ? (
            <button
              type="button"
              onClick={handleProceedItemSplit}
              disabled={selectedItems.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark disabled:opacity-50 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
            >
              <span>Bayar Batch 1</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast.info(`Bagi rata Rp ${formatRupiah(equalAmount)} per orang dicatat.`);
                onProceedPayment();
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md"
            >
              Lanjut ke Pembayaran
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
