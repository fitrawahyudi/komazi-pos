import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  User,
  Coffee,
  AlertTriangle,
  ZoomIn,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react';
import { qrOrderService } from '../../services/qrOrderService';
import { formatRupiah, formatDateTime } from '../../utils/format';
import { toast } from '../../store/toastStore';

export default function PendingQrOrdersModal({
  isOpen,
  onClose,
  pendingOrders = [],
  onRefresh,
}) {
  const [orders, setOrders] = useState(pendingOrders);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('Bukti transfer tidak valid atau tidak terbaca');

  useEffect(() => {
    setOrders(pendingOrders);
    if (pendingOrders.length > 0 && !selectedOrder) {
      setSelectedOrder(pendingOrders[0]);
    } else if (pendingOrders.length === 0) {
      setSelectedOrder(null);
    }
  }, [pendingOrders]);

  if (!isOpen) return null;

  const handleConfirm = async (order) => {
    if (processingId) return;
    setProcessingId(order.id);

    try {
      await qrOrderService.confirmPayment(order.id);
      toast.success(`Pesanan #${order.invoiceNo} (${order.tableNo}) berhasil dikonfirmasi lunas!`);
      
      const nextList = orders.filter((o) => o.id !== order.id);
      setOrders(nextList);
      if (nextList.length > 0) {
        setSelectedOrder(nextList[0]);
      } else {
        setSelectedOrder(null);
        onClose();
      }
      onRefresh?.();
    } catch (err) {
      toast.error(`Gagal konfirmasi: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingOrder || processingId) return;
    setProcessingId(rejectingOrder.id);

    try {
      await qrOrderService.rejectPayment(rejectingOrder.id, rejectReason);
      toast.info(`Pesanan #${rejectingOrder.invoiceNo} telah ditolak.`);

      const nextList = orders.filter((o) => o.id !== rejectingOrder.id);
      setOrders(nextList);
      setRejectingOrder(null);
      if (nextList.length > 0) {
        setSelectedOrder(nextList[0]);
      } else {
        setSelectedOrder(null);
        onClose();
      }
      onRefresh?.();
    } catch (err) {
      toast.error(`Gagal menolak pesanan: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-4xl bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-komazi-text flex items-center gap-2">
                Verifikasi Pesanan QR Meja
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] rounded-full font-mono">
                  {orders.length} Menunggu
                </span>
              </h2>
              <p className="text-[11px] text-komazi-muted">
                Periksa kesesuaian bukti transfer sebelum meneruskan ke dapur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-komazi-surface-2 hover:bg-komazi-surface border border-komazi-border flex items-center justify-center text-komazi-muted hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body: Master List & Detail View */}
        {orders.length === 0 ? (
          <div className="p-12 text-center text-komazi-muted space-y-2">
            <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-2 opacity-80" />
            <p className="text-sm font-medium text-white">Semua pesanan meja telah selesai diverifikasi!</p>
            <p className="text-xs">Tidak ada antrean pesanan QR meja baru saat ini.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-komazi-border">
            {/* Sidebar Daftar Pesanan Pending */}
            <div className="md:col-span-4 overflow-y-auto p-3 space-y-2 max-h-60 md:max-h-none bg-komazi-surface/40">
              {orders.map((o) => {
                const isSelected = selectedOrder?.id === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-sm'
                        : 'bg-komazi-surface-2/60 border-komazi-border hover:border-komazi-border-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md">
                        {o.tableNo || 'Meja -'}
                      </span>
                      <span className="text-[10px] text-komazi-muted font-mono">{o.invoiceNo}</span>
                    </div>
                    <p className="font-semibold text-xs text-white truncate">{o.customerName || 'Tamu'}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-komazi-border/50 text-xs">
                      <span className="text-[10px] text-komazi-muted">{o.items?.length || 0} menu</span>
                      <span className="font-bold font-mono text-emerald-400">{formatRupiah(o.total)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail Pesanan & Bukti Transfer */}
            {selectedOrder && (
              <div className="md:col-span-8 flex flex-col overflow-y-auto p-5 space-y-4">
                {/* Info Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-komazi-surface-2/40 border border-komazi-border rounded-xl">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-komazi-muted">Meja & Pemesan</span>
                    <p className="text-sm font-bold text-white">
                      {selectedOrder.tableNo} • {selectedOrder.customerName || 'Tamu'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-komazi-muted">Total Pembayaran</span>
                    <p className="text-sm font-bold font-mono text-emerald-400">
                      {formatRupiah(selectedOrder.total)}
                    </p>
                  </div>
                </div>

                {/* Grid Rincian Menu & Foto Bukti */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Kolom Kiri: Rincian Menu */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-komazi-muted uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag size={13} /> Rincian Menu ({selectedOrder.items?.length || 0})
                    </h4>
                    <div className="bg-komazi-surface-2/30 border border-komazi-border rounded-xl p-3 space-y-2 max-h-56 overflow-y-auto">
                      {(selectedOrder.items || []).map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs border-b border-komazi-border/40 pb-1.5 last:border-0 last:pb-0">
                          <div>
                            <span className="font-semibold text-white">
                              {it.qty}× {it.productName}
                            </span>
                            {it.variantName && (
                              <p className="text-[10px] text-amber-400 font-medium">({it.variantName})</p>
                            )}
                            {it.note && <p className="text-[10px] text-komazi-muted italic">"{it.note}"</p>}
                          </div>
                          <span className="font-mono text-komazi-muted shrink-0 ml-2">
                            {formatRupiah(it.lineTotal || it.unitPrice * it.qty)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kolom Kanan: Foto Struk Bukti Transfer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-komazi-muted uppercase tracking-wider">
                        Bukti Transfer Pelanggan
                      </h4>
                      {selectedOrder.proofUrl && (
                        <button
                          onClick={() => setPreviewImageUrl(selectedOrder.proofUrl)}
                          className="text-[11px] text-komazi-coral hover:underline flex items-center gap-1 font-semibold"
                        >
                          <ZoomIn size={12} /> Perbesar Foto
                        </button>
                      )}
                    </div>

                    <div className="relative w-full aspect-square bg-black/40 border border-komazi-border rounded-xl overflow-hidden flex items-center justify-center group">
                      {selectedOrder.proofUrl ? (
                        <>
                          <img
                            src={selectedOrder.proofUrl}
                            alt="Bukti Transfer"
                            className="w-full h-full object-contain cursor-pointer"
                            onClick={() => setPreviewImageUrl(selectedOrder.proofUrl)}
                          />
                          <button
                            onClick={() => setPreviewImageUrl(selectedOrder.proofUrl)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5"
                          >
                            <ZoomIn size={16} /> Klik untuk Perbesar
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4 text-xs text-komazi-muted">
                          <AlertTriangle size={24} className="mx-auto text-amber-400 mb-1" />
                          <span>Foto bukti transfer tidak tersedia</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Kasir */}
                <div className="pt-3 border-t border-komazi-border flex items-center justify-end gap-2.5">
                  <button
                    disabled={processingId === selectedOrder.id}
                    onClick={() => setRejectingOrder(selectedOrder)}
                    className="px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <XCircle size={15} /> Tolak Pesanan
                  </button>

                  <button
                    disabled={processingId === selectedOrder.id}
                    onClick={() => handleConfirm(selectedOrder)}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5"
                  >
                    {processingId === selectedOrder.id ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Memproses...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Konfirmasi Lunas & Kirim ke Dapur
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Zoom Foto Bukti Transfer */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] bg-zinc-950 p-2 rounded-2xl border border-zinc-800 shadow-2xl">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition"
            >
              <X size={18} />
            </button>
            <img src={previewImageUrl} alt="Bukti Transfer Full" className="max-h-[82vh] w-auto object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Tolak Pesanan */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle size={20} />
              <h3 className="font-bold text-sm text-white">Tolak Pesanan {rejectingOrder.tableNo}?</h3>
            </div>
            <p className="text-xs text-komazi-muted">
              Pesanan #{rejectingOrder.invoiceNo} akan dibatalkan (*VOID*). Silakan pilih alasan penolakan:
            </p>

            <div className="space-y-1.5">
              {[
                'Bukti transfer blur / tidak terbaca',
                'Nominal transfer tidak sesuai tagihan',
                'Rekening tujuan salah',
                'Struk transfer diduga fiktif / kadaluwarsa',
              ].map((reasonText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRejectReason(reasonText)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition ${
                    rejectReason === reasonText
                      ? 'bg-red-500/15 border-red-500 text-red-300 font-semibold'
                      : 'bg-komazi-surface-2/60 border-komazi-border text-komazi-muted hover:text-white'
                  }`}
                >
                  {reasonText}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-komazi-border">
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-komazi-muted hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={processingId === rejectingOrder.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow"
              >
                {processingId === rejectingOrder.id ? 'Memproses...' : 'Ya, Tolak Pesanan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

