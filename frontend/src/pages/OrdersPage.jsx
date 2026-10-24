import React, { useState, useMemo, useEffect } from 'react';
import { useOrdersStore } from '../store/ordersStore';
import { useAuthStore } from '../store/authStore';
import { useShiftStore } from '../store/shiftStore';
import { formatRupiah, formatDateTime, getLocalDateString } from '../utils/format';
import ThermalReceiptModal from '../components/pos/ThermalReceiptModal';
import ShiftModal from '../components/shift/ShiftModal';
import Pagination from '../components/ui/Pagination';
import OrdersTableSkeleton from '../components/ui/loading/skeletons/OrdersTableSkeleton';
import { toast } from '../store/toastStore';
import { api } from '../services/api';
import { exportOrdersToExcel, exportOrdersToCsv } from '../utils/excel';
import ExportOrdersModal from '../components/orders/ExportOrdersModal';
import OrderDetailModal from '../components/orders/OrderDetailModal';
import { usePersistentState } from '../hooks/usePersistentState';
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
  Undo2,
  Layers,
  ShieldCheck,
  Eye,
  Clock,
  Sparkles,
  CreditCard,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Download,
  SlidersHorizontal,
} from 'lucide-react';

export default function OrdersPage() {
  const orders = useOrdersStore((s) => s.orders);
  const fetchOrders = useOrdersStore((s) => s.fetchOrders);
  const voidOrder = useOrdersStore((s) => s.voidOrder);
  const refundOrder = useOrdersStore((s) => s.refundOrder);
  const isLoading = useOrdersStore((s) => s.isLoading);

  const user = useAuthStore((s) => s.user);

  const activeShift = useShiftStore((s) => s.activeShift);
  const shiftHistory = useShiftStore((s) => s.shiftHistory);
  const fetchActiveShift = useShiftStore((s) => s.fetchActiveShift);
  const fetchShiftHistory = useShiftStore((s) => s.fetchShiftHistory);

  useEffect(() => {
    let lastFetched = Date.now();
    // 1. Fetch fresh orders immediately upon mounting
    fetchOrders?.();
    fetchActiveShift?.();
    fetchShiftHistory?.();

    // 2. Auto-sync silently when window / tab regains focus or visibility (throttled)
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetched > 10000) {
        lastFetched = Date.now();
        fetchOrders?.();
        fetchActiveShift?.();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const role = user?.role || 'CASHIER';
  const isOwner = role === 'OWNER';
  const isManager = role === 'MANAGER';
  const isManagerOrOwner = isOwner || isManager;
  const isCashier = role === 'CASHIER';

  // Check if there is an active shift running
  const hasActiveShift = Boolean(activeShift && !activeShift.isClosed);

  // Filter States (Default: hari ini)
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = usePersistentState('orders_statusFilter', 'ALL'); // 'ALL' | 'PAID' | 'VOIDED' | 'REFUNDED'
  const [methodFilter, setMethodFilter] = usePersistentState('orders_methodFilter', 'ALL'); // 'ALL' | 'CASH' | 'QRIS' | 'TRANSFER'
  const [startDate, setStartDate] = useState(() => getLocalDateString(new Date()));
  const [endDate, setEndDate] = useState(() => getLocalDateString(new Date()));
  const [shiftFilter, setShiftFilter] = usePersistentState('orders_shiftFilter', 'ALL'); // 'ALL' | 'ACTIVE' | specific shiftId
  const [cashierFilter, setCashierFilter] = usePersistentState('orders_cashierFilter', 'ALL'); // 'ALL' | cashierName

  // Preset Tanggal Aktif (TODAY | YESTERDAY | 7DAYS | THIS_MONTH | ALL | CUSTOM)
  const activeDatePreset = useMemo(() => {
    if (!startDate && !endDate) return 'ALL';
    if (startDate === todayStr && endDate === todayStr) return 'TODAY';

    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yStr = getLocalDateString(yDate);
    if (startDate === yStr && endDate === yStr) return 'YESTERDAY';

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenStr = getLocalDateString(sevenDaysAgo);
    if (startDate === sevenStr && endDate === todayStr) return '7DAYS';

    const now = new Date();
    const firstOfMonth = getLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    if (startDate === firstOfMonth && endDate === todayStr) return 'THIS_MONTH';

    return 'CUSTOM';
  }, [startDate, endDate, todayStr]);

  const handleSelectDatePreset = (preset) => {
    const now = new Date();
    const tStr = getLocalDateString(now);

    if (preset === 'TODAY') {
      setStartDate(tStr);
      setEndDate(tStr);
    } else if (preset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = getLocalDateString(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7DAYS') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      setStartDate(getLocalDateString(past));
      setEndDate(tStr);
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(getLocalDateString(start));
      setEndDate(tStr);
    } else if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = React.useRef(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setShowExportDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      const name = o.cashierName || o.cashier?.name || o.shift?.cashier?.name;
      if (name) names.add(name);
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
      // 1. Shift filter (if active shift filter selected)
      if (shiftFilter === 'ACTIVE') {
        if (!activeShift) return false;
        const isAct =
          order.shiftId === activeShift.id ||
          new Date(order.createdAt).getTime() >= new Date(activeShift.openedAt).getTime();
        if (!isAct) return false;
      } else if (shiftFilter !== 'ALL') {
        if (String(order.shiftId) !== String(shiftFilter)) return false;
      }

      // 2. Cashier filter
      if (cashierFilter !== 'ALL') {
        const orderCashier = order.cashierName || order.cashier?.name || order.shift?.cashier?.name;
        if (orderCashier !== cashierFilter) return false;
      }

      // 3. Status filter
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      // 4. Payment Method filter
      if (methodFilter !== 'ALL') {
        const orderMethod = (order.payments?.[0]?.method || order.paymentMethod || 'CASH').toUpperCase();
        if (orderMethod !== methodFilter.toUpperCase()) {
          return false;
        }
      }

      // 5. Date Range filter (startDate & endDate)
      if (startDate || endDate) {
        if (!order.createdAt) return false;
        const localDate = new Date(order.createdAt);
        if (isNaN(localDate.getTime())) return false;
        const y = localDate.getFullYear();
        const m = String(localDate.getMonth() + 1).padStart(2, '0');
        const d = String(localDate.getDate()).padStart(2, '0');
        const orderDateStr = `${y}-${m}-${d}`;

        if (startDate && orderDateStr < startDate) return false;
        if (endDate && orderDateStr > endDate) return false;
      }

      // 6. Search query filter (no. invoice, nama pelanggan, meja, kasir)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInvoice = order.invoiceNo?.toLowerCase().includes(q);
        const matchCustomer = order.customerName && order.customerName.toLowerCase().includes(q);
        const matchTable = order.tableNo && String(order.tableNo).toLowerCase().includes(q);
        const orderCashier = order.cashierName || order.cashier?.name || order.shift?.cashier?.name;
        const matchCashier = orderCashier && orderCashier.toLowerCase().includes(q);
        if (!matchInvoice && !matchCustomer && !matchTable && !matchCashier) {
          return false;
        }
      }

      return true;
    });
  }, [
    orders,
    isManagerOrOwner,
    activeShift,
    shiftFilter,
    cashierFilter,
    statusFilter,
    methodFilter,
    startDate,
    endDate,
    searchQuery,
  ]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = usePersistentState('orders_itemsPerPage', 10);

  // Reset ke halaman pertama saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, methodFilter, startDate, endDate, shiftFilter, cashierFilter]);

  // Status apakah ada filter yang berbeda dari kondisi default (Hari Ini)
  const isFiltered = Boolean(
    searchQuery.trim() ||
    statusFilter !== 'ALL' ||
    methodFilter !== 'ALL' ||
    shiftFilter !== 'ALL' ||
    cashierFilter !== 'ALL' ||
    startDate !== todayStr ||
    endDate !== todayStr
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setMethodFilter('ALL');
    const tStr = getLocalDateString(new Date());
    setStartDate(tStr);
    setEndDate(tStr);
    setShiftFilter('ALL');
    setCashierFilter('ALL');
    setCurrentPage(1);
  };

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

    try {
      const res = await refundOrder(
        refundTargetOrder.id,
        refundReason,
        refundAmount,
        user?.name || (isManagerOrOwner ? 'Owner' : 'Kasir')
      );
      if (res?.pendingApproval) {
        toast.info(res.message || 'Permintaan refund berhasil diajukan! Menunggu persetujuan Owner.');
      } else {
        toast.success(`Pengembalian dana senilai ${formatRupiah(refundAmount)} berhasil diproses`);
      }
      setRefundTargetOrder(null);
      setRefundReason('');
      fetchOrders?.();
    } catch (err) {
      toast.error(err?.message || 'Gagal memproses refund');
    }
  };

  const getFilterMeta = (scope = 'FILTERED') => {
    let shiftLabel = 'Semua Shift';
    if (shiftFilter === 'ACTIVE') {
      shiftLabel = activeShift ? `Shift Aktif (${activeShift.cashierName})` : 'Shift Aktif';
    } else if (shiftFilter !== 'ALL') {
      const found = (shiftHistory || []).find((s) => String(s.id) === String(shiftFilter));
      shiftLabel = found ? `Shift #${found.id} - ${found.cashierName}` : `Shift #${shiftFilter}`;
    }

    let dateRangeLabel = 'Semua Tanggal';
    if (startDate && endDate) {
      if (startDate === endDate) {
        dateRangeLabel = startDate === todayStr ? `Hari Ini (${startDate})` : startDate;
      } else {
        dateRangeLabel = `${startDate} s/d ${endDate}`;
      }
    } else if (startDate) {
      dateRangeLabel = `Mulai ${startDate}`;
    } else if (endDate) {
      dateRangeLabel = `Sampai ${endDate}`;
    }

    return {
      status: scope === 'ALL' ? 'ALL' : statusFilter,
      method: scope === 'ALL' ? 'ALL' : methodFilter,
      dateRange: scope === 'ALL' ? 'Semua Riwayat' : dateRangeLabel,
      cashier: scope === 'ALL' ? 'Semua Kasir' : cashierFilter,
      shift: scope === 'ALL' ? 'Semua Shift' : shiftLabel,
      search: scope === 'ALL' ? '' : searchQuery.trim(),
      scope: scope === 'ALL' ? 'Semua Riwayat' : 'Data Terfilter',
    };
  };

  const handleQuickExport = (format = 'XLSX', scope = 'FILTERED') => {
    setShowExportDropdown(false);
    const targetList = scope === 'ALL' ? orders : filteredOrders;
    if (!targetList || targetList.length === 0) {
      toast.warning('Tidak ada data pesanan untuk diekspor pada pilihan ini.');
      return;
    }

    try {
      const meta = getFilterMeta(scope);
      if (format === 'XLSX') {
        const res = exportOrdersToExcel({
          orders: targetList,
          filterMeta: meta,
          storeName: 'Komazi Coffee & Workspace',
        });
        toast.success(
          `Berhasil mengekspor ${res.count} transaksi (${res.itemCount || 0} baris item) ke file ${res.fileName}`,
          'Ekspor Excel'
        );
      } else {
        const res = exportOrdersToCsv({
          orders: targetList,
          filterMeta: meta,
          storeName: 'Komazi Coffee & Workspace',
        });
        toast.success(
          `Berhasil mengekspor ${res.count} transaksi ke file ${res.fileName}`,
          'Ekspor CSV'
        );
      }
    } catch (err) {
      console.error('[ExportOrders Error]', err);
      toast.error(err?.message || 'Gagal mengekspor riwayat pesanan');
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header with Role Mode Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
              <Receipt className="w-6 h-6 text-komazi-coral" />
              <span>Riwayat Pesanan</span>
            </h1>
          </div>

          <p className="text-xs text-komazi-muted mt-1">
            {isCashier
              ? 'Menampilkan daftar invoice transaksi yang diproses selama shift kasir Anda sedang aktif.'
              : 'Memantau seluruh transaksi penjualan dari semua kasir dan seluruh sesi shift outlet.'}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Export Dropdown Group */}
          <div className="relative" ref={exportDropdownRef}>
            <div className="inline-flex items-center rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all overflow-hidden">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                disabled={orders.length === 0}
                className="inline-flex items-center gap-2 pl-3.5 pr-2.5 py-2.5 text-white font-bold text-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Buka panel dialog ekspor riwayat pesanan (Excel & CSV)"
              >
                <Download className="w-4 h-4 text-emerald-100" />
                <span>Ekspor</span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-emerald-900/50 text-emerald-100 font-mono font-bold">
                  {filteredOrders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowExportDropdown((prev) => !prev)}
                disabled={orders.length === 0}
                className="pr-2.5 pl-1.5 py-2.5 text-white/90 hover:text-white border-l border-emerald-500/50 cursor-pointer active:scale-95 disabled:opacity-40"
                title="Pilihan cepat ekspor Excel / CSV"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showExportDropdown ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {/* Dropdown Menu */}
            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-komazi-muted border-b border-komazi-border/70 flex items-center justify-between">
                  <span>Pilihan Cepat Ekspor</span>
                  <span className="font-mono text-komazi-coral">{filteredOrders.length} Terfilter</span>
                </div>

                {/* Section Excel */}
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3 h-3" />
                    <span>Microsoft Excel (.xlsx)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickExport('XLSX', 'FILTERED')}
                    disabled={filteredOrders.length === 0}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-komazi-text hover:bg-komazi-surface-2 flex items-center justify-between disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    <span>Sesuai Filter Aktif</span>
                    <span className="text-[10px] text-komazi-muted font-mono">{filteredOrders.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickExport('XLSX', 'ALL')}
                    disabled={orders.length === 0}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-komazi-text hover:bg-komazi-surface-2 flex items-center justify-between disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    <span>Semua Riwayat</span>
                    <span className="text-[10px] text-komazi-muted font-mono">{orders.length}</span>
                  </button>
                </div>

                {/* Section CSV */}
                <div className="py-1 border-t border-komazi-border/60">
                  <div className="px-3 py-1 text-[10px] font-bold text-blue-400 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" />
                    <span>Format CSV (.csv)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickExport('CSV', 'FILTERED')}
                    disabled={filteredOrders.length === 0}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-komazi-text hover:bg-komazi-surface-2 flex items-center justify-between disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    <span>Sesuai Filter Aktif</span>
                    <span className="text-[10px] text-komazi-muted font-mono">{filteredOrders.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickExport('CSV', 'ALL')}
                    disabled={orders.length === 0}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-komazi-text hover:bg-komazi-surface-2 flex items-center justify-between disabled:opacity-40 cursor-pointer transition-colors"
                  >
                    <span>Semua Riwayat</span>
                    <span className="text-[10px] text-komazi-muted font-mono">{orders.length}</span>
                  </button>
                </div>

                {/* Custom Modal Option */}
                <div className="pt-1 border-t border-komazi-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportDropdown(false);
                      setIsExportModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-komazi-coral hover:bg-komazi-coral/10 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Opsi</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={async () => {
              await fetchOrders?.();
              await fetchActiveShift?.();
              toast.info('Data riwayat pesanan disinkronkan dengan server', 'Sinkronisasi');
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-komazi-surface border border-komazi-border hover:bg-komazi-surface-2 text-komazi-text font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Segarkan riwayat pesanan dari server"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-komazi-coral' : 'text-komazi-muted'}`} />
          </button>
        </div>
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
                <span className="text-[10px] uppercase font-bold text-komazi-muted block">
                  {isFiltered ? 'Transaksi Terfilter' : 'Transaksi Shift Ini'}
                </span>
                <span className="text-base font-black text-komazi-text">{stats.paidCount} Transaksi</span>
              </div>
              <div className="h-8 w-px bg-komazi-border"></div>
              <div>
                <span className="text-[10px] uppercase font-bold text-komazi-muted block">
                  {isFiltered ? 'Omzet Terfilter' : 'Omzet Shift Ini'}
                </span>
                <span className="text-base font-black text-komazi-coral font-mono">
                  {formatRupiah(stats.totalOmzet)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Informative Shift Status Banner for Cashier */
          <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-komazi-text">
                  Shift Kasir Belum Dibuka
                </h3>
                <p className="text-xs text-komazi-muted">
                  Buka shift kasir untuk melayani transaksi baru. Anda tetap dapat mencari dan memfilter riwayat pesanan berdasarkan tanggal di bawah ini.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsShiftModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
            >
              <CircleDot className="w-4 h-4" />
              <span>Buka Shift Kasir</span>
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
                Jumlah Transaksi
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

      {/* 3. FILTER BAR (Exact match to requested UI layout) */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Input 1: Cari no. pesanan atau pelanggan... */}
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Cari no. pesanan atau pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted/70 focus:border-komazi-coral focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-komazi-muted hover:text-white transition-colors"
                title="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown 2: Semua Status */}
          <div className="relative min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-medium focus:border-komazi-coral focus:outline-none cursor-pointer transition-colors"
            >
              <option value="ALL">Semua Status</option>
              <option value="PAID">Berhasil (PAID)</option>
              <option value="VOIDED">Dibatalkan (VOID)</option>
              <option value="REFUNDED">Dikembalikan (REFUND)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-komazi-muted absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Dropdown 3: Semua Metode */}
          <div className="relative min-w-[145px]">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-medium focus:border-komazi-coral focus:outline-none cursor-pointer transition-colors"
            >
              <option value="ALL">Semua Metode</option>
              <option value="CASH">Tunai (Cash)</option>
              <option value="QRIS">QRIS Dinamis</option>
              <option value="TRANSFER">Transfer Bank</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-komazi-muted absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Date Range 4 & 5: [ dd/mm/tttt 📅 ] hingga [ dd/mm/tttt 📅 ] */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-medium focus:border-komazi-coral focus:outline-none [color-scheme:dark] cursor-pointer"
              title="Dari tanggal"
            />
            <span className="text-xs text-komazi-muted font-medium px-0.5 select-none">
              hingga
            </span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-medium focus:border-komazi-coral focus:outline-none [color-scheme:dark] cursor-pointer"
              title="Sampai tanggal"
            />
          </div>

          {/* Tombol Reset Filter */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-komazi-coral hover:bg-komazi-coral/10 border border-komazi-coral/30 transition-all active:scale-95 shrink-0"
              title="Reset semua filter ke kondisi awal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Preset Tanggal Cepat & Filter Opsi */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-komazi-border/50 text-xs">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted/80 mr-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-komazi-coral" />
              <span>Waktu:</span>
            </span>
            <button
              type="button"
              onClick={() => handleSelectDatePreset('TODAY')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeDatePreset === 'TODAY'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'bg-komazi-surface-2 hover:bg-komazi-surface-2/80 text-komazi-muted hover:text-white border border-komazi-border'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => handleSelectDatePreset('YESTERDAY')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeDatePreset === 'YESTERDAY'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'bg-komazi-surface-2 hover:bg-komazi-surface-2/80 text-komazi-muted hover:text-white border border-komazi-border'
              }`}
            >
              Kemarin
            </button>
            <button
              type="button"
              onClick={() => handleSelectDatePreset('7DAYS')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeDatePreset === '7DAYS'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'bg-komazi-surface-2 hover:bg-komazi-surface-2/80 text-komazi-muted hover:text-white border border-komazi-border'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => handleSelectDatePreset('THIS_MONTH')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeDatePreset === 'THIS_MONTH'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'bg-komazi-surface-2 hover:bg-komazi-surface-2/80 text-komazi-muted hover:text-white border border-komazi-border'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handleSelectDatePreset('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                activeDatePreset === 'ALL'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'bg-komazi-surface-2 hover:bg-komazi-surface-2/80 text-komazi-muted hover:text-white border border-komazi-border'
              }`}
            >
              Semua
            </button>
          </div>

          {/* Filter Opsi Shift & Kasir */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted/80 mr-0.5">
              Opsi:
            </span>

            {/* Filter Shift */}
            <div className="relative">
              <select
                value={shiftFilter}
                onChange={(e) => setShiftFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-[11px] text-komazi-text font-semibold focus:border-komazi-coral outline-none cursor-pointer"
                title="Filter berdasarkan shift"
              >
                <option value="ALL">Semua Shift</option>
                {shiftList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-komazi-muted absolute right-2 top-2.5 pointer-events-none" />
            </div>

            {/* Filter Kasir */}
            <div className="relative">
              <select
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-[11px] text-komazi-text font-semibold focus:border-komazi-coral outline-none cursor-pointer"
                title="Filter berdasarkan kasir"
              >
                <option value="ALL">Semua Kasir</option>
                {distinctCashiers.map((name) => (
                  <option key={name} value={name}>
                    Kasir: {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-komazi-muted absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. ORDERS TABLE */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-komazi-border bg-komazi-surface-2 text-komazi-muted font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">No. Invoice</th>
                  <th className="py-3 px-4">Waktu Transaksi</th>
                  <th className="py-3 px-4">Kasir</th>
                  <th className="py-3 px-4">Pelanggan / Meja</th>
                  <th className="py-3 px-4">Item Pesanan</th>
                  <th className="py-3 px-4">Metode Bayar</th>
                  <th className="py-3 px-4 text-right">Total Akhir</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-komazi-border">
                {isLoading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-4 sm:p-6 bg-komazi-black/40">
                      <OrdersTableSkeleton rows={5} />
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-16 text-center text-komazi-muted space-y-2"
                    >
                      <Receipt className="w-10 h-10 mx-auto text-komazi-muted/40" />
                      <p className="font-semibold text-sm text-komazi-text">
                        {activeDatePreset === 'TODAY' && !searchQuery && statusFilter === 'ALL' && methodFilter === 'ALL' && shiftFilter === 'ALL' && cashierFilter === 'ALL'
                          ? 'Belum ada transaksi untuk hari ini.'
                          : 'Tidak ada transaksi yang sesuai kriteria filter.'}
                      </p>
                      <p className="text-xs text-komazi-muted max-w-md mx-auto">
                        {activeDatePreset === 'TODAY' && !searchQuery && statusFilter === 'ALL' && methodFilter === 'ALL' && shiftFilter === 'ALL' && cashierFilter === 'ALL'
                          ? 'Gunakan tombol preset atau pilih rentang tanggal lain untuk melihat riwayat sebelumnya.'
                          : 'Coba sesuaikan kata kunci pencarian, filter kasir, shift, atau rentang waktu di atas.'}
                      </p>
                      {(activeDatePreset === 'TODAY' || isFiltered) && orders.length > 0 && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleSelectDatePreset('ALL')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral/90 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Lihat Semua Riwayat Transaksi</span>
                          </button>
                        </div>
                      )}
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
                          <button
                            type="button"
                            onClick={() => setSelectedOrderDetail(order)}
                            className="hover:underline hover:text-white transition-colors cursor-pointer text-left font-mono font-bold text-komazi-coral"
                            title="Klik untuk melihat rincian detail pesanan"
                          >
                            {order.invoiceNo}
                          </button>
                        </td>

                        {/* 2. Date Time */}
                        <td className="py-3.5 px-4 text-komazi-muted whitespace-nowrap">
                          {formatDateTime(order.createdAt)}
                        </td>

                        {/* 3. Kasir & Shift (Visible to all cashiers & managers) */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-komazi-text">
                            {order.cashierName || order.cashier?.name || order.shift?.cashier?.name || 'Kasir'}
                          </div>
                        </td>

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
                            {/* Lihat Detail Pesanan */}
                            <button
                              type="button"
                              onClick={() => setSelectedOrderDetail(order)}
                              title="Lihat Rincian Detail Pesanan"
                              className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-teal-light hover:text-white text-komazi-muted transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Reprint Struk Pelanggan */}
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(order)}
                              title="Cetak Ulang Struk Pelanggan"
                              className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-coral hover:text-white text-komazi-muted transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Cetak Struk Pertinggal (Salinan Kasir) */}
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt({ ...order, initialReceiptType: 'merchant' })}
                              title="Cetak Struk Pertinggal (Salinan Kasir / Arsip Toko)"
                              className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-amber-500 hover:text-white text-komazi-muted transition-colors cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
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
                                <Undo2 className="w-3.5 h-3.5" />
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

      {/* Modal: Dedicated Order Detail View */}
      {selectedOrderDetail && (
        <OrderDetailModal
          isOpen={Boolean(selectedOrderDetail)}
          order={selectedOrderDetail}
          onClose={() => setSelectedOrderDetail(null)}
          onPrintCustomerReceipt={(ord) => {
            setSelectedOrderDetail(null);
            setSelectedReceipt(ord);
          }}
          onPrintMerchantReceipt={(ord) => {
            setSelectedOrderDetail(null);
            setSelectedReceipt({ ...ord, initialReceiptType: 'merchant' });
          }}
        />
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
                <div className="p-3 rounded-xl bg-komazi-coral/10 border border-komazi-coral/20 flex items-start gap-2.5 text-xs text-komazi-coral">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-komazi-text">Pengajuan Refund Tanpa Otorisasi PIN</p>
                    <p className="text-[11px] text-komazi-muted mt-0.5">
                      Permintaan refund akan langsung dikirimkan ke Owner untuk disetujui tanpa perlu memasukkan PIN otorisasi.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-success/10 border border-success/30 text-success text-[11px] font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Akses Langsung: Anda memiliki otorisasi penuh sebagai {user?.role}. Refund langsung diproses.</span>
                </div>
              )}

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setRefundTargetOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-warning hover:bg-warning/90 text-black font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  {isManagerOrOwner ? 'Konfirmasi Refund' : 'Ajukan Refund ke Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Export Orders Modal */}
      <ExportOrdersModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={orders}
        filteredOrders={filteredOrders}
        activeFilters={{
          status: statusFilter,
          method: methodFilter,
          dateRange:
            startDate && endDate
              ? startDate === endDate
                ? startDate === todayStr
                  ? `Hari Ini (${startDate})`
                  : startDate
                : `${startDate} s/d ${endDate}`
              : startDate
              ? `Mulai ${startDate}`
              : endDate
              ? `Sampai ${endDate}`
              : 'Semua Tanggal',
          cashier: cashierFilter,
          shift:
            shiftFilter === 'ACTIVE'
              ? activeShift
                ? `Shift Aktif (${activeShift.cashierName})`
                : 'Shift Aktif'
              : shiftFilter !== 'ALL'
              ? `Shift #${shiftFilter}`
              : 'Semua Shift',
          search: searchQuery.trim(),
        }}
      />
    </div>
  );
}
