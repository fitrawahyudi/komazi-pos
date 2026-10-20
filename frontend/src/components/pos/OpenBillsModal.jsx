import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { formatRupiah, formatDateTime, formatOrderType } from '../../utils/format';
import {
  X,
  Clock,
  Play,
  Trash2,
  FileText,
  RotateCcw,
  Eye,
  Receipt,
  ShoppingBag,
} from 'lucide-react';
import Pagination from '../ui/Pagination';

export default function OpenBillsModal({ onClose }) {
  const { openBills, restoreOpenBill, deleteOpenBill, syncOpenBillsWithBackendOrders } = useCartStore();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewingBill, setPreviewingBill] = useState(null);

  // Fungsi reload data pesanan langsung dari backend MySQL
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (typeof syncOpenBillsWithBackendOrders === 'function') {
        await syncOpenBillsWithBackendOrders(true);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [syncOpenBillsWithBackendOrders]);

  // Sinkronisasi otomatis saat modal dibuka & dengar perubahan realtime
  useEffect(() => {
    handleRefresh();

    // Dengar notifikasi pesanan di-update / dibuat / dibatalkan secara realtime
    const handleOrdersUpdated = () => {
      if (typeof syncOpenBillsWithBackendOrders === 'function') {
        syncOpenBillsWithBackendOrders(false);
      }
    };

    window.addEventListener('komazi:orders-updated', handleOrdersUpdated);
    return () => {
      window.removeEventListener('komazi:orders-updated', handleOrdersUpdated);
    };
  }, [handleRefresh, syncOpenBillsWithBackendOrders]);

  const paginatedBills = useMemo(() => {
    const start = (page - 1) * perPage;
    return openBills.slice(start, start + perPage);
  }, [openBills, page, perPage]);

  const handleRestore = (billId) => {
    restoreOpenBill(billId);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="min-h-full flex items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-komazi-border shrink-0 bg-komazi-surface">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base text-komazi-text">
                  Daftar Pesanan Tertahan
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] text-komazi-muted">
                  <span>{openBills.length} Bill Tersimpan</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-semibold text-komazi-muted hover:text-white hover:border-komazi-coral/40 transition-colors disabled:opacity-50 active:scale-95"
                title="Segarkan daftar pesanan dari server"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-komazi-coral' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Memuat...' : 'Segarkan'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white transition-colors"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1">
            {openBills.length === 0 ? (
              <div className="text-center py-12 text-komazi-muted space-y-2">
                <FileText className="w-12 h-12 mx-auto text-komazi-muted/40" />
                <p className="font-semibold text-sm text-komazi-text">Tidak Ada Bill Tertahan</p>
                <p className="text-xs">
                  Gunakan tombol "Hold Bill" di keranjang kasir untuk menyimpan pesanan sementara.
                </p>
              </div>
            ) : (
              paginatedBills.map((bill) => (
                <div
                  key={bill.id}
                  className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-komazi-coral/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-komazi-text">{bill.label}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-komazi-surface border border-komazi-border text-komazi-muted">
                        {formatOrderType(bill.orderType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-komazi-muted">
                      <Clock className="w-3.5 h-3.5 text-komazi-teal-light" />
                      <span>Disimpan: {formatDateTime(bill.savedAt)}</span>
                    </div>
                    <p className="text-xs text-komazi-muted">
                      {bill.items?.length || 0} jenis item • Subtotal: {formatRupiah(bill.total)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-komazi-border/50 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => deleteOpenBill(bill.id)}
                      className="p-2 rounded-xl text-komazi-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Batalkan / Hapus bill"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewingBill(bill)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-komazi-surface hover:bg-komazi-teal/15 border border-komazi-border hover:border-komazi-teal/40 text-komazi-teal-light text-xs font-semibold transition-all active:scale-95 shadow-sm"
                      title="Buka rincian lengkap pesanan tagihan ini"
                    >
                      <Eye className="w-3.5 h-3.5 text-komazi-teal" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(bill.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-colors active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Lanjutkan</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {openBills.length > 0 && (
            <div className="p-3 border-t border-komazi-border bg-komazi-surface">
              <Pagination
                currentPage={page}
                totalItems={openBills.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={(newLimit) => {
                  setPerPage(newLimit);
                  setPage(1);
                }}
                itemLabel="bill tertahan"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Rincian Pesanan Tertahan ── */}
      {previewingBill && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewingBill(null);
          }}
          className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
        >
          <div className="min-h-full flex items-center justify-center">
            <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] my-auto animate-in zoom-in-95 duration-150">
              {/* Header Preview */}
              <div className="p-4 sm:p-5 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/70">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-komazi-teal/15 border border-komazi-teal/30 flex items-center justify-center text-komazi-teal-light shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display font-bold text-base text-komazi-text truncate">
                        {previewingBill.label || (previewingBill.tableNo ? `Meja ${previewingBill.tableNo}` : (previewingBill.customerName || 'Pesanan Tertahan'))}
                      </h4>
                      {previewingBill.orderType && (
                        <span className="px-2 py-0.5 rounded-full bg-komazi-surface border border-komazi-border text-[10px] font-bold text-komazi-muted uppercase tracking-wider shrink-0">
                          {formatOrderType(previewingBill.orderType)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-komazi-muted flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-komazi-teal-light" />
                      <span>Disimpan: {formatDateTime(previewingBill.savedAt)}</span>
                    </p>
                  </div>
                </div>  
              </div>

              {/* Info Badges */}
              <div className="px-4 py-2.5 bg-komazi-surface-2 border-b border-komazi-border flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-komazi-muted">Meja:</span>
                  <span className="font-bold text-komazi-text">
                    {previewingBill.tableNo ? `No. ${previewingBill.tableNo}` : '- (Takeaway)'}
                  </span>
                  {previewingBill.customerName && (
                    <>
                      <span className="text-komazi-muted/40">•</span>
                      <span className="text-komazi-muted">Pelanggan:</span>
                      <span className="font-bold text-komazi-text">{previewingBill.customerName}</span>
                    </>
                  )}
                </div>
                <div className="text-xs font-semibold text-komazi-teal-light flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>{(previewingBill.items || []).reduce((acc, i) => acc + (i.qty || 1), 0)} Total Item</span>
                </div>
              </div>

              {/* Items List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1 max-h-[48vh]">
                <p className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted mb-2">
                  Daftar Item Pesanan:
                </p>
                {(!previewingBill.items || previewingBill.items.length === 0) ? (
                  <div className="py-8 text-center text-xs text-komazi-muted">
                    Tidak ada menu di dalam pesanan ini
                  </div>
                ) : (
                  previewingBill.items.map((item, idx) => {
                    const itemName = item.name || item.productName || 'Item';
                    const variantName = typeof item.variant === 'string' ? item.variant : item.variant?.name || item.variantName;
                    const modifiersStr = Array.isArray(item.modifiers)
                      ? item.modifiers.map((m) => (typeof m === 'string' ? m : m.name || m)).filter(Boolean).join(', ')
                      : (typeof item.modifiers === 'string' ? item.modifiers : null);
                    const qty = item.qty || 1;
                    const unitPrice = Number(item.unitPrice || item.price || 0);
                    const lineTotal = Number(item.lineTotal || (qty * unitPrice));

                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-komazi-surface-2/80 border border-komazi-border flex items-start justify-between gap-3 group hover:border-komazi-border/80 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-komazi-teal/15 text-komazi-teal-light font-mono font-bold text-xs shrink-0">
                              {qty}x
                            </span>
                            <span className="font-semibold text-xs text-komazi-text leading-tight">
                              {itemName}
                            </span>
                          </div>

                          {variantName && (
                            <span className="inline-block mt-1 ml-6 text-[10px] font-semibold text-komazi-coral bg-komazi-coral/15 px-1.5 py-0.5 rounded">
                              {variantName}
                            </span>
                          )}

                          {modifiersStr && (
                            <p className="text-[11px] text-komazi-teal-light ml-6 mt-0.5">
                              +{modifiersStr}
                            </p>
                          )}

                          {item.note && (
                            <p className="text-[11px] text-amber-300/90 italic ml-6 mt-0.5">
                              Catatan: "{item.note}"
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-xs text-komazi-text tabular-nums">
                            {formatRupiah(lineTotal)}
                          </p>
                          {qty > 1 && (
                            <p className="font-mono text-[10px] text-komazi-muted tabular-nums">
                              @{formatRupiah(unitPrice)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {previewingBill.attachedWorkspaceSession && (
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-purple-300">Sesi Workspace / Ruangan:</span>
                      <p className="text-[11px] text-komazi-muted">
                        {previewingBill.attachedWorkspaceSession.roomName || 'Ruang Kerja'} ({previewingBill.attachedWorkspaceSession.durationMinutes || 60} Menit)
                      </p>
                    </div>
                    <span className="font-mono font-bold text-purple-300">
                      {formatRupiah(previewingBill.attachedWorkspaceSession.charge || 0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Rincian Finansial & Aksi */}
              <div className="p-4 sm:p-5 border-t border-komazi-border bg-komazi-surface-2/70 space-y-3">
                {Number(previewingBill.discountValue || 0) > 0 && (
                  <div className="flex items-center justify-between text-xs text-komazi-muted">
                    <span>Potongan / Diskon:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      -{formatRupiah(previewingBill.discountValue)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-komazi-muted font-medium">Total Nominal Tagihan:</span>
                  <span className="font-mono font-bold text-base text-komazi-coral">
                    {formatRupiah(previewingBill.total || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPreviewingBill(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-komazi-border text-komazi-muted hover:text-white hover:bg-komazi-surface-3 text-xs font-bold transition-colors"
                  >
                    Tutup
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const id = previewingBill.id || previewingBill.billId;
                      handleRestore(id);
                    }}
                    className="flex-[1.5] py-2.5 px-4 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Lanjutkan Pesanan Ini</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
