import React, { useState, useEffect, useMemo } from 'react';
import {
  Undo2,
  Receipt,
  Search,
  Filter,
  Calendar,
  Clock,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  Plus,
  ArrowRight,
  Eye,
  KeyRound,
  X,
  Lock,
  Check,
  RotateCcw,
} from 'lucide-react';
import { useOrdersStore } from '../store/ordersStore';
import { useAuthStore } from '../store/authStore';
import { usePrinterStore } from '../store/printerStore';
import { formatRupiah, formatDateTime, formatOrderType } from '../utils/format';
import { toast } from '../store/toastStore';
import api from '../services/api';
import Pagination from '../components/ui/Pagination';
import ThermalReceiptModal from '../components/pos/ThermalReceiptModal';

export default function RefundsPage() {
  const orders = useOrdersStore((s) => s.orders);
  const fetchOrders = useOrdersStore((s) => s.fetchOrders);
  const refundOrder = useOrdersStore((s) => s.refundOrder);
  const isLoading = useOrdersStore((s) => s.isLoading);
  const { user } = useAuthStore();
  const { isConnected: isPrinterConnected } = usePrinterStore();

  const isOwnerOrManager = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Pending Approvals from Owner
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [isDeciding, setIsDeciding] = useState(false);

  // New Refund Modal State
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [selectedOrderToRefund, setSelectedOrderToRefund] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Pagination for refunded orders table
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const loadPendingApprovals = async () => {
    try {
      const res = await api.approvals.getPending();
      if (res && res.success && Array.isArray(res.data)) {
        setPendingApprovals(res.data.filter((item) => item.type === 'REFUND'));
      }
    } catch (err) {
      console.warn('Error loading pending approvals:', err);
    }
  };

  useEffect(() => {
    let lastFetched = Date.now();
    fetchOrders?.();
    loadPendingApprovals();
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetched > 10000) {
        lastFetched = Date.now();
        fetchOrders?.();
        loadPendingApprovals();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const handleDecide = async (approvalId, approve) => {
    try {
      setIsDeciding(true);
      const res = await api.approvals.decide(approvalId, approve);
      if (res && res.success) {
        toast.success(approve ? 'Permintaan refund berhasil disetujui!' : 'Permintaan refund telah ditolak');
        loadPendingApprovals();
        fetchOrders?.();
      } else {
        toast.error(res?.message || 'Gagal memproses persetujuan');
      }
    } catch (err) {
      toast.error(err?.message || 'Gagal memproses persetujuan');
    } finally {
      setIsDeciding(false);
    }
  };

  // All refunded orders
  const refundedOrders = useMemo(() => {
    return (orders || []).filter((o) => o.status === 'REFUNDED');
  }, [orders]);

  // Orders eligible for refund (PAID)
  const paidOrdersEligible = useMemo(() => {
    return (orders || [])
      .filter((o) => o.status === 'PAID')
      .filter((o) => {
        if (!orderSearchQuery) return true;
        const q = orderSearchQuery.toLowerCase();
        return (
          (o.invoiceNo && o.invoiceNo.toLowerCase().includes(q)) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.tableName && o.tableName.toLowerCase().includes(q))
        );
      })
      .slice(0, 15); // Show top 15 results for easy pick
  }, [orders, orderSearchQuery]);

  // Filtered refunded orders
  const filteredRefunded = useMemo(() => {
    return refundedOrders.filter((o) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (o.invoiceNo && o.invoiceNo.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.refundReason && o.refundReason.toLowerCase().includes(q)) ||
        (o.refundedBy && o.refundedBy.toLowerCase().includes(q))
      );
    });
  }, [refundedOrders, searchQuery]);

  const paginatedRefunded = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRefunded.slice(start, start + itemsPerPage);
  }, [filteredRefunded, currentPage, itemsPerPage]);

  // Statistics
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRefunded = useMemo(() => {
    return refundedOrders.filter((o) => {
      const dateStr = (o.refundedAt || o.createdAt || '').slice(0, 10);
      return dateStr === todayStr;
    });
  }, [refundedOrders, todayStr]);

  const totalRefundTodayAmount = useMemo(() => {
    return todayRefunded.reduce((sum, o) => sum + Number(o.refundAmount || o.total || 0), 0);
  }, [todayRefunded]);

  const totalAllRefundAmount = useMemo(() => {
    return refundedOrders.reduce((sum, o) => sum + Number(o.refundAmount || o.total || 0), 0);
  }, [refundedOrders]);

  const handleSelectOrderForRefund = (order) => {
    setSelectedOrderToRefund(order);
    setRefundAmount(Number(order.total || 0));
    setRefundReason('');
  };

  const handleProcessRefundSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrderToRefund) {
      toast.error('Pilih pesanan yang ingin di-refund terlebih dahulu');
      return;
    }
    if (!refundReason.trim()) {
      toast.error('Alasan pengembalian dana (refund) wajib diisi');
      return;
    }
    if (!refundAmount || refundAmount <= 0) {
      toast.error('Nominal refund harus lebih dari Rp 0');
      return;
    }

    try {
      setIsSubmittingRefund(true);
      const res = await refundOrder(
        selectedOrderToRefund.id,
        refundReason.trim(),
        refundAmount,
        user?.name || (user?.role === 'OWNER' ? 'Owner' : 'Kasir')
      );
      if (res?.pendingApproval) {
        toast.info(res.message || 'Permintaan refund berhasil diajukan! Menunggu persetujuan Owner.');
      } else {
        toast.success(
          `Refund transaksi ${selectedOrderToRefund.invoiceNo} senilai ${formatRupiah(refundAmount)} berhasil diproses!`
        );
      }
      setShowProcessModal(false);
      setSelectedOrderToRefund(null);
      setRefundReason('');
      loadPendingApprovals();
      fetchOrders?.();
    } catch (err) {
      toast.error(err?.message || 'Gagal memproses refund');
    } finally {
      setIsSubmittingRefund(false);
    }
  };


  return (
    <div className="p-4 sm:p-6 pb-28 lg:pb-12 space-y-6 max-w-7xl mx-auto select-none animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-komazi-surface p-5 sm:p-6 rounded-2xl border border-komazi-border shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-danger/15 border border-danger/30 flex items-center justify-center text-danger shadow-inner shrink-0">
            <Undo2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display font-black text-xl sm:text-2xl text-komazi-text tracking-tight">
                Pengembalian Dana (Refund)
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-danger/15 border border-danger/30 text-danger">
                Audit &amp; Retur Transaksi
              </span>
            </div>
            <p className="text-xs text-komazi-muted mt-1 leading-relaxed">
              Pencatatan pengembalian uang penjualan, retur nota pesanan, dan verifikasi otorisasi supervisor.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedOrderToRefund(null);
            setOrderSearchQuery('');
            setShowProcessModal(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Proses Refund Transaksi</span>
        </button>
      </div>

      {/* 2. Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Nilai Refund Hari Ini */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
              Total Refund Hari Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-danger/15 text-danger flex items-center justify-center">
              <Undo2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-mono font-black text-2xl text-danger">
              {formatRupiah(totalRefundTodayAmount)}
            </h3>
            <p className="text-[10px] text-komazi-muted mt-1">
              {todayRefunded.length} transaksi di-refund hari ini
            </p>
          </div>
        </div>

        {/* Jumlah Nota Di-Refund Keseluruhan */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
              Total Transaksi Di-Refund
            </span>
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-mono font-bold text-2xl text-komazi-text">
              {refundedOrders.length} Nota
            </h3>
            <p className="text-[10px] text-komazi-muted mt-1">
              Akumulasi nota yang dibatalkan &amp; dikembalikan
            </p>
          </div>
        </div>

        {/* Total Akumulasi Nilai Refund */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
              Total Nilai Seluruh Refund
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-mono font-bold text-2xl text-amber-400">
              {formatRupiah(totalAllRefundAmount)}
            </h3>
            <p className="text-[10px] text-komazi-muted mt-1">
              Seluruh dana yang telah keluar via retur
            </p>
          </div>
        </div>
      </div>

      {/* 2.5. Pending Approvals Section */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-sm text-komazi-text">
                    Permintaan Refund Menunggu Persetujuan Owner
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                    {pendingApprovals.length} Menunggu
                  </span>
                </div>
                <p className="text-xs text-komazi-muted mt-0.5">
                  {isOwnerOrManager
                    ? 'Sebagai Owner/Manager, Anda dapat menyetujui atau menolak permohonan refund berikut secara langsung.'
                    : 'Permintaan refund telah terkirim ke Owner dan bot Telegram. Menunggu konfirmasi persetujuan.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadPendingApprovals}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold self-start sm:self-auto flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh Status
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingApprovals.map((item) => {
              const reqData = item.data || {};
              const orderInfo = item.order || {};
              const invoice = orderInfo.invoiceNo || reqData.invoiceNo || (item.orderId ? `#KMZ-${item.orderId}` : 'Nota');
              const amount = Number(reqData.amount || orderInfo.total || 0);

              return (
                <div
                  key={item.id}
                  className="bg-komazi-surface border border-komazi-border rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-sm hover:border-amber-500/40 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-komazi-coral">
                        {invoice}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30">
                        PENDING
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-xs text-komazi-muted">Nominal Refund:</span>
                      <span className="font-mono font-bold text-sm text-danger">
                        {formatRupiah(amount)}
                      </span>
                    </div>

                    <div className="text-xs text-komazi-muted pt-1">
                      <span className="font-medium text-komazi-text">Alasan: </span>
                      <span className="italic">"{item.reason || reqData.reason || '-'}"</span>
                    </div>

                    <div className="text-[10px] text-komazi-muted flex items-center justify-between pt-1 border-t border-komazi-border/50">
                      <span>
                        Diajukan: <strong className="text-komazi-text">{item.requester?.name || reqData.requesterName || 'Kasir'}</strong>
                      </span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>

                  {isOwnerOrManager ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-komazi-border/50">
                      <button
                        type="button"
                        disabled={isDeciding}
                        onClick={() => handleDecide(item.id, false)}
                        className="flex-1 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-danger/20 hover:text-danger text-komazi-muted text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        disabled={isDeciding}
                        onClick={() => handleDecide(item.id, true)}
                        className="flex-1 py-1.5 rounded-lg bg-success hover:bg-success/90 text-black text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Setujui
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-komazi-surface-2 text-[11px] text-komazi-muted text-center italic">
                      Menunggu respon Owner via POS / Telegram
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Table of Refunded Orders */}
      <div className="bg-komazi-surface rounded-2xl border border-komazi-border overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-komazi-coral" />
            <h2 className="font-bold text-sm text-komazi-text">
              Daftar Transaksi yang Di-Refund
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-komazi-surface-2 text-komazi-muted font-bold font-mono">
              {filteredRefunded.length} Nota
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari invoice, pelanggan, alasan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none w-56 sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-komazi-surface-2/70 text-komazi-muted uppercase text-[10px] font-bold tracking-wider border-b border-komazi-border">
              <tr>
                <th className="py-3 px-4">No. Invoice</th>
                <th className="py-3 px-4">Waktu Refund</th>
                <th className="py-3 px-4">Pelanggan / Meja</th>
                <th className="py-3 px-4">Metode Asli</th>
                <th className="py-3 px-4 text-right">Nilai Refund</th>
                <th className="py-3 px-4">Alasan Refund</th>
                <th className="py-3 px-4">Otorisasi</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/50">
              {paginatedRefunded.length > 0 ? (
                paginatedRefunded.map((order) => {
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-komazi-surface-2/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-komazi-coral whitespace-nowrap">
                        {order.invoiceNo || `#KMZ-${order.id}`}
                      </td>
                      <td className="py-3 px-4 text-komazi-muted font-mono whitespace-nowrap">
                        {order.refundedAt ? formatDateTime(order.refundedAt) : formatDateTime(order.createdAt)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-komazi-text">
                          {order.customerName || 'Tamu / Umum'}
                        </div>
                        <div className="text-[10px] text-komazi-muted">
                          {order.tableNo ? `Meja ${order.tableNo}` : formatOrderType(order.orderType)}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-komazi-surface-2 text-komazi-muted border border-komazi-border">
                          {order.paymentMethod || 'TUNAI'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-danger whitespace-nowrap">
                        -{formatRupiah(order.refundAmount || order.total || 0)}
                      </td>
                      <td className="py-3 px-4 text-komazi-muted max-w-xs truncate">
                        {order.refundReason || 'Pembatalan transaksi'}
                      </td>
                      <td className="py-3 px-4 text-komazi-muted whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-komazi-teal-light" />
                          <span>{order.refundedBy || 'Supervisor'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(order)}
                          className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-white transition-colors"
                          title="Lihat Nota / Cetak Struk"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-komazi-muted">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-komazi-surface-2 flex items-center justify-center text-komazi-muted">
                        <Undo2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold">Tidak ada transaksi yang di-refund</p>
                      <p className="text-[11px] text-komazi-muted">
                        Seluruh transaksi penjualan berjalan normal tanpa retur.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredRefunded.length > itemsPerPage && (
          <div className="p-4 border-t border-komazi-border">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRefunded.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 4. Modal: Proses Refund Transaksi Baru */}
      {showProcessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-danger/15 text-danger flex items-center justify-center font-bold">
                  <Undo2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Proses Refund Transaksi</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Pilih nota lunas (PAID) yang akan dibatalkan dan dikembalikan dananya
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProcessModal(false)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Select Paid Order if not selected */}
            {!selectedOrderToRefund ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Cari nomor nota / invoice / pelanggan..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {paidOrdersEligible.length > 0 ? (
                    paidOrdersEligible.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => handleSelectOrderForRefund(order)}
                        className="p-3 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface-2/80 border border-komazi-border cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-komazi-coral">
                              {order.invoiceNo || `#KMZ-${order.id}`}
                            </span>
                            <span className="text-[10px] text-komazi-muted">
                              {order.customerName || 'Tamu'}
                            </span>
                          </div>
                          <span className="text-[10px] text-komazi-muted">
                            {formatDateTime(order.createdAt)} • {order.paymentMethod || 'TUNAI'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs text-komazi-text">
                            {formatRupiah(order.total)}
                          </span>
                          <span className="text-xs text-komazi-coral group-hover:translate-x-0.5 transition-transform">
                            Pilih →
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-komazi-muted">
                      Tidak ada transaksi berstatus PAID ditemukan.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Step 2: Form Reason & Authorization */
              <form onSubmit={handleProcessRefundSubmit} className="space-y-4">
                {/* Selected Order Summary Card */}
                <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-komazi-coral">
                      {selectedOrderToRefund.invoiceNo}
                    </span>
                    <p className="text-[11px] text-komazi-muted">
                      Total Belanja: {formatRupiah(selectedOrderToRefund.total)} • {selectedOrderToRefund.paymentMethod}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderToRefund(null)}
                    className="text-[11px] text-komazi-coral hover:underline font-semibold"
                  >
                    Ganti Nota
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">
                    Nominal Dana yang Di-refund (Rp):
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max={selectedOrderToRefund.total}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border font-mono text-sm font-bold text-danger focus:border-danger outline-none"
                  />
                  <span className="text-[10px] text-komazi-muted mt-1 block">
                    * Maksimal pengembalian sebesar total nota ({formatRupiah(selectedOrderToRefund.total)})
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">
                    Alasan Pengembalian Dana (Wajib Diisi):
                  </label>
                  <textarea
                    rows="2"
                    required
                    placeholder="contoh: Pesanan salah buat / pelanggan batal pesan / double bayar"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-danger outline-none"
                  />
                </div>

                {!isOwnerOrManager ? (
                  <div className="p-3 rounded-xl bg-komazi-coral/10 border border-komazi-coral/20 flex items-start gap-2.5 text-xs text-komazi-coral">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-komazi-text">Pengajuan Refund Tanpa PIN Otorisasi</p>
                      <p className="text-[11px] text-komazi-muted mt-0.5">
                        Permintaan refund akan langsung dikirimkan ke Owner untuk disetujui tanpa perlu memasukkan PIN.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Akses Owner: Refund akan langsung dieksekusi dan stok bahan otomatis dipulihkan.</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProcessModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRefund}
                    className="flex-1 py-2.5 rounded-xl bg-danger hover:bg-danger/80 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                  >
                    <Undo2 className="w-4 h-4" />
                    <span>
                      {isSubmittingRefund
                        ? 'Memproses...'
                        : isOwnerOrManager
                        ? 'Konfirmasi Refund Dana'
                        : 'Ajukan Refund ke Owner'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
        <ThermalReceiptModal
          order={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
