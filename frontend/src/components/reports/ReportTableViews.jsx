import React, { useState, useMemo } from 'react';
import {
  Package,
  Tag,
  Users,
  Utensils,
  CreditCard,
  Receipt,
  Percent,
  UserCheck,
  Wallet,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import { formatWibDateTime, exportCustomTableToExcel, exportCustomTableToCsv } from '../../utils/exportReport';
import Pagination from '../ui/Pagination';

/**
 * Reusable KPI Mini Card
 */
function KpiCard({ title, value, subtext, icon: Icon, color = 'text-komazi-coral', bg = 'bg-komazi-coral/15' }) {
  return (
    <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col justify-between">
      <div className="flex items-center justify-between text-komazi-muted mb-2">
        <span className="text-xs uppercase font-bold tracking-wider truncate">{title}</span>
        <div className={`p-2 rounded-xl ${bg} ${color} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className={`font-display font-black text-xl sm:text-2xl ${color} tabular-nums font-mono truncate`}>
          {value}
        </p>
        {subtext && <span className="text-[10px] text-komazi-muted font-medium mt-1 inline-block truncate">{subtext}</span>}
      </div>
    </div>
  );
}

/**
 * Reusable Table Wrapper with search filter & table styling
 */
function ReportTableContainer({
  title,
  searchPlaceholder = 'Cari data...',
  searchValue,
  onSearchChange,
  headers = [],
  children,
  emptyMessage = 'Tidak ada data pada periode ini',
  rowCount = 0,
  onExportExcel,
  currentPage = 1,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
  itemLabel = 'data',
}) {
  return (
    <div className="space-y-4">
      {/* Table Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-komazi-surface p-3.5 rounded-2xl border border-komazi-border">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-komazi-muted" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text placeholder-komazi-muted focus:outline-none focus:border-komazi-coral transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <span className="text-xs text-komazi-muted font-medium mr-1 hidden md:inline">
            Total: <strong className="text-komazi-text">{rowCount}</strong> baris
          </span>
          <button
            type="button"
            onClick={onExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Styled Table */}
      <div className="rounded-2xl bg-komazi-surface border border-komazi-border overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-komazi-surface-2 border-b border-komazi-border text-[11px] font-bold text-komazi-muted uppercase tracking-wider">
                {headers.map((h, idx) => (
                  <th
                    key={idx}
                    className={`py-3.5 px-4 whitespace-nowrap ${
                      h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/60">
              {rowCount === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="py-12 text-center text-komazi-muted">
                    <AlertCircle className="w-8 h-8 text-komazi-muted/40 mx-auto mb-2" />
                    <p className="text-xs font-bold text-komazi-text">{emptyMessage}</p>
                    <p className="text-[11px] text-komazi-muted mt-0.5">Coba ganti filter rentang tanggal atau kata kunci pencarian.</p>
                  </td>
                </tr>
              ) : (
                children
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive Pagination */}
        {onPageChange && rowCount > 10 && (
          <Pagination
            currentPage={currentPage}
            totalItems={rowCount}
            itemsPerPage={itemsPerPage}
            onPageChange={onPageChange}
            onItemsPerPageChange={onItemsPerPageChange}
            itemLabel={itemLabel}
          />
        )}
      </div>
    </div>
  );
}

// ==========================================
// 1. Penjualan Produk (PRODUCTS)
// ==========================================
export function ProductsReportView({ orders = [], dateRangeLabel = '', canViewCogs = true, storeName }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const productData = useMemo(() => {
    const map = {};
    let totalQty = 0;
    let totalRev = 0;
    let totalCogs = 0;

    orders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const key = item.productId ? `p_${item.productId}` : item.productName || item.name;
        if (!map[key]) {
          map[key] = {
            name: item.productName || item.name || 'Produk',
            category: item.categoryName || 'Menu',
            qty: 0,
            revenue: 0,
            cogs: 0,
          };
        }
        const q = Number(item.qty || 1);
        const rev = Number(item.lineTotal || (Number(item.unitPrice || 0) * q));
        const cost = Number(item.lineCost || (Number(item.unitCost || 0) * q));

        map[key].qty += q;
        map[key].revenue += rev;
        map[key].cogs += cost;

        totalQty += q;
        totalRev += rev;
        totalCogs += cost;
      });
    });

    const list = Object.values(map)
      .map((p) => {
        const grossProfit = Math.max(0, p.revenue - p.cogs);
        const margin = p.revenue > 0 ? Math.round((grossProfit / p.revenue) * 1000) / 10 : 0;
        const avgPrice = p.qty > 0 ? Math.round(p.revenue / p.qty) : 0;
        return {
          ...p,
          grossProfit,
          margin,
          avgPrice,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return { list, totalQty, totalRev, totalCogs, totalGrossProfit: totalRev - totalCogs };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return productData.list;
    const q = search.toLowerCase();
    return productData.list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [productData.list, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'Nama Produk', align: 'left' },
    { label: 'Kategori', align: 'left' },
    { label: 'Qty Terjual', align: 'right' },
    { label: 'Harga Rata-rata', align: 'right' },
    { label: 'Total Penjualan', align: 'right' },
    ...(canViewCogs
      ? [
          { label: 'Total HPP', align: 'right' },
          { label: 'Laba Kotor', align: 'right' },
          { label: 'Margin', align: 'right' },
        ]
      : []),
  ];

  const handleExport = (format) => {
    const rawHeaders = [
      'No',
      'Nama Produk',
      'Kategori',
      'Qty Terjual',
      'Harga Rata-rata (Rp)',
      'Total Penjualan (Rp)',
      ...(canViewCogs ? ['Total HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'] : []),
    ];
    const rawRows = filtered.map((p, idx) => [
      idx + 1,
      p.name,
      p.category,
      p.qty,
      p.avgPrice,
      p.revenue,
      ...(canViewCogs ? [p.cogs, p.grossProfit, `${p.margin}%`] : []),
    ]);
    const summaryRow = [
      'TOTAL',
      '',
      '',
      productData.totalQty,
      '',
      productData.totalRev,
      ...(canViewCogs
        ? [
            productData.totalCogs,
            productData.totalGrossProfit,
            `${productData.totalRev > 0 ? ((productData.totalGrossProfit / productData.totalRev) * 100).toFixed(1) : 0}%`,
          ]
        : []),
    ];
    const payload = {
      title: 'Laporan Penjualan Produk',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Produk',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Produk Terjual"
          value={`${productData.totalQty} porsi`}
          subtext={`${productData.list.length} varian menu terjual`}
          icon={Package}
          color="text-komazi-coral"
          bg="bg-komazi-coral/15"
        />
        <KpiCard
          title="Total Omzet Produk"
          value={formatRupiah(productData.totalRev)}
          subtext={`Dari ${orders.length} pesanan berhasil`}
          icon={TrendingUp}
          color="text-komazi-teal-light"
          bg="bg-komazi-teal/15"
        />
        <KpiCard
          title="Produk Terlaris"
          value={productData.list[0]?.name || '-'}
          subtext={productData.list[0] ? `${productData.list[0].qty} cup terjual` : 'Belum ada data'}
          icon={Sparkles}
          color="text-warning"
          bg="bg-warning/15"
        />
        {canViewCogs && (
          <KpiCard
            title="Total Laba Kotor"
            value={formatRupiah(productData.totalGrossProfit)}
            subtext={`Margin rata-rata ${productData.totalRev > 0 ? ((productData.totalGrossProfit / productData.totalRev) * 100).toFixed(1) : 0}%`}
            icon={Receipt}
            color="text-emerald-400"
            bg="bg-emerald-500/15"
          />
        )}
      </div>

      <ReportTableContainer
        title="Daftar Penjualan Produk"
        searchPlaceholder="Cari nama menu atau kategori..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        onExportExcel={() => handleExport('EXCEL')}
        currentPage={page}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={setPageSize}
        itemLabel="produk"
      >
        {paginated.map((p, idx) => {
          const realIdx = (page - 1) * pageSize + idx;
          return (
            <tr key={realIdx} className="hover:bg-komazi-surface-2/60 transition-colors">
              <td className="py-3 px-4 text-center text-komazi-muted font-mono">{realIdx + 1}</td>
              <td className="py-3 px-4 font-bold text-komazi-text">{p.name}</td>
              <td className="py-3 px-4">
                <span className="px-2 py-0.5 rounded-md bg-komazi-surface-2 border border-komazi-border text-[10px] font-medium text-komazi-muted">
                  {p.category}
                </span>
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold text-komazi-text">{p.qty}</td>
              <td className="py-3 px-4 text-right font-mono text-komazi-muted">{formatRupiah(p.avgPrice)}</td>
              <td className="py-3 px-4 text-right font-mono font-black text-komazi-coral">{formatRupiah(p.revenue)}</td>
              {canViewCogs && (
                <>
                  <td className="py-3 px-4 text-right font-mono text-warning">-{formatRupiah(p.cogs)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{formatRupiah(p.grossProfit)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-komazi-teal-light">{p.margin}%</td>
                </>
              )}
            </tr>
          );
        })}
      </ReportTableContainer>
    </div>
  );
}

// ==========================================
// 2. Laporan Kategori (CATEGORIES)
// ==========================================
export function CategoriesReportView({ orders = [], dateRangeLabel = '', storeName }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const catData = useMemo(() => {
    const map = {};
    let grandRev = 0;
    let grandQty = 0;

    orders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const name = item.categoryName || 'Kategori Umum';
        if (!map[name]) {
          map[name] = { name, qty: 0, revenue: 0, itemsSet: new Set() };
        }
        const q = Number(item.qty || 1);
        const rev = Number(item.lineTotal || (Number(item.unitPrice || 0) * q));
        map[name].qty += q;
        map[name].revenue += rev;
        map[name].itemsSet.add(item.productName || item.name);
        grandRev += rev;
        grandQty += q;
      });
    });

    const list = Object.values(map)
      .map((c) => ({
        name: c.name,
        menuCount: c.itemsSet.size,
        qty: c.qty,
        revenue: c.revenue,
        share: grandRev > 0 ? Math.round((c.revenue / grandRev) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return { list, grandRev, grandQty };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return catData.list;
    const q = search.toLowerCase();
    return catData.list.filter((c) => c.name.toLowerCase().includes(q));
  }, [catData.list, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'Kategori Menu', align: 'left' },
    { label: 'Jumlah Variasi Menu', align: 'right' },
    { label: 'Total Porsi Terjual', align: 'right' },
    { label: 'Total Penjualan', align: 'right' },
    { label: 'Kontribusi Omzet', align: 'right' },
  ];

  const handleExport = (format) => {
    const rawHeaders = ['No', 'Kategori Menu', 'Variasi Menu', 'Porsi Terjual', 'Total Omzet (Rp)', 'Kontribusi (%)'];
    const rawRows = filtered.map((c, idx) => [idx + 1, c.name, c.menuCount, c.qty, c.revenue, `${c.share}%`]);
    const summaryRow = ['TOTAL', '', '', catData.grandQty, catData.grandRev, '100%'];
    const payload = {
      title: 'Laporan Penjualan per Kategori',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Kategori',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Kategori Aktif Terjual"
          value={`${catData.list.length} kategori`}
          subtext={`Dari ${catData.grandQty} total porsi`}
          icon={Tag}
          color="text-komazi-coral"
          bg="bg-komazi-coral/15"
        />
        <KpiCard
          title="Total Omzet Kategori"
          value={formatRupiah(catData.grandRev)}
          subtext="Akumulasi omzet produk"
          icon={TrendingUp}
          color="text-komazi-teal-light"
          bg="bg-komazi-teal/15"
        />
        <KpiCard
          title="Kategori Terlaris"
          value={catData.list[0]?.name || '-'}
          subtext={catData.list[0] ? `${catData.list[0].share}% dari seluruh penjualan` : 'Belum ada data'}
          icon={Sparkles}
          color="text-warning"
          bg="bg-warning/15"
        />
      </div>

      <ReportTableContainer
        title="Daftar Kategori Menu"
        searchPlaceholder="Cari kategori..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        onExportExcel={() => handleExport('EXCEL')}
        currentPage={page}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={setPageSize}
        itemLabel="kategori"
      >
        {paginated.map((c, idx) => {
          const realIdx = (page - 1) * pageSize + idx;
          return (
            <tr key={realIdx} className="hover:bg-komazi-surface-2/60 transition-colors">
              <td className="py-3 px-4 text-center text-komazi-muted font-mono">{realIdx + 1}</td>
              <td className="py-3 px-4 font-bold text-komazi-text">{c.name}</td>
              <td className="py-3 px-4 text-right font-mono text-komazi-muted">{c.menuCount} menu</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-komazi-text">{c.qty}</td>
              <td className="py-3 px-4 text-right font-mono font-black text-komazi-coral">{formatRupiah(c.revenue)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-komazi-teal-light">{c.share}%</td>
            </tr>
          );
        })}
      </ReportTableContainer>
    </div>
  );
}

// ==========================================
// 3. Laporan Pelanggan (CUSTOMERS)
// ==========================================
export function CustomersReportView({ orders = [], dateRangeLabel = '', storeName }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const custData = useMemo(() => {
    const map = {};
    let totalSpend = 0;

    orders.forEach((o) => {
      const name = o.customerName || (o.customer?.name) || 'Tamu Umum';
      const phone = o.customer?.phone || '-';
      const key = o.customerId ? `cid_${o.customerId}` : `cname_${name}`;

      if (!map[key]) {
        map[key] = {
          name,
          phone,
          count: 0,
          total: 0,
          lastOrderDate: o.createdAt,
        };
      }
      map[key].count += 1;
      const t = Number(o.total || 0);
      map[key].total += t;
      totalSpend += t;
      if (new Date(o.createdAt) > new Date(map[key].lastOrderDate)) {
        map[key].lastOrderDate = o.createdAt;
      }
    });

    const list = Object.values(map)
      .map((c) => ({
        ...c,
        aov: c.count > 0 ? Math.round(c.total / c.count) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return { list, totalSpend, totalCustomers: list.length };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return custData.list;
    const q = search.toLowerCase();
    return custData.list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
  }, [custData.list, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'Nama Pelanggan', align: 'left' },
    { label: 'Nomor Telepon', align: 'left' },
    { label: 'Jumlah Transaksi', align: 'right' },
    { label: 'Rata-rata Order (AOV)', align: 'right' },
    { label: 'Total Belanja', align: 'right' },
    { label: 'Kunjungan Terakhir', align: 'left' },
  ];

  const handleExport = (format) => {
    const rawHeaders = ['No', 'Nama Pelanggan', 'No HP', 'Jumlah Transaksi', 'AOV (Rp)', 'Total Belanja (Rp)', 'Kunjungan Terakhir'];
    const rawRows = filtered.map((c, idx) => [
      idx + 1,
      c.name,
      c.phone,
      c.count,
      c.aov,
      c.total,
      formatWibDateTime(c.lastOrderDate),
    ]);
    const summaryRow = ['TOTAL', '', '', orders.length, '', custData.totalSpend, ''];
    const payload = {
      title: 'Laporan Pelanggan',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Pelanggan',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Tamu & Pelanggan"
          value={`${custData.totalCustomers} orang`}
          subtext="Tamu unik tercatat"
          icon={Users}
          color="text-komazi-coral"
          bg="bg-komazi-coral/15"
        />
        <KpiCard
          title="Total Nilai Transaksi"
          value={formatRupiah(custData.totalSpend)}
          subtext={`Dari ${orders.length} struk pesanan`}
          icon={TrendingUp}
          color="text-komazi-teal-light"
          bg="bg-komazi-teal/15"
        />
        <KpiCard
          title="Pelanggan Terbanyak Belanja"
          value={custData.list[0]?.name || '-'}
          subtext={custData.list[0] ? `Total ${formatRupiah(custData.list[0].total)}` : 'Belum ada data'}
          icon={Sparkles}
          color="text-warning"
          bg="bg-warning/15"
        />
      </div>

      <ReportTableContainer
        title="Daftar Pelanggan"
        searchPlaceholder="Cari nama atau nomor telepon..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        onExportExcel={() => handleExport('EXCEL')}
        currentPage={page}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={setPageSize}
        itemLabel="pelanggan"
      >
        {paginated.map((c, idx) => {
          const realIdx = (page - 1) * pageSize + idx;
          return (
            <tr key={realIdx} className="hover:bg-komazi-surface-2/60 transition-colors">
              <td className="py-3 px-4 text-center text-komazi-muted font-mono">{realIdx + 1}</td>
              <td className="py-3 px-4 font-bold text-komazi-text">{c.name}</td>
              <td className="py-3 px-4 font-mono text-komazi-muted">{c.phone}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-komazi-text">{c.count}x</td>
              <td className="py-3 px-4 text-right font-mono text-komazi-muted">{formatRupiah(c.aov)}</td>
              <td className="py-3 px-4 text-right font-mono font-black text-komazi-coral">{formatRupiah(c.total)}</td>
              <td className="py-3 px-4 text-komazi-muted text-[11px]">{formatWibDateTime(c.lastOrderDate)}</td>
            </tr>
          );
        })}
      </ReportTableContainer>
    </div>
  );
}

// ==========================================
// 4. Tipe Pesanan (ORDER_TYPES)
// ==========================================
export function OrderTypesReportView({ orders = [], dateRangeLabel = '', storeName }) {
  const [search, setSearch] = useState('');

  const typeData = useMemo(() => {
    const map = {
      DINE_IN: { name: 'Dine-In (Makan di Tempat)', count: 0, revenue: 0 },
      TAKE_AWAY: { name: 'Take-Away (Bungkus)', count: 0, revenue: 0 },
    };
    let grandRev = 0;
    let grandCount = orders.length;

    orders.forEach((o) => {
      const t = String(o.type || 'DINE_IN').toUpperCase();
      const clean = t.includes('TAKE') ? 'TAKE_AWAY' : 'DINE_IN';
      const amt = Number(o.total || 0);
      map[clean].count += 1;
      map[clean].revenue += amt;
      grandRev += amt;
    });

    const list = Object.values(map).map((t) => ({
      ...t,
      aov: t.count > 0 ? Math.round(t.revenue / t.count) : 0,
      share: grandRev > 0 ? Math.round((t.revenue / grandRev) * 1000) / 10 : 0,
    }));

    return { list, grandRev, grandCount };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return typeData.list;
    const q = search.toLowerCase();
    return typeData.list.filter((t) => t.name.toLowerCase().includes(q));
  }, [typeData.list, search]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'Tipe Pesanan', align: 'left' },
    { label: 'Jumlah Transaksi', align: 'right' },
    { label: 'Rata-rata Order (AOV)', align: 'right' },
    { label: 'Total Penjualan', align: 'right' },
    { label: 'Porsi Omzet', align: 'right' },
  ];

  const handleExport = (format) => {
    const rawHeaders = ['No', 'Tipe Pesanan', 'Transaksi', 'AOV (Rp)', 'Total Omzet (Rp)', 'Kontribusi (%)'];
    const rawRows = filtered.map((t, idx) => [idx + 1, t.name, t.count, t.aov, t.revenue, `${t.share}%`]);
    const summaryRow = ['TOTAL', '', typeData.grandCount, '', typeData.grandRev, '100%'];
    const payload = {
      title: 'Laporan Tipe Pesanan',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Tipe_Pesanan',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Transaksi Dine-In"
          value={`${typeData.list.find((t) => t.name.includes('Dine'))?.count || 0} struk`}
          subtext={`Omzet: ${formatRupiah(typeData.list.find((t) => t.name.includes('Dine'))?.revenue || 0)}`}
          icon={Utensils}
          color="text-komazi-coral"
          bg="bg-komazi-coral/15"
        />
        <KpiCard
          title="Transaksi Take-Away"
          value={`${typeData.list.find((t) => t.name.includes('Take'))?.count || 0} struk`}
          subtext={`Omzet: ${formatRupiah(typeData.list.find((t) => t.name.includes('Take'))?.revenue || 0)}`}
          icon={TrendingUp}
          color="text-komazi-teal-light"
          bg="bg-komazi-teal/15"
        />
        <KpiCard
          title="Dominasi Layanan"
          value={typeData.list[0]?.name.split(' ')[0] || '-'}
          subtext={`${typeData.list[0]?.share || 0}% kontribusi omzet terbesar`}
          icon={Sparkles}
          color="text-warning"
          bg="bg-warning/15"
        />
      </div>

      <ReportTableContainer
        title="Daftar Tipe Pesanan"
        searchPlaceholder="Cari tipe pesanan..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        onExportExcel={() => handleExport('EXCEL')}
        onExportCsv={() => handleExport('CSV')}
      >
        {filtered.map((t, idx) => (
          <tr key={idx} className="hover:bg-komazi-surface-2/60 transition-colors">
            <td className="py-3 px-4 text-center text-komazi-muted font-mono">{idx + 1}</td>
            <td className="py-3 px-4 font-bold text-komazi-text">{t.name}</td>
            <td className="py-3 px-4 text-right font-mono font-bold text-komazi-text">{t.count} struk</td>
            <td className="py-3 px-4 text-right font-mono text-komazi-muted">{formatRupiah(t.aov)}</td>
            <td className="py-3 px-4 text-right font-mono font-black text-komazi-coral">{formatRupiah(t.revenue)}</td>
            <td className="py-3 px-4 text-right font-mono font-bold text-komazi-teal-light">{t.share}%</td>
          </tr>
        ))}
      </ReportTableContainer>
    </div>
  );
}

// ==========================================
// 5. Metode Pembayaran (PAYMENTS)
// ==========================================
export function PaymentsReportView({ orders = [], dateRangeLabel = '', storeName }) {
  const [search, setSearch] = useState('');

  const payData = useMemo(() => {
    const map = {
      QRIS: { name: 'QRIS (Statik & Dinamis)', count: 0, revenue: 0 },
      CASH: { name: 'Uang Tunai (Cash)', count: 0, revenue: 0 },
      TRANSFER: { name: 'Transfer Bank', count: 0, revenue: 0 },
    };
    let grandRev = 0;
    let grandCount = orders.length;

    orders.forEach((o) => {
      const method = String(o.paymentMethod || o.payments?.[0]?.method || 'CASH').toUpperCase();
      const clean = method.includes('QRIS') ? 'QRIS' : method.includes('TRANSFER') ? 'TRANSFER' : 'CASH';
      const amt = Number(o.total || 0);
      map[clean].count += 1;
      map[clean].revenue += amt;
      grandRev += amt;
    });

    const list = Object.values(map)
      .map((p) => ({
        ...p,
        aov: p.count > 0 ? Math.round(p.revenue / p.count) : 0,
        share: grandRev > 0 ? Math.round((p.revenue / grandRev) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const nonCash = (map.QRIS.revenue + map.TRANSFER.revenue);
    const nonCashShare = grandRev > 0 ? Math.round((nonCash / grandRev) * 100) : 0;

    return { list, grandRev, grandCount, nonCash, nonCashShare };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return payData.list;
    const q = search.toLowerCase();
    return payData.list.filter((p) => p.name.toLowerCase().includes(q));
  }, [payData.list, search]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'Metode Pembayaran', align: 'left' },
    { label: 'Jumlah Transaksi', align: 'right' },
    { label: 'Rata-rata per Struk', align: 'right' },
    { label: 'Total Nominal', align: 'right' },
    { label: 'Porsi Kontribusi', align: 'right' },
  ];

  const handleExport = (format) => {
    const rawHeaders = ['No', 'Metode Bayar', 'Jumlah Transaksi', 'AOV (Rp)', 'Total Nominal (Rp)', 'Porsi (%)'];
    const rawRows = filtered.map((p, idx) => [idx + 1, p.name, p.count, p.aov, p.revenue, `${p.share}%`]);
    const summaryRow = ['TOTAL', '', payData.grandCount, '', payData.grandRev, '100%'];
    const payload = {
      title: 'Laporan Metode Pembayaran',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Metode_Bayar',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Transaksi QRIS"
          value={formatRupiah(payData.list.find((p) => p.name.includes('QRIS'))?.revenue || 0)}
          subtext={`${payData.list.find((p) => p.name.includes('QRIS'))?.count || 0} transaksi berhasil`}
          icon={CreditCard}
          color="text-komazi-coral"
          bg="bg-komazi-coral/15"
        />
        <KpiCard
          title="Uang Tunai (Cash)"
          value={formatRupiah(payData.list.find((p) => p.name.includes('Tunai'))?.revenue || 0)}
          subtext={`${payData.list.find((p) => p.name.includes('Tunai'))?.count || 0} transaksi laci kasir`}
          icon={Wallet}
          color="text-emerald-400"
          bg="bg-emerald-500/15"
        />
        <KpiCard
          title="Adopsi Non-Tunai"
          value={`${payData.nonCashShare}%`}
          subtext={`Total Non-Tunai: ${formatRupiah(payData.nonCash)}`}
          icon={TrendingUp}
          color="text-komazi-teal-light"
          bg="bg-komazi-teal/15"
        />
      </div>

      <ReportTableContainer
        title="Daftar Metode Pembayaran"
        searchPlaceholder="Cari metode pembayaran..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        onExportExcel={() => handleExport('EXCEL')}
        onExportCsv={() => handleExport('CSV')}
      >
        {filtered.map((p, idx) => (
          <tr key={idx} className="hover:bg-komazi-surface-2/60 transition-colors">
            <td className="py-3 px-4 text-center text-komazi-muted font-mono">{idx + 1}</td>
            <td className="py-3 px-4 font-bold text-komazi-text">{p.name}</td>
            <td className="py-3 px-4 text-right font-mono font-bold text-komazi-text">{p.count} struk</td>
            <td className="py-3 px-4 text-right font-mono text-komazi-muted">{formatRupiah(p.aov)}</td>
            <td className="py-3 px-4 text-right font-mono font-black text-komazi-coral">{formatRupiah(p.revenue)}</td>
            <td className="py-3 px-4 text-right font-mono font-bold text-komazi-teal-light">{p.share}%</td>
          </tr>
        ))}
      </ReportTableContainer>
    </div>
  );
}

// ==========================================
// 6. Laporan Pajak (TAXES)
// ==========================================
export function TaxesReportView({ orders = [], dateRangeLabel = '', storeName }) {
  const [search, setSearch] = useState('');

  const taxData = useMemo(() => {
    let totalTax = 0;
    let totalDpp = 0;
    let taxOrderCount = 0;

    const list = orders.map((o) => {
      const sub = Number(o.subtotal || 0);
      const disc = Number(o.discount || 0);
      const dpp = Math.max(0, sub - disc);
      const taxAmt = Number(o.tax || 0);
      const total = Number(o.total || 0);

      if (taxAmt > 0) {
        totalTax += taxAmt;
        totalDpp += dpp;
        taxOrderCount += 1;
      }

      return {
        id: o.id,
        invoiceNo: o.invoiceNo || '-',
        waktu: formatWibDateTime(o.createdAt),
        cashier: o.cashierName || o.cashier?.name || 'Kasir',
        subtotal: sub,
        discount: disc,
        dpp,
        taxAmount: taxAmt,
        total,
      };
    });

    return { list, totalTax, totalDpp, taxOrderCount };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return taxData.list;
    const q = search.toLowerCase();
    return taxData.list.filter(
      (t) => t.invoiceNo.toLowerCase().includes(q) || t.cashier.toLowerCase().includes(q)
    );
  }, [taxData.list, search]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'No Invoice', align: 'left' },
    { label: 'Waktu Transaksi (WIB)', align: 'left' },
    { label: 'Kasir', align: 'left' },
    { label: 'Subtotal Sebelum Pajak', align: 'right' },
    { label: 'Diskon', align: 'right' },
    { label: 'DPP (Dasar Pajak)', align: 'right' },
    { label: 'Pajak Resto (PB1)', align: 'right' },
    { label: 'Total Bayar', align: 'right' },
  ];

  const handleExport = (format) => {
    const rawHeaders = [
      'No',
      'No Invoice',
      'Waktu Transaksi',
      'Kasir',
      'Subtotal (Rp)',
      'Diskon (Rp)',
      'DPP (Rp)',
      'Pajak PB1 (Rp)',
      'Total (Rp)',
    ];
    const rawRows = filtered.map((t, idx) => [
      idx + 1,
      t.invoiceNo,
      t.waktu,
      t.cashier,
      t.subtotal,
      t.discount,
      t.dpp,
      t.taxAmount,
      t.total,
    ]);
    const summaryRow = ['TOTAL', '', '', '', '', '', taxData.totalDpp, taxData.totalTax, ''];
    const payload = {
      title: 'Laporan Pajak Penjualan (PB1)',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Pajak',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Pajak Terkumpul (PB1)"
          value={formatRupiah(taxData.totalTax)}
          subtext={`Dari ${taxData.taxOrderCount} struk kena pajak`}
          icon={Receipt}
          color="text-komazi-coral"
          bg="bg-komazi-coral/15"
        />
        <KpiCard
          title="Dasar Pengenaan Pajak (DPP)"
          value={formatRupiah(taxData.totalDpp)}
          subtext="Omzet dasar kena pajak"
          icon={TrendingUp}
          color="text-komazi-teal-light"
          bg="bg-komazi-teal/15"
        />
        <KpiCard
          title="Rata-rata Pajak / Struk"
          value={formatRupiah(taxData.taxOrderCount > 0 ? Math.round(taxData.totalTax / taxData.taxOrderCount) : 0)}
          subtext={`${orders.length} total seluruh transaksi`}
          icon={Sparkles}
          color="text-warning"
          bg="bg-warning/15"
        />
      </div>

      <ReportTableContainer
        title="Daftar Transaksi Pajak"
        searchPlaceholder="Cari invoice atau kasir..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        onExportExcel={() => handleExport('EXCEL')}
        onExportCsv={() => handleExport('CSV')}
      >
        {filtered.map((t, idx) => (
          <tr key={idx} className="hover:bg-komazi-surface-2/60 transition-colors">
            <td className="py-3 px-4 text-center text-komazi-muted font-mono">{idx + 1}</td>
            <td className="py-3 px-4 font-mono font-bold text-komazi-text">{t.invoiceNo}</td>
            <td className="py-3 px-4 text-komazi-muted text-[11px]">{t.waktu}</td>
            <td className="py-3 px-4 text-komazi-text font-medium">{t.cashier}</td>
            <td className="py-3 px-4 text-right font-mono text-komazi-muted">{formatRupiah(t.subtotal)}</td>
            <td className="py-3 px-4 text-right font-mono text-danger">-{formatRupiah(t.discount)}</td>
            <td className="py-3 px-4 text-right font-mono font-bold text-komazi-text">{formatRupiah(t.dpp)}</td>
            <td className="py-3 px-4 text-right font-mono font-black text-komazi-coral">{formatRupiah(t.taxAmount)}</td>
            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{formatRupiah(t.total)}</td>
          </tr>
        ))}
      </ReportTableContainer>
    </div>
  );
}

// ==========================================
// 7. Laporan Diskon (DISCOUNTS)
// ==========================================
export function DiscountsReportView({ orders = [], dateRangeLabel = '', storeName }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const discData = useMemo(() => {
    let totalDiscount = 0;
    let totalOriginalSubtotal = 0;

    const list = orders
      .filter((o) => Number(o.discount || 0) > 0)
      .map((o) => {
        const sub = Number(o.subtotal || 0);
        const disc = Number(o.discount || 0);
        const pct = sub > 0 ? Math.round((disc / sub) * 1000) / 10 : 0;
        const total = Number(o.total || 0);

        totalDiscount += disc;
        totalOriginalSubtotal += sub;

        return {
          id: o.id,
          invoiceNo: o.invoiceNo || '-',
          waktu: formatWibDateTime(o.createdAt),
          cashier: o.cashierName || o.cashier?.name || 'Kasir',
          customer: o.customerName || (o.customer?.name) || 'Tamu',
          subtotal: sub,
          discount: disc,
          pct: `${pct}%`,
          total,
        };
      });

    return { list, totalDiscount, totalOriginalSubtotal, count: list.length };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return discData.list;
    const q = search.toLowerCase();
    return discData.list.filter(
      (d) =>
        d.invoiceNo.toLowerCase().includes(q) ||
        d.cashier.toLowerCase().includes(q) ||
        d.customer.toLowerCase().includes(q)
    );
  }, [discData.list, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'No Invoice', align: 'left' },
    { label: 'Waktu Transaksi (WIB)', align: 'left' },
    { label: 'Kasir', align: 'left' },
    { label: 'Pelanggan', align: 'left' },
    { label: 'Subtotal Awal', align: 'right' },
    { label: 'Potongan Diskon', align: 'right' },
    { label: 'Diskon (%)', align: 'right' },
    { label: 'Total Bayar', align: 'right' },
  ];

  const handleExport = (format) => {
    const rawHeaders = [
      'No',
      'No Invoice',
      'Waktu Transaksi',
      'Kasir',
      'Pelanggan',
      'Subtotal Awal (Rp)',
      'Potongan Diskon (Rp)',
      'Diskon (%)',
      'Total Bayar (Rp)',
    ];
    const rawRows = filtered.map((d, idx) => [
      idx + 1,
      d.invoiceNo,
      d.waktu,
      d.cashier,
      d.customer,
      d.subtotal,
      d.discount,
      d.pct,
      d.total,
    ]);
    const summaryRow = ['TOTAL', '', '', '', '', discData.totalOriginalSubtotal, discData.totalDiscount, '', ''];
    const payload = {
      title: 'Laporan Diskon & Promosi',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Diskon',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Total Diskon Diberikan"
          value={formatRupiah(discData.totalDiscount)}
          subtext={`Dari ${discData.count} struk berdiskon`}
          icon={Percent}
          color="text-danger"
          bg="bg-danger/15"
        />
        <KpiCard
          title="Rasio Diskon / Omzet"
          value={`${discData.totalOriginalSubtotal > 0 ? ((discData.totalDiscount / discData.totalOriginalSubtotal) * 100).toFixed(1) : 0}%`}
          subtext="Persentase dari subtotal kotor"
          icon={TrendingUp}
          color="text-komazi-coral"
          bg="bg-komazi-coral/15"
        />
        <KpiCard
          title="Rata-rata Diskon"
          value={formatRupiah(discData.count > 0 ? Math.round(discData.totalDiscount / discData.count) : 0)}
          subtext="Potongan per struk promo"
          icon={Sparkles}
          color="text-warning"
          bg="bg-warning/15"
        />
      </div>

      <ReportTableContainer
        title="Daftar Transaksi Berdiskon"
        searchPlaceholder="Cari invoice, kasir, atau pelanggan..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        emptyMessage="Tidak ada transaksi berdiskon pada periode ini"
        onExportExcel={() => handleExport('EXCEL')}
        currentPage={page}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={setPageSize}
        itemLabel="transaksi diskon"
      >
        {paginated.map((d, idx) => {
          const realIdx = (page - 1) * pageSize + idx;
          return (
            <tr key={realIdx} className="hover:bg-komazi-surface-2/60 transition-colors">
              <td className="py-3 px-4 text-center text-komazi-muted font-mono">{realIdx + 1}</td>
              <td className="py-3 px-4 font-mono font-bold text-komazi-text">{d.invoiceNo}</td>
              <td className="py-3 px-4 text-komazi-muted text-[11px]">{d.waktu}</td>
              <td className="py-3 px-4 text-komazi-text font-medium">{d.cashier}</td>
              <td className="py-3 px-4 text-komazi-muted">{d.customer}</td>
              <td className="py-3 px-4 text-right font-mono text-komazi-muted">{formatRupiah(d.subtotal)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-danger">-{formatRupiah(d.discount)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-komazi-coral">{d.pct}</td>
              <td className="py-3 px-4 text-right font-mono font-black text-emerald-400">{formatRupiah(d.total)}</td>
            </tr>
          );
        })}
      </ReportTableContainer>
    </div>
  );
}

// ==========================================
// 8. Laporan Pegawai / Kasir (STAFF)
// ==========================================
export function StaffReportView({ orders = [], dateRangeLabel = '', storeName }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const staffData = useMemo(() => {
    const map = {};
    let grandRev = 0;
    let grandCount = orders.length;

    orders.forEach((o) => {
      const name = o.cashierName || o.cashier?.name || 'Kasir Operasional';
      if (!map[name]) {
        map[name] = { name, count: 0, revenue: 0 };
      }
      const t = Number(o.total || 0);
      map[name].count += 1;
      map[name].revenue += t;
      grandRev += t;
    });

    const list = Object.values(map)
      .map((s) => ({
        ...s,
        aov: s.count > 0 ? Math.round(s.revenue / s.count) : 0,
        share: grandRev > 0 ? Math.round((s.revenue / grandRev) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return { list, grandRev, grandCount };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return staffData.list;
    const q = search.toLowerCase();
    return staffData.list.filter((s) => s.name.toLowerCase().includes(q));
  }, [staffData.list, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'Nama Staf / Kasir', align: 'left' },
    { label: 'Jumlah Transaksi', align: 'right' },
    { label: 'Rata-rata Nilai Struk (AOV)', align: 'right' },
    { label: 'Total Penjualan Diproses', align: 'right' },
    { label: 'Kontribusi Penjualan', align: 'right' },
  ];

  const handleExport = (format) => {
    const rawHeaders = ['No', 'Nama Kasir / Staf', 'Jumlah Transaksi', 'AOV (Rp)', 'Total Omzet (Rp)', 'Kontribusi (%)'];
    const rawRows = filtered.map((s, idx) => [idx + 1, s.name, s.count, s.aov, s.revenue, `${s.share}%`]);
    const summaryRow = ['TOTAL', '', staffData.grandCount, '', staffData.grandRev, '100%'];
    const payload = {
      title: 'Laporan Kinerja Penjualan Pegawai',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Pegawai',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Kasir Paling Aktif"
          value={staffData.list[0]?.name || '-'}
          subtext={staffData.list[0] ? `${staffData.list[0].count} transaksi diproses` : 'Belum ada data'}
          icon={UserCheck}
          color="text-komazi-coral"
          bg="bg-komazi-coral/15"
        />
        <KpiCard
          title="Omzet Kasir Tertinggi"
          value={formatRupiah(staffData.list[0]?.revenue || 0)}
          subtext={staffData.list[0] ? `${staffData.list[0].share}% dari omzet total` : 'Belum ada data'}
          icon={TrendingUp}
          color="text-komazi-teal-light"
          bg="bg-komazi-teal/15"
        />
        <KpiCard
          title="Total Staf Bertransaksi"
          value={`${staffData.list.length} orang`}
          subtext={`Memproses ${staffData.grandCount} pesanan`}
          icon={Users}
          color="text-warning"
          bg="bg-warning/15"
        />
      </div>

      <ReportTableContainer
        title="Daftar Kinerja Pegawai Kasir"
        searchPlaceholder="Cari nama pegawai atau kasir..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        onExportExcel={() => handleExport('EXCEL')}
        currentPage={page}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={setPageSize}
        itemLabel="pegawai"
      >
        {paginated.map((s, idx) => {
          const realIdx = (page - 1) * pageSize + idx;
          return (
            <tr key={realIdx} className="hover:bg-komazi-surface-2/60 transition-colors">
              <td className="py-3 px-4 text-center text-komazi-muted font-mono">{realIdx + 1}</td>
              <td className="py-3 px-4 font-bold text-komazi-text">{s.name}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-komazi-text">{s.count} struk</td>
              <td className="py-3 px-4 text-right font-mono text-komazi-muted">{formatRupiah(s.aov)}</td>
              <td className="py-3 px-4 text-right font-mono font-black text-komazi-coral">{formatRupiah(s.revenue)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-komazi-teal-light">{s.share}%</td>
            </tr>
          );
        })}
      </ReportTableContainer>
    </div>
  );
}

// ==========================================
// 9. Laporan Kas Kasir (CASH_DRAWER)
// ==========================================
export function CashDrawerReportView({ shiftHistory = [], dateRangeLabel = '', storeName }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    setPage(1);
  }, [search]);

  const drawerData = useMemo(() => {
    let totalCashSales = 0;
    let totalCashOut = 0;
    let totalCashDrop = 0;
    let totalVariance = 0;

    const list = (shiftHistory || []).map((sh) => {
      const cSales = Number(sh.totalCashSales || 0);
      const cOut = Number(sh.totalCashOut || 0);
      const cDrop = Number(sh.totalCashDrop || 0);
      const exp = Number(sh.expectedCash || 0);
      const act = sh.closingCash !== null && sh.closingCash !== undefined ? Number(sh.closingCash) : null;
      const diff = act !== null ? act - exp : (sh.difference !== null && sh.difference !== undefined ? Number(sh.difference) : 0);

      totalCashSales += cSales;
      totalCashOut += cOut;
      totalCashDrop += cDrop;
      totalVariance += diff;

      return {
        id: sh.id,
        shiftCode: `Shift #${sh.id}`,
        cashier: sh.cashierName || sh.cashier?.name || 'Kasir',
        openedAt: formatWibDateTime(sh.openedAt),
        openingCash: Number(sh.openingCash || 0),
        cashSales: cSales,
        cashIn: Number(sh.totalCashIn || 0),
        cashOut: cOut,
        cashDrop: cDrop,
        expectedCash: exp,
        actualCash: act,
        variance: diff,
        isClosed: Boolean(sh.isClosed),
      };
    });

    return { list, totalCashSales, totalCashOut, totalCashDrop, totalVariance };
  }, [shiftHistory]);

  const filtered = useMemo(() => {
    if (!search.trim()) return drawerData.list;
    const q = search.toLowerCase();
    return drawerData.list.filter(
      (s) => s.shiftCode.toLowerCase().includes(q) || s.cashier.toLowerCase().includes(q)
    );
  }, [drawerData.list, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const headers = [
    { label: 'No', align: 'center' },
    { label: 'Sesi Shift', align: 'left' },
    { label: 'Waktu Buka Shift', align: 'left' },
    { label: 'Kasir', align: 'left' },
    { label: 'Modal Awal', align: 'right' },
    { label: 'Penjualan Tunai', align: 'right' },
    { label: 'Kas Keluar', align: 'right' },
    { label: 'Setor Brankas', align: 'right' },
    { label: 'Ekspektasi Kas', align: 'right' },
    { label: 'Fisik Aktual', align: 'right' },
    { label: 'Selisih Kas', align: 'right' },
    { label: 'Status', align: 'center' },
  ];

  const handleExport = (format) => {
    const rawHeaders = [
      'No',
      'Shift',
      'Waktu Buka',
      'Kasir',
      'Modal Awal (Rp)',
      'Penjualan Tunai (Rp)',
      'Kas Masuk (Rp)',
      'Kas Keluar (Rp)',
      'Setor Brankas (Rp)',
      'Ekspektasi Kas (Rp)',
      'Fisik Aktual (Rp)',
      'Selisih Kas (Rp)',
      'Status',
    ];
    const rawRows = filtered.map((s, idx) => [
      idx + 1,
      s.shiftCode,
      s.openedAt,
      s.cashier,
      s.openingCash,
      s.cashSales,
      s.cashIn,
      s.cashOut,
      s.cashDrop,
      s.expectedCash,
      s.actualCash !== null ? s.actualCash : '-',
      s.variance,
      s.isClosed ? 'Ditutup' : 'Aktif',
    ]);
    const summaryRow = [
      'TOTAL',
      '',
      '',
      '',
      '',
      drawerData.totalCashSales,
      '',
      drawerData.totalCashOut,
      drawerData.totalCashDrop,
      '',
      '',
      drawerData.totalVariance,
      '',
    ];
    const payload = {
      title: 'Laporan Rekapitulasi Kas Laci Kasir',
      dateRangeLabel,
      headers: rawHeaders,
      rows: rawRows,
      summaryRow,
      filenamePrefix: 'Laporan_Kas_Kasir',
      storeName,
    };
    if (format === 'EXCEL') exportCustomTableToExcel(payload);
    else exportCustomTableToCsv(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Penjualan Tunai Laci"
          value={formatRupiah(drawerData.totalCashSales)}
          subtext="Total uang tunai masuk dari POS"
          icon={Wallet}
          color="text-emerald-400"
          bg="bg-emerald-500/15"
        />
        <KpiCard
          title="Kas Keluar Kasir"
          value={formatRupiah(drawerData.totalCashOut)}
          subtext="Petty cash belanja darurat kasir"
          icon={Receipt}
          color="text-danger"
          bg="bg-danger/15"
        />
        <KpiCard
          title="Setor Brankas (Drop)"
          value={formatRupiah(drawerData.totalCashDrop)}
          subtext="Uang disetor aman dari laci"
          icon={TrendingUp}
          color="text-purple-400"
          bg="bg-purple-500/15"
        />
        <KpiCard
          title="Net Selisih Kas"
          value={formatRupiah(drawerData.totalVariance)}
          subtext={drawerData.totalVariance === 0 ? 'Kas seimbang (Balance)' : drawerData.totalVariance > 0 ? 'Surplus kas fisik' : 'Defisit kas fisik'}
          icon={Sparkles}
          color={drawerData.totalVariance >= 0 ? 'text-komazi-teal-light' : 'text-danger'}
          bg={drawerData.totalVariance >= 0 ? 'bg-komazi-teal/15' : 'bg-danger/15'}
        />
      </div>

      <ReportTableContainer
        title="Daftar Sesi Kasir & Mutasi Kas"
        searchPlaceholder="Cari sesi shift atau kasir..."
        searchValue={search}
        onSearchChange={setSearch}
        headers={headers}
        rowCount={filtered.length}
        emptyMessage="Belum ada riwayat sesi kasir"
        onExportExcel={() => handleExport('EXCEL')}
        currentPage={page}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={setPageSize}
        itemLabel="sesi shift"
      >
        {paginated.map((s, idx) => {
          const realIdx = (page - 1) * pageSize + idx;
          return (
            <tr key={realIdx} className="hover:bg-komazi-surface-2/60 transition-colors">
              <td className="py-3 px-4 text-center text-komazi-muted font-mono">{realIdx + 1}</td>
              <td className="py-3 px-4 font-bold text-komazi-text">{s.shiftCode}</td>
              <td className="py-3 px-4 text-komazi-muted text-[11px]">{s.openedAt}</td>
              <td className="py-3 px-4 text-komazi-text font-medium">{s.cashier}</td>
              <td className="py-3 px-4 text-right font-mono text-komazi-muted">{formatRupiah(s.openingCash)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{formatRupiah(s.cashSales)}</td>
              <td className="py-3 px-4 text-right font-mono text-danger">-{formatRupiah(s.cashOut)}</td>
              <td className="py-3 px-4 text-right font-mono text-purple-400">-{formatRupiah(s.cashDrop)}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-komazi-text">{formatRupiah(s.expectedCash)}</td>
              <td className="py-3 px-4 text-right font-mono font-black text-komazi-text">
                {s.actualCash !== null ? formatRupiah(s.actualCash) : '-'}
              </td>
              <td className="py-3 px-4 text-right font-mono font-bold">
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] ${
                    s.variance === 0
                      ? 'text-komazi-muted'
                      : s.variance > 0
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-danger bg-danger/10'
                  }`}
                >
                  {s.variance > 0 ? `+${formatRupiah(s.variance)}` : s.variance < 0 ? formatRupiah(s.variance) : 'Pas'}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    s.isClosed
                      ? 'bg-komazi-surface-2 text-komazi-muted border border-komazi-border'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {s.isClosed ? 'Ditutup' : 'Aktif'}
                </span>
              </td>
            </tr>
          );
        })}
      </ReportTableContainer>
    </div>
  );
}
