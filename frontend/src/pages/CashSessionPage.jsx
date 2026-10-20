import React, { useState, useEffect, useMemo } from 'react';
import {
  LockOpen,
  Lock,
  Unlock,
  Coins,
  Banknote,
  Receipt,
  QrCode,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  User,
  Plus,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Calculator,
  X,
  Eye,
  Store,
} from 'lucide-react';
import { useShiftStore } from '../store/shiftStore';
import { useAuthStore } from '../store/authStore';
import { useHrisStore } from '../store/hrisStore';
import { useSettingsStore } from '../store/settingsStore';
import { formatRupiah, formatDateTime } from '../utils/format';
import { toast } from '../store/toastStore';
import Pagination from '../components/ui/Pagination';
import ShiftModal from '../components/shift/ShiftModal';
import CloseSessionReportModal from '../components/shift/CloseSessionReportModal';
import AttendanceVerificationModal from '../components/hris/AttendanceVerificationModal';
import PaymentMethodBreakdownCard from '../components/shift/PaymentMethodBreakdownCard';

export default function CashSessionPage() {
  const {
    activeShift,
    registers,
    selectedRegisterId,
    setSelectedRegisterId,
    shiftHistory,
    fetchRegisters,
    fetchActiveShift,
    fetchShiftHistory,
    fetchShiftDetail,
    openShift,
  } = useShiftStore();
  const { user } = useAuthStore();

  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState(200000);

  // Shift Modal State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [selectedReportSession, setSelectedReportSession] = useState(null);

  // Pagination for shift history
  const [historyPage, setHistoryPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const isManagerOrOwner = ['MANAGER', 'OWNER'].includes(user?.role);

  useEffect(() => {
    fetchRegisters?.();
    fetchActiveShift?.();
    if (isManagerOrOwner) {
      fetchShiftHistory?.();
    }
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchActiveShift?.();
        if (isManagerOrOwner) {
          fetchShiftHistory?.();
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchRegisters, fetchActiveShift, fetchShiftHistory, isManagerOrOwner]);

  const myTodaySchedule = useHrisStore((state) => state.myTodaySchedule);
  const fetchMyTodaySchedule = useHrisStore((state) => state.fetchMyTodaySchedule);
  const myTodayAttendance = useHrisStore((state) => state.myTodayAttendance);
  const fetchTodayAttendance = useHrisStore((state) => state.fetchTodayAttendance);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

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

  const hasActiveShift = Boolean(activeShift && !activeShift.isClosed);

  // Active shift numbers
  const openingCash = Number(activeShift?.openingCash || 0);
  const totalCashSales = Number(activeShift?.totalCashSales || 0);
  const totalNonCashSales = Number(activeShift?.totalNonCashSales || 0);
  const totalCashIn = Number(activeShift?.totalCashIn || 0);
  const totalCashOut = Number(activeShift?.totalCashOut || 0);
  const totalCashDrop = Number(activeShift?.totalCashDrop || 0);
  const totalCashRefund = Number(activeShift?.totalCashRefund || 0);
  const ordersCount = Number(activeShift?.ordersCount || 0);

  const expectedCash = hasActiveShift
    ? openingCash + totalCashSales + totalCashIn - totalCashOut - totalCashDrop - totalCashRefund
    : 0;

  // Active duration
  const activeDuration = useMemo(() => {
    if (!activeShift?.openedAt) return '-';
    const start = new Date(activeShift.openedAt).getTime();
    const now = Date.now();
    const diffMin = Math.max(0, Math.floor((now - start) / 60000));
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h} jam ${m} menit`;
  }, [activeShift]);

  // Paginated History
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * itemsPerPage;
    return (shiftHistory || []).slice(start, start + itemsPerPage);
  }, [shiftHistory, historyPage, itemsPerPage]);

  const handleOpenShiftSubmit = async (e) => {
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
      setIsOpeningShift(true);
      await openShift({
        openingCash: openingCashInput,
        registerId: selectedRegisterId,
      });
      toast.success(`Sesi kasir berhasil dibuka dengan modal ${formatRupiah(openingCashInput)}`);
    } catch (err) {
      toast.error(err?.message || 'Gagal membuka sesi kasir');
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleViewReport = async (shift) => {
    try {
      const detail = await fetchShiftDetail(shift.id);
      setSelectedReportSession(detail || shift);
    } catch (err) {
      setSelectedReportSession(shift);
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28 lg:pb-12 space-y-6 max-w-7xl mx-auto select-none animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-komazi-surface p-5 sm:p-6 rounded-2xl border border-komazi-border shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shadow-inner shrink-0">
            <LockOpen className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display font-black text-xl sm:text-2xl text-komazi-text tracking-tight">
                Sesi Kas Terbuka
              </h1>
            </div>
            <p className="text-xs text-komazi-muted mt-1 leading-relaxed">
              Manajemen sesi kas terbuka
            </p>
          </div>
        </div>

        {hasActiveShift && (
          <button
            type="button"
            onClick={() => setIsShiftModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-danger hover:bg-danger/80 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0 self-start sm:self-auto"
          >
            <Lock className="w-4 h-4" />
            <span>Tutup Sesi Kasir &amp; Rekonsiliasi</span>
          </button>
        )}
      </div>

      {/* 2. Active Session Card OR Open Session Form */}
      {hasActiveShift ? (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-komazi-surface via-komazi-surface to-komazi-surface-2 border border-komazi-border shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-komazi-border/80 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-komazi-coral">
                SESI AKTIF • {activeShift.registerName || 'Kasir Utama'}
              </span>
              <h2 className="font-display font-black text-xl text-komazi-text mt-0.5">
                Dibuka oleh {activeShift.cashierName || 'Kasir'}
              </h2>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-komazi-muted">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateTime(activeShift.openedAt)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  Berjalan {activeDuration}
                </span>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-komazi-surface border border-komazi-border">
              <span className="text-[10px] text-komazi-muted uppercase font-bold block">Modal Awal</span>
              <span className="font-mono font-bold text-lg text-komazi-text mt-1 block">
                {formatRupiah(openingCash)}
              </span>
              <span className="text-[10px] text-komazi-muted mt-1 block">Uang pecahan awal laci</span>
            </div>

            <div className="p-4 rounded-xl bg-komazi-surface border border-komazi-border">
              <span className="text-[10px] text-komazi-muted uppercase font-bold block">Arus Kas Masuk / Keluar</span>
              <div className="flex items-center gap-1 mt-1 font-mono font-bold text-sm">
                <span className="text-blue-400">+{formatRupiah(totalCashIn)}</span>
                <span className="text-komazi-muted">/</span>
                <span className="text-amber-400">-{formatRupiah(totalCashOut + totalCashDrop)}</span>
              </div>
              <span className="text-[10px] text-komazi-muted mt-1 block">{activeShift.cashMovements?.length || 0} catatan mutasi</span>
            </div>

            <div className="p-4 rounded-xl bg-komazi-surface border border-komazi-coral/30 shadow-inner">
              <span className="text-[10px] text-komazi-coral uppercase font-bold block">Kas Diharapkan di Laci</span>
              <span className="font-mono font-black text-xl text-komazi-coral mt-1 block">
                {formatRupiah(expectedCash)}
              </span>
              <span className="text-[10px] text-komazi-muted mt-1 block">Target hitung kas fisik</span>
            </div>
          </div>

          {/* Rincian Per Metode Bayar */}
          <PaymentMethodBreakdownCard
            shift={activeShift}
            totalCashSales={totalCashSales}
          />
        </div>
      ) : (
        /* Open Session Form */
        <div className="p-6 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm max-w-xl">
          <h2 className="font-display font-black text-lg text-komazi-text mb-1">
            Buka Sesi Kasir Baru
          </h2>
          <p className="text-xs text-komazi-muted mb-4 leading-relaxed">
            Pilih register dan masukkan modal kas awal pecahan yang tersedia di laci kasir sebelum melayani pesanan.
          </p>

          {isScheduleBlocked && (
            <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong className="block text-amber-200">Jadwal Kerja Belum Diatur</strong>
                <span className="text-amber-300/90 text-xs mt-0.5 block">
                  Anda belum memiliki jadwal kerja untuk hari ini. Silakan hubungi Owner atau Manajer untuk mengatur jadwal kerja sebelum Anda dapat membuka sesi kasir.
                </span>
              </div>
            </div>
          )}

          {isAttendanceBlocked && (
            <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3">
              <div className="flex items-start gap-2.5 text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
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

          <form onSubmit={handleOpenShiftSubmit} className="space-y-4">
            {registers.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-komazi-muted uppercase mb-1">
                  Pilih Terminal POS:
                </label>
                <select
                  value={selectedRegisterId}
                  onChange={(e) => setSelectedRegisterId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-bold text-komazi-text focus:border-komazi-coral outline-none"
                >
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-komazi-muted uppercase mb-1">
                Modal Awal Kasir:
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-komazi-muted font-mono">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  required
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-base font-black font-mono text-komazi-text focus:border-komazi-coral outline-none"
                  placeholder="200000"
                />
              </div>
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

            <button
              type="submit"
              disabled={isOpeningShift || isBlocked}
              className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                isBlocked
                  ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                  : 'bg-komazi-coral hover:bg-komazi-coral/90 text-white shadow-komazi-coral/25'
              }`}
            >
              {isScheduleBlocked
                ? 'Jadwal Kerja Belum Diatur'
                : isAttendanceBlocked
                ? 'Presensi Diperlukan Terlebih Dahulu'
                : isOpeningShift
                ? 'Membuka Sesi...'
                : 'Buka Sesi Kasir & Mulai Transaksi'}
            </button>
          </form>
        </div>
      )}

      {/* 3. Riwayat Sesi Kasir Table (Khusus Owner & Manager) */}
      {isManagerOrOwner && (
        <div className="bg-komazi-surface rounded-2xl border border-komazi-border overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-komazi-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-komazi-coral" />
              <h2 className="font-bold text-sm text-komazi-text">
                Riwayat Sesi Kasir
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-komazi-surface-2/70 text-komazi-muted uppercase text-[10px] font-bold tracking-wider border-b border-komazi-border">
                <tr>
                  <th className="py-3 px-4">Register &amp; Kasir</th>
                  <th className="py-3 px-4">Waktu Buka / Tutup</th>
                  <th className="py-3 px-4 text-right">Modal Awal</th>
                  <th className="py-3 px-4 text-right">Penjualan Tunai</th>
                  <th className="py-3 px-4 text-right">Kas Diharapkan</th>
                  <th className="py-3 px-4 text-right">Kas Dihitung</th>
                  <th className="py-3 px-4 text-right">Selisih Kas</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-komazi-border/50">
                {paginatedHistory.length > 0 ? (
                  paginatedHistory.map((shift) => {
                    const diff = Number(shift.difference || 0);
                    const isMatch = diff === 0;
                    const isSurplus = diff > 0;
                    return (
                      <tr
                        key={shift.id}
                        className="hover:bg-komazi-surface-2/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-komazi-text whitespace-nowrap">
                          <div>{shift.registerName || 'Kasir Utama'}</div>
                          <div className="text-[10px] text-komazi-muted font-normal">
                            {shift.cashierName || shift.cashier?.name || 'Kasir'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-komazi-muted font-mono whitespace-nowrap">
                          <div>{shift.openedAt ? formatDateTime(shift.openedAt) : '-'}</div>
                          <div className="text-[10px] opacity-75">
                            s/d {shift.closedAt ? formatDateTime(shift.closedAt) : 'Selesai'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-komazi-muted whitespace-nowrap">
                          {formatRupiah(shift.openingCash)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold whitespace-nowrap">
                          +{formatRupiah(shift.totalCashSales || shift.cashSales || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-komazi-text whitespace-nowrap">
                          {formatRupiah(shift.expectedCash || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-komazi-coral font-bold whitespace-nowrap">
                          {shift.closingCash !== null && shift.closingCash !== undefined
                            ? formatRupiah(shift.closingCash)
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              isMatch
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : isSurplus
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-danger/10 text-danger'
                            }`}
                          >
                            {isMatch ? 'Pas (Rp 0)' : `${isSurplus ? '+' : ''}${formatRupiah(diff)}`}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleViewReport(shift)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-coral font-bold text-[11px] border border-komazi-border transition-colors"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>Z-Report</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-komazi-muted">
                      Belum ada riwayat sesi kasir sebelumnya
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(shiftHistory || []).length > itemsPerPage && (
            <div className="p-4 border-t border-komazi-border">
              <Pagination
                currentPage={historyPage}
                totalItems={(shiftHistory || []).length}
                itemsPerPage={itemsPerPage}
                onPageChange={setHistoryPage}
              />
            </div>
          )}
        </div>
      )}

      {/* 4. Modal Tutup Sesi & Rekonsiliasi Kas */}
      {isShiftModalOpen && (
        <ShiftModal
          onClose={() => {
            setIsShiftModalOpen(false);
            fetchActiveShift?.();
            fetchShiftHistory?.();
          }}
        />
      )}

      {/* 5. Z-Report Modal */}
      {selectedReportSession && (
        <CloseSessionReportModal
          session={selectedReportSession}
          onClose={() => setSelectedReportSession(null)}
        />
      )}

      {/* 6. Attendance Verification Modal */}
      <AttendanceVerificationModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onSuccess={handleAttendanceSuccess}
      />
    </div>
  );
}
