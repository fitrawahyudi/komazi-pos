import React, { useState, useMemo, useEffect } from 'react';
import Pagination from '../ui/Pagination';
import LoadingButton from '../ui/loading/LoadingButton';
import { useShiftStore } from '../../store/shiftStore';
import { useAuthStore } from '../../store/authStore';
import { useHrisStore } from '../../store/hrisStore';
import { formatRupiah, formatDateTime } from '../../utils/format';
import { scrollInputIntoViewOnFocus } from '../../utils/keyboard';
import DenominationCounter from './DenominationCounter';
import CloseSessionReportModal from './CloseSessionReportModal';
import AttendanceVerificationModal from '../hris/AttendanceVerificationModal';
import PaymentMethodBreakdownCard from './PaymentMethodBreakdownCard';
import {
  X,
  CircleDot,
  Banknote,
  Calculator,
  Lock,
  Unlock,
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  History,
  Coins,
  ShieldCheck,
  User,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { toast } from '../../store/toastStore';
import { useSettingsStore } from '../../store/settingsStore';

export default function ShiftModal({ onClose, onProceedToClockOut }) {
  const {
    activeShift,
    registers,
    selectedRegisterId,
    fetchRegisters,
    fetchActiveShift,
    openShift,
    closeShift,
    addCashMovement,
  } = useShiftStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'movement' | 'cashiers'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDenomCounter, setShowDenomCounter] = useState(false);
  const [closedSessionReport, setClosedSessionReport] = useState(null);

  const myTodaySchedule = useHrisStore((state) => state.myTodaySchedule);
  const fetchMyTodaySchedule = useHrisStore((state) => state.fetchMyTodaySchedule);
  const myTodayAttendance = useHrisStore((state) => state.myTodayAttendance);
  const fetchTodayAttendance = useHrisStore((state) => state.fetchTodayAttendance);

  useEffect(() => {
    fetchMyTodaySchedule?.();
    if (user?.id) fetchTodayAttendance?.(user.id);
  }, [fetchMyTodaySchedule, fetchTodayAttendance, user?.id]);

  const { settings } = useSettingsStore();
  const isAttendanceEnforced = settings?.enforceAttendanceGuard !== false && settings?.enforceAttendanceGuard !== 'false';
  const isOwner = user?.role === 'OWNER';
  const hasClockedIn = isOwner || !isAttendanceEnforced || Boolean(myTodaySchedule?.hasClockedIn || myTodayAttendance?.clockIn);
  const isScheduleBlocked = !isOwner && myTodaySchedule !== null && !myTodaySchedule?.isScheduled;
  const isAttendanceBlocked = !isOwner && isAttendanceEnforced && !isScheduleBlocked && !hasClockedIn;
  const isBlocked = isScheduleBlocked || isAttendanceBlocked;

  const handleAttendanceSuccess = async () => {
    setShowVerifyModal(false);
    await fetchMyTodaySchedule?.();
    if (user?.id) await fetchTodayAttendance?.(user.id);
    toast.success('Presensi berhasil diverifikasi! Sesi kasir siap dibuka.');
  };

  // Opening / Closing inputs
  const [openingCashInput, setOpeningCashInput] = useState(200000);
  const [shiftNote, setShiftNote] = useState('');

  // Cash Movement inputs
  const [movementType, setMovementType] = useState('OUT'); // 'OUT' | 'IN' | 'DROP'
  const [movementAmount, setMovementAmount] = useState(25000);
  const [movementReason, setMovementReason] = useState('Beli Es Batu Darurat');

  // Pagination for Cash Movements
  const [movementPage, setMovementPage] = useState(1);
  const [movementsPerPage, setMovementsPerPage] = useState(10);

  useEffect(() => {
    fetchRegisters?.();
    fetchActiveShift?.();
  }, [fetchRegisters, fetchActiveShift]);

  const cashMovements = activeShift?.cashMovements || [];
  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * movementsPerPage;
    return cashMovements.slice(start, start + movementsPerPage);
  }, [cashMovements, movementPage, movementsPerPage]);

  const openingCash = Number(activeShift?.openingCash || 0);
  const totalCashSales = Number(activeShift?.totalCashSales || 0);
  const totalNonCashSales = Number(activeShift?.totalNonCashSales || 0);
  const totalSales = Number(activeShift?.totalSales || totalCashSales + totalNonCashSales);
  const totalCashIn = Number(activeShift?.totalCashIn || 0);
  const totalCashOut = Number(activeShift?.totalCashOut || 0);
  const totalCashDrop = Number(activeShift?.totalCashDrop || 0);
  const totalCashRefund = Number(activeShift?.totalCashRefund || 0);

  const activeDurationFormatted = useMemo(() => {
    if (!activeShift?.openedAt) return '-';
    const start = new Date(activeShift.openedAt).getTime();
    const now = Date.now();
    const diffMin = Math.max(0, Math.floor((now - start) / 60000));
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h} jam ${m} menit`;
  }, [activeShift]);

  const expectedCash = activeShift
    ? openingCash + totalCashSales + totalCashIn - totalCashOut - totalCashDrop - totalCashRefund
    : 0;

  const [closingCashInput, setClosingCashInput] = useState(expectedCash);

  // Sync default closing cash when expectedCash updates
  useEffect(() => {
    if (activeShift && closingCashInput === 0) {
      setClosingCashInput(expectedCash);
    }
  }, [expectedCash, activeShift, closingCashInput]);

  const difference = Number(closingCashInput) - expectedCash;

  const handleOpenShift = async (e) => {
    e.preventDefault();
    if (isScheduleBlocked) {
      toast.error('Jadwal kerja Anda belum diatur untuk hari ini. Silakan hubungi Owner atau Manajer.');
      return;
    }
    if (isAttendanceBlocked) {
      toast.error('Anda wajib melakukan presensi terlebih dahulu sebelum membuka sesi kasir.');
      return;
    }
    if (openingCashInput < 0) {
      toast.error('Modal awal kasir tidak boleh bernilai negatif');
      return;
    }
    try {
      setIsSubmitting(true);
      await openShift({
        openingCash: openingCashInput,
        registerId: selectedRegisterId,
      });
      toast.success(`Sesi kasir dibuka dengan modal awal ${formatRupiah(openingCashInput)}`);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Gagal membuka sesi kasir');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const completed = await closeShift(closingCashInput, shiftNote, activeShift?.id);
      toast.success('Sesi kasir berhasil ditutup dan direkonsiliasi!');
      setClosedSessionReport(completed);
    } catch (err) {
      toast.error(err?.message || 'Gagal menutup sesi kasir');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMovement = async (e) => {
    e.preventDefault();
    if (!movementAmount || Number(movementAmount) <= 0) {
      toast.error('Masukkan nominal kas masuk/keluar yang valid');
      return;
    }
    if (!movementReason.trim()) {
      toast.error('Masukkan keterangan / alasan arus kas');
      return;
    }

    if ((movementType === 'OUT' || movementType === 'DROP') && Number(movementAmount) > expectedCash) {
      if (movementType === 'DROP') {
        toast.error(`Setor brankas (${formatRupiah(movementAmount)}) melebihi saldo kas di laci (${formatRupiah(expectedCash)}).`);
        return;
      }
      const confirmed = window.confirm(
        `Perhatian: Pengeluaran (${formatRupiah(movementAmount)}) melebihi saldo kas fisik di laci (${formatRupiah(expectedCash)}).\n\nTetap lanjutkan pencatatan?`
      );
      if (!confirmed) return;
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
        `Arus kas ${movementType === 'IN' ? 'Masuk' : movementType === 'DROP' ? 'Setor Brankas' : 'Keluar'} ${formatRupiah(movementAmount)} dicatat!`
      );
      setMovementReason('');
    } catch (err) {
      toast.error(err?.message || 'Gagal mencatat arus kas');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (closedSessionReport) {
    return (
      <CloseSessionReportModal
        session={closedSessionReport}
        onClose={() => {
          setClosedSessionReport(null);
          onClose();
        }}
        onProceedToClockOut={
          onProceedToClockOut
            ? () => {
                setClosedSessionReport(null);
                onProceedToClockOut();
              }
            : undefined
        }
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-xl rounded-3xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-komazi-border shrink-0 bg-komazi-surface">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${activeShift ? 'bg-success/20 text-success' : 'bg-komazi-coral/20 text-komazi-coral'}`}>
              <CircleDot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-komazi-text flex items-center gap-2">
                <span>{activeShift ? 'Manajemen Sesi Kasir' : 'Buka Sesi Kasir Baru'}</span>
              </h2>
              <p className="text-xs text-komazi-muted">
                {activeShift
                  ? `${activeShift.registerName || 'Kasir Utama'} • Dibuka oleh ${activeShift.cashierName || 'Kasir'}`
                  : 'Daftarkan modal awal fisik untuk memulai transaksi'}
              </p>
            </div>
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
          <div className="flex border-b border-komazi-border bg-komazi-surface-2/60 p-2 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'summary'
                  ? 'bg-komazi-surface text-komazi-text shadow-sm border border-komazi-border'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              <Banknote className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Ringkasan &amp; Tutup Sesi</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('movement')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'movement'
                  ? 'bg-komazi-surface text-komazi-text shadow-sm border border-komazi-border'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-blue-400" />
              <span>Arus Kas Laci ({cashMovements.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cashiers')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'cashiers'
                  ? 'bg-komazi-surface text-komazi-text shadow-sm border border-komazi-border'
                  : 'text-komazi-muted hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kasir Bertugas</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-5 flex-1 text-xs">
          {!activeShift ? (
            /* ================= OPEN SHIFT FORM ================= */
            <form onSubmit={handleOpenShift} className="space-y-4">
              {isScheduleBlocked && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong className="block text-amber-200">Jadwal Kerja Belum Diatur</strong>
                    <span className="leading-relaxed text-[11px] block mt-0.5">
                      Anda belum memiliki jadwal kerja untuk hari ini. Silakan hubungi Owner atau Manajer untuk mengatur jadwal kerja sebelum Anda dapat membuka sesi kasir.
                    </span>
                  </div>
                </div>
              )}

              {isAttendanceBlocked && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <strong className="block text-amber-200 font-bold">Presensi Wajib Dilakukan</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-black font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Clock className="w-4 h-4 stroke-[2.5]" />
                    <span>Lakukan Presensi & Verifikasi (Selfie & GPS)</span>
                  </button>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-komazi-muted font-semibold">Kasir Bertugas:</span>
                  <span className="font-bold text-komazi-text">{user?.name || 'Kasir'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-komazi-muted font-semibold">Terminal POS:</span>
                  <span className="font-bold text-komazi-text">
                    {registers.find((r) => r.id === selectedRegisterId)?.name || 'Kasir Utama'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-komazi-muted uppercase tracking-wider text-[11px]">
                  Modal Awal Kasir
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm font-bold text-komazi-muted font-mono">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    required
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                    onFocus={scrollInputIntoViewOnFocus}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-base font-black font-mono text-komazi-text focus:border-komazi-coral outline-none"
                    placeholder="200000"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[100000, 200000, 300000, 500000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOpeningCashInput(preset)}
                      className="py-1.5 rounded-lg text-xs font-mono font-bold bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-coral transition-colors"
                    >
                      {preset / 1000}k
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={isBlocked}
                  loadingText="Membuka Sesi..."
                  variant="primary"
                  size="lg"
                  icon={Unlock}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg ${
                    isBlocked
                      ? 'opacity-50 cursor-not-allowed'
                      : 'shadow-komazi-coral/20'
                  }`}
                >
                  {isScheduleBlocked
                    ? 'Jadwal Kerja Belum Diatur'
                    : isAttendanceBlocked
                    ? 'Presensi Diperlukan Terlebih Dahulu'
                    : 'Buka Sesi Kasir Sekarang'}
                </LoadingButton>
              </div>
            </form>
          ) : activeTab === 'summary' ? (
            /* ================= ACTIVE SHIFT SUMMARY & CLOSE FORM ================= */
            <div className="space-y-5">
              {/* Financial Dashboard Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <span className="text-[10px] text-komazi-muted uppercase font-bold block">Modal Awal</span>
                  <span className="font-mono font-bold text-sm text-komazi-text">
                    {formatRupiah(openingCash)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <span className="text-[10px] text-komazi-muted uppercase font-bold block">Penjualan Tunai</span>
                  <span className="font-mono font-bold text-sm text-emerald-400">
                    +{formatRupiah(totalCashSales)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <span className="text-[10px] text-komazi-muted uppercase font-bold block">Arus Kas Masuk</span>
                  <span className="font-mono font-bold text-sm text-blue-400">
                    +{formatRupiah(totalCashIn)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <span className="text-[10px] text-komazi-muted uppercase font-bold block">Kas Keluar / Drop</span>
                  <span className="font-mono font-bold text-sm text-amber-400">
                    -{formatRupiah(totalCashOut + totalCashDrop)}
                  </span>
                </div>
              </div>

              {/* Expected Cash in Drawer Tile */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-komazi-surface-2 via-neutral-900 to-komazi-surface-2 border border-komazi-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-komazi-muted block">
                    Total Kas yang Diharapkan di Laci
                  </span>
                  <span className="font-display font-black text-2xl text-komazi-coral font-mono">
                    {formatRupiah(expectedCash)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-komazi-muted block">Durasi Sesi</span>
                  <span className="font-bold text-komazi-text">{activeDurationFormatted}</span>
                </div>
              </div>

              {/* Rincian Per Metode Bayar */}
              <PaymentMethodBreakdownCard
                shift={activeShift}
                totalCashSales={totalCashSales}
              />

              {/* Close Shift Form */}
              <form onSubmit={handleCloseShift} className="space-y-4 pt-2 border-t border-komazi-border">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-komazi-text text-xs uppercase tracking-wider">
                    Uang Fisik Hasil Hitung (Counted Cash):
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDenomCounter(!showDenomCounter)}
                    className="flex items-center gap-1 text-[11px] font-bold text-komazi-coral hover:underline"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>{showDenomCounter ? 'Tutup Kalkulator' : 'Buka Kalkulator Pecahan'}</span>
                  </button>
                </div>

                {showDenomCounter && (
                  <DenominationCounter
                    onApply={(total) => {
                      setClosingCashInput(total);
                      setShowDenomCounter(false);
                      toast.info(`Kas fisik diperbarui ke ${formatRupiah(total)}`);
                    }}
                    currentCounted={closingCashInput}
                  />
                )}

                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-sm font-bold text-komazi-muted font-mono">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={closingCashInput}
                    onChange={(e) => setClosingCashInput(Number(e.target.value))}
                    onFocus={scrollInputIntoViewOnFocus}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-base font-black font-mono text-komazi-text focus:border-komazi-coral outline-none"
                    placeholder="Hitung uang di laci..."
                  />
                </div>

                {/* Selisih Indicator */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  difference === 0
                    ? 'bg-success/10 border-success/30 text-success'
                    : difference > 0
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-danger/10 border-danger/30 text-danger'
                }`}>
                  <div className="flex items-center gap-2">
                    {difference === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : difference > 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-blue-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-danger" />
                    )}
                    <span className="font-bold text-xs">
                      {difference === 0
                        ? 'Kas Seimbang (Sesuai Rp 0)'
                        : difference > 0
                        ? 'Kas Lebih (Surplus)'
                        : 'Kas Kurang (Defisit)'}
                    </span>
                  </div>
                  <span className="font-mono font-black text-sm">
                    {difference > 0 ? `+${formatRupiah(difference)}` : formatRupiah(difference)}
                  </span>
                </div>

                {/* Closing Notes */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-komazi-muted">
                    Catatan Penutupan / Alasan Selisih (Opsional):
                  </label>
                  <input
                    type="text"
                    value={shiftNote}
                    onChange={(e) => setShiftNote(e.target.value)}
                    placeholder="Contoh: Kas seimbang, serah terima lancar"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral outline-none"
                  />
                </div>

                <div className="pt-2">
                  <LoadingButton
                    type="submit"
                    isLoading={isSubmitting}
                    loadingText="Menutup Sesi..."
                    variant="danger"
                    size="lg"
                    icon={Lock}
                    className="w-full py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-danger/20"
                  >
                    Tutup Sesi 
                  </LoadingButton>
                </div>
              </form>
            </div>
          ) : activeTab === 'movement' ? (
            /* ================= CASH MOVEMENT TAB ================= */
            <div className="space-y-5">
              <form onSubmit={handleAddMovement} className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-komazi-text uppercase tracking-wider">
                    Catat Arus Kas Fisik Laci
                  </h4>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    Saldo Laci: {formatRupiah(expectedCash)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('OUT')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      movementType === 'OUT'
                        ? 'bg-danger/20 border-danger text-danger'
                        : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-komazi-text'
                    }`}
                  >
                    Kas Keluar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('IN')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      movementType === 'IN'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-komazi-text'
                    }`}
                  >
                    Kas Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('DROP')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      movementType === 'DROP'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-komazi-text'
                    }`}
                  >
                    Setor Brankas
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-komazi-muted font-bold uppercase">Nominal (Rp):</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    required
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border font-mono font-bold text-sm text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[10000, 20000, 50000, 100000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMovementAmount(preset)}
                      className="px-2 py-0.5 rounded-lg bg-komazi-surface hover:bg-komazi-border text-[10px] font-mono font-bold text-komazi-muted hover:text-white transition-colors"
                    >
                      +{formatRupiah(preset)}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-komazi-muted font-bold uppercase">Keterangan / Alasan:</label>
                  <input
                    type="text"
                    required
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    placeholder={
                      movementType === 'IN'
                        ? 'Contoh: Tambahan uang kembalian'
                        : movementType === 'DROP'
                        ? 'Contoh: Setor uang ke brankas supervisor'
                        : 'Contoh: Beli es batu darurat, gas elpiji'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>

                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Menyimpan Arus Kas..."
                  variant="primary"
                  className={`w-full py-2.5 rounded-xl font-bold text-xs ${
                    movementType === 'IN'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : movementType === 'DROP'
                      ? 'bg-purple-600 hover:bg-purple-500'
                      : ''
                  }`}
                >
                  Simpan Arus Kas
                </LoadingButton>
              </form>

              {/* Movements List */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-komazi-text">Riwayat Arus Kas Sesi Ini</h4>
                {cashMovements.length === 0 ? (
                  <p className="text-center py-6 text-komazi-muted italic">Belum ada catatan arus kas pada sesi ini.</p>
                ) : (
                  <div className="space-y-2">
                    {paginatedMovements.map((m) => {
                      const isIncoming = m.type === 'IN' || m.type === 'CASH_IN';
                      const isDrop = m.type === 'DROP' || m.type === 'CASH_DROP';
                      const typeLabel = isIncoming ? 'Kas Masuk' : isDrop ? 'Setor Brankas' : 'Kas Keluar';
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isIncoming
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isDrop
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-danger/20 text-danger'
                            }`}>
                              {typeLabel}
                            </span>
                            <div>
                              <span className="font-bold text-komazi-text block">{m.reason}</span>
                              <span className="text-[10px] text-komazi-muted">{formatDateTime(m.createdAt)} • oleh {m.userName || 'Kasir'}</span>
                            </div>
                          </div>
                          <span className={`font-mono font-bold text-sm ${
                            isIncoming ? 'text-emerald-400' : isDrop ? 'text-purple-300' : 'text-danger'
                          }`}>
                            {isIncoming ? '+' : '-'}{formatRupiah(m.amount)}
                          </span>
                        </div>
                      );
                    })}

                    <Pagination
                      currentPage={movementPage}
                      totalItems={cashMovements.length}
                      itemsPerPage={movementsPerPage}
                      onPageChange={setMovementPage}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= CASHIERS TAB ================= */
            <div className="space-y-4">
              <p className="text-komazi-muted">
                Daftar kasir yang bertransaksi menggunakan sesi laci kas ini:
              </p>
              {activeShift.cashiers && activeShift.cashiers.length > 0 ? (
                <div className="space-y-2">
                  {activeShift.cashiers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-komazi-coral/20 text-komazi-coral flex items-center justify-center font-bold">
                          {c.name?.[0] || 'K'}
                        </div>
                        <div>
                          <span className="font-bold text-komazi-text block">{c.name}</span>
                          <span className="text-[10px] text-komazi-muted">{c.ordersCount} pesanan diproses</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm text-komazi-text">
                        {formatRupiah(c.totalSales || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-komazi-muted italic">Belum ada transaksi penjualan pada sesi ini.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AttendanceVerificationModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onSuccess={handleAttendanceSuccess}
      />
    </div>
  );
}
