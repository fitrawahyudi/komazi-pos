import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Receipt,
  Layers,
  Banknote,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { exportOrdersToExcel, exportOrdersToCsv } from '../../utils/excel';
import { formatRupiah, formatDateTime } from '../../utils/format';
import { toast } from '../../store/toastStore';

export default function ExportOrdersModal({
  isOpen,
  onClose,
  orders = [],
  filteredOrders = [],
  activeFilters = {},
}) {
  if (!isOpen) return null;

  // 1. Opsi Ekspor
  const [format, setFormat] = useState('XLSX'); // 'XLSX' | 'CSV'
  const [scope, setScope] = useState('FILTERED'); // 'FILTERED' | 'ALL' | 'CUSTOM'
  const [statusScope, setStatusScope] = useState('ALL'); // 'ALL' | 'PAID' | 'VOIDED' | 'REFUNDED'
  const [includeItemDetails, setIncludeItemDetails] = useState(true);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // 2. Evaluasi Kumpulan Pesanan yang akan diekspor
  const targetOrders = useMemo(() => {
    let baseList = [];
    if (scope === 'FILTERED') {
      baseList = [...filteredOrders];
    } else if (scope === 'ALL') {
      baseList = [...orders];
    } else {
      // Custom date scope
      baseList = orders.filter((o) => {
        if (!o.createdAt) return false;
        const localDate = new Date(o.createdAt);
        const y = localDate.getFullYear();
        const m = String(localDate.getMonth() + 1).padStart(2, '0');
        const d = String(localDate.getDate()).padStart(2, '0');
        const orderDateStr = `${y}-${m}-${d}`;

        if (customStartDate && orderDateStr < customStartDate) return false;
        if (customEndDate && orderDateStr > customEndDate) return false;
        return true;
      });
    }

    // Filter status jika dipilih spesifik
    if (statusScope !== 'ALL') {
      baseList = baseList.filter((o) => (o.status || '').toUpperCase() === statusScope);
    }

    return baseList;
  }, [scope, orders, filteredOrders, statusScope, customStartDate, customEndDate]);

  // 3. Ringkasan Statistik Data yang akan diekspor
  const stats = useMemo(() => {
    let revenue = 0;
    let itemsCount = 0;
    let paidCount = 0;
    let voidCount = 0;
    let refundCount = 0;

    targetOrders.forEach((o) => {
      const tot = Number(o.total || 0);
      const qty = (o.items || []).reduce(
        (sum, it) => sum + (Number(it.quantity || it.qty) || 1),
        0
      );
      itemsCount += qty;

      if (o.status === 'PAID') {
        revenue += tot;
        paidCount++;
      } else if (o.status === 'VOIDED') {
        voidCount++;
      } else if (o.status === 'REFUNDED') {
        refundCount++;
      }
    });

    return { revenue, itemsCount, paidCount, voidCount, refundCount };
  }, [targetOrders]);

  // 4. Handler Eksekusi Unduh Berkas
  const handleDownload = async () => {
    if (targetOrders.length === 0) {
      toast.warning('Tidak ada pesanan yang sesuai untuk diekspor.');
      return;
    }

    try {
      setIsExporting(true);

      let dateRangeLabel = 'Semua Tanggal';
      if (scope === 'CUSTOM') {
        if (customStartDate && customEndDate) {
          dateRangeLabel = `${customStartDate} s/d ${customEndDate}`;
        } else if (customStartDate) {
          dateRangeLabel = `Mulai ${customStartDate}`;
        } else if (customEndDate) {
          dateRangeLabel = `Sampai ${customEndDate}`;
        }
      } else if (scope === 'FILTERED') {
        dateRangeLabel = activeFilters.dateRange || 'Sesuai Filter Halaman';
      }

      const meta = {
        status: statusScope !== 'ALL' ? statusScope : activeFilters.status || 'ALL',
        method: activeFilters.method || 'ALL',
        dateRange: dateRangeLabel,
        cashier: activeFilters.cashier || 'Semua Kasir',
        shift: activeFilters.shift || 'Semua Shift',
        search: activeFilters.search || '',
        scope: scope === 'FILTERED' ? 'Data Terfilter' : scope === 'ALL' ? 'Semua Data' : 'Rentang Tanggal',
      };

      if (format === 'XLSX') {
        const res = exportOrdersToExcel({
          orders: targetOrders,
          filterMeta: meta,
          storeName: 'Komazi Coffee & Workspace',
        });
        toast.success(
          `Berhasil mengekspor ${res.count} transaksi (${res.itemCount || 0} baris item) ke ${res.fileName}`,
          'Ekspor Excel'
        );
      } else {
        const res = exportOrdersToCsv({
          orders: targetOrders,
          filterMeta: meta,
          storeName: 'Komazi Coffee & Workspace',
        });
        toast.success(
          `Berhasil mengekspor ${res.count} transaksi ke ${res.fileName}`,
          'Ekspor CSV'
        );
      }

      onClose();
    } catch (err) {
      console.error('[ExportOrdersModal Error]', err);
      toast.error(err?.message || 'Gagal mengekspor riwayat pesanan');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-komazi-text font-display">
                Ekspor Riwayat Pesanan
              </h2>
              <p className="text-xs text-komazi-muted">
                Unduh rekap transaksi penjualan lengkap untuk laporan keuangan & arsip
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* 1. Format Selection */}
          <div>
            <label className="block text-xs font-bold text-komazi-muted uppercase tracking-wider mb-2.5">
              Pilih Format Berkas:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('XLSX')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                  format === 'XLSX'
                    ? 'bg-emerald-500/10 border-emerald-500/60 ring-2 ring-emerald-500/30 text-emerald-400'
                    : 'bg-komazi-surface-2/60 border-komazi-border text-komazi-muted hover:border-neutral-700 hover:text-komazi-text'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    format === 'XLSX' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-komazi-text flex items-center gap-1.5">
                    <span>Excel (.xlsx)</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">
                      Rekomendasi
                    </span>
                  </div>
                  <p className="text-[11px] text-komazi-muted mt-0.5 leading-snug">
                    Format resmi Komazi lengkap dengan styling hijau, formula total & sheet rincian menu.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('CSV')}
                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                  format === 'CSV'
                    ? 'bg-emerald-500/10 border-emerald-500/60 ring-2 ring-emerald-500/30 text-emerald-400'
                    : 'bg-komazi-surface-2/60 border-komazi-border text-komazi-muted hover:border-neutral-700 hover:text-komazi-text'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    format === 'CSV' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-komazi-text">CSV (.csv)</div>
                  <p className="text-[11px] text-komazi-muted mt-0.5 leading-snug">
                    Teks terpisah koma dengan UTF-8 BOM, kompatibel dengan software akuntansi & Google Sheets.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Scope Selection */}
          <div>
            <label className="block text-xs font-bold text-komazi-muted uppercase tracking-wider mb-2.5">
              Cakupan Data Pesanan:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setScope('FILTERED')}
                className={`px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scope === 'FILTERED'
                    ? 'bg-komazi-coral/15 border-komazi-coral/60 ring-1 ring-komazi-coral/40 text-komazi-coral font-bold'
                    : 'bg-komazi-surface-2/60 border-komazi-border text-komazi-muted hover:text-white'
                }`}
              >
                <div className="text-xs text-komazi-text font-bold">Sesuai Filter Halaman</div>
                <div className="text-[10px] text-komazi-muted mt-0.5 font-mono">
                  {filteredOrders.length} Pesanan terfilter
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('ALL')}
                className={`px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scope === 'ALL'
                    ? 'bg-komazi-coral/15 border-komazi-coral/60 ring-1 ring-komazi-coral/40 text-komazi-coral font-bold'
                    : 'bg-komazi-surface-2/60 border-komazi-border text-komazi-muted hover:text-white'
                }`}
              >
                <div className="text-xs text-komazi-text font-bold">Semua Riwayat Pesanan</div>
                <div className="text-[10px] text-komazi-muted mt-0.5 font-mono">
                  {orders.length} Total pesanan
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('CUSTOM')}
                className={`px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                  scope === 'CUSTOM'
                    ? 'bg-komazi-coral/15 border-komazi-coral/60 ring-1 ring-komazi-coral/40 text-komazi-coral font-bold'
                    : 'bg-komazi-surface-2/60 border-komazi-border text-komazi-muted hover:text-white'
                }`}
              >
                <div className="text-xs text-komazi-text font-bold">Rentang Tanggal Kustom</div>
                <div className="text-[10px] text-komazi-muted mt-0.5">Pilih tanggal awal & akhir</div>
              </button>
            </div>

            {/* Custom Date Pickers */}
            {scope === 'CUSTOM' && (
              <div className="mt-3 p-3.5 rounded-xl bg-komazi-surface-2/60 border border-komazi-border grid grid-cols-2 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[10px] font-bold text-komazi-muted uppercase mb-1">
                    Dari Tanggal:
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-komazi-muted uppercase mb-1">
                    Sampai Tanggal:
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Filter Status Tambahan */}
          <div>
            <label className="block text-xs font-bold text-komazi-muted uppercase tracking-wider mb-2">
              Filter Status Transaksi:
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'ALL', label: 'Semua Status' },
                { key: 'PAID', label: 'Hanya Lunas (PAID)' },
                { key: 'VOIDED', label: 'Hanya Dibatalkan (VOID)' },
                { key: 'REFUNDED', label: 'Hanya Pengembalian (REFUND)' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusScope(st.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusScope === st.key
                      ? 'bg-komazi-surface-2 text-komazi-coral border border-komazi-coral/50'
                      : 'bg-komazi-surface-2/50 text-komazi-muted border border-transparent hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Live Summary Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-komazi-surface-2/80 to-komazi-surface-2 border border-komazi-border shadow-inner space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-komazi-muted">
                Ringkasan Data yang Akan Diekspor
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {targetOrders.length} Pesanan Terpilih
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1 border-t border-komazi-border/60">
              <div>
                <span className="text-[10px] text-komazi-muted block">Omzet Lunas (Rp)</span>
                <span className="font-mono font-black text-sm text-emerald-400 mt-0.5 block truncate">
                  {formatRupiah(stats.revenue)}
                </span>
                <span className="text-[9px] text-komazi-muted">{stats.paidCount} transaksi</span>
              </div>
              <div>
                <span className="text-[10px] text-komazi-muted block">Total Item Terjual</span>
                <span className="font-mono font-black text-sm text-komazi-text mt-0.5 block">
                  {stats.itemsCount.toLocaleString('id-ID')} pcs
                </span>
                <span className="text-[9px] text-komazi-muted">seluruh menu</span>
              </div>
              <div>
                <span className="text-[10px] text-komazi-muted block">Batal & Refund</span>
                <span className="font-mono font-bold text-sm text-danger mt-0.5 block">
                  {stats.voidCount} / {stats.refundCount}
                </span>
                <span className="text-[9px] text-komazi-muted">void / refund</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-komazi-border flex items-center justify-between bg-komazi-surface-2/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-komazi-border text-xs font-bold text-komazi-muted hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || targetOrders.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>
              {isExporting
                ? 'Menyiapkan Berkas...'
                : `Unduh ${format === 'XLSX' ? 'Excel (.xlsx)' : 'CSV (.csv)'}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
