import React from 'react';
import {
  X,
  Clock,
  User,
  Store,
  ShoppingBag,
  RotateCcw,
  CheckCircle2,
  FileText,
  Coffee,
  Utensils,
  Receipt,
  Printer,
} from 'lucide-react';
import { formatDateTime, formatTime, formatOrderType, isDrinkItem } from '../../utils/format';

/**
 * Modal detail pesanan riwayat KDS/BDS
 * Menampilkan rincian seluruh item pesanan, varian, catatan, dan tombol Recall langsung
 */
export default function KdsOrderDetailModal({
  isOpen,
  onClose,
  order,
  station = 'ALL',
  onRecall,
  onPrint,
  canBump = true,
}) {
  if (!isOpen || !order) return null;

  const items = order.items || [];
  const isDineIn = (order.orderType || '').toUpperCase() === 'DINE_IN';
  const tableOrCust = order.tableNo || order.tableNumber ? `Meja ${order.tableNo || order.tableNumber}` : order.customerName || 'Pelanggan';

  // Pisahkan item berdasarkan stasiun jika relevan
  const drinkItems = items.filter((i) => i.station?.type === 'BAR' || isDrinkItem(i));
  const foodItems = items.filter((i) => !(i.station?.type === 'BAR' || isDrinkItem(i)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-komazi-surface rounded-2xl border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-komazi-border bg-komazi-surface-2/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-black text-base sm:text-lg text-komazi-text">
                  {order.invoiceNo || `#${order.id}`}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isDineIn
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isDineIn ? <Store className="w-2.5 h-2.5" /> : <ShoppingBag className="w-2.5 h-2.5" />}
                  <span>{formatOrderType(order.orderType)}</span>
                </span>
              </div>
              <p className="text-xs text-komazi-muted mt-0.5">
                Dibuat: {formatDateTime(order.createdAt)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-komazi-surface hover:bg-komazi-border text-komazi-muted hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup Detail"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Pelanggan & Meja */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-komazi-surface-2/30 border-b border-komazi-border text-xs">
          <div className="flex items-center gap-2 text-komazi-text">
            <Store className="w-3.5 h-3.5 text-komazi-coral shrink-0" />
            <span className="text-komazi-muted">Lokasi:</span>
            <span className="font-bold">{tableOrCust}</span>
          </div>
          <div className="flex items-center gap-2 text-komazi-text">
            <User className="w-3.5 h-3.5 text-komazi-teal-light shrink-0" />
            <span className="text-komazi-muted">Pelanggan:</span>
            <span className="font-bold truncate">{order.customerName || '-'}</span>
          </div>
          <div className="flex items-center gap-2 text-komazi-text">
            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="text-komazi-muted">Waktu Masuk:</span>
            <span className="font-mono">{formatTime(order.createdAt)} WIB</span>
          </div>
          <div className="flex items-center gap-2 text-komazi-text">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-komazi-muted">Status:</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              SELESAI (SERVED)
            </span>
          </div>
        </div>

        {/* Catatan Keseluruhan Pesanan */}
        {order.notes && (
          <div className="p-3 mx-4 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
            <FileText className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Catatan Pesanan: </span>
              <span>{order.notes}</span>
            </div>
          </div>
        )}

        {/* Daftar Item Pesanan */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <h4 className="text-xs font-bold text-komazi-muted uppercase tracking-wider">
            Rincian Menu ({items.length} Item)
          </h4>

          <div className="space-y-2">
            {items.map((item, idx) => {
              const isDrink = item.station?.type === 'BAR' || isDrinkItem(item);
              const qty = Number(item.qty || item.quantity) || 1;
              const name = item.productName || item.name || item.product?.name || 'Item';

              return (
                <div
                  key={item.id || idx}
                  className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border/80 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="px-2 py-0.5 rounded-lg bg-komazi-coral text-white font-mono font-black text-xs shrink-0">
                      {qty}x
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-komazi-text text-sm">{name}</span>
                        {item.variantName && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700 font-medium">
                            {item.variantName}
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${
                            isDrink
                              ? 'bg-komazi-teal/15 text-komazi-teal-light border border-komazi-teal/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isDrink ? <Coffee className="w-2.5 h-2.5" /> : <Utensils className="w-2.5 h-2.5" />}
                          <span>{isDrink ? 'BAR' : 'KITCHEN'}</span>
                        </span>
                      </div>

                      {/* Catatan Khusus Item / Modifiers */}
                      {(item.note || item.notes) && (
                        <p className="text-[11px] text-amber-400 mt-1 italic flex items-center gap-1">
                          <span>• Catatan:</span> {item.note || item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      Disajikan
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Modal dengan Tombol Aksi */}
        <div className="p-4 border-t border-komazi-border bg-komazi-surface-2/80 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-komazi-surface hover:bg-komazi-border text-komazi-text text-xs font-bold border border-komazi-border transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {onPrint && (
              <button
                type="button"
                onClick={() => onPrint(order)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                title="Cetak Tiket Pesanan / Struk"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Tiket / Struk</span>
              </button>
            )}

            {canBump && onRecall && (
              <button
                type="button"
                onClick={() => {
                  onRecall(order.id, station);
                  onClose();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-black font-black text-xs transition-all shadow-md cursor-pointer"
                title="Kembalikan tiket ini ke antrean produksi aktif dapur/bar"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kembalikan ke Antrean (Recall)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
