import React, { useState, useEffect } from 'react';
import { useAssetStore } from '../../store/assetStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { formatRupiah } from '../../utils/format';
import {
  TrendingDown,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  RotateCcw,
  Building2,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Receipt,
  FileCheck2,
} from 'lucide-react';

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export default function DepreciationPage() {
  const { user } = useAuthStore();
  const {
    depreciations,
    depreciationPreview,
    depreciationLoading,
    fetchDepreciations,
    previewDepreciation,
    processDepreciation,
  } = useAssetStore();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [notes, setNotes] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDepreciations({ year: selectedYear, month: selectedMonth });
    previewDepreciation(selectedYear, selectedMonth).catch(() => {});
  }, [fetchDepreciations, previewDepreciation, selectedYear, selectedMonth]);

  const handlePreview = () => {
    previewDepreciation(selectedYear, selectedMonth);
  };

  const handleExecute = async () => {
    setSubmitting(true);
    try {
      await processDepreciation(selectedYear, selectedMonth, notes);
      setIsConfirmOpen(false);
      setNotes('');
    } catch {
      // error handled in store
    } finally {
      setSubmitting(false);
    }
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <TrendingDown className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-komazi-text tracking-tight flex items-center gap-2">
              <span>Penyusutan Aset</span>
            </h1>
          </div>
          <p className="text-xs text-komazi-muted mt-1">
            Kalkulasi dan pembukuan depresiasi nilai mesin & peralatan ke laporan laba rugi bulanan.
          </p>
        </div>

        {/* Period Selector Controls */}
        <div className="flex items-center gap-2 bg-komazi-surface p-1.5 rounded-2xl border border-komazi-border self-start sm:self-auto">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs font-bold text-komazi-text focus:outline-none cursor-pointer"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3 py-1.5 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs font-bold text-komazi-text focus:outline-none cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handlePreview}
            disabled={depreciationLoading}
            className="p-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface text-komazi-muted hover:text-komazi-text transition-colors"
            title="Refresh Pratinjau"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${depreciationLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Monthly Preview Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
              Periode Pembukuan: {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </div>
            <div className="text-xl sm:text-2xl font-black text-komazi-text mt-0.5 flex items-center gap-2">
              <span>{formatRupiah(depreciationPreview?.totalDepreciationAmount || 0)}</span>
              <span className="text-xs font-semibold text-komazi-muted">
                ({depreciationPreview?.eligibleCount || 0} aset siap disusutkan)
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={
              depreciationLoading ||
              !depreciationPreview ||
              depreciationPreview.eligibleCount === 0
            }
            onClick={() => setIsConfirmOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 self-start sm:self-auto active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Eksekusi Penyusutan Periode Ini</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-1">
            <div className="text-komazi-muted font-bold uppercase text-[10px]">Aset Siap Disusutkan</div>
            <div className="font-mono text-lg font-black text-purple-400">
              {depreciationPreview?.eligibleCount || 0} Unit
            </div>
            <p className="text-[10px] text-komazi-muted">Aset aktif dengan nilai buku &gt; residu</p>
          </div>

          <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-1">
            <div className="text-komazi-muted font-bold uppercase text-[10px]">Sudah Dibukukan</div>
            <div className="font-mono text-lg font-black text-emerald-400">
              {depreciationPreview?.alreadyProcessedCount || 0} Unit
            </div>
            <p className="text-[10px] text-komazi-muted">Beban telah tercatat pada periode ini</p>
          </div>

          <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-1">
            <div className="text-komazi-muted font-bold uppercase text-[10px]">Habis Masa Manfaat</div>
            <div className="font-mono text-lg font-black text-komazi-muted">
              {depreciationPreview?.fullyDepreciatedCount || 0} Unit
            </div>
            <p className="text-[10px] text-komazi-muted">Nilai buku telah mencapai nilai residu</p>
          </div>
        </div>

        {/* Eligible Assets Table */}
        {depreciationPreview?.eligibleAssets && depreciationPreview.eligibleAssets.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-komazi-text flex items-center gap-1.5">
              <span>Daftar Aset yang Akan Disusutkan Bulan Ini</span>
            </div>
            <div className="rounded-xl border border-komazi-border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-komazi-surface-2/60 border-b border-komazi-border text-[10px] uppercase font-bold text-komazi-muted">
                    <th className="py-2.5 px-3">Kode</th>
                    <th className="py-2.5 px-3">Nama Aset</th>
                    <th className="py-2.5 px-3 text-right">Nilai Buku Saat Ini</th>
                    <th className="py-2.5 px-3 text-right">Beban Penyusutan</th>
                    <th className="py-2.5 px-3 text-right">Estimasi Nilai Buku Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-komazi-border/50 text-komazi-text">
                  {depreciationPreview.eligibleAssets.map((a) => (
                    <tr key={a.id} className="hover:bg-komazi-surface-2/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-komazi-coral">{a.code}</td>
                      <td className="py-2.5 px-3 font-medium">{a.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-komazi-muted">
                        {formatRupiah(a.currentBookValue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-400">
                        {formatRupiah(a.depreciationAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400">
                        {formatRupiah(a.estimatedClosingBookValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 3. History of Processed Depreciations Table */}
      <div className="rounded-2xl bg-komazi-surface border border-komazi-border overflow-hidden shadow-sm space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>Jurnal Histori Penyusutan ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})</span>
            </h3>
            <p className="text-xs text-komazi-muted mt-0.5">
              Daftar aset yang telah selesai disusutkan dan dibukukan pada database.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-komazi-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-komazi-surface-2/60 border-b border-komazi-border text-[10px] uppercase font-bold text-komazi-muted">
                <th className="py-3 px-4">Waktu Proses</th>
                <th className="py-3 px-4">Kode Aset</th>
                <th className="py-3 px-4">Nama Aset</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">Beban Penyusutan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Diproses Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/50 text-komazi-text">
              {depreciations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-komazi-muted">
                    Belum ada penyusutan yang dibukukan untuk periode {MONTH_NAMES[selectedMonth - 1]}{' '}
                    {selectedYear}.
                  </td>
                </tr>
              ) : (
                depreciations.map((dep) => (
                  <tr key={dep.id} className="hover:bg-komazi-surface-2/40">
                    <td className="py-3 px-4 text-komazi-muted whitespace-nowrap">
                      {new Date(dep.processedAt || dep.createdAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-komazi-coral">
                      {dep.asset?.code}
                    </td>
                    <td className="py-3 px-4 font-semibold">{dep.asset?.name}</td>
                    <td className="py-3 px-4 text-komazi-muted">{dep.asset?.category}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-purple-400">
                      {formatRupiah(dep.depreciationAmount)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Selesai Dibukukan</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-komazi-muted">
                      {dep.processedBy?.name || 'Sistem Otomatis'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal Konfirmasi Eksekusi */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-komazi-surface border border-purple-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-purple-400">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">Konfirmasi Pembukuan Penyusutan</h3>
                <p className="text-[11px] text-komazi-muted">
                  Periode {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                </p>
              </div>
            </div>

            <p className="text-xs text-komazi-muted">
              Sistem akan memproses penyusutan sebanyak{' '}
              <strong className="text-komazi-text">{depreciationPreview?.eligibleCount} aset</strong>{' '}
              dengan total beban sebesar{' '}
              <strong className="text-purple-400">
                {formatRupiah(depreciationPreview?.totalDepreciationAmount || 0)}
              </strong>
              . Nilai buku aset akan diperbarui secara atomik dan beban akan langsung masuk ke Laporan
              Laba Rugi.
            </p>

            <div>
              <label className="block text-xs font-bold text-komazi-muted mb-1">
                Catatan Pembukuan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Misal: Penutupan buku akhir bulan reguler"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-komazi-surface-2 border border-komazi-border rounded-xl text-xs text-komazi-text focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-muted"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleExecute}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-2 shadow-md"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Eksekusi Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
