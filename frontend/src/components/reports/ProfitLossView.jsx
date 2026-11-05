import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Receipt,
  Trash2,
  Users,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatRupiah } from '../../utils/format';
import { api } from '../../services/api';
import { exportProfitLossToExcel } from '../../utils/excel';
import { toast } from '../../store/toastStore';

/**
 * Pemetaan kode period prop dari ReportsPage ke parameter profitService
 */
const DATE_RANGE_MAP = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  WEEK: '7d',
  MONTH: 'month',
  LAST_MONTH: 'last_month',
  CUSTOM: 'custom',
};

const PERIOD_LABELS = {
  today: 'Hari Ini',
  yesterday: 'Kemarin',
  '7d': '7 Hari Terakhir',
  month: 'Bulan Ini',
  last_month: 'Bulan Lalu',
  custom: 'Rentang Kustom',
};

const formatChartDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const m = parseInt(parts[1], 10) - 1;
    return `${parts[2]} ${months[m] || parts[1]}`;
  }
  return dateStr;
};

const formatCompactRupiah = (val) => {
  if (val === 0) return '0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}rb`;
  return `${sign}${abs}`;
};

/**
 * Custom Tooltip untuk Grafik Tren Laba Rugi
 */
const CustomTrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload || {};

  const rev = Number(item.revenue || 0);
  const cogs = Number(item.cogs || 0);
  const totalExp = Number(item.totalExpenses || 0);
  const net = Number(item.netProfit || 0);
  const margin = item.marginPct !== undefined ? item.marginPct : rev > 0 ? Math.round((net / rev) * 100) : 0;
  const isNetPositive = net >= 0;

  return (
    <div className="bg-komazi-surface/95 backdrop-blur-md border border-komazi-border/80 shadow-2xl rounded-xl p-3.5 text-xs min-w-[240px] space-y-2 z-50">
      <div className="flex items-center justify-between border-b border-komazi-border/60 pb-2">
        <span className="font-bold text-komazi-text flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-komazi-coral" />
          <span>{item.date || label}</span>
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-komazi-surface-2 text-komazi-muted font-mono">
          {item.ordersCount || 0} Order
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-komazi-muted flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" />
            <span>Omzet Penjualan</span>
          </span>
          <span className="font-mono font-bold text-komazi-text">{formatRupiah(rev)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-komazi-muted flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
            <span>HPP Resep</span>
          </span>
          <span className="font-mono font-bold text-warning">-{formatRupiah(cogs)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-komazi-muted flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            <span>Beban Operasional</span>
          </span>
          <span className="font-mono font-bold text-danger">-{formatRupiah(totalExp)}</span>
        </div>

        <div className="pt-2 border-t border-komazi-border/60 flex items-center justify-between">
          <span className="font-bold text-komazi-text flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full inline-block ${
                isNetPositive ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span>Laba Bersih</span>
          </span>
          <div className="text-right">
            <span
              className={`font-mono font-black ${
                isNetPositive ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {formatRupiah(net)}
            </span>
            <span className="text-[10px] text-komazi-muted ml-1.5">({margin}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ProfitLossView({
  dateRange = 'TODAY',
  storeName = 'Komazi Coffee & Workspace',
}) {
  const activePeriod = DATE_RANGE_MAP[dateRange] || 'today';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const params = { period: activePeriod };
        const res = await api.reports.getProfitLoss(params);
        if (res && res.success && res.data) {
          setData(res.data);
        } else {
          setError(res?.message || 'Gagal memuat laporan laba rugi');
        }
      } catch (err) {
        console.error('Error fetching P&L report:', err);
        setError(err.message || 'Gagal terhubung ke server');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activePeriod]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportExcel = () => {
    if (!data || !data.summary) {
      toast.error('Tidak ada data laba rugi untuk diekspor');
      return;
    }

    try {
      const periodLabel = PERIOD_LABELS[activePeriod] || 'Periode Laba Rugi';

      exportProfitLossToExcel({
        data,
        periodLabel,
        storeName,
      });

      toast.success('Laporan Laba Rugi Excel berhasil diunduh');
    } catch (err) {
      console.error('Gagal ekspor Excel P&L:', err);
      toast.error(err.message || 'Gagal mengekspor Excel');
    }
  };

  const summary = data?.summary || {
    grossRevenue: 0,
    totalDiscount: 0,
    workspaceRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPct: 0,
    expenses: {
      pettyCashOut: 0,
      wasteCost: 0,
      laborCost: 0,
      operationalExpenses: 0,
      depreciationCost: 0,
      totalOperatingExpenses: 0,
    },
    netProfit: 0,
    netMarginPct: 0,
    isProfitable: true,
    totalOrders: 0,
  };

  const isProfitable = summary.netProfit >= 0;
  const dailyTrends = Array.isArray(data?.dailyTrends) ? data.dailyTrends : [];

  return (
    <div className="space-y-6">
      {/* 0. Header Toolbar Laba Rugi (Single Source of Truth dengan Filter Utama) */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-komazi-text">Laporan Laba Rugi</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30">
                {PERIOD_LABELS[activePeriod] || 'Hari Ini'}
              </span>
            </div>
            {data?.startDate && data?.endDate && (
              <p className="text-[11px] text-komazi-muted mt-0.5">
                Rentang data: {new Date(data.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} s/d {new Date(data.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Actions: Ekspor Excel & Refresh */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:border-komazi-teal/50 text-komazi-muted hover:text-komazi-text text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-komazi-teal' : ''}`} />
            <span>Muat Ulang</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || !data}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor Excel P&L</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-danger/10 border border-danger/30 text-danger flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="px-3 py-1 bg-danger text-white rounded-lg font-bold hover:bg-danger/90 transition-all text-xs"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 1. Executive Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Omzet Penjualan */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-komazi-muted uppercase tracking-wider">
              Omzet Penjualan (Gross)
            </span>
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono font-black text-xl sm:text-2xl text-komazi-text">
              {formatRupiah(summary.grossRevenue)}
            </div>
            <div className="text-[11px] text-komazi-muted mt-1 flex items-center gap-1 font-medium">
              <Receipt className="w-3 h-3" />
              <span>{summary.totalOrders} transaksi berhasil</span>
            </div>
          </div>
        </div>

        {/* HPP / COGS */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-komazi-muted uppercase tracking-wider">
              HPP Bahan (COGS)
            </span>
            <div className="w-8 h-8 rounded-xl bg-warning/15 flex items-center justify-center text-warning">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono font-black text-xl sm:text-2xl text-warning">
              -{formatRupiah(summary.cogs)}
            </div>
            <div className="text-[11px] text-komazi-muted mt-1 font-medium">
              Laba Kotor:{' '}
              <strong className="text-komazi-text">{formatRupiah(summary.grossProfit)}</strong> (
              {summary.grossMarginPct}%)
            </div>
          </div>
        </div>

        {/* Beban Operasional */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-komazi-muted uppercase tracking-wider">
              Biaya Operasional
            </span>
            <div className="w-8 h-8 rounded-xl bg-danger/15 flex items-center justify-center text-danger">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono font-black text-xl sm:text-2xl text-danger">
              -{formatRupiah((summary.expenses?.operationalExpenses || 0) + (summary.expenses?.pettyCashOut || 0))}
            </div>
            <div className="text-[11px] text-komazi-muted mt-1 flex items-center gap-1 font-medium">
              <span>Rutin: {formatRupiah(summary.expenses?.operationalExpenses || 0)}</span>
              <span>•</span>
              <span>Kas: {formatRupiah(summary.expenses?.pettyCashOut || 0)}</span>
            </div>
          </div>
        </div>

        {/* Beban Penyusutan Aset */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-komazi-muted uppercase tracking-wider">
              Penyusutan Aset
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono font-black text-xl sm:text-2xl text-purple-400">
              -{formatRupiah(summary.expenses?.depreciationCost || 0)}
            </div>
            <div className="text-[11px] text-komazi-muted mt-1 flex items-center gap-1 font-medium">
              <span>Metode Garis Lurus Aktiva</span>
            </div>
          </div>
        </div>

        {/* Estimasi Laba Bersih (Net Profit) */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-lg transition-all col-span-1 sm:col-span-2 lg:col-span-1 ${
            isProfitable
              ? 'bg-gradient-to-br from-success/15 via-komazi-surface to-komazi-surface border-success/40'
              : 'bg-gradient-to-br from-danger/15 via-komazi-surface to-komazi-surface border-danger/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-komazi-text">
              Estimasi Laba Bersih
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isProfitable
                  ? 'bg-success text-white shadow-md shadow-success/30'
                  : 'bg-danger text-white shadow-md shadow-danger/30'
              }`}
            >
              {isProfitable ? <Sparkles className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`font-mono font-black text-2xl sm:text-3xl ${
                isProfitable ? 'text-success' : 'text-danger'
              }`}
            >
              {formatRupiah(summary.netProfit)}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase ${
                  isProfitable
                    ? 'bg-success/20 text-success border border-success/30'
                    : 'bg-danger/20 text-danger border border-danger/30'
                }`}
              >
                {isProfitable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isProfitable ? 'Profit' : 'Defisit'} {summary.netMarginPct}%
              </span>
              <span className="text-[10px] text-komazi-muted font-medium">Net Profit Margin</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Waterfall P&L Breakdown Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-komazi-border pb-3">
          <div>
            <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
              <Scale className="w-4 h-4 text-komazi-coral" />
              <span>Kalkulasi Laba Bersih Lengkap</span>
            </h3>
            <p className="text-xs text-komazi-muted mt-0.5">
              Perhitungan komprehensif dari Omzet Kotor, HPP Resep, Biaya Operasional, hingga Penyusutan Aset.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Step 1: Revenue */}
          <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-1">
            <div className="text-komazi-muted font-bold uppercase text-[10px]">Langkah 1</div>
            <div className="text-komazi-text font-bold text-sm">Omzet Penjualan</div>
            <div className="font-mono text-base font-black text-komazi-text">
              {formatRupiah(summary.grossRevenue)}
            </div>
            <p className="text-[10px] text-komazi-muted">Total penerimaan kasir & QRIS</p>
          </div>

          {/* Step 2: Gross Profit */}
          <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-1">
            <div className="text-komazi-muted font-bold uppercase text-[10px]">Langkah 2</div>
            <div className="text-komazi-text font-bold text-sm">Dikurangi HPP (COGS)</div>
            <div className="font-mono text-base font-black text-warning">
              -{formatRupiah(summary.cogs)}
            </div>
            <p className="text-[10px] text-komazi-muted">
              Laba Kotor: <strong>{formatRupiah(summary.grossProfit)}</strong>
            </p>
          </div>

          {/* Step 3: Operating Expenses */}
          <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-1">
            <div className="text-komazi-muted font-bold uppercase text-[10px]">Langkah 3</div>
            <div className="text-komazi-text font-bold text-sm">Beban & Penyusutan</div>
            <div className="font-mono text-base font-black text-danger">
              -{formatRupiah(summary.expenses?.totalOperatingExpenses || 0)}
            </div>
            <p className="text-[10px] text-komazi-muted truncate">
              Biaya + Kas + Depresiasi + Upah
            </p>
          </div>

          {/* Step 4: Net Profit */}
          <div
            className={`p-3.5 rounded-xl border space-y-1 ${
              isProfitable
                ? 'bg-success/10 border-success/30'
                : 'bg-danger/10 border-danger/30'
            }`}
          >
            <div className="text-komazi-muted font-bold uppercase text-[10px]">Hasil Akhir</div>
            <div className="text-komazi-text font-bold text-sm">Laba Bersih Operasional</div>
            <div
              className={`font-mono text-base font-black ${
                isProfitable ? 'text-success' : 'text-danger'
              }`}
            >
              {formatRupiah(summary.netProfit)}
            </div>
            <p className="text-[10px] text-komazi-muted">
              Margin Bersih: <strong>{summary.netMarginPct}%</strong>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Daily Financial Trend Chart (Grafik Tren Finansial Harian) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-komazi-border pb-3">
          <div>
            <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-komazi-teal" />
              <span>Tren Performa Finansial Harian</span>
            </h3>
            <p className="text-xs text-komazi-muted mt-0.5">
              Visualisasi perbandingan Omzet vs Beban Operasional & HPP Resep, serta garis tren Laba Bersih.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-komazi-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" />
              <span>Omzet</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              <span>HPP</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
              <span>Beban Ops</span>
            </span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Laba Bersih</span>
            </span>
          </div>
        </div>

        {dailyTrends.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-komazi-muted">
            <BarChart3 className="w-10 h-10 stroke-[1.2] mb-2 opacity-40" />
            <p className="text-xs">Tidak ada data tren finansial untuk periode ini.</p>
          </div>
        ) : (
          <div className="h-80 sm:h-96 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dailyTrends}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                />
                <YAxis
                  tickFormatter={formatCompactRupiah}
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#475569' }}
                  width={60}
                />
                <Tooltip content={<CustomTrendTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }}
                  formatter={(value) => <span className="text-komazi-text font-medium">{value}</span>}
                />
                <Bar
                  dataKey="revenue"
                  name="Omzet Penjualan"
                  fill="#14B8A6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="cogs"
                  name="HPP Resep"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="totalExpenses"
                  name="Beban Operasional"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="Laba Bersih"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10B981', strokeWidth: 1, stroke: '#FFFFFF' }}
                  activeDot={{ r: 6, fill: '#34D399' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 4. Detailed Expense Breakdowns: Biaya, Penyusutan, Petty Cash & Waste */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ExpenseBreakdownCard
          title="Biaya Operasional"
          icon={Wallet}
          iconColor="text-komazi-coral"
          amountColor="text-danger"
          total={summary.expenses?.operationalExpenses}
          items={data?.breakdowns?.expensesByCategory}
          labelKey="category"
          valueKey="amount"
          emptyText="Belum ada pengeluaran operasional"
        />

        <ExpenseBreakdownCard
          title="Penyusutan Aset"
          icon={TrendingDown}
          iconColor="text-purple-400"
          amountColor="text-purple-400"
          total={summary.expenses?.depreciationCost}
          items={data?.breakdowns?.depreciationsByAsset}
          labelKey="asset"
          valueKey="amount"
          emptyText="Belum ada depresiasi tercatat"
        />

        <ExpenseBreakdownCard
          title="Kas Kecil Kasir"
          icon={Receipt}
          iconColor="text-komazi-coral"
          amountColor="text-danger"
          total={summary.expenses?.pettyCashOut}
          items={data?.breakdowns?.pettyCashByReason}
          labelKey="reason"
          valueKey="amount"
          emptyText="Tidak ada kas kecil"
        />

        <ExpenseBreakdownCard
          title="Bahan Terbuang"
          icon={Trash2}
          iconColor="text-warning"
          amountColor="text-warning"
          total={summary.expenses?.wasteCost}
          items={data?.breakdowns?.wasteByReason}
          labelKey="reason"
          valueKey="cost"
          emptyText="Tidak ada catatan waste"
        />
      </div>
    </div>
  );
}

function ExpenseBreakdownCard({
  title,
  icon: Icon,
  iconColor = 'text-komazi-coral',
  total = 0,
  amountColor = 'text-danger',
  items = [],
  labelKey = 'label',
  valueKey = 'amount',
  emptyText = 'Belum ada data',
}) {
  const sortedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return [...items].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0));
  }, [items, valueKey]);

  return (
    <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col h-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-komazi-border pb-2.5 shrink-0">
        <h4 className="font-bold text-xs text-komazi-text flex items-center gap-1.5 min-w-0">
          <Icon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />
          <span className="truncate">{title}</span>
          {sortedItems.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-komazi-surface-2 text-komazi-muted border border-komazi-border shrink-0">
              {sortedItems.length}
            </span>
          )}
        </h4>
        <span className={`font-mono font-bold text-xs ${amountColor} shrink-0`}>
          -{formatRupiah(total || 0)}
        </span>
      </div>

      {/* List Body with bounded scroll */}
      <div className="space-y-1.5 overflow-y-auto pr-1 my-2 flex-1">
        {sortedItems.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center py-6">
            <p className="text-[11px] text-komazi-muted">{emptyText}</p>
          </div>
        ) : (
          sortedItems.map((it, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-[11px] hover:border-komazi-border/80 transition-colors"
            >
              <span className="font-medium text-komazi-text truncate pr-2">
                {it[labelKey] || '-'}
              </span>
              <span className={`font-mono font-bold ${amountColor} shrink-0`}>
                -{formatRupiah(it[valueKey] || 0)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Subtle hint when list has more than 5 items */}
      {sortedItems.length > 5 && (
        <div className="pt-2 border-t border-komazi-border/50 text-[10px] text-komazi-muted text-center shrink-0">
          Scroll untuk melihat {sortedItems.length} rincian
        </div>
      )}
    </div>
  );
}
