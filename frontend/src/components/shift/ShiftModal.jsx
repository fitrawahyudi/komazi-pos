import React, { useState, useMemo } from 'react';
import Pagination from '../ui/Pagination';
import { useShiftStore } from '../../store/shiftStore';
import { useAuthStore } from '../../store/authStore';
import { formatRupiah, formatDateTime } from '../../utils/format';
import {
  X,
  CircleDot,
  Banknote,
  Calculator,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  History,
  Coins,
} from 'lucide-react';
import { toast } from '../../store/toastStore';

export default function ShiftModal({ onClose }) {
  const { activeShift, openShift, closeShift, addCashMovement, fetchActiveShift } = useShiftStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'movement'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Opening / Closing inputs
  const [openingCashInput, setOpeningCashInput] = useState(200000);
  const [shiftNote, setShiftNote] = useState('');

  // Sinkronkan data shift aktif terbaru dari database saat modal dibuka
  React.useEffect(() => {
    fetchActiveShift?.();
  }, [fetchActiveShift]);

  // Cash Movement inputs
  const [movementType, setMovementType] = useState('OUT'); // 'OUT' | 'IN'
  const [movementAmount, setMovementAmount] = useState(25000);
  const [movementReason, setMovementReason] = useState('Beli Es Batu Darurat');

  // Pagination for Cash Movements
  const [movementPage, setMovementPage] = useState(1);
  const [movementsPerPage, setMovementsPerPage] = useState(10);

  const cashMovements = activeShift?.cashMovements || [];
  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * movementsPerPage;
    return cashMovements.slice(start, start + movementsPerPage);
  }, [cashMovements, movementPage, movementsPerPage]);

  const openingCash = Number(activeShift?.openingCash || 0);
  const totalCashSales = Number(activeShift?.totalCashSales || 0);
  const totalCashIn = Number(activeShift?.totalCashIn || 0);
  const totalCashOut = Number(activeShift?.totalCashOut || 0);

  const expectedCash = activeShift
    ? openingCash + totalCashSales + totalCashIn - totalCashOut
    : 0;

  const [closingCashInput, setClosingCashInput] = useState(expectedCash);
  const difference = Number(closingCashInput) - expectedCash;

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (openingCashInput < 0) {
      toast.error('Modal awal kasir tidak boleh bernilai negatif');
      return;
    }
    try {
      setIsSubmitting(true);
      await openShift(user || { id: 1, name: 'Kasir' }, openingCashInput);
      toast.success(`Shift kasir dibuka dengan modal ${formatRupiah(openingCashInput)}`);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Gagal membuka shift di database');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await closeShift(closingCashInput, shiftNote);
      toast.success('Shift kasir berhasil ditutup dan direkonsiliasi ke database!');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Gagal menutup shift di database');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMovement = (e) => {
    e.preventDefault();
    if (!movementAmount || Number(movementAmount) <= 0) {
      toast.error('Masukkan nominal kas masuk/keluar yang valid');
      return;
    }
    if (!movementReason.trim()) {
      toast.error('Masukkan alasan kas masuk/keluar');
      return;
    }

    addCashMovement(movementType, movementAmount, movementReason);
    toast.success(
      `Kas ${movementType === 'IN' ? 'Masuk' : 'Keluar'} ${formatRupiah(movementAmount)} dicatat!`
    );
    setMovementReason('');
    // Auto-update closing cash input to match expected
    const newExpected = expectedCash + (movementType === 'IN' ? Number(movementAmount) : -Number(movementAmount));
    setClosingCashInput(newExpected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border">
          <div className="flex items-center gap-2">
            <CircleDot
              className={`w-5 h-5 ${activeShift ? 'text-success' : 'text-danger'}`}
            />
            <h2 className="font-bold text-base text-komazi-text">
              {activeShift ? 'Manajemen Shift & Rekonsiliasi Kas' : 'Buka Shift Baru'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector (Only if active shift exists) */}
        {activeShift && (
          <div className="flex border-b border-komazi-border bg-komazi-surface-2/60 p-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'summary'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              Ringkasan & Tutup Shift
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('movement')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'movement'
                  ? 'bg-komazi-coral text-white shadow-sm'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Kas Masuk / Keluar ({activeShift.cashMovements?.length || 0})</span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {activeShift ? (
            activeTab === 'summary' ? (
              /* TAB 1: SUMMARY & CLOSE SHIFT */
              <form onSubmit={handleCloseShift} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-komazi-muted">Kasir Bertugas:</span>
                    <span className="font-bold text-komazi-text">{activeShift.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-komazi-muted">Waktu Buka Shift:</span>
                    <span className="font-mono text-komazi-text">
                      {formatDateTime(activeShift.openedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-komazi-border/50 pt-2">
                    <span className="text-komazi-muted">Modal Awal Kas:</span>
                    <span className="font-mono font-bold text-komazi-text">
                      {formatRupiah(openingCash)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-komazi-muted">Penjualan Tunai (Cash):</span>
                    <span className="font-mono font-bold text-success">
                      +{formatRupiah(totalCashSales)}
                    </span>
                  </div>
                  {totalCashIn > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Kas Masuk (Petty Cash):</span>
                      <span className="font-mono font-bold">+{formatRupiah(totalCashIn)}</span>
                    </div>
                  )}
                  {totalCashOut > 0 && (
                    <div className="flex justify-between text-danger">
                      <span>Kas Keluar (Operasional):</span>
                      <span className="font-mono font-bold">-{formatRupiah(totalCashOut)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-komazi-muted">
                    <span>Non-Tunai (QRIS/Transfer):</span>
                    <span className="font-mono font-bold text-komazi-teal-light">
                      +{formatRupiah(activeShift.totalNonCashSales || 0)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-komazi-border flex justify-between font-bold text-sm">
                    <span className="text-komazi-text">Kas Fisik Seharusnya:</span>
                    <span className="font-mono text-komazi-coral">
                      {formatRupiah(expectedCash)}
                    </span>
                  </div>
                </div>

                {/* Input Actual Physical Cash */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1.5">
                    Hitungan Uang Fisik Aktual di Laci Kasir:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-komazi-muted font-mono">
                      Rp
                    </span>
                    <input
                      type="number"
                      step="1000"
                      value={closingCashInput}
                      onChange={(e) => setClosingCashInput(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-base font-bold font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                    />
                  </div>
                </div>

                {/* Live Reconciliation Difference Card */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                    difference === 0
                      ? 'bg-success/10 border-success/30 text-success'
                      : difference < 0
                      ? 'bg-danger/10 border-danger/30 text-danger'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {difference === 0 ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {difference === 0
                        ? 'Kas Seimbang (Sesuai 100%)'
                        : difference < 0
                        ? `Kas Kurang (Minus ${formatRupiah(Math.abs(difference))})`
                        : `Kas Lebih (+${formatRupiah(difference)})`}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm">
                    {difference === 0 ? 'Rp 0' : formatRupiah(difference)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1.5">
                    Catatan Kasir / Alasan Selisih:
                  </label>
                  <input
                    type="text"
                    value={shiftNote}
                    onChange={(e) => setShiftNote(e.target.value)}
                    placeholder="Contoh: Uang pecahan koin kurang 500 perak..."
                    className="w-full px-3.5 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted/60 focus:border-komazi-coral focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-danger hover:bg-danger/90 text-white font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lock className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>{isSubmitting ? 'Menyimpan ke Database...' : 'Tutup Shift Sekarang'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: PETTY CASH (KAS MASUK & KAS KELUAR) */
              <div className="space-y-4">
                <form onSubmit={handleAddMovement} className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
                  <p className="font-bold text-xs text-komazi-text">Catat Kas Masuk / Kas Keluar:</p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMovementType('OUT')}
                      className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                        movementType === 'OUT'
                          ? 'bg-danger/20 border-danger text-danger'
                          : 'bg-komazi-surface border-komazi-border text-komazi-muted'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Kas Keluar (Beli Barang)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementType('IN')}
                      className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                        movementType === 'IN'
                          ? 'bg-success/20 border-success text-success'
                          : 'bg-komazi-surface border-komazi-border text-komazi-muted'
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                      <span>Kas Masuk (Tambah Modal)</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-komazi-muted mb-1">
                      Nominal (Rp):
                    </label>
                    <input
                      type="number"
                      step="1000"
                      min="1000"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      className="w-full p-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-komazi-muted mb-1">
                      Keterangan / Alasan:
                    </label>
                    <input
                      type="text"
                      value={movementReason}
                      onChange={(e) => setMovementReason(e.target.value)}
                      placeholder="Contoh: Beli es batu kristal 2 kantong..."
                      className="w-full p-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Simpan Mutasi Kas</span>
                  </button>
                </form>

                {/* Movement History */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-komazi-muted flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat Kas Masuk/Keluar Shift Ini:</span>
                  </p>

                  {(!cashMovements || cashMovements.length === 0) ? (
                    <div className="p-4 text-center border border-dashed border-komazi-border rounded-xl text-xs text-komazi-muted">
                      Belum ada kas masuk/keluar yang dicatat di shift ini.
                    </div>
                  ) : (
                    <>
                      {paginatedMovements.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                m.type === 'IN'
                                  ? 'bg-success/20 text-success'
                                  : 'bg-danger/20 text-danger'
                              }`}
                            >
                              {m.type === 'IN' ? (
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-komazi-text">{m.reason}</p>
                              <p className="text-[10px] text-komazi-muted">
                                {formatDateTime(m.timestamp)}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`font-mono font-bold ${
                              m.type === 'IN' ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {m.type === 'IN' ? '+' : '-'}{formatRupiah(m.amount)}
                          </span>
                        </div>
                      ))}

                      {cashMovements.length > 0 && (
                        <div className="pt-2">
                          <Pagination
                            currentPage={movementPage}
                            totalItems={cashMovements.length}
                            itemsPerPage={movementsPerPage}
                            onPageChange={setMovementPage}
                            onItemsPerPageChange={(newLimit) => {
                              setMovementsPerPage(newLimit);
                              setMovementPage(1);
                            }}
                            itemLabel="mutasi kas"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          ) : (
            /* OPEN SHIFT FORM */
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2 text-xs">
                <p className="text-komazi-muted leading-relaxed">
                  Buka shift kasir sebelum memulai transaksi. Masukkan uang modal awal
                  (uang pecahan di laci kasir untuk uang kembalian).
                </p>
                <div className="flex justify-between font-bold text-komazi-text pt-2 border-t border-komazi-border">
                  <span>Kasir yang Masuk:</span>
                  <span>{user?.name || 'Kasir Bertugas'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted mb-1.5">
                  Modal Awal Kasir (Cash Float):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-komazi-muted font-mono">
                    Rp
                  </span>
                  <input
                    type="number"
                    step="10000"
                    min="0"
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-base font-bold font-mono text-komazi-text focus:border-komazi-coral focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[100000, 200000, 300000, 500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setOpeningCashInput(amt)}
                      className="flex-1 py-1 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-[11px] font-mono text-komazi-muted hover:text-white border border-komazi-border transition-colors"
                    >
                      {amt / 1000}k
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Unlock className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>{isSubmitting ? 'Membuka di Database...' : 'Buka Shift Sekarang'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
