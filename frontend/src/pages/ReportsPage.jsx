import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOrdersStore } from '../store/ordersStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useStockStore } from '../store/stockStore';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { formatRupiah } from '../utils/format';
import { useSettingsStore } from '../store/settingsStore';
import { exportReportToCsv, exportReportToExcel } from '../utils/exportReport';
import CogsReportView from '../components/reports/CogsReportView';
import ProfitLossView from '../components/reports/ProfitLossView';
import TopProductInsightCard from '../components/analytics/TopProductInsightCard';
import DashboardMetricsSkeleton from '../components/ui/loading/skeletons/DashboardMetricsSkeleton';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Download,
  Calendar,
  Percent,
  AlertTriangle,
  CreditCard,
  Coffee,
  Scale,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  LineChart as LucideLineChart,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export default function ReportsPage({ tab: propTab }) {
  const { user } = useAuthStore();
  const canViewCogs = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const location = useLocation();
  const navigate = useNavigate();

  const orders = useOrdersStore((s) => s.orders);
  const fetchOrders = useOrdersStore((s) => s.fetchOrders);
  const isLoading = useOrdersStore((s) => s.isLoading);
  const { historySessions, sessions } = useWorkspaceStore();
  const { getLowStockItems } = useStockStore();

  const activeTab = React.useMemo(() => {
    if (propTab) return propTab;
    if (location.pathname.includes('/cogs')) return 'COGS';
    if (location.pathname.includes('/profit-loss')) return 'PROFIT_LOSS';
    return 'SALES';
  }, [propTab, location.pathname]);

  const handleTabChange = (newTab) => {
    if (newTab === 'COGS') navigate('/reports/cogs');
    else if (newTab === 'PROFIT_LOSS') navigate('/reports/profit-loss');
    else navigate('/reports/sales');
  };

  const [dateRange, setDateRange] = useState('TODAY'); // 'TODAY' | 'WEEK' | 'MONTH'

  React.useEffect(() => {
    let lastFetched = Date.now();
    fetchOrders?.();
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetched > 10000) {
        lastFetched = Date.now();
        fetchOrders?.();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Helper penentu batas rentang tanggal berbasis kalender lokal perangkat kasir
  const isOrderInDateRange = (orderCreatedAt, range) => {
    if (!orderCreatedAt) return false;
    const orderDate = new Date(orderCreatedAt);
    const now = new Date();

    if (range === 'TODAY') {
      return (
        orderDate.getFullYear() === now.getFullYear() &&
        orderDate.getMonth() === now.getMonth() &&
        orderDate.getDate() === now.getDate()
      );
    }

    if (range === 'WEEK') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      const orderTime = orderDate.getTime();
      return orderTime >= startOfWeek && orderTime <= endOfToday;
    }

    if (range === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      const orderTime = orderDate.getTime();
      return orderTime >= startOfMonth && orderTime <= endOfToday;
    }

    return true;
  };

  const dateRangeLabel =
    dateRange === 'TODAY'
      ? 'Hari Ini'
      : dateRange === 'WEEK'
      ? '7 Hari Terakhir'
      : 'Bulan Ini';

  // 1. Filter transaksi lunas (PAID) secara riil sesuai rentang tanggal yang dipilih
  const filteredOrders = React.useMemo(() => {
    if (!orders || orders.length === 0) return [];
    return orders.filter((o) => o.status === 'PAID' && isOrderInDateRange(o.createdAt, dateRange));
  }, [orders, dateRange]);

  // 2. Ringkasan KPI dihitung murni dari filteredOrders
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalTransactions = filteredOrders.length;
  const averageOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
  const workspaceTotalRevenue = filteredOrders.reduce(
    (sum, o) => sum + (o.workspaceSession ? Number(o.workspaceSession.charge || 0) : 0),
    0
  );
  const lowStockCount = getLowStockItems().length;

  // 3. Estimasi Laba Kotor & Margin HPP dari transaksi yang difilter
  const { totalCogs, grossProfit, grossMarginPct } = React.useMemo(() => {
    let cogs = 0;
    filteredOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        cogs += Number(item.lineCost || (Number(item.unitCost || 0) * Number(item.qty || 1)) || 0);
      });
    });
    const profit = Math.max(0, totalRevenue - cogs);
    const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 1000) / 10 : 0;
    return { totalCogs: cogs, grossProfit: profit, grossMarginPct: margin };
  }, [filteredOrders, totalRevenue]);

  // 4. Data Tren Penjualan Jam dihitung murni dari filteredOrders
  const hourlyBuckets = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
  const hourlyTotals = {};
  hourlyBuckets.forEach((b) => { hourlyTotals[b] = 0; });

  filteredOrders.forEach((o) => {
    if (!o.createdAt) return;
    const hour = new Date(o.createdAt).getHours();
    const bucketHour = Math.floor(hour / 2) * 2;
    const key = `${String(bucketHour).padStart(2, '0')}:00`;
    if (hourlyTotals[key] !== undefined) {
      hourlyTotals[key] += Number(o.total || 0);
    } else {
      hourlyTotals['20:00'] += Number(o.total || 0);
    }
  });

  const salesChartData = hourlyBuckets.map((time) => ({
    time,
    total: hourlyTotals[time] || 0,
  }));

  // 5. Produk Terlaris dihitung murni dari filteredOrders
  const productSalesMap = {};
  filteredOrders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const name = item.productName || item.name || 'Produk';
      if (!productSalesMap[name]) {
        productSalesMap[name] = { name, sales: 0, revenue: 0 };
      }
      productSalesMap[name].sales += Number(item.qty || 1);
      productSalesMap[name].revenue += Number(item.lineTotal || (Number(item.unitPrice || item.price || 0) * Number(item.qty || 1)));
    });
  });

  const sortedTopProducts = Object.values(productSalesMap).sort((a, b) => b.sales - a.sales);
  const topProductsData = sortedTopProducts.slice(0, 6);

  // 6. Metode Pembayaran dihitung murni dari filteredOrders
  const paymentCounts = { QRIS: 0, CASH: 0, TRANSFER: 0 };
  filteredOrders.forEach((o) => {
    const method = (o.paymentMethod || o.payments?.[0]?.method || 'CASH').toUpperCase();
    if (method.includes('QRIS')) paymentCounts.QRIS += 1;
    else if (method.includes('TRANSFER')) paymentCounts.TRANSFER += 1;
    else paymentCounts.CASH += 1;
  });

  const totalPayments = filteredOrders.length;
  const paymentMethodsData = totalPayments > 0 ? [
    { name: 'QRIS', count: paymentCounts.QRIS, value: Math.round((paymentCounts.QRIS / totalPayments) * 100), color: '#FF5A4D' },
    { name: 'Tunai (Cash)', count: paymentCounts.CASH, value: Math.round((paymentCounts.CASH / totalPayments) * 100), color: '#1F6F6B' },
    { name: 'Transfer Bank', count: paymentCounts.TRANSFER, value: Math.round((paymentCounts.TRANSFER / totalPayments) * 100), color: '#F5B544' },
  ] : [
    { name: 'QRIS', count: 0, value: 0, color: '#FF5A4D' },
    { name: 'Tunai (Cash)', count: 0, value: 0, color: '#1F6F6B' },
    { name: 'Transfer Bank', count: 0, value: 0, color: '#F5B544' },
  ];

  const { settings } = useSettingsStore();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format = 'CSV', scope = 'FILTERED') => {
    const targetOrders =
      scope === 'FILTERED' ? (filteredOrders.length > 0 ? filteredOrders : orders) : orders;
    const label =
      scope === 'FILTERED' && filteredOrders.length > 0 ? dateRangeLabel : 'Semua Transaksi';
    const storeName = settings?.storeName || 'Komazi Coffee & Workspace';

    if (!targetOrders || targetOrders.length === 0) {
      toast.error('Tidak ada data transaksi untuk diekspor!');
      return;
    }

    setShowExportMenu(false);
    try {
      if (format === 'EXCEL') {
        exportReportToExcel({
          orders: targetOrders,
          dateRangeLabel: label,
          canViewCogs,
          storeName,
        });
        toast.success(`Laporan Excel (.xlsx) berhasil diunduh (${targetOrders.length} transaksi)!`);
      } else {
        exportReportToCsv({
          orders: targetOrders,
          dateRangeLabel: label,
          canViewCogs,
          storeName,
        });
        toast.success(`Laporan CSV (.csv) berhasil diunduh (${targetOrders.length} transaksi)!`);
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Gagal mengekspor laporan: ' + err.message);
    }
  };

  const handleExportCSV = () => {
    handleExport('CSV', 'FILTERED');
  };

  const handleExportExcel = () => {
    handleExport('EXCEL', 'FILTERED');
  };

  // Dynamic header metadata per tab
  const pageMeta = {
    SALES: {
      title: 'Laporan Penjualan & Omzet',
      desc: 'Dashboard visual performa omzet harian, tren per jam, komposisi pembayaran, dan menu terlaris.',
      icon: TrendingUp,
    },
    COGS: {
      title: 'Laporan Laba Kotor & Analisis Margin HPP (COGS)',
      desc: 'Perhitungan laba kotor otomatis berdasarkan takaran resep (BOM) dan snapshot modal setiap transaksi.',
      icon: Scale,
    },
    PROFIT_LOSS: {
      title: 'Laporan Estimasi Laba Bersih (P&L)',
      desc: 'Analisis laba bersih akrual: Omzet dikurangi HPP, petty cash kas keluar, kerugian waste bahan, dan upah shift.',
      icon: LucideLineChart,
    },
  }[activeTab] || {
    title: 'Laporan & Analisis Bisnis',
    desc: 'Dashboard visual performa omzet harian, laba kotor HPP, produk terlaris, dan margin operasional.',
    icon: BarChart3,
  };
  const PageIcon = pageMeta.icon;

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header & Date Range Filter & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
            <PageIcon className="w-6 h-6 text-komazi-coral" />
            <span>{pageMeta.title}</span>
          </h1>
          <p className="text-xs text-komazi-muted mt-0.5">
            {pageMeta.desc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="flex items-center bg-komazi-surface border border-komazi-border p-1 rounded-xl">
            <button
              onClick={() => setDateRange('TODAY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                dateRange === 'TODAY'
                  ? 'bg-komazi-coral text-white'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setDateRange('WEEK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                dateRange === 'WEEK'
                  ? 'bg-komazi-coral text-white'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setDateRange('MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                dateRange === 'MONTH'
                  ? 'bg-komazi-coral text-white'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              Bulan Ini
            </button>
          </div>

          {/* Export Dropdown Group */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-komazi-teal to-emerald-600 hover:from-komazi-teal-light hover:to-emerald-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export Laporan</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  showExportMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl p-3 z-50 animate-scale-in space-y-2 backdrop-blur-xl">
                <div className="px-2 pt-1 pb-2 border-b border-komazi-border/60">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
                    Pilih Format Ekspor Laporan
                  </p>
                  <p className="text-xs text-komazi-text font-medium mt-0.5">
                    Filter aktif:{' '}
                    <span className="text-komazi-teal font-bold">{dateRangeLabel}</span>{' '}
                    ({filteredOrders.length} transaksi)
                  </p>
                </div>

                {/* Option 1: Excel (.xlsx) */}
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border/80 hover:border-emerald-500/40 transition-all space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-komazi-text">Microsoft Excel (.xlsx)</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Rekomendasi
                          </span>
                        </div>
                        <p className="text-[10px] text-komazi-muted mt-0.5">
                          Spreadsheet rapi, lebar kolom otomatis, format angka & kartu ringkasan.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleExport('EXCEL', 'FILTERED')}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold text-center transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span>{dateRangeLabel} ({filteredOrders.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('EXCEL', 'ALL')}
                      className="px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border hover:border-emerald-500/50 text-komazi-text text-[11px] font-medium text-center transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span>Semua ({orders.length})</span>
                    </button>
                  </div>
                </div>

                {/* Option 2: CSV (.csv) */}
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border/80 hover:border-komazi-teal/40 transition-all space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-komazi-teal/15 text-komazi-teal-light shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-komazi-text">File CSV (.csv)</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-komazi-teal/20 text-komazi-teal-light border border-komazi-teal/30">
                            Excel ID
                          </span>
                        </div>
                        <p className="text-[10px] text-komazi-muted mt-0.5">
                          Pemisah titik-koma (;) & UTF-8 BOM, kolom terpisah rapi di Excel.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleExport('CSV', 'FILTERED')}
                      className="px-2.5 py-1.5 rounded-lg bg-komazi-teal hover:bg-komazi-teal-light text-white text-[11px] font-bold text-center transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span>{dateRangeLabel} ({filteredOrders.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport('CSV', 'ALL')}
                      className="px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border hover:border-komazi-teal/50 text-komazi-text text-[11px] font-medium text-center transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span>Semua ({orders.length})</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Tab Content */}
      {activeTab === 'COGS' && canViewCogs ? (
        <CogsReportView
          dateRange={dateRange}
          onExportCSV={handleExportCSV}
          onExportExcel={handleExportExcel}
        />
      ) : activeTab === 'PROFIT_LOSS' && canViewCogs ? (
        <ProfitLossView dateRange={dateRange} />
      ) : isLoading && orders.length === 0 ? (
        <DashboardMetricsSkeleton />
      ) : (
        <>
          {/* AI Sales Analytics Quick Highlight Card */}
          <TopProductInsightCard />

          {/* Banner Status Transaksi Hari Ini (Jika Masih 0) */}
          {dateRange === 'TODAY' && totalTransactions === 0 && (
            <div className="p-4 rounded-2xl bg-komazi-surface/90 border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-white">Status Penjualan Hari Ini ({new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })})</span>
                  <p className="text-komazi-muted text-[11px] mt-0.5">
                    Belum ada transaksi penjualan yang tercatat hari ini. Seluruh indikator omzet menampilkan data riil (Rp 0). Transaksi baru di kasir POS akan langsung terupdate di sini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDateRange('WEEK')}
                className="px-3.5 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-slate-200 text-xs font-semibold shrink-0 transition-all border border-komazi-border"
              >
                Lihat 7 Hari Terakhir &rarr;
              </button>
            </div>
          )}

          {/* 2. Key Performance Indicators (KPI Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omzet */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border relative overflow-hidden">
          <div className="flex items-center justify-between text-komazi-muted mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Total Omzet Penjualan</span>
            <div className="p-2 rounded-xl bg-komazi-coral-soft text-komazi-coral">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-black text-2xl text-komazi-coral tabular-nums font-mono">
            {formatRupiah(totalRevenue)}
          </p>
          <span className="text-[10px] text-komazi-muted font-medium mt-1 inline-block">
            {totalTransactions === 0 ? 'Belum ada transaksi pada periode ini' : `${totalTransactions} transaksi berhasil (${dateRangeLabel})`}
          </span>
        </div>

        {/* Total Transaksi */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border relative overflow-hidden">
          <div className="flex items-center justify-between text-komazi-muted mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Jumlah Transaksi</span>
            <div className="p-2 rounded-xl bg-komazi-teal/15 text-komazi-teal-light">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-black text-2xl text-komazi-text tabular-nums font-mono">
            {totalTransactions} <span className="text-sm font-sans font-normal text-komazi-muted">struk</span>
          </p>
          <span className="text-[10px] text-komazi-muted mt-1 inline-block">
            {totalTransactions === 0 ? '0 pesanan tercatat' : `Rata-rata ${formatRupiah(averageOrderValue)} / transaksi`}
          </span>
        </div>

        {/* Nilai Transaksi Rata-rata (AOV) */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border relative overflow-hidden">
          <div className="flex items-center justify-between text-komazi-muted mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Rata-rata Order (AOV)</span>
            <div className="p-2 rounded-xl bg-warning/15 text-warning">
              <Coffee className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-black text-2xl text-komazi-text tabular-nums font-mono">
            {formatRupiah(averageOrderValue)}
          </p>
          <span className="text-[10px] text-komazi-muted mt-1 inline-block">
            {totalTransactions === 0 ? 'Belum ada data transaksi' : 'Rata-rata nilai per struk lunas'}
          </span>
        </div>

        {/* Estimasi Margin Laba Kotor */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border relative overflow-hidden">
          <div className="flex items-center justify-between text-komazi-muted mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Margin Laba Kotor</span>
            <div className="p-2 rounded-xl bg-komazi-teal/15 text-komazi-teal-light">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-black text-2xl text-komazi-teal-light tabular-nums font-mono">
            {totalRevenue > 0 ? `${grossMarginPct}%` : '0%'}
          </p>
          <span className="text-[10px] text-komazi-teal-light font-semibold mt-1 inline-block">
            {totalRevenue > 0 ? `Laba Kotor: ${formatRupiah(grossProfit)}` : 'Belum ada omzet penjualan'}
          </span>
        </div>
      </div>

      {/* 3. Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Tren Penjualan Jam (Area Chart Coral) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-komazi-text">Tren Omzet Penjualan (Per Jam)</h3>
            <span className="text-xs text-komazi-coral font-semibold">Zona Waktu: WIB</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData}>
                <defs>
                  <linearGradient id="coralGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF5A4D" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#FF5A4D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="time" stroke="#9A9A9A" fontSize={11} />
                <YAxis
                  stroke="#9A9A9A"
                  fontSize={11}
                  tickFormatter={(val) => `Rp ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    borderColor: '#2A2A2A',
                    borderRadius: '0.75rem',
                    color: '#F5F5F5',
                    fontSize: '12px',
                  }}
                  formatter={(val) => [formatRupiah(val), 'Omzet']}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#FF5A4D"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#coralGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart: Komposisi Metode Pembayaran */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-komazi-text">Metode Pembayaran</h3>
            <p className="text-xs text-komazi-muted mt-0.5">Persentase transaksi pelanggan</p>
          </div>

          {totalPayments === 0 ? (
            <div className="h-48 w-full flex flex-col items-center justify-center text-center p-4 text-komazi-muted">
              <CreditCard className="w-8 h-8 text-komazi-muted/40 mb-2" />
              <p className="text-xs font-semibold text-komazi-text">Belum ada transaksi pembayaran</p>
              <p className="text-[11px] text-komazi-muted mt-0.5">Porsi metode bayar (Tunai, QRIS, Transfer) akan tampil setelah ada transaksi lunas.</p>
            </div>
          ) : (
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentMethodsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141414',
                      borderColor: '#2A2A2A',
                      borderRadius: '0.75rem',
                      color: '#F5F5F5',
                      fontSize: '12px',
                    }}
                    formatter={(val) => [`${val}%`, 'Porsi']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-1.5 pt-2 border-t border-komazi-border text-xs">
            {paymentMethodsData.map((pm) => (
              <div key={pm.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pm.color }} />
                  <span className="text-komazi-muted">{pm.name}</span>
                </div>
                <span className="font-mono font-bold text-komazi-text">{pm.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Top Selling Products Bar Chart */}
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-komazi-text">6 Menu Paling Terlaris</h3>
          <span className="text-xs text-komazi-teal-light font-semibold">Berdasarkan Total Porsi Terjual</span>
        </div>

        {topProductsData.length === 0 ? (
          <div className="h-44 w-full flex flex-col items-center justify-center text-center p-6 text-komazi-muted">
            <Coffee className="w-8 h-8 text-komazi-muted/40 mb-2" />
            <p className="text-xs font-semibold text-komazi-text">Belum ada menu terjual pada periode ini</p>
            <p className="text-[11px] text-komazi-muted mt-0.5">Penjualan menu akan otomatis dirangking setelah kasir memproses pesanan.</p>
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="name" stroke="#9A9A9A" fontSize={11} />
                <YAxis stroke="#9A9A9A" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    borderColor: '#2A2A2A',
                    borderRadius: '0.75rem',
                    color: '#F5F5F5',
                    fontSize: '12px',
                  }}
                  formatter={(val, name) => [
                    name === 'sales' ? `${val} cup/porsi` : formatRupiah(val),
                    name === 'sales' ? 'Terjual' : 'Omzet Menu',
                  ]}
                />
                <Bar dataKey="sales" fill="#1F6F6B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
