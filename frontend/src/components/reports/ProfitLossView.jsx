import React, { useState, useEffect, useMemo } from 'react';
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

export default function ProfitLossView({ dateRange = 'TODAY' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const periodMap = {
      TODAY: 'today',
      WEEK: '7d',
      MONTH: 'month',
    };
    const period = periodMap[dateRange] || 'today';

    api.reports.getProfitLoss({ period })
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && res.data) {
          setData(res.data);
        } else {
          setError(res?.message || 'Gagal memuat laporan laba rugi');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching P&L report:', err);
        setError(err.message || 'Gagal terhubung ke server');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dateRange]);

  const summary = data?.summary || {
    grossRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPct: 0,
    expenses: {
      pettyCashOut: 0,
      wasteCost: 0,
      laborCost: 0,
      totalOperatingExpenses: 0,
    },
    netProfit: 0,
    netMarginPct: 0,
    isProfitable: true,
    totalOrders: 0,
  };

  const isProfitable = summary.netProfit >= 0;

  return (
    <div className="space-y-6">
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

      {/* 3. Detailed Expense Breakdowns: Biaya, Penyusutan, Petty Cash & Waste */}
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
