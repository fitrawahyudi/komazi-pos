import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Minus,
  Banknote,
  Search,
  Filter,
  Calendar,
  Clock,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Coins,
  History,
  Lock,
  Unlock,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useShiftStore } from '../store/shiftStore';
import { useAuthStore } from '../store/authStore';
import { usePrinterStore } from '../store/printerStore';
import { formatRupiah, formatDateTime } from '../utils/format';
import { toast } from '../store/toastStore';
import Pagination from '../components/ui/Pagination';
import ShiftModal from '../components/shift/ShiftModal';

export default function CashDrawerPage() {
  const { activeShift, fetchActiveShift, addCashMovement } = useShiftStore();
  const { user } = useAuthStore();
  const { isConnected: isPrinterConnected, openCashDrawer } = usePrinterStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'IN' | 'OUT'
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Modal Kas Masuk / Keluar State
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('OUT'); // 'IN' | 'OUT'
  const [movementAmount, setMovementAmount] = useState(25000);
  const [movementReason, setMovementReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination for cash movements
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchActiveShift?.();
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchActiveShift?.();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchActiveShift]);

  const hasActiveShift = Boolean(activeShift && !activeShift.isClosed);

  // Financial metrics
  const openingCash = Number(activeShift?.openingCash || 0);
  const totalCashSales = Number(activeShift?.totalCashSales || 0);
  const totalCashIn = Number(activeShift?.totalCashIn || 0);
  const totalCashOut = Number(activeShift?.totalCashOut || 0);
  const totalCashDrop = Number(activeShift?.totalCashDrop || 0);
  const totalCashRefund = Number(activeShift?.totalCashRefund || 0);

  const currentCashInDrawer = hasActiveShift
    ? openingCash + totalCashSales + totalCashIn - totalCashOut - totalCashDrop - totalCashRefund
    : 0;

  const rawMovements = activeShift?.cashMovements || [];

  const filteredMovements = useMemo(() => {
    return rawMovements.filter((m) => {
      const matchType =
        filterType === 'ALL' ||
        m.type === filterType ||
        (filterType === 'IN' && m.type === 'CASH_IN') ||
        (filterType === 'OUT' && m.type === 'CASH_OUT') ||
        (filterType === 'DROP' && m.type === 'CASH_DROP');
      const matchSearch =
        !searchQuery ||
        (m.reason && m.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(m.amount).includes(searchQuery);
      return matchType && matchSearch;
    });
  }, [rawMovements, filterType, searchQuery]);

  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMovements.slice(start, start + itemsPerPage);
  }, [filteredMovements, currentPage, itemsPerPage]);

  const handleOpenMovementModal = (type) => {
    if (!hasActiveShift) {
      toast.warning('Buka sesi kasir terlebih dahulu untuk mencatat arus kas.');
      setIsShiftModalOpen(true);
      return;
    }
    setMovementType(type);
    setMovementAmount(type === 'OUT' ? 25000 : type === 'DROP' ? 100000 : 50000);
    setMovementReason('');
    setShowMovementModal(true);
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();
    if (!movementAmount || movementAmount <= 0) {
      toast.error('Nominal kas harus lebih dari Rp 0');
      return;
    }
    if (!movementReason.trim()) {
      toast.error('Alasan / keterangan kas wajib diisi');
      return;
    }

    try {
      setIsSubmitting(true);
      await addCashMovement({
        type: movementType,
        amount: movementAmount,
        reason: movementReason.trim(),
        shiftId: activeShift?.id,
      });
      toast.success(
        `${
          movementType === 'IN'
            ? 'Kas Masuk'
            : movementType === 'DROP'
            ? 'Setor Brankas'
            : 'Kas Keluar'
        } senilai ${formatRupiah(movementAmount)} berhasil dicatat!`
      );
      setShowMovementModal(false);
      setMovementReason('');
    } catch (err) {
      toast.error(err?.message || 'Gagal menyimpan arus kas');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKickDrawer = () => {
    if (typeof openCashDrawer === 'function') {
      openCashDrawer();
      toast.success('Sinyal buka laci kasir (kick cash drawer) dikirim ke printer!');
    } else {
      toast.info('Laci kasir siap dihubungkan melalui port printer thermal RJ11.');
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28 lg:pb-12 space-y-6 max-w-7xl mx-auto select-none animate-in fade-in duration-200">
      {/* 1. Header & Actions Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-komazi-surface p-5 sm:p-6 rounded-2xl border border-komazi-border shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shadow-inner shrink-0">
            <Wallet className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display font-black text-xl sm:text-2xl text-komazi-text tracking-tight">
                Kas Kasir 
              </h1>
            </div>
            <p className="text-xs text-komazi-muted mt-1 leading-relaxed">
              Buka kas, pantau penjualan secara langsung, dan tutup kas di akhir shift Anda.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleKickDrawer}
            title="Kirim sinyal pulsa RJ-11 untuk membuka laci kasir otomatis"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-text transition-all active:scale-95 shadow-sm"
          >
            <Printer className="w-4 h-4 text-komazi-teal-light" />
            <span>Buka Laci Kasir</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenMovementModal('IN')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Kas Masuk</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenMovementModal('OUT')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-danger/15 hover:bg-danger/25 border border-danger/30 text-danger text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <Minus className="w-4 h-4 stroke-[2.5]" />
            <span>Kas Keluar</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenMovementModal('DROP')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
            <span>Setor Brankas</span>
          </button>
        </div>
      </div>

      {/* 2. Metrics & Cash Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Main: Saldo Fisik di Laci */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-komazi-surface-2 to-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
              Saldo Kas di Laci Saat Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-mono font-black text-2xl text-emerald-400">
              {formatRupiah(currentCashInDrawer)}
            </h3>
            <p className="text-[10px] text-komazi-muted mt-1">
              Kas fisik riil yang wajib ada di kasir
            </p>
          </div>
        </div>

        {/* Modal Awal Kas */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
              Modal Awal Kasir
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-mono font-bold text-xl text-komazi-text">
              {formatRupiah(openingCash)}
            </h3>
            <p className="text-[10px] text-komazi-muted mt-1">
              Saldo awal saat shift dibuka
            </p>
          </div>
        </div>

        {/* Total Penjualan Tunai */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
              Penjualan Tunai Sesi Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="font-mono font-bold text-xl text-komazi-coral">
              +{formatRupiah(totalCashSales)}
            </h3>
            <p className="text-[10px] text-komazi-muted mt-1">
              Omzet tunai yang diterima dari pembeli
            </p>
          </div>
        </div>

        {/* Arus Kas Operasional (Net In - Out) */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-komazi-muted">
              Arus Kas Masuk / Keluar
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                +{formatRupiah(totalCashIn)}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger/10 text-danger">
                -{formatRupiah(totalCashOut)}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <h3
              className={`font-mono font-bold text-xl ${
                totalCashIn - totalCashOut >= 0 ? 'text-komazi-text' : 'text-danger'
              }`}
            >
              {totalCashIn - totalCashOut >= 0 ? '+' : ''}
              {formatRupiah(totalCashIn - totalCashOut)}
            </h3>
            <p className="text-[10px] text-komazi-muted mt-1">
              Net mutasi petty cash kasir
            </p>
          </div>
        </div>
      </div>

      {/* 3. Filter & Table Card */}
      <div className="bg-komazi-surface rounded-2xl border border-komazi-border overflow-hidden shadow-sm">
        {/* Table Filter Header */}
        <div className="p-4 sm:p-5 border-b border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-komazi-coral" />
            <h2 className="font-bold text-sm text-komazi-text">
              Riwayat Kas &amp; Mutasi Kas
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-komazi-surface-2 text-komazi-muted font-bold font-mono">
              {filteredMovements.length} Catatan
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-komazi-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari keterangan..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none w-44 sm:w-56"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-komazi-surface-2 p-1 rounded-xl border border-komazi-border text-xs">
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'IN', label: 'Kas Masuk' },
                { id: 'OUT', label: 'Kas Keluar' },
                { id: 'DROP', label: 'Setor Brankas' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFilterType(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    filterType === tab.id
                      ? 'bg-komazi-coral text-white shadow-sm'
                      : 'text-komazi-muted hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-komazi-surface-2/70 text-komazi-muted uppercase text-[10px] font-bold tracking-wider border-b border-komazi-border">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Tipe Mutasi</th>
                <th className="py-3 px-4">Keterangan / Keperluan</th>
                <th className="py-3 px-4 text-right">Nominal</th>
                <th className="py-3 px-4">Petugas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border/50">
              {paginatedMovements.length > 0 ? (
                paginatedMovements.map((movement) => {
                  const isIncoming = movement.type === 'IN' || movement.type === 'CASH_IN';
                  const isDrop = movement.type === 'DROP' || movement.type === 'CASH_DROP';
                  return (
                    <tr
                      key={movement.id}
                      className="hover:bg-komazi-surface-2/40 transition-colors"
                    >
                      <td className="py-3 px-4 text-komazi-muted font-mono whitespace-nowrap">
                        {movement.createdAt || movement.timestamp
                          ? formatDateTime(movement.createdAt || movement.timestamp)
                          : '-'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            isIncoming
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                              : isDrop
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/25'
                              : 'bg-danger/10 text-danger border-danger/25'
                          }`}
                        >
                          {isIncoming ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : isDrop ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          <span>
                            {isIncoming
                              ? 'Kas Masuk'
                              : isDrop
                              ? 'Setor Brankas'
                              : 'Kas Keluar'}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-komazi-text">
                        {movement.reason || '-'}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          isIncoming ? 'text-emerald-400' : isDrop ? 'text-purple-300' : 'text-danger'
                        }`}
                      >
                        {isIncoming ? '+' : '-'}
                        {formatRupiah(movement.amount)}
                      </td>
                      <td className="py-3 px-4 text-komazi-muted">
                        {movement.userName || activeShift?.cashierName || user?.name || 'Kasir'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-komazi-muted">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-komazi-surface-2 flex items-center justify-center text-komazi-muted">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold">Belum ada mutasi arus kas tercatat</p>
                      <p className="text-[11px] text-komazi-muted">
                        Gunakan tombol Kas Masuk atau Kas Keluar di atas untuk mencatat operasional.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredMovements.length > itemsPerPage && (
          <div className="p-4 border-t border-komazi-border">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredMovements.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* 4. Modal Catat Kas Masuk / Kas Keluar */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    movementType === 'IN'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-danger/15 text-danger'
                  }`}
                >
                  {movementType === 'IN' ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">
                    {movementType === 'IN' ? 'Catat Kas Masuk (Tambahan Kas)' : 'Catat Kas Keluar (Pengeluaran Operasional)'}
                  </h3>
                  <p className="text-[11px] text-komazi-muted">
                    {movementType === 'IN'
                      ? 'Menambah jumlah uang tunai di laci kasir'
                      : 'Biaya operasional kasir (es batu, gas, galon, belanja darurat)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMovementModal(false)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                  Nominal Uang (Rp):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-komazi-muted font-mono">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    required
                    autoFocus
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-sm font-bold font-mono text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {[10000, 20000, 50000, 100000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMovementAmount(preset)}
                    className="px-2.5 py-1 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-[11px] font-mono font-bold text-komazi-muted hover:text-white transition-colors"
                  >
                    +{formatRupiah(preset)}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                  Keterangan / Keperluan:
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder={
                    movementType === 'IN'
                      ? 'contoh: Tambahan uang kembalian pecahan Rp 2.000'
                      : 'contoh: Beli es batu kristal 2 kantong (habis mendadak)'
                  }
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50 ${
                    movementType === 'IN'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-danger hover:bg-danger/80'
                  }`}
                >
                  {movementType === 'IN' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Mutasi Kas'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Modal Fallback jika sesi belum dibuka */}
      {isShiftModalOpen && <ShiftModal onClose={() => setIsShiftModalOpen(false)} />}
    </div>
  );
}
