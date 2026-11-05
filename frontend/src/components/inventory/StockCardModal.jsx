import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Download,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  History,
  X,
  Layers,
  Filter,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useStockStore } from '../../store/stockStore';
import { toast } from '../../store/toastStore';
import { formatRupiah, formatDateTime } from '../../utils/format';
import { exportToExcel } from '../../utils/excel';

export default function StockCardModal({
  isOpen,
  onClose,
  ingredient,
  canViewCost = false,
}) {
  const fetchStockCard = useStockStore((s) => s.fetchStockCard);

  const [dateFilterType, setDateFilterType] = useState('ALL'); // 'ALL' | 'TODAY' | '7D' | 'MONTH' | 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cardData, setCardData] = useState(null);

  // Compute startDate & endDate based on quick filters
  const dateParams = useMemo(() => {
    const now = new Date();
    if (dateFilterType === 'TODAY') {
      const todayStr = now.toISOString().slice(0, 10);
      return { startDate: todayStr, endDate: todayStr };
    }
    if (dateFilterType === '7D') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { startDate: d.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) };
    }
    if (dateFilterType === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: startOfMonth.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
      };
    }
    if (dateFilterType === 'CUSTOM') {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    return {};
  }, [dateFilterType, customStartDate, customEndDate]);

  const loadCardData = useCallback(async () => {
    if (!ingredient?.id) return;
    setIsLoading(true);
    try {
      const res = await fetchStockCard(ingredient.id, {
        ...dateParams,
        limit: 250,
      });
      if (res) {
        setCardData(res);
      }
    } catch {
      toast.error('Gagal memuat kartu stok bahan baku');
    } finally {
      setIsLoading(false);
    }
  }, [ingredient?.id, fetchStockCard, dateParams]);

  useEffect(() => {
    if (isOpen && ingredient?.id) {
      loadCardData();
    }
  }, [isOpen, ingredient?.id, loadCardData]);

  const handleExport = () => {
    if (!cardData || !cardData.movements || cardData.movements.length === 0) {
      toast.error('Tidak ada data mutasi untuk diekspor');
      return;
    }

    const ingName = cardData.ingredient?.name || ingredient?.name || 'Bahan';
    const unit = cardData.ingredient?.unit || ingredient?.unit || '';

    const rows = cardData.movements.map((m, idx) => ({
      'No': idx + 1,
      'Waktu': formatDateTime(m.createdAt),
      'Tipe Mutasi':
        m.type === 'PURCHASE'
          ? 'Masuk / Pembelian'
          : m.type === 'WASTE'
          ? 'Terbuang / Waste'
          : m.type === 'SALE'
          ? 'Penjualan POS'
          : m.type === 'ADJUSTMENT'
          ? 'Penyesuaian Opname'
          : m.type,
      'Saldo Sebelum': `${m.stockBefore !== null ? m.stockBefore : '-'} ${unit}`,
      'Perubahan Qty': `${m.displayQty || (m.qty >= 0 ? `+${m.qty}` : m.qty)} ${unit}`,
      'Saldo Sesudah': `${m.stockAfter !== null ? m.stockAfter : '-'} ${unit}`,
      'Keterangan': m.note || '-',
      'Dicatat Oleh': m.recordedBy || 'Sistem',
      ...(canViewCost
        ? {
            'Biaya Satuan': m.unitCost ? formatRupiah(m.unitCost) : '-',
            'Total Nilai': m.totalCost ? formatRupiah(m.totalCost) : '-',
          }
        : {}),
    }));

    const sanitizeFileName = ingName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
    exportToExcel(
      rows,
      `kartu_stok_${sanitizeFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      `Kartu Stok - ${ingName}`
    );
    toast.success(`Kartu stok "${ingName}" berhasil diekspor`);
  };

  const ing = cardData?.ingredient || ingredient;
  const summary = cardData?.summary || {
    openingStock: ing?.stock || 0,
    totalIn: 0,
    totalOut: 0,
    closingStock: ing?.stock || 0,
    movementCount: 0,
  };
  const movements = cardData?.movements || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Kartu Stok: ${ing?.name || 'Bahan Baku'}`}
      subtitle={`${ing?.unit ? `Satuan: ${ing.unit}` : ''} • Stok Fisik Saat Ini: ${ing?.stock ?? ing?.currentStock ?? 0} ${ing?.unit || ''}`}
      icon={BookOpen}
      maxWidth="3xl"
      className="max-h-[92dvh]"
      bodyClassName="p-4 sm:p-5 space-y-4 overflow-y-auto"
      headerRight={
        <button
          type="button"
          onClick={handleExport}
          disabled={movements.length === 0 || isLoading}
          className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          title="Ekspor kartu stok ini ke Excel"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ekspor Excel</span>
        </button>
      }
    >
      {/* Quick Date Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {[
              { id: 'ALL', label: 'Semua Waktu' },
              { id: 'TODAY', label: 'Hari Ini' },
              { id: '7D', label: '7 Hari Terakhir' },
              { id: 'MONTH', label: 'Bulan Ini' },
              { id: 'CUSTOM', label: 'Tanggal Kustom' },
            ].map((f) => {
              const active = dateFilterType === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDateFilterType(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border active:scale-95 ${
                    active
                      ? 'bg-komazi-coral text-white border-komazi-coral shadow-sm shadow-komazi-coral/20'
                      : 'bg-komazi-surface-2 text-komazi-muted border-komazi-border hover:text-komazi-text'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={loadCardData}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-komazi-text border border-komazi-border text-xs transition-all active:scale-95 disabled:opacity-50 ml-auto"
            title="Muat ulang kartu stok"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-komazi-teal-light ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {dateFilterType === 'CUSTOM' && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border/80 text-xs animate-in fade-in duration-100 flex-wrap sm:flex-nowrap">
            <Calendar className="w-3.5 h-3.5 text-komazi-coral shrink-0" />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[11px] text-komazi-muted">Dari:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[11px] text-komazi-muted">Sampai:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards: Saldo Awal -> Total Masuk (+) -> Total Keluar (-) -> Saldo Akhir */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Saldo Awal */}
        <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-komazi-muted flex items-center gap-1">
            <Scale className="w-3 h-3 text-sky-400" />
            Saldo Awal
          </span>
          <div className="mt-1">
            <p className="text-base sm:text-lg font-black font-mono text-komazi-text">
              {summary.openingStock} <span className="text-xs font-normal text-komazi-muted">{ing?.unit}</span>
            </p>
            <p className="text-[10px] text-komazi-muted mt-0.5">Awal periode</p>
          </div>
        </div>

        {/* Total Masuk */}
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
            Total Masuk
          </span>
          <div className="mt-1">
            <p className="text-base sm:text-lg font-black font-mono text-emerald-400">
              +{summary.totalIn} <span className="text-xs font-normal text-emerald-400/70">{ing?.unit}</span>
            </p>
            <p className="text-[10px] text-emerald-400/60 mt-0.5">
              {canViewCost && summary.totalCostIn ? formatRupiah(summary.totalCostIn) : 'Restok & Opname +'}
            </p>
          </div>
        </div>

        {/* Total Keluar */}
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 text-rose-400" />
            Total Keluar
          </span>
          <div className="mt-1">
            <p className="text-base sm:text-lg font-black font-mono text-rose-400">
              -{summary.totalOut} <span className="text-xs font-normal text-rose-400/70">{ing?.unit}</span>
            </p>
            <p className="text-[10px] text-rose-400/60 mt-0.5">
              {canViewCost && summary.totalCostOut ? formatRupiah(summary.totalCostOut) : 'Penjualan & Waste'}
            </p>
          </div>
        </div>

        {/* Saldo Akhir */}
        <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-coral/30 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-komazi-coral flex items-center gap-1">
            <Layers className="w-3 h-3 text-komazi-coral" />
            Saldo Akhir
          </span>
          <div className="mt-1">
            <p className="text-base sm:text-lg font-black font-mono text-komazi-coral">
              {summary.closingStock} <span className="text-xs font-normal text-komazi-coral/70">{ing?.unit}</span>
            </p>
            <p className="text-[10px] text-komazi-muted mt-0.5">
              {summary.movementCount} mutasi tercatat
            </p>
          </div>
        </div>
      </div>

      {/* Movement Ledger Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-komazi-muted px-1">
          <span className="font-semibold text-komazi-text flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-komazi-coral" />
            Buku Mutasi Kronologis ({movements.length})
          </span>
          <span className="text-[11px] text-komazi-muted">Urutan: Terbaru di atas</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-komazi-coral mx-auto opacity-80" />
            <p className="text-xs text-komazi-muted">Memuat catatan mutasi kartu stok...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="p-8 rounded-xl bg-komazi-surface-2 border border-dashed border-komazi-border text-center space-y-1">
            <p className="text-xs font-semibold text-komazi-text">Belum ada mutasi dalam periode ini</p>
            <p className="text-[11px] text-komazi-muted">
              Pilih periode waktu lain atau lakukan transaksi/restok bahan untuk melihat log pergerakan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-komazi-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-komazi-surface-2 text-komazi-muted uppercase text-[10px] font-bold tracking-wider border-b border-komazi-border">
                <tr>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Tipe</th>
                  <th className="py-2.5 px-3">Keterangan / Ref</th>
                  <th className="py-2.5 px-3 text-right">Saldo Awal</th>
                  <th className="py-2.5 px-3 text-right">Mutasi (+/-)</th>
                  <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                  {canViewCost && <th className="py-2.5 px-3 text-right">Biaya</th>}
                  <th className="py-2.5 px-3">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-komazi-border/60 bg-komazi-surface font-sans">
                {movements.map((m) => {
                  const isPurchase = m.type === 'PURCHASE';
                  const isWaste = m.type === 'WASTE';
                  const isSale = m.type === 'SALE';

                  const badgeClass = isPurchase
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : isWaste
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : isSale
                    ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

                  const typeLabel = isPurchase
                    ? 'Restok'
                    : isWaste
                    ? 'Waste'
                    : isSale
                    ? 'POS Sale'
                    : 'Opname';

                  const qtyColor = isPurchase
                    ? 'text-emerald-400'
                    : isWaste || isSale
                    ? 'text-rose-400'
                    : m.qty >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400';

                  return (
                    <tr key={m.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-komazi-muted font-mono text-[11px]">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClass}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-komazi-text font-medium max-w-xs truncate" title={m.note || '-'}>
                        {m.note || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-komazi-muted">
                        {m.stockBefore !== null ? m.stockBefore : '-'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${qtyColor}`}>
                        {m.displayQty || (m.qty >= 0 ? `+${m.qty}` : m.qty)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-komazi-text">
                        {m.stockAfter !== null ? m.stockAfter : '-'}
                      </td>
                      {canViewCost && (
                        <td className="py-2.5 px-3 text-right font-mono text-komazi-muted text-[11px]">
                          {m.totalCost ? formatRupiah(m.totalCost) : '-'}
                        </td>
                      )}
                      <td className="py-2.5 px-3 whitespace-nowrap text-komazi-muted text-[11px]">
                        {m.recordedBy || 'Sistem'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

