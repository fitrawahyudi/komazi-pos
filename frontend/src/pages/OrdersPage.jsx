import React, { useState, useMemo, useEffect } from 'react';
import { useOrdersStore } from '../store/ordersStore';
import { useAuthStore } from '../store/authStore';
import { useShiftStore } from '../store/shiftStore';
import { formatRupiah, formatDateTime } from '../utils/format';
import ThermalReceiptModal from '../components/pos/ThermalReceiptModal';
import ShiftModal from '../components/shift/ShiftModal';
import Pagination from '../components/ui/Pagination';
import { toast } from '../store/toastStore';
import {
  Receipt,
  Search,
  Filter,
  Printer,
  Ban,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  Lock,
  Unlock,
  CircleDot,
  TrendingUp,
  Banknote,
  Calendar,
  Users,
  Layers,
  ShieldCheck,
  Eye,
  Clock,
  Sparkles,
  CreditCard,
} from 'lucide-react';

export default function OrdersPage() {
  const { orders, voidOrder, refundOrder } = useOrdersStore();
  const { user } = useAuthStore();
  const { activeShift, shiftHistory, fetchActiveShift, fetchShiftHistory } = useShiftStore();

  useEffect(() => {
    fetchActiveShift?.();
    fetchShiftHistory?.();
  }, [fetchActiveShift, fetchShiftHistory]);

  const role = user?.role || 'CASHIER';
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isManagerOrOwner = isOwner || isManager;
  const isCashier = role === 'CASHIER';

  // Check if there is an active shift running
  const hasActiveShift = Boolean(activeShift && !activeShift.isClosed);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PAID' | 'VOIDED' | 'REFUNDED'
  const [shiftFilter, setShiftFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | specific shiftId
  const [cashierFilter, setCashierFilter] = useState('ALL'); // 'ALL' | cashierName
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL' | 'TODAY' | '7DAYS' | '30DAYS'

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Void modal state
  const [voidTargetOrder, setVoidTargetOrder] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [managerPin, setManagerPin] = useState('');

  // Refund modal state
  const [refundTargetOrder, setRefundTargetOrder] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);

  // Distinct Cashiers list for Owner/Manager filter
  const distinctCashiers = useMemo(() => {
    const names = new Set();
    orders.forEach((o) => {
      if (o.cashierName) names.add(o.cashierName);
    });
    return Array.from(names);
  }, [orders]);

  // Distinct Shifts list for Owner/Manager filter
  const shiftList = useMemo(() => {
    const list = [];
    if (activeShift && !activeShift.isClosed) {
      list.push({
        id: 'ACTIVE',
        label: `Shift Aktif (${activeShift.cashierName})`,
        isLive: true,
      });
    }
    (shiftHistory || []).forEach((s) => {
      list.push({
        id: String(s.id),
        label: `Shift #${s.id} - ${s.cashierName} (${formatDateTime(s.openedAt)})`,
        isLive: false,
      });
    });
    return list;
  }, [activeShift, shiftHistory]);

  // Main Filter Algorithm
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. ROLE ISOLATION:
      // If CASHIER: Strictly only orders belonging to cashier's active shift
      if (isCashier) {
        if (!hasActiveShift) return false;

        const isCurrentShiftOrder =
          order.shiftId === activeShift.id ||
          ((order.cashierId === user?.id || order.cashierName === user?.name) &&
            new Date(order.createdAt).getTime() >= new Date(activeShift.openedAt).getTime());

        if (!isCurrentShiftOrder) return false;
      }

      // If OWNER or MANAGER: Apply Manager Supervisory Filters
      if (isManagerOrOwner) {
        // Shift Filter
        if (shiftFilter === 'ACTIVE') {
          if (!activeShift) return false;
          const isAct =
            order.shiftId === activeShift.id ||
            new Date(order.createdAt).getTime() >= new Date(activeShift.openedAt).getTime();
          if (!isAct) return false;
        } else if (shiftFilter !== 'ALL') {
          if (String(order.shiftId) !== String(shiftFilter)) return false;
        }

        // Cashier Filter
        if (cashierFilter !== 'ALL') {
          if (order.cashierName !== cashierFilter) return false;
        }

        // Date Filter
        if (dateFilter === 'TODAY') {
          const orderDate = new Date(order.createdAt).toDateString();
          const today = new Date().toDateString();
          if (orderDate !== today) return false;
        } else if (dateFilter === '7DAYS') {
          const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
          if (new Date(order.createdAt).getTime() < sevenDaysAgo) return false;
        } else if (dateFilter === '30DAYS') {
          const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
          if (new Date(order.createdAt).getTime() < thirtyDaysAgo) return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInvoice = order.invoiceNo?.toLowerCase().includes(q);
        const matchCustomer = order.customerName && order.customerName.toLowerCase().includes(q);
        const matchTable = order.tableNo && String(order.tableNo).toLowerCase().includes(q);
        const matchCashier = order.cashierName && order.cashierName.toLowerCase().includes(q);
        if (!matchInvoice && !matchCustomer && !matchTable && !matchCashier) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    isCashier,
    isManagerOrOwner,
    hasActiveShift,
    activeShift,
    user,
    shiftFilter,
    cashierFilter,
    dateFilter,
    statusFilter,
    searchQuery,
  ]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset ke halaman pertama saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, shiftFilter, cashierFilter, dateFilter]);

  // Paginated Orders Sliced
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  // Statistics calculation for the active view
  const stats = useMemo(() => {
    let totalOmzet = 0;
    let paidCount = 0;
    let voidCount = 0;
    let refundCount = 0;
    let totalRefundAmount = 0;
    let cashCount = 0;
    let nonCashCount = 0;

    filteredOrders.forEach((o) => {
      if (o.status === 'PAID') {
        totalOmzet += Number(o.total || 0);
        paidCount++;
        const pMethod = o.payments?.[0]?.method || o.paymentMethod || 'CASH';
        if (pMethod === 'CASH') {
          cashCount++;
        } else {
          nonCashCount++;
        }
      } else if (o.status === 'VOIDED') {
        voidCount++;
      } else if (o.status === 'REFUNDED') {
        refundCount++;
        totalRefundAmount += Number(o.refundAmount || o.total || 0);
      }
    });

    return {
      totalOmzet,
      paidCount,
      voidCount,
      refundCount,
      totalRefundAmount,
      totalOrders: filteredOrders.length,
      cashCount,
      nonCashCount,
    };
  }, [filteredOrders]);

  // Void Handler
  const handleConfirmVoid = async (e) => {
    e.preventDefault();
    if (!voidReason.trim()) return;

    // Check manager/owner authorization PIN if current role is CASHIER
    if (!isManagerOrOwner) {
      if (!managerPin.trim()) {
        toast.error('Masukkan PIN Otorisasi Manager/Supervisor.');
        return;
      }
      try {
        const check = await api.settings.verifyPin(managerPin.trim());
        if (!check || !check.success) {
          toast.error(check?.message || 'PIN Otorisasi Manager/Supervisor salah.');
          return;
        }
      } catch (err) {
        toast.error('Gagal memverifikasi PIN: ' + err.message);
        return;
      }
    }

    await voidOrder(
      voidTargetOrder.id,
      voidReason,
      user?.name || (isManagerOrOwner ? 'Owner' : 'Manager'),
      managerPin.trim()
    );
    toast.success(`Transaksi #${voidTargetOrder.invoiceNo} berhasil dibatalkan (VOID)`);
    setVoidTargetOrder(null);
    setVoidReason('');
    setManagerPin('');
  };

  // Refund Handler
  const handleConfirmRefund = async (e) => {
    e.preventDefault();
    if (!refundReason.trim()) return;

    if (!isManagerOrOwner) {
      if (!managerPin.trim()) {
        toast.error('Masukkan PIN Otorisasi Manager/Supervisor.');
        return;
      }
      try {
        const check = await api.settings.verifyPin(managerPin.trim());
        if (!check || !check.success) {
          toast.error(check?.message || 'PIN Otorisasi Manager/Supervisor salah.');
          return;
        }
      } catch (err) {
        toast.error('Gagal memverifikasi PIN: ' + err.message);
        return;
      }
    }

    await refundOrder(
      refundTargetOrder.id,
      refundReason,
      refundAmount,
      user?.name || (isManagerOrOwner ? 'Owner' : 'Manager'),
      managerPin.trim()
    );
    toast.success(`Pengembalian dana senilai ${formatRupiah(refundAmount)} berhasil diproses`);
    setRefundTargetOrder(null);
    setRefundReason('');
    setManagerPin('');
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header with Role Mode Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
              <Receipt className="w-6 h-6 text-komazi-coral" />
              <span>Riwayat Transaksi Penjualan</span>
            </h1>

            {isCashier ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-komazi-teal/15 border border-komazi-teal/30 text-komazi-teal-light">
                <CircleDot className="w-3 h-3 text-komazi-teal-light animate-pulse" />
                Mode Kasir: Shift Berjalan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-komazi-coral/15 border border-komazi-coral/30 text-komazi-coral">
                <ShieldCheck className="w-3.5 h-3.5" />
                Mode Pengawasan: Akses Penuh ({user?.role === 'OWNER' ? 'Owner' : 'Manager'})
              </span>
            )}
          </div>

          <p className="text-xs text-komazi-muted mt-1">
            {isCashier
              ? 'Menampilkan daftar invoice transaksi yang diproses selama shift kasir Anda sedang aktif.'
              : 'Memantau seluruh transaksi penjualan dari semua kasir dan seluruh sesi shift outlet.'}
          </p>
        </div>

        {/* Action Button: Buka Shift jika belum ada shift */}
        {isCashier && !hasActiveShift && (
          <button
            type="button"
            onClick={() => setIsShiftModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md shadow-komazi-coral/20 transition-all active:scale-95"
          >
            <CircleDot className="w-4 h-4 animate-pulse" />
            <span>Buka Shift Kasir</span>
          </button>
        )}
      </div>

      {/* 2. ROLE-SPECIFIC BANNER / STATS CARDS */}
      {isCashier ? (
        /* Cashier Shift Status Card */
        hasActiveShift ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-komazi-surface to-komazi-surface-2 border border-komazi-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-komazi-teal/15 border border-komazi-teal/30 flex items-center justify-center text-komazi-teal-light shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-komazi-text">
                    Shift Aktif: {activeShift.cashierName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-success/15 border border-success/30 text-success">
                    Shift #{activeShift.id}
                  </span>
                </div>
                <p className="text-xs text-komazi-muted mt-0.5">
                  Dibuka sejak: <span className="text-komazi-text font-semibold">{formatDateTime(activeShift.openedAt)}</span>
                  {' • '}Modal Kas Awal: <span className="text-komazi-text font-semibold">{formatRupiah(activeShift.openingCash)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-komazi-surface/80 p-2.5 rounded-xl border border-komazi-border shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-komazi-muted block">Transaksi Shift Ini</span>
                <span className="text-base font-black text-komazi-text">{stats.paidCount} Transaksi</span>
              </div>
              <div className="h-8 w-px bg-komazi-border"></div>
              <div>
                <span className="text-[10px] uppercase font-bold text-komazi-muted block">Omzet Shift Ini</span>
                <span className="text-base font-black text-komazi-coral font-mono">
                  {formatRupiah(stats.totalOmzet)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Shift State for Cashier */
          <div className="p-8 sm:p-12 rounded-3xl bg-komazi-surface border-2 border-dashed border-komazi-border text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-danger/15 border border-danger/30 text-danger flex items-center justify-center mx-auto shadow-lg">
              <Lock className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-lg font-bold text-komazi-text">Shift Kasir Belum Dibuka</h2>
              <p className="text-xs text-komazi-muted leading-relaxed">
                Sebagai kasir, riwayat pesanan Anda diisolasi per shift demi keamanan pencatatan finansial. Buka shift kasir terlebih dahulu untuk mulai melayani transaksi baru dan melihat riwayat penjualan shift Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <CircleDot className="w-4 h-4" />
              <span>Buka Shift Kasir Sekarang</span>
            </button>
          </div>
        )
      ) : (
        /* Owner & Manager Supervisory 4 Summary Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Omzet Terfilter */}
          <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase text-komazi-muted tracking-wider">
                Total Omzet Terfilter
              </span>
              <p className="font-mono font-black text-lg text-komazi-coral">
                {formatRupiah(stats.totalOmzet)}
              </p>
              <span className="text-[10px] text-komazi-muted">
                {stats.paidCount} transaksi berhasil
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Total Transaksi & Metode */}
          <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase text-komazi-muted tracking-wider">
                Volume Transaksi
              </span>
              <p className="font-black text-lg text-komazi-text">
                {stats.totalOrders} Transaksi
              </p>
              <span className="text-[10px] text-komazi-muted">
                {stats.cashCount} Tunai • {stats.nonCashCount} QRIS/Trf
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-komazi-teal/15 border border-komazi-teal/30 flex items-center justify-center text-komazi-teal-light">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Status Selesai */}
          <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase text-komazi-muted tracking-wider">
                Transaksi Sukses
              </span>
              <p className="font-black text-lg text-success">
                {stats.paidCount} Transaksi
              </p>
              <span className="text-[10px] text-success font-semibold">
                Status: PAID
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center text-success">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Void & Refund */}
          <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase text-komazi-muted tracking-wider">
                Void & Refund
              </span>
              <p className="font-black text-lg text-warning">
                {stats.voidCount + stats.refundCount} Kasus
              </p>
              <span className="text-[10px] text-danger font-medium">
                {stats.voidCount} Void • {stats.refundCount} Refund ({formatRupiah(stats.totalRefundAmount)})
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center text-warning">
              <Ban className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* 3. FILTER BAR */}
      {(!isCashier || hasActiveShift) && (
        <div className="p-3 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          {/* Search box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-komazi-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={isCashier ? 'Cari no. invoice, meja...' : 'Cari invoice, kasir, pelanggan...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Owner & Manager: Filter Sesi Shift */}
            {isManagerOrOwner && (
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="py-2 px-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-semibold focus:border-komazi-coral outline-none cursor-pointer"
                title="Filter berdasarkan sesi shift"
              >
                <option value="ALL">Semua Sesi Shift</option>
                {shiftList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}

            {/* Owner & Manager: Filter Staf Kasir */}
            {isManagerOrOwner && (
              <select
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="py-2 px-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-semibold focus:border-komazi-coral outline-none cursor-pointer"
                title="Filter berdasarkan nama kasir"
              >
                <option value="ALL">Semua Kasir</option>
                {distinctCashiers.map((name) => (
                  <option key={name} value={name}>
                    Kasir: {name}
                  </option>
                ))}
              </select>
            )}

            {/* Owner & Manager: Filter Rentang Waktu */}
            {isManagerOrOwner && (
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="py-2 px-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-semibold focus:border-komazi-coral outline-none cursor-pointer"
              >
                <option value="ALL">Semua Tanggal</option>
                <option value="TODAY">Hari Ini</option>
                <option value="7DAYS">7 Hari Terakhir</option>
                <option value="30DAYS">30 Hari Terakhir</option>
              </select>
            )}

            {/* Status Filter (Available to all) */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-semibold focus:border-komazi-coral outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="PAID">Berhasil (PAID)</option>
              <option value="VOIDED">Dibatalkan (VOIDED)</option>
              <option value="REFUNDED">Dikembalikan (REFUNDED)</option>
            </select>
          </div>
        </div>
      )}

      {/* 4. ORDERS TABLE */}
      {(!isCashier || hasActiveShift) && (
        <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-komazi-border bg-komazi-surface-2 text-komazi-muted font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">No. Invoice</th>
                  <th className="py-3 px-4">Waktu Transaksi</th>
                  {isManagerOrOwner && <th className="py-3 px-4">Kasir & Shift</th>}
                  <th className="py-3 px-4">Pelanggan / Meja</th>
                  <th className="py-3 px-4">Item Pesanan</th>
                  <th className="py-3 px-4">Metode Bayar</th>
                  <th className="py-3 px-4 text-right">Total Akhir</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-komazi-border">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isManagerOrOwner ? 9 : 8}
                      className="py-16 text-center text-komazi-muted space-y-2"
                    >
                      <Receipt className="w-10 h-10 mx-auto text-komazi-muted/40" />
                      <p className="font-semibold text-sm text-komazi-text">
                        {isCashier
                          ? 'Belum ada transaksi pada shift ini.'
                          : 'Tidak ada transaksi yang sesuai kriteria filter.'}
                      </p>
                      <p className="text-xs text-komazi-muted">
                        {isCashier
                          ? 'Transaksi baru dari meja kasir akan langsung muncul di sini secara real-time.'
                          : 'Coba ubah filter kasir, shift, atau rentang waktu di atas.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => {
                    const payment = order.payments?.[0];
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-komazi-surface-2/60 transition-colors"
                      >
                        {/* 1. Invoice No */}
                        <td className="py-3.5 px-4 font-mono font-bold text-komazi-coral">
                          {order.invoiceNo}
                        </td>

                        {/* 2. Date Time */}
                        <td className="py-3.5 px-4 text-komazi-muted whitespace-nowrap">
                          {formatDateTime(order.createdAt)}
                        </td>

                        {/* 3. Kasir & Shift (Special for Manager / Owner Oversight) */}
                        {isManagerOrOwner && (
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-komazi-text">
                              {order.cashierName || 'Kasir'}
                            </div>
                            <span className="inline-block mt-0.5 px-2 py-0.2 rounded text-[10px] font-mono font-semibold bg-komazi-surface-2 border border-komazi-border text-komazi-muted">
                              {order.shiftId ? `Shift #${order.shiftId}` : 'Shift Berjalan'}
                            </span>
                          </td>
                        )}

                        {/* 4. Customer / Table */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-komazi-text">
                            {order.customerName || 'Tamu Komazi'}
                          </div>
                          <div className="text-[10px] text-komazi-muted">
                            {(order.type === 'DINE_IN' || order.orderType === 'DINE_IN')
                              ? `Dine In • Meja ${order.tableNo || '-'}`
                              : 'Take Away'}
                          </div>
                        </td>

                        {/* 5. Items summary */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="line-clamp-2 text-komazi-muted text-[11px]">
                            {order.items?.map((i) => `${i.productName || i.name} (${i.qty}x)`).join(', ')}
                            {order.workspaceSession && (
                              <span className="text-komazi-teal-light font-medium ml-1">
                                + Workspace ({order.workspaceSession.areaName})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Payment Method */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-komazi-surface-2 border border-komazi-border font-bold text-[10px] text-komazi-text">
                            {payment?.method || order.paymentMethod || 'CASH'}
                          </span>
                        </td>

                        {/* 7. Total Final */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-komazi-coral tabular-nums whitespace-nowrap">
                          {formatRupiah(order.total)}
                        </td>

                        {/* 8. Status Badge */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              order.status === 'PAID'
                                ? 'bg-success/15 text-success border border-success/30'
                                : order.status === 'VOIDED'
                                ? 'bg-danger/15 text-danger border border-danger/30'
                                : 'bg-warning/15 text-warning border border-warning/30'
                            }`}
                          >
                            {order.status === 'PAID' && <CheckCircle className="w-3 h-3" />}
                            {order.status === 'VOIDED' && <XCircle className="w-3 h-3" />}
                            {order.status === 'REFUNDED' && <RotateCcw className="w-3 h-3" />}
                            <span>{order.status}</span>
                          </span>
                          {order.voidReason && (
                            <p className="text-[9px] text-danger italic mt-0.5 max-w-[120px] truncate mx-auto">
                              "{order.voidReason}"
                            </p>
                          )}
                          {order.refundReason && (
                            <p className="text-[9px] text-warning italic mt-0.5 max-w-[120px] truncate mx-auto">
                              "{order.refundReason}"
                            </p>
                          )}
                        </td>

                        {/* 9. Action Buttons */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Reprint Struk */}
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(order)}
                              title="Cetak Ulang Struk Thermal"
                              className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-coral hover:text-white text-komazi-muted transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Void Button (only if PAID) */}
                            {order.status === 'PAID' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoidTargetOrder(order);
                                  setVoidReason('');
                                  setManagerPin('');
                                }}
                                title={
                                  isManagerOrOwner
                                    ? 'Batalkan / Void Transaksi (Akses Langsung Manager)'
                                    : 'Batalkan / Void Transaksi (Perlu Otorisasi PIN)'
                                }
                                className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-danger hover:text-white text-komazi-muted transition-colors"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Refund Button (only if PAID) */}
                            {order.status === 'PAID' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRefundTargetOrder(order);
                                  setRefundAmount(order.total);
                                  setRefundReason('');
                                  setManagerPin('');
                                }}
                                title="Refund / Pengembalian Dana"
                                className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-warning hover:text-black text-komazi-muted transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalItems={filteredOrders.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            itemLabel="transaksi"
          />
        </div>
      )}

      {/* Modal: Receipt Preview */}
      {selectedReceipt && (
        <ThermalReceiptModal
          order={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Modal: Shift Modal for Cashier */}
      {isShiftModalOpen && (
        <ShiftModal onClose={() => setIsShiftModalOpen(false)} />
      )}

      {/* Modal: Void Order */}
      {voidTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border bg-danger/10">
              <div className="flex items-center gap-2 text-danger">
                <Ban className="w-5 h-5" />
                <h3 className="font-bold text-base">Void Transaksi: {voidTargetOrder.invoiceNo}</h3>
              </div>
              <button
                onClick={() => setVoidTargetOrder(null)}
                className="text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmVoid} className="p-5 space-y-4">
              <p className="text-xs text-komazi-muted">
                Tindakan void akan membatalkan seluruh nilai transaksi{' '}
                <strong className="text-komazi-coral font-mono">{formatRupiah(voidTargetOrder.total)}</strong>.
                Aksi ini tercatat permanen di audit log.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5">
                  Alasan Void (Wajib):
                </label>
                <textarea
                  required
                  rows="2"
                  placeholder="Contoh: Kesalahan input menu / pelanggan batal pesan..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-danger focus:outline-none"
                />
              </div>

              {!isManagerOrOwner ? (
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-danger" />
                    <span>PIN Otorisasi Manager:</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan PIN Supervisor (4-6 digit)"
                    value={managerPin}
                    onChange={(e) => setManagerPin(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-danger focus:outline-none"
                    required
                  />
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-success/10 border border-success/30 text-success text-[11px] font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Akses Langsung: Anda memiliki otorisasi penuh sebagai {user?.role}.</span>
                </div>
              )}

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setVoidTargetOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-danger hover:bg-danger/90 text-white font-bold text-xs shadow-md"
                >
                  Konfirmasi Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Refund Order */}
      {refundTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border bg-warning/10">
              <div className="flex items-center gap-2 text-warning">
                <RotateCcw className="w-5 h-5" />
                <h3 className="font-bold text-base">Refund Transaksi: {refundTargetOrder.invoiceNo}</h3>
              </div>
              <button
                onClick={() => setRefundTargetOrder(null)}
                className="text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRefund} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5">
                  Nominal Pengembalian Dana:
                </label>
                <input
                  type="number"
                  max={refundTargetOrder.total}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono font-bold focus:border-warning focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5">
                  Alasan Refund (Wajib):
                </label>
                <textarea
                  required
                  rows="2"
                  placeholder="Contoh: Kualitas pesanan tidak sesuai, pengembalian tunai ke pelanggan..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-warning focus:outline-none"
                />
              </div>

              {!isManagerOrOwner ? (
                <div>
                  <label className="block text-xs font-bold uppercase text-komazi-muted mb-1.5 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-warning" />
                    <span>PIN Otorisasi Manager:</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Masukkan PIN Supervisor (4-6 digit)"
                    value={managerPin}
                    onChange={(e) => setManagerPin(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-warning focus:outline-none"
                    required
                  />
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-success/10 border border-success/30 text-success text-[11px] font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Akses Langsung: Anda memiliki otorisasi penuh sebagai {user?.role}.</span>
                </div>
              )}

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setRefundTargetOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-warning hover:bg-warning/90 text-black font-bold text-xs shadow-md"
                >
                  Konfirmasi Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
