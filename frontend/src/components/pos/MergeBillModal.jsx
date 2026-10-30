import React, { useState, useMemo } from 'react';
import { useCartStore } from '../../store/cartStore';
import { formatRupiah, formatDateTime, formatOrderType } from '../../utils/format';
import {
  GitMerge,
  X,
  CheckSquare,
  Square,
  Clock,
  ShoppingBag,
  ArrowRight,
  AlertCircle,
  Check,
  Eye,
  Receipt,
  Utensils,
} from 'lucide-react';
import { toast } from '../../store/toastStore';

export default function MergeBillModal({ onClose }) {
  const {
    openBills,
    currentHoldBillId,
    currentBackendOrderId,
    tableNo,
    customerName,
    mergeOpenBills,
  } = useCartStore();

  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewingBill, setPreviewingBill] = useState(null);
  const isEditingOpenBill = Boolean(currentHoldBillId || currentBackendOrderId);

  // Filter tagihan: jangan tampilkan tagihan yang sedang aktif dibuka di keranjang saat ini
  const candidateBills = useMemo(() => {
    return (openBills || []).filter((b) => {
      if (currentHoldBillId && (b.id === currentHoldBillId || b.billId === currentHoldBillId)) {
        return false;
      }
      if (currentBackendOrderId && b.backendOrderId === currentBackendOrderId) {
        return false;
      }
      return true;
    });
  }, [openBills, currentHoldBillId, currentBackendOrderId]);

  // Toggle pilihan bill
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Pilih Semua / Kosongkan
  const handleToggleSelectAll = () => {
    if (selectedIds.length === candidateBills.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidateBills.map((b) => b.id || b.billId));
    }
  };

  // Kalkulasi ringkasan pilihan
  const selectedBills = useMemo(() => {
    return candidateBills.filter((b) => selectedIds.includes(b.id || b.billId));
  }, [candidateBills, selectedIds]);

  const summary = useMemo(() => {
    const totalBills = selectedBills.length;
    const totalItems = selectedBills.reduce(
      (sum, b) => sum + (b.items || []).reduce((iSum, item) => iSum + (item.qty || 1), 0),
      0
    );
    const totalNominal = selectedBills.reduce((sum, b) => sum + Number(b.total || 0), 0);
    return { totalBills, totalItems, totalNominal };
  }, [selectedBills]);

  // Eksekusi penggabungan
  const handleProceedMerge = async () => {
    if (!isEditingOpenBill) {
      toast.error('Buka dan lanjutkan salah satu pesanan hold bill terlebih dahulu');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Pilih setidaknya 1 tagihan untuk digabungkan');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await mergeOpenBills(selectedIds);
      if (res && res.success) {
        toast.success(
          `Berhasil menggabungkan ${res.count} tagihan (${res.totalItemsAdded} item ditambahkan)!`
        );
        onClose();
      } else {
        toast.error('Gagal menggabungkan tagihan. Silakan coba lagi.');
      }
    } catch (err) {
      console.error('[MergeBillModal] error:', err);
      toast.error('Terjadi kesalahan saat menggabungkan tagihan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeDestinationLabel = isEditingOpenBill
    ? (tableNo
        ? `Meja ${tableNo}${customerName ? ` (${customerName})` : ''}`
        : customerName
        ? customerName
        : 'Pesanan Tertahan Aktif')
    : 'Belum Ada Hold Bill yang Dibuka';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="min-h-full flex items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-komazi-teal/15 border border-komazi-teal/30 flex items-center justify-center text-komazi-teal-light">
                <GitMerge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base sm:text-lg text-komazi-text flex items-center gap-2">
                  <span>Gabungkan Tagihan</span>
                </h3>
                <p className="text-xs text-komazi-muted mt-0.5">
                  Tujuan:{' '}
                  <span className="font-semibold text-komazi-teal-light">
                    {activeDestinationLabel}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          {!isEditingOpenBill ? (
            <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-2 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Pilih dan lanjutkan salah satu pesanan dari <b>Open Bills</b> terlebih dahulu untuk menggabungkan tagihan.
              </span>
            </div>
          ) : (
            <div className="px-4 py-3 bg-komazi-teal/10 border-b border-komazi-border flex items-center justify-between text-xs text-komazi-text">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-komazi-teal animate-pulse" />
                <span>
                  Pilih tagihan tertahan yang ingin dilebur ke dalam pesanan ini:
                </span>
              </div>
              {candidateBills.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs font-semibold text-komazi-teal-light hover:underline flex items-center gap-1"
                >
                  {selectedIds.length === candidateBills.length ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Batal Pilih Semua</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Pilih Semua ({candidateBills.length})</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Content: List Tagihan */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1 max-h-[55vh]">
            {candidateBills.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-center text-komazi-muted mx-auto mb-3">
                  <AlertCircle className="w-7 h-7 text-komazi-muted/60" />
                </div>
                <h4 className="text-sm font-bold text-komazi-text mb-1">
                  Tidak Ada Tagihan Tertahan Lain
                </h4>
                <p className="text-xs text-komazi-muted max-w-sm mx-auto">
                  Belum ada tagihan tertahan (*open bills*) lain yang dapat digabungkan ke keranjang ini. Simpan pesanan lain terlebih dahulu menggunakan fitur *Hold Bill*.
                </p>
              </div>
            ) : (
              candidateBills.map((bill) => {
                const billIdentifier = bill.id || bill.billId;
                const isSelected = selectedIds.includes(billIdentifier);
                const itemsList = bill.items || [];
                const itemCount = itemsList.reduce((acc, i) => acc + (i.qty || 1), 0);

                return (
                  <div
                    key={billIdentifier}
                    onClick={() => toggleSelect(billIdentifier)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                      isSelected
                        ? 'bg-komazi-teal/10 border-komazi-teal/50 shadow-md shadow-komazi-teal/5'
                        : 'bg-komazi-surface-2/70 border-komazi-border hover:border-komazi-border/80 hover:bg-komazi-surface-2'
                    }`}
                  >
                    {/* Checkbox Icon */}
                    <div className="pt-0.5 shrink-0 text-komazi-teal">
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-md bg-komazi-teal flex items-center justify-center text-white">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border border-komazi-border bg-komazi-surface flex items-center justify-center text-transparent hover:border-komazi-muted" />
                      )}
                    </div>

                    {/* Bill Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-sm text-komazi-text truncate">
                          {bill.label || (bill.tableNo ? `Meja ${bill.tableNo}` : (bill.customerName || 'Tagihan'))}
                        </span>
                        <span className="font-mono font-bold text-sm text-komazi-coral shrink-0">
                          {formatRupiah(bill.total || 0)}
                        </span>
                      </div>

                      {/* Detail item singkat */}
                      <p className="text-xs text-komazi-muted line-clamp-1 mb-2">
                        {itemsList
                          .map((i) => `${i.qty || 1}x ${i.name || i.productName || 'Item'}`)
                          .join(', ')}
                      </p>

                      {/* Meta badges & Action */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-komazi-border/50 text-[11px] text-komazi-muted/80">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 font-semibold text-komazi-teal-light">
                            <ShoppingBag className="w-3 h-3" />
                            <span>{itemCount} item</span>
                          </span>
                          {bill.savedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDateTime(bill.savedAt)}</span>
                            </span>
                          )}
                          {bill.tableNo && (
                            <span className="px-1.5 py-0.5 rounded bg-komazi-surface border border-komazi-border text-[10px] font-bold text-komazi-text">
                              Meja {bill.tableNo}
                            </span>
                          )}
                        </div>

                        {/* Tombol Lihat Pesanan */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewingBill(bill);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-komazi-surface hover:bg-komazi-teal/15 border border-komazi-border hover:border-komazi-teal/40 text-komazi-teal-light text-[11px] font-semibold transition-all active:scale-95 shadow-sm"
                          title="Buka rincian lengkap pesanan tagihan ini"
                        >
                          <Eye className="w-3.5 h-3.5 text-komazi-teal" />
                          <span>Lihat Pesanan</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Summary & Action */}
          <div className="p-4 sm:p-5 border-t border-komazi-border bg-komazi-surface-2/60 space-y-3">
            {candidateBills.length > 0 && (
              <div className="flex items-center justify-between text-xs text-komazi-muted bg-komazi-surface p-2.5 rounded-xl border border-komazi-border">
                <div>
                  <span className="text-komazi-text font-bold">
                    {summary.totalBills} tagihan
                  </span>{' '}
                  dipilih ({summary.totalItems} item baru)
                </div>
                <div className="font-mono font-bold text-komazi-text text-sm">
                  +{formatRupiah(summary.totalNominal)}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-komazi-border text-komazi-muted hover:text-white hover:bg-komazi-surface-3 text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProceedMerge}
                disabled={isSubmitting || !isEditingOpenBill || selectedIds.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-komazi-teal hover:bg-komazi-teal-light text-white text-xs font-bold shadow-lg shadow-komazi-teal/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <GitMerge className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Menggabungkan...'
                    : `Gabungkan (${selectedIds.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal Pratinjau Pesanan Tertahan ── */}
      {previewingBill && (
        <div
          role="dialog"
          aria-modal="true"
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
                        {previewingBill.label || (previewingBill.tableNo ? `Meja ${previewingBill.tableNo}` : (previewingBill.customerName || 'Tagihan Tertahan'))}
                      </h4>
                      {previewingBill.orderType && (
                        <span className="px-2 py-0.5 rounded-full bg-komazi-surface border border-komazi-border text-[10px] font-bold text-komazi-muted uppercase tracking-wider shrink-0">
                          {formatOrderType(previewingBill.orderType)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-komazi-muted flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>Tersimpan: {formatDateTime(previewingBill.savedAt)}</span>
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
                  Daftar Pesanan yang Ada:
                </p>
                {(!previewingBill.items || previewingBill.items.length === 0) ? (
                  <div className="py-8 text-center text-xs text-komazi-muted">
                    Tidak ada menu di dalam tagihan ini
                  </div>
                ) : (
                  previewingBill.items.map((item, idx) => {
                    const itemName = item.name || item.productName || 'Item';
                    const variantName = item.variant?.name || item.variantName;
                    const modifiersStr = Array.isArray(item.modifiers)
                      ? item.modifiers.map((m) => m.name || m).join(', ')
                      : (item.modifiers || null);
                    const qty = item.qty || 1;
                    const unitPrice = Number(item.unitPrice || 0);
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
                            <span className="inline-block mt-1 ml-6 text-[10px] font-semibold text-komazi-coral bg-komazi-coral/15 px-1.5 py-0.2 rounded">
                              {variantName}
                            </span>
                          )}

                          {modifiersStr && (
                            <p className="text-[11px] text-komazi-teal-light ml-6 mt-0.5">
                              +{modifiersStr}
                            </p>
                          )}

                          {item.note && (
                            <p className="text-[11px] text-komazi-muted italic ml-6 mt-0.5">
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
              </div>

              {/* Rincian Finansial & Aksi */}
              <div className="p-4 sm:p-5 border-t border-komazi-border bg-komazi-surface-2/70 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-komazi-muted font-medium">Total Nominal Tagihan Ini:</span>
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

                  {/* Tombol aksi langsung dari modal pratinjau */}
                  {(() => {
                    const billId = previewingBill.id || previewingBill.billId;
                    const isSelected = selectedIds.includes(billId);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          toggleSelect(billId);
                          setPreviewingBill(null);
                        }}
                        className={`flex-[1.5] py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                            : 'bg-komazi-teal hover:bg-komazi-teal-light text-white shadow-komazi-teal/20'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <X className="w-4 h-4" />
                            <span>Batal Pilih Tagihan Ini</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Pilih Tagihan Ini (+Gabung)</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
