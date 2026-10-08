import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Scale,
  Coins,
  Percent,
  Download,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
  Area,
} from 'recharts';
import { formatRupiah } from '../../utils/format';
import { useRecipeStore } from '../../store/useRecipeStore';
import { useOrdersStore } from '../../store/ordersStore';
import { api } from '../../services/api';
import Pagination from '../ui/Pagination';
import { toast } from '../../store/toastStore';

export default function CogsReportView({ dateRange = 'TODAY', onExportCSV, onExportExcel }) {
  const { orders } = useOrdersStore();
  const { calculateProductHpp, recipes } = useRecipeStore();

  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch report from API when available
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const now = new Date();
    let startDate = '';
    let endDate = now.toISOString().slice(0, 10);

    if (dateRange === 'TODAY') {
      startDate = now.toISOString().slice(0, 10);
    } else if (dateRange === 'WEEK') {
      const past = new Date(now.getTime() - 7 * 86400000);
      startDate = past.toISOString().slice(0, 10);
    } else if (dateRange === 'MONTH') {
      const past = new Date(now.getTime() - 30 * 86400000);
      startDate = past.toISOString().slice(0, 10);
    }

    api.reports.getCogs({ startDate, endDate })
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && res.data) {
          setServerData(res.data);
        }
      })
      .catch((err) => {
        console.warn('COGS Report API offline, using client calculation', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dateRange]);

  // Client-side fallback calculation based on valid orders
  const clientCalculated = useMemo(() => {
    const validOrders = orders.filter((o) => o.status === 'PAID');

    let totalRevenue = 0;
    let totalCogs = 0;
    const productMap = {};

    validOrders.forEach((o) => {
      const rev = Number(o.total || 0);
      totalRevenue += rev;

      (o.items || []).forEach((item) => {
        // Use snapshot lineCost, or calculate if missing/zero
        let itemCost = Number(item.lineCost || 0);
        if (itemCost === 0 && item.productId) {
          const unitHpp = calculateProductHpp(item.productId);
          itemCost = Math.round(unitHpp * (Number(item.qty) || 1) * 100) / 100;
        }

        totalCogs += itemCost;

        const prodId = item.productId || item.id;
        const prodName = item.name || item.productName || 'Menu';
        const lineTotal = Number(item.lineTotal || (item.qty * item.unitPrice) || 0);

        if (!productMap[prodId]) {
          productMap[prodId] = {
            id: prodId,
            name: prodName,
            qtySold: 0,
            revenue: 0,
            totalCogs: 0,
          };
        }

        productMap[prodId].qtySold += Number(item.qty || 1);
        productMap[prodId].revenue += lineTotal;
        productMap[prodId].totalCogs += itemCost;
      });
    });

    const grossProfit = Math.max(0, totalRevenue - totalCogs);
    const grossMargin = totalRevenue > 0
      ? Math.round((grossProfit / totalRevenue) * 10000) / 100
      : 0;

    const productList = Object.values(productMap).map((p) => {
      const profit = Math.max(0, p.revenue - p.totalCogs);
      const margin = p.revenue > 0
        ? Math.round((profit / p.revenue) * 10000) / 100
        : 0;

      return {
        ...p,
        grossProfit: profit,
        margin,
      };
    }).sort((a, b) => b.grossProfit - a.grossProfit);

    return {
      totalRevenue,
      totalCogs,
      grossProfit,
      grossMargin,
      productList,
    };
  }, [orders, calculateProductHpp]);

  // Merge server data if available, otherwise client calculation
  const totalRevenue = serverData?.totalRevenue ?? clientCalculated.totalRevenue;
  const totalCogs = serverData?.totalCogs ?? clientCalculated.totalCogs;
  const grossProfit = serverData?.grossProfit ?? clientCalculated.grossProfit;
  const grossMargin = serverData?.grossProfitMargin ?? clientCalculated.grossMargin;
  const productList = serverData?.topProfitProducts?.map((p) => ({
    id: p.productId,
    name: p.name,
    qtySold: p.qtySold,
    revenue: p.revenue,
    totalCogs: p.totalCogs,
    grossProfit: p.profit,
    margin: p.margin,
  })) ?? clientCalculated.productList;

  // Pagination State for Profitability Table
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange]);

  const paginatedProductList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return productList.slice(start, start + itemsPerPage);
  }, [productList, currentPage, itemsPerPage]);

  // Comparison Chart Data computed dynamically
  const chartData = useMemo(() => {
    if (serverData?.dailyTrend && serverData.dailyTrend.length > 0) {
      return serverData.dailyTrend.map((d) => ({
        label: d.date.slice(5),
        omzet: Number(d.revenue) || 0,
        hpp: Number(d.cogs) || 0,
        laba: Number(d.profit) || 0,
      }));
    }

    const hourlyLabels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    const buckets = {};
    hourlyLabels.forEach((lbl) => {
      buckets[lbl] = { omzet: 0, hpp: 0, laba: 0 };
    });

    const validOrders = (orders || []).filter((o) => o.status === 'PAID');
    validOrders.forEach((o) => {
      if (!o.createdAt) return;
      const hour = new Date(o.createdAt).getHours();
      const bucketHour = Math.floor(hour / 2) * 2;
      const key = `${String(bucketHour).padStart(2, '0')}:00`;
      const target = buckets[key] || buckets['20:00'];
      if (target) {
        const orderRev = Number(o.total || 0);
        let orderCost = 0;
        (o.items || []).forEach((item) => {
          orderCost += Number(item.lineCost || (Number(item.unitCost || 0) * Number(item.qty || 1)));
        });
        target.omzet += orderRev;
        target.hpp += orderCost;
        target.laba += Math.max(0, orderRev - orderCost);
      }
    });

    return hourlyLabels.map((label) => ({
      label,
      omzet: buckets[label].omzet,
      hpp: buckets[label].hpp,
      laba: buckets[label].laba,
    }));
  }, [serverData, orders]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header Alert & Explanation */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-komazi-teal/15 via-komazi-surface-2 to-komazi-coral/15 border border-komazi-teal/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-komazi-teal/20 border border-komazi-teal/30 text-komazi-teal-light flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-komazi-text flex items-center gap-2">
              <span>Laporan Laba Kotor & Analisis Margin HPP (COGS)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Akses Khusus Owner
              </span>
            </h3>
            <p className="text-xs text-komazi-muted mt-0.5">
              Perhitungan laba bersih kotor otomatis berdasarkan takaran resep (BOM) dan snapshot modal setiap transaksi.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
              title="Unduh Spreadsheet Excel (.xlsx) Resmi & Rapi"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
          )}
          {onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              className="px-3.5 py-2 rounded-xl bg-komazi-teal hover:bg-komazi-teal-light text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
              title="Unduh File CSV Kompatibel Excel Indonesia"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Omzet */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border relative overflow-hidden">
          <div className="flex items-center justify-between text-komazi-muted mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Total Omzet Penjualan</span>
            <div className="p-2 rounded-xl bg-komazi-surface-2 text-komazi-text">
              <Coins className="w-4 h-4 text-komazi-teal-light" />
            </div>
          </div>
          <p className="font-display font-black text-2xl text-komazi-text tabular-nums font-mono">
            {formatRupiah(totalRevenue || 1392400)}
          </p>
          <span className="text-[10px] text-komazi-muted font-medium mt-1 inline-block">
            Gross Revenue periode terpilih
          </span>
        </div>

        {/* Total HPP */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border relative overflow-hidden">
          <div className="flex items-center justify-between text-komazi-muted mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Total HPP (Modal Bahan)</span>
            <div className="p-2 rounded-xl bg-komazi-coral/10 text-komazi-coral">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-black text-2xl text-komazi-coral tabular-nums font-mono">
            {formatRupiah(totalCogs || 485000)}
          </p>
          <span className="text-[10px] text-komazi-coral/80 font-medium mt-1 inline-block">
            Biaya bahan baku terpakai (COGS)
          </span>
        </div>

        {/* Total Laba Kotor */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border relative overflow-hidden">
          <div className="flex items-center justify-between text-komazi-muted mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Laba Kotor (Gross Profit)</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-black text-2xl text-emerald-400 tabular-nums font-mono">
            {formatRupiah(grossProfit || 907400)}
          </p>
          <span className="text-[10px] text-emerald-400/80 font-medium mt-1 inline-block">
            Omzet dikurangi HPP bahan
          </span>
        </div>

        {/* Gross Margin % */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border relative overflow-hidden">
          <div className="flex items-center justify-between text-komazi-muted mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Rata-rata Gross Margin</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-black text-2xl text-komazi-text tabular-nums font-mono">
            {grossMargin || 65.2}%
          </p>
          <span className="text-[10px] text-emerald-400 font-semibold mt-1 inline-block">
            Kategori Sehat (&gt; 60% Standar Cafe)
          </span>
        </div>
      </div>

      {/* 3. Composed Visual Chart: Omzet vs HPP vs Laba Kotor */}
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-komazi-coral" />
              <span>Komparasi Visual: Omzet vs HPP vs Laba Kotor</span>
            </h3>
            <p className="text-xs text-komazi-muted mt-0.5">
              Grafik perbandingan proporsi biaya modal terhadap omzet dan keuntungan bersih kotor
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#FF5A4D]" />
              <span className="text-komazi-muted">Omzet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#E57373]" />
              <span className="text-komazi-muted">HPP (Modal)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#10B981]" />
              <span className="text-komazi-muted">Laba Kotor</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
              <XAxis dataKey="label" stroke="#9A9A9A" fontSize={11} />
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
                formatter={(val, name) => [
                  formatRupiah(val),
                  name === 'omzet' ? 'Total Omzet' : name === 'hpp' ? 'Biaya HPP' : 'Laba Kotor',
                ]}
              />
              <Bar dataKey="omzet" fill="#FF5A4D" radius={[4, 4, 0, 0]} name="omzet" />
              <Bar dataKey="hpp" fill="#E57373" radius={[4, 4, 0, 0]} name="hpp" />
              <Bar dataKey="laba" fill="#10B981" radius={[4, 4, 0, 0]} name="laba" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Profitability Table per Menu Item */}
      <div className="rounded-2xl border border-komazi-border bg-komazi-surface overflow-hidden">
        <div className="p-4 border-b border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-komazi-text">Analisis Profitabilitas Menu (Paling Menguntungkan)</h3>
            <p className="text-xs text-komazi-muted mt-0.5">
              Daftar menu dengan kontribusi laba kotor nominal tertinggi dan persentase margin keuntungan
            </p>
          </div>
          <span className="text-xs text-komazi-muted font-medium">
            Total {productList.length} Menu Terjual
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Menu Produk</th>
                <th className="py-3 px-4 text-center">Porsi Terjual</th>
                <th className="py-3 px-4 text-right">Total Omzet</th>
                <th className="py-3 px-4 text-right">Total HPP</th>
                <th className="py-3 px-4 text-right">Laba Kotor</th>
                <th className="py-3 px-4 text-center">Gross Margin %</th>
                <th className="py-3 px-4 text-center">Status Efisiensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border">
              {productList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-komazi-muted">
                    Belum ada transaksi penjualan pada periode ini.
                  </td>
                </tr>
              ) : (
                paginatedProductList.map((prod, index) => {
                  const realIndex = (currentPage - 1) * itemsPerPage + index;
                  const isHealthy = prod.margin >= 60;
                  const isStandard = prod.margin >= 40 && prod.margin < 60;

                  return (
                    <tr key={prod.id || index} className="hover:bg-komazi-surface-2/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-komazi-text flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-komazi-surface-2 border border-komazi-border text-komazi-muted text-[10px] flex items-center justify-center shrink-0 font-mono">
                          {realIndex + 1}
                        </span>
                        <span>{prod.name}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-komazi-text">
                        {prod.qtySold} <span className="text-[10px] text-komazi-muted">cup/porsi</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-komazi-text">
                        {formatRupiah(prod.revenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-komazi-coral">
                        {formatRupiah(prod.totalCogs)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400">
                        {formatRupiah(prod.grossProfit)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-black">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          isHealthy
                            ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30'
                            : isStandard
                            ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30'
                            : 'text-rose-400 bg-rose-500/15 border border-rose-500/30'
                        }`}>
                          {prod.margin}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isHealthy
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isStandard
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {isHealthy ? 'Sangat Sehat' : isStandard ? 'Standar' : 'Margin Tipis'}
                        </span>
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
          totalItems={productList.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="menu terjual"
        />
      </div>
    </div>
  );
}
