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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              Beban Operasional
            </span>
            <div className="w-8 h-8 rounded-xl bg-danger/15 flex items-center justify-center text-danger">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono font-black text-xl sm:text-2xl text-danger">
              -{formatRupiah(summary.expenses?.totalOperatingExpenses || 0)}
            </div>
            <div className="text-[11px] text-komazi-muted mt-1 flex items-center gap-2 font-medium">
              <span>Kas: {formatRupiah(summary.expenses?.pettyCashOut || 0)}</span>
              <span>•</span>
              <span>Waste: {formatRupiah(summary.expenses?.wasteCost || 0)}</span>
            </div>
          </div>
        </div>

        {/* Estimasi Laba Bersih (Net Profit) */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between shadow-lg transition-all ${
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
              <span>Kalkulasi Laba Bersih (P&L Waterfall)</span>
            </h3>
            <p className="text-xs text-komazi-muted mt-0.5">
              Rincian matematis dari Omzet Kotor hingga Laba Bersih yang dapat ditarik Owner.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted self-start sm:self-auto">
            Metode Akrual Resep POS
          </span>
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
            <div className="text-komazi-text font-bold text-sm">Beban Pengeluaran</div>
            <div className="font-mono text-base font-black text-danger">
              -{formatRupiah(summary.expenses?.totalOperatingExpenses || 0)}
            </div>
            <p className="text-[10px] text-komazi-muted">
              Kas Kecil + Waste + Upah Shift
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
            <div className="text-komazi-text font-bold text-sm">Estimasi Laba Bersih</div>
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

      {/* 3. Daily Net Profit Trend Chart */}
      {data?.dailyTrends && data.dailyTrends.length > 0 && (
        <div className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-komazi-coral" />
                <span>Tren Harian Omzet vs Laba Bersih</span>
              </h3>
              <p className="text-xs text-komazi-muted mt-0.5">
                Perbandingan dinamis omzet masuk, beban operasional, dan hasil laba bersih per hari.
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.dailyTrends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" opacity={0.4} />
                <XAxis dataKey="date" stroke="#718096" fontSize={11} tickLine={false} />
                <YAxis stroke="#718096" fontSize={11} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A202C',
                    borderColor: '#2D3748',
                    borderRadius: '12px',
                    fontSize: '11px',
                  }}
                  formatter={(val, name) => [formatRupiah(val), name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="revenue" name="Omzet Penjualan" fill="#FF5A4D" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="grossProfit" name="Laba Kotor" fill="#1F6F6B" radius={[6, 6, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="netProfit" name="Laba Bersih" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Detailed Expense Breakdowns: Petty Cash & Waste */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Petty Cash Out Breakdown */}
        <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-3">
          <div className="flex items-center justify-between border-b border-komazi-border pb-2.5">
            <h4 className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Pengeluaran Kas Kecil (Petty Cash Out)</span>
            </h4>
            <span className="font-mono font-bold text-xs text-danger">
              -{formatRupiah(summary.expenses?.pettyCashOut || 0)}
            </span>
          </div>

          <div className="space-y-2">
            {!data?.breakdowns?.pettyCashByReason || data.breakdowns.pettyCashByReason.length === 0 ? (
              <p className="text-xs text-komazi-muted py-6 text-center">
                Tidak ada pengeluaran kas kecil tercatat pada periode ini.
              </p>
            ) : (
              data.breakdowns.pettyCashByReason.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs"
                >
                  <span className="font-medium text-komazi-text">{it.reason}</span>
                  <span className="font-mono font-bold text-danger">-{formatRupiah(it.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Waste Breakdown */}
        <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-3">
          <div className="flex items-center justify-between border-b border-komazi-border pb-2.5">
            <h4 className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-warning" />
              <span>Kerugian Bahan Terbuang (Waste & Rusak)</span>
            </h4>
            <span className="font-mono font-bold text-xs text-warning">
              -{formatRupiah(summary.expenses?.wasteCost || 0)}
            </span>
          </div>

          <div className="space-y-2">
            {!data?.breakdowns?.wasteByReason || data.breakdowns.wasteByReason.length === 0 ? (
              <p className="text-xs text-komazi-muted py-6 text-center">
                Tidak ada catatan waste / bahan terbuang pada periode ini.
              </p>
            ) : (
              data.breakdowns.wasteByReason.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs"
                >
                  <span className="font-medium text-komazi-text">{it.reason}</span>
                  <span className="font-mono font-bold text-warning">-{formatRupiah(it.cost)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
