import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Banknote, ShieldAlert, Sparkles, AlertCircle, ArrowRight, Store, Clock } from 'lucide-react';
import { useShiftStore } from '../../store/shiftStore';
import { useAuthStore } from '../../store/authStore';
import { useHrisStore } from '../../store/hrisStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatRupiah } from '../../utils/format';
import { toast } from '../../store/toastStore';
import LoadingButton from '../ui/loading/LoadingButton';
import { scrollInputIntoViewOnFocus } from '../../utils/keyboard';
import AttendanceVerificationModal from '../hris/AttendanceVerificationModal';

export default function OpenShiftGateModal({ isOpen, onClose }) {
  const { openShift, registers, selectedRegisterId, setSelectedRegisterId, fetchRegisters } = useShiftStore();
  const { user } = useAuthStore();

  const [openingCashInput, setOpeningCashInput] = useState(200000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const myTodaySchedule = useHrisStore((state) => state.myTodaySchedule);
  const fetchMyTodaySchedule = useHrisStore((state) => state.fetchMyTodaySchedule);
  const myTodayAttendance = useHrisStore((state) => state.myTodayAttendance);
  const fetchTodayAttendance = useHrisStore((state) => state.fetchTodayAttendance);

  useEffect(() => {
    if (isOpen) {
      fetchRegisters?.();
      fetchMyTodaySchedule?.();
      if (user?.id) {
        fetchTodayAttendance?.(user.id);
      }
    }
  }, [isOpen, user?.id, fetchRegisters, fetchMyTodaySchedule, fetchTodayAttendance]);

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

  if (!isOpen) return null;

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
      toast.success(`Sesi kasir berhasil dibuka dengan modal ${formatRupiah(openingCashInput)}`);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Gagal membuka sesi kasir di server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickPresets = [100000, 200000, 300000, 500000];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="absolute inset-0 z-30 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-3xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Ribbon */}
        <div className="p-6 bg-gradient-to-b from-komazi-coral/15 to-transparent border-b border-komazi-border/60 text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-komazi-coral/20 border border-komazi-coral/40 flex items-center justify-center text-komazi-coral mx-auto mb-3 shadow-inner">
            <Lock className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h2 className="font-display font-black text-xl text-komazi-text tracking-tight">
            Sesi Kasir Belum Dibuka
          </h2>
          <p className="text-xs text-komazi-muted mt-1 leading-relaxed max-w-sm mx-auto">
            Sebelum melakukan transaksi di POS, kasir wajib mendaftarkan modal awal uang pecahan di laci kasir.
          </p>
        </div>

        {/* Content Form */}
        <form onSubmit={handleOpenShift} className="p-6 space-y-4">
          {/* Schedule Blocked Alert */}
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

          {/* Attendance Required Alert & Quick Clock-In Button */}
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

          {/* Register & Cashier Info */}
          <div className="p-3.5 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-2.5 text-xs">
            {/* Terminal POS / Register Selector */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-komazi-muted uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-komazi-coral" />
                Terminal POS
              </span>
              {registers.length > 1 ? (
                <select
                  value={selectedRegisterId}
                  onChange={(e) => setSelectedRegisterId(Number(e.target.value))}
                  className="px-2.5 py-1 rounded-lg bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-text focus:border-komazi-coral outline-none"
                >
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-komazi-text">
                  {registers[0]?.name || 'Kasir Utama'}
                </span>
              )}
            </div>

            {/* Cashier Info */}
            <div className="flex items-center justify-between pt-2 border-t border-komazi-border/60">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-komazi-coral/20 flex items-center justify-center text-komazi-coral font-bold text-[10px]">
                  {user?.name?.[0]?.toUpperCase() || 'K'}
                </div>
                <span className="font-bold text-komazi-text">{user?.name || 'Kasir'}</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {user?.role || 'CASHIER'}
              </span>
            </div>
          </div>

          {/* Modal Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-komazi-muted uppercase tracking-wider">
              Modal Awal Kasir:
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-sm font-bold text-komazi-muted font-mono">
                Rp
              </span>
              <input
                type="number"
                min="0"
                step="10000"
                required
                autoFocus
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                onFocus={scrollInputIntoViewOnFocus}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-komazi-surface-2 border border-komazi-border text-lg font-black font-mono text-komazi-text focus:border-komazi-coral focus:ring-2 focus:ring-komazi-coral/20 outline-none transition-all"
                placeholder="200000"
              />
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {quickPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setOpeningCashInput(preset)}
                  className={`py-2 px-1 rounded-xl text-xs font-mono font-bold border transition-all ${openingCashInput === preset
                      ? 'bg-komazi-coral/20 border-komazi-coral text-komazi-coral shadow-sm'
                      : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-white hover:border-komazi-muted/40'
                    }`}
                >
                  {preset / 1000}k
                </button>
              ))}
            </div>
          </div>

          {/* Policy info note */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Modal awal digunakan untuk menghitung selisih kas fisik saat shift ditutup dan direkonsiliasi.
            </span>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              disabled={isBlocked}
              loadingText="Membuka Sesi..."
              variant="primary"
              size="lg"
              icon={Unlock}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-xl ${
                isBlocked ? 'opacity-50 cursor-not-allowed' : 'shadow-komazi-coral/25 active:scale-[0.98]'
              }`}
            >
              {isScheduleBlocked
                ? 'Jadwal Kerja Belum Diatur'
                : isAttendanceBlocked
                ? 'Presensi Diperlukan Terlebih Dahulu'
                : 'Buka Sesi Kasir & Mulai Transaksi'}
            </LoadingButton>
          </div>
        </form>
      </div>

      <AttendanceVerificationModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onSuccess={handleAttendanceSuccess}
      />
    </div>
  );
}
