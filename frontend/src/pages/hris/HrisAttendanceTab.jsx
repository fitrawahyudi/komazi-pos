import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ClockAlert,
  ShieldCheck,
  MapPin,
  Camera,
  Eye,
  X,
  ExternalLink,
  Store,
  AlertTriangle,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import AttendanceVerificationModal from '../../components/hris/AttendanceVerificationModal';
import ShiftModal from '../../components/shift/ShiftModal';
import { useHrisStore } from '../../store/hrisStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { formatDuration } from '../../utils/format';

export default function HrisAttendanceTab({
  attendanceList = [],
  correctionsList = [],
  staffList = [],
  currentUser,
  isManagerOrOwner,
  onClockIn,
  onClockOut,
  onCreateManualAttendance,
  onDeleteAttendance,
  onCreateCorrection,
  onReviewCorrection,
  currentTimeWib,
  onFetchAttendance,
}) {
  const storeTodayAttendance = useHrisStore((state) => state.myTodayAttendance);
  const fetchTodayAttendance = useHrisStore((state) => state.fetchTodayAttendance);
  const myTodaySchedule = useHrisStore((state) => state.myTodaySchedule);
  const fetchMyTodaySchedule = useHrisStore((state) => state.fetchMyTodaySchedule);
  const { settings, updateSettings } = useSettingsStore();

  const isAttendanceEnforced = settings?.enforceAttendanceGuard !== false && settings?.enforceAttendanceGuard !== 'false';

  const [subTab, setSubTab] = useState('logs'); // 'logs' or 'corrections'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyModalMode, setVerifyModalMode] = useState('CLOCK_IN');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const hasActiveShift = Boolean(myTodaySchedule?.hasActiveShift);
  const activeShift = myTodaySchedule?.activeShift || null;
  const shiftActionMessage = myTodaySchedule?.shiftActionMessage || '';

  // Modal states
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  // Manual Attendance Form
  const [manualForm, setManualForm] = useState({
    userId: '',
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    status: 'PRESENT',
    notes: 'Entri manual oleh supervisor',
  });

  // Correction Request Form
  const [correctionForm, setCorrectionForm] = useState({
    attendanceId: '',
    date: new Date().toISOString().split('T')[0],
    requestedClockIn: '',
    requestedClockOut: '',
    reason: '',
  });

  // Ensure current user's today attendance & schedule status is fetched on mount
  useEffect(() => {
    if (fetchTodayAttendance && currentUser?.id) {
      fetchTodayAttendance(currentUser.id);
    }
    if (fetchMyTodaySchedule) {
      fetchMyTodaySchedule();
    }
  }, [currentUser?.id, fetchTodayAttendance, fetchMyTodaySchedule]);

  // Re-fetch attendance whenever selectedDate or staffFilter changes
  useEffect(() => {
    if (onFetchAttendance) {
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (staffFilter && staffFilter !== 'ALL' && staffFilter !== 'undefined') {
        params.staffId = staffFilter;
      }
      onFetchAttendance(params);
    }
  }, [selectedDate, staffFilter, onFetchAttendance]);

  // Find today's attendance for current user (from store or attendanceList fallback)
  const myTodayAttendance = useMemo(() => {
    if (storeTodayAttendance) return storeTodayAttendance;
    const today = new Date().toISOString().split('T')[0];
    return attendanceList.find((a) => a.userId === currentUser?.id && a.date === today);
  }, [storeTodayAttendance, attendanceList, currentUser]);

  // Filtered attendance records
  const filteredAttendance = useMemo(() => {
    return attendanceList.filter((a) => {
      const matchDate = !selectedDate || a.date === selectedDate;
      const matchStaff = staffFilter === 'ALL' || a.userId === Number(staffFilter);
      return matchDate && matchStaff;
    });
  }, [attendanceList, selectedDate, staffFilter]);

  const paginatedAttendance = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredAttendance.slice(start, start + perPage);
  }, [filteredAttendance, page, perPage]);

  const isOwner = currentUser?.role === 'OWNER';
  const isScheduleBlocked = !isOwner && myTodaySchedule !== null && !myTodaySchedule?.isScheduled;

  // Auto trigger clockout if requested via searchParams (e.g. from CloseSessionReportModal)
  useEffect(() => {
    if (searchParams && searchParams.get('action') === 'clockout') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
      if (myTodayAttendance && !myTodayAttendance.clockOut) {
        if (hasActiveShift) {
          toast.warning(
            'Anda masih memiliki sesi kasir aktif. Tutup sesi atau selesaikan serah terima sebelum presensi pulang.'
          );
          setIsShiftModalOpen(true);
        } else {
          setVerifyModalMode('CLOCK_OUT');
          setIsVerifyModalOpen(true);
        }
      }
    }
  }, [searchParams, myTodayAttendance, hasActiveShift, setSearchParams]);

  // Submit Handlers
  const handleClockInAction = () => {
    setVerifyModalMode('CLOCK_IN');
    setIsVerifyModalOpen(true);
  };

  const handleClockOutAction = () => {
    if (hasActiveShift) {
      toast.warning(
        'Anda masih memiliki sesi kasir aktif. Tutup sesi atau selesaikan serah terima sebelum presensi pulang.'
      );
      setIsShiftModalOpen(true);
      return;
    }
    setVerifyModalMode('CLOCK_OUT');
    setIsVerifyModalOpen(true);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.userId) return;
    await onCreateManualAttendance(manualForm);
    setIsManualModalOpen(false);
    if (onFetchAttendance) {
      onFetchAttendance({
        date: selectedDate || undefined,
        staffId: staffFilter !== 'ALL' ? staffFilter : undefined,
      });
    }
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    await onCreateCorrection(correctionForm);
    setIsCorrectionModalOpen(false);
    setCorrectionForm({
      attendanceId: '',
      date: new Date().toISOString().split('T')[0],
      requestedClockIn: '',
      requestedClockOut: '',
      reason: '',
    });
  };

  const handleReviewCorrectionAction = async (id, statusPayload) => {
    await onReviewCorrection(id, statusPayload);
    if (onFetchAttendance) {
      onFetchAttendance({
        date: selectedDate || undefined,
        staffId: staffFilter !== 'ALL' ? staffFilter : undefined,
      });
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          OWNER CONTROLS: ATURAN WAJIB PRESENSI UNTUK SEMUA STAF
         ───────────────────────────────────────────────────────────── */}
      {isOwner && (
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                isAttendanceEnforced
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              {isAttendanceEnforced ? (
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <ClockAlert className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-komazi-text">Aturan Wajib Presensi Staf</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isAttendanceEnforced
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {isAttendanceEnforced ? 'WAJIB PRESENSI AKTIF' : 'PRESENSI FLEKSIBEL (OPSIONAL)'}
                </span>
              </div>
              <p className="text-[11px] text-komazi-muted mt-1 leading-relaxed">
                {isAttendanceEnforced
                  ? 'Staf wajib melakukan clock-in presensi terlebih dahulu sebelum dapat membuka sesi kasir atau memproses pesanan di POS.'
                  : 'Presensi bersifat fleksibel / opsional. Staf dapat langsung membuka sesi kasir dan memproses pesanan di POS tanpa harus presensi terlebih dahulu.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-komazi-border/50">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <span className="text-xs font-semibold text-komazi-text">
                {isAttendanceEnforced ? 'Wajibkan Presensi' : 'Presensi Bebas'}
              </span>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(isAttendanceEnforced)}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    await updateSettings({ enforceAttendanceGuard: val });
                    toast.success(
                      val
                        ? 'Aturan disimpan: Seluruh staf kini WAJIB presensi sebelum bertransaksi / buka kasir.'
                        : 'Aturan disimpan: Presensi kini bersifat OPSIONAL (staf bebas bertransaksi tanpa presensi).'
                    );
                    fetchMyTodaySchedule?.();
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-komazi-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-500"></div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Schedule Blocked Alert Banner */}
      {isScheduleBlocked && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-200 text-sm">
              Jadwal Kerja Anda Belum Diatur
            </div>
            <p className="text-amber-300/90 leading-relaxed">
              Anda belum memiliki jadwal kerja untuk hari ini. Silakan hubungi Owner atau Manajer untuk mengatur jadwal kerja sebelum Anda dapat melakukan presensi mandiri, membuka sesi kasir, ataupun melakukan transaksi.
            </p>
          </div>
        </div>
      )}

      {/* 1. Quick Clock In / Clock Out Self-Service Widget */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-komazi-surface to-komazi-surface-2 border border-komazi-border shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center shrink-0 border border-komazi-coral/30">
              <Clock className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-komazi-text">{currentUser?.name || 'Karyawan'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-komazi-surface-2 border border-komazi-border text-komazi-muted uppercase font-mono">
                  {currentUser?.role || 'STAF'}
                </span>
              </div>
              <div className="text-2xl font-black text-komazi-text font-mono tracking-tight mt-0.5">
                {currentTimeWib} <span className="text-xs text-komazi-coral font-bold font-sans">WIB</span>
              </div>
              <div className="text-xs text-komazi-muted mt-1 flex flex-wrap items-center gap-2">
                <span>Status Presensi:</span>
                {!myTodayAttendance ? (
                  <span className="font-bold text-amber-400">Belum Presensi</span>
                ) : myTodayAttendance.clockOut ? (
                  <span className="font-bold text-neutral-400">
                    Selesai Giliran Kerja (Masuk: {new Date(myTodayAttendance.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • Pulang: {new Date(myTodayAttendance.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}) — {formatDuration(myTodayAttendance.workMinutes)}
                  </span>
                ) : (
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Sedang Bekerja (Masuk: {new Date(myTodayAttendance.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!myTodayAttendance ? (
              <button
                type="button"
                disabled={isScheduleBlocked}
                onClick={handleClockInAction}
                title={isScheduleBlocked ? 'Jadwal kerja Anda belum diatur' : 'Presensi'}
                className={`px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 ${
                  isScheduleBlocked
                    ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed opacity-60'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 active:scale-95'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isScheduleBlocked ? 'Jadwal Belum Diatur' : 'Presensi'}</span>
              </button>
            ) : !myTodayAttendance.clockOut ? (
              <button
                type="button"
                onClick={handleClockOutAction}
                className="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all active:scale-95 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                <span>Presensi Pulang</span>
              </button>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-neutral-900 border border-komazi-border text-xs text-komazi-muted font-semibold">
                ✓ Presensi
              </div>
            )}

            {/* Tombol Ajukan Koreksi */}
            <button
              type="button"
              onClick={() => setIsCorrectionModalOpen(true)}
              className="px-4 py-3 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-white border border-komazi-border text-xs font-bold transition-all flex items-center gap-1.5"
              title="Ajukan permohonan koreksi jika lupa presensi masuk atau pulang"
            >
              <ClockAlert className="w-4 h-4 text-komazi-coral" />
              <span>Koreksi Presensi</span>
            </button>
          </div>
        </div>

        {/* Status Sesi Kasir & Pesan Tindakan */}
        {myTodayAttendance && !myTodayAttendance.clockOut && (
          <div className="pt-3 border-t border-komazi-border/70">
            {hasActiveShift ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5 text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-200">
                      Sesi Kasir Aktif: {activeShift?.registerName || 'Kasir Utama'}
                    </div>
                    <p className="text-amber-300/90 leading-relaxed text-[11px]">
                      {shiftActionMessage || 'Anda masih memiliki sesi kasir aktif. Tutup sesi atau selesaikan serah terima sebelum presensi pulang.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Tutup Sesi Kasir</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-[11px] leading-relaxed">
                    {shiftActionMessage || 'Anda dapat melakukan presensi pulang. Sesi kasir milik karyawan lain tidak terpengaruh.'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-400/80 shrink-0 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                  Sesi Kasir Bebas
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Sub-tab switcher: Log Presensi vs Pengajuan Koreksi */}
      <div className="flex items-center gap-2 border-b border-komazi-border pb-2">
        <button
          type="button"
          onClick={() => setSubTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            subTab === 'logs'
              ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
              : 'text-komazi-muted hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Riwayat Presensi</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('corrections')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
            subTab === 'corrections'
              ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
              : 'text-komazi-muted hover:text-white'
          }`}
        >
          <ClockAlert className="w-4 h-4" />
          <span>Pengajuan Koreksi</span>
          {correctionsList.filter((c) => c.status === 'PENDING').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SUB-TAB 1: LOG PRESENSI HARIAN
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'logs' && (
        <div className="space-y-4">
          {/* Controls: Date Picker, Staff Filter, Manual Entry Button */}
          <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Date Filter */}
              <div className="flex items-center gap-2 bg-komazi-surface-2 border border-komazi-border px-3 py-1.5 rounded-xl text-xs">
                <Calendar className="w-3.5 h-3.5 text-komazi-coral" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-komazi-text outline-none cursor-pointer text-xs"
                />
              </div>

              {selectedDate && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('');
                    setPage(1);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-komazi-surface-2 border border-komazi-border text-komazi-muted text-[11px] hover:text-white"
                >
                  Semua Tanggal
                </button>
              )}

              {/* Staff Filter (Manager/Owner only) */}
              {isManagerOrOwner && (
                <select
                  value={staffFilter}
                  onChange={(e) => {
                    setStaffFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Staf</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Tombol Entri Manual (Manajer / Pemilik) */}
            {isManagerOrOwner && (
              <button
                type="button"
                onClick={() => setIsManualModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-komazi-text font-bold text-xs shadow-sm transition-all active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4 text-komazi-coral" />
                <span>Catat Presensi Manual</span>
              </button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
                  <tr>
                    <th className="py-3 px-4">Pegawai</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Jam Masuk</th>
                    <th className="py-3 px-4">Jam Pulang</th>
                    <th className="py-3 px-4">Bukti &amp; Lokasi</th>
                    <th className="py-3 px-4">Durasi Kerja</th>
                    <th className="py-3 px-4">Status &amp; Keterlambatan</th>
                    <th className="py-3 px-4">Catatan</th>
                    {isManagerOrOwner && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-komazi-border">
                  {paginatedAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={isManagerOrOwner ? 9 : 8} className="py-12 text-center text-komazi-muted">
                        <Clock className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p>Belum ada catatan presensi pada tanggal {selectedDate || 'yang dipilih'}</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedAttendance.map((item) => {
                      const clockInTime = new Date(item.clockIn).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const clockOutTime = item.clockOut
                        ? new Date(item.clockOut).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                      const hours = Math.floor((item.workMinutes || 0) / 60);
                      const minutes = (item.workMinutes || 0) % 60;

                      return (
                        <tr key={item.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-komazi-text">{item.user?.name || 'Staf'}</div>
                            <div className="text-[10px] text-komazi-muted">
                              @{item.user?.username} • {item.user?.role}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-komazi-muted">{item.date}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">{clockInTime}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-rose-400">{clockOutTime}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1.5 py-0.5 min-w-[140px]">
                              {/* Bukti Masuk */}
                              <div className="flex items-center gap-1.5" title="Bukti Presensi Masuk">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 font-mono">
                                  IN
                                </span>
                                {item.photoUrl ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewPhotoUrl({
                                        url: item.photoUrl,
                                        title: `Foto Masuk - ${item.user?.name || 'Staf'} (${clockInTime})`,
                                      })
                                    }
                                    className="relative group shrink-0"
                                    title="Klik untuk memperbesar foto selfie masuk"
                                  >
                                    <img
                                      src={item.photoUrl}
                                      alt="Selfie Masuk"
                                      className="w-7 h-7 rounded-md object-cover border border-emerald-500/40 group-hover:border-emerald-400 shadow-sm transition-all"
                                    />
                                    <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                      <Eye className="w-3 h-3" />
                                    </div>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-komazi-muted/50 px-1">—</span>
                                )}

                                {item.distanceMeters !== null && item.distanceMeters !== undefined ? (
                                  (item.latitude && item.longitude) || (item.verification?.latitude && item.verification?.longitude) ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${item.latitude || item.verification?.latitude},${item.longitude || item.verification?.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0 hover:underline cursor-pointer transition-all ${
                                        item.distanceMeters <= 100
                                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                                      }`}
                                      title={`Jarak Masuk: ${item.distanceMeters}m (Akurasi: ±${Math.round(item.accuracy || item.verification?.accuracy || 0)}m). Klik untuk buka di Google Maps.`}
                                    >
                                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                                      <span>{item.distanceMeters}m</span>
                                      <ExternalLink className="w-2 h-2 opacity-60" />
                                    </a>
                                  ) : (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0 ${
                                        item.distanceMeters <= 100
                                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      }`}
                                      title={`Jarak Masuk: ${item.distanceMeters}m`}
                                    >
                                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                                      {item.distanceMeters}m
                                    </span>
                                  )
                                ) : null}
                              </div>

                              {/* Bukti Pulang (jika sudah Clock-Out) */}
                              {item.clockOut ? (
                                <div className="flex items-center gap-1.5" title="Bukti Presensi Pulang">
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0 font-mono">
                                    OUT
                                  </span>
                                  {item.clockOutPhotoUrl ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewPhotoUrl({
                                          url: item.clockOutPhotoUrl,
                                          title: `Foto Pulang - ${item.user?.name || 'Staf'} (${clockOutTime})`,
                                        })
                                      }
                                      className="relative group shrink-0"
                                      title="Klik untuk memperbesar foto selfie pulang"
                                    >
                                      <img
                                        src={item.clockOutPhotoUrl}
                                        alt="Selfie Pulang"
                                        className="w-7 h-7 rounded-md object-cover border border-rose-500/40 group-hover:border-rose-400 shadow-sm transition-all"
                                      />
                                      <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                        <Eye className="w-3 h-3" />
                                      </div>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-komazi-muted/50 px-1">—</span>
                                  )}

                                  {item.clockOutDistanceMeters !== null && item.clockOutDistanceMeters !== undefined ? (
                                    (item.clockOutLatitude && item.clockOutLongitude) ||
                                    (item.verification?.clockOutVerification?.latitude &&
                                      item.verification?.clockOutVerification?.longitude) ? (
                                      <a
                                        href={`https://www.google.com/maps?q=${item.clockOutLatitude || item.verification?.clockOutVerification?.latitude},${item.clockOutLongitude || item.verification?.clockOutVerification?.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0 hover:underline cursor-pointer transition-all ${
                                          item.clockOutDistanceMeters <= 100
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                                        }`}
                                        title={`Jarak Pulang: ${item.clockOutDistanceMeters}m (Akurasi: ±${Math.round(item.verification?.clockOutVerification?.accuracy || 0)}m). Klik untuk buka di Google Maps.`}
                                      >
                                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                                        <span>{item.clockOutDistanceMeters}m</span>
                                        <ExternalLink className="w-2 h-2 opacity-60" />
                                      </a>
                                    ) : (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5 shrink-0 ${
                                          item.clockOutDistanceMeters <= 100
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                        }`}
                                        title={`Jarak Pulang: ${item.clockOutDistanceMeters}m`}
                                      >
                                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                                        {item.clockOutDistanceMeters}m
                                      </span>
                                    )
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {item.clockOut ? formatDuration(item.workMinutes) : 'Sedang berjalan'}
                          </td>
                          <td className="py-3.5 px-4">
                            {item.status === 'LATE' ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                Terlambat ({item.lateMinutes ? formatDuration(item.lateMinutes) : '0m'})
                              </span>
                            ) : item.status === 'PRESENT' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                Tepat Waktu
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-komazi-muted text-[10px] font-bold">
                                {item.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-komazi-muted italic">{item.notes || '—'}</td>
                          {isManagerOrOwner && (
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => onDeleteAttendance(item.id)}
                                title="Hapus catatan"
                                className="p-1 rounded-lg text-komazi-muted hover:text-rose-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredAttendance.length > 0 && (
              <div className="p-3 border-t border-komazi-border">
                <Pagination
                  currentPage={page}
                  totalItems={filteredAttendance.length}
                  itemsPerPage={perPage}
                  onPageChange={setPage}
                  onItemsPerPageChange={(newLimit) => {
                    setPerPage(newLimit);
                    setPage(1);
                  }}
                  itemLabel="presensi"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SUB-TAB 2: PENGAJUAN KOREKSI ABSENSI (MAKER-CHECKER)
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'corrections' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-komazi-text">Daftar Pengajuan Koreksi Presensi</h3>
              <p className="text-[11px] text-komazi-muted">
                Ditinjau oleh Manajer/Pemilik dengan prinsip otorisasi berjenjang (penyetuju kedua)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCorrectionModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Ajukan Koreksi Presensi</span>
            </button>
          </div>

          <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
                  <tr>
                    <th className="py-3 px-4">Pemohon</th>
                    <th className="py-3 px-4">Tanggal Koreksi</th>
                    <th className="py-3 px-4">Jam Masuk Diminta</th>
                    <th className="py-3 px-4">Jam Pulang Diminta</th>
                    <th className="py-3 px-4">Alasan Staf</th>
                    <th className="py-3 px-4">Status &amp; Peninjau</th>
                    {isManagerOrOwner && <th className="py-3 px-4 text-right">Keputusan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-komazi-border">
                  {correctionsList.length === 0 ? (
                    <tr>
                      <td colSpan={isManagerOrOwner ? 7 : 6} className="py-12 text-center text-komazi-muted">
                        <CheckCircle2 className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p>Tidak ada permohonan koreksi presensi</p>
                      </td>
                    </tr>
                  ) : (
                    correctionsList.map((item) => {
                      const isSelf = currentUser?.id === item.userId;
                      return (
                        <tr key={item.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-komazi-text">{item.user?.name}</div>
                            <div className="text-[10px] text-komazi-muted">@{item.user?.username}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-komazi-text">{item.date}</td>
                          <td className="py-3.5 px-4 font-mono text-emerald-400">
                            {item.requestedClockIn
                              ? new Date(item.requestedClockIn).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-rose-400">
                            {item.requestedClockOut
                              ? new Date(item.requestedClockOut).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-komazi-muted max-w-xs">{item.reason}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${
                                  item.status === 'APPROVED'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : item.status === 'REJECTED'
                                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {item.status === 'APPROVED' ? 'Disetujui' : item.status === 'REJECTED' ? 'Ditolak' : 'Menunggu'}
                              </span>
                              {item.reviewedBy && (
                                <span className="text-[10px] text-komazi-muted">
                                  Oleh: {item.reviewedBy.name}
                                </span>
                              )}
                            </div>
                          </td>

                          {isManagerOrOwner && (
                            <td className="py-3.5 px-4 text-right">
                              {item.status === 'PENDING' ? (
                                isSelf ? (
                                  <span className="text-[10px] text-amber-400 font-semibold italic">
                                    Prinsip Penyetuju Kedua: Menunggu persetujuan staf lain
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleReviewCorrectionAction(item.id, { status: 'APPROVED' })}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[11px] border border-emerald-500/30 transition-all"
                                    >
                                      Setujui
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleReviewCorrectionAction(item.id, { status: 'REJECTED' })}
                                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-[11px] border border-rose-500/30 transition-all"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                )
                              ) : (
                                <span className="text-[10px] text-komazi-muted">Selesai</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <Clock className="w-4 h-4 text-komazi-coral" />
                <span>Pencatatan Presensi Manual</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Pilih Staf *</label>
                <select
                  required
                  value={manualForm.userId}
                  onChange={(e) => setManualForm({ ...manualForm, userId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                >
                  <option value="">-- Pilih Staf --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role === 'OWNER' ? 'Pemilik' : s.role === 'MANAGER' ? 'Manajer' : s.role === 'CASHIER' ? 'Kasir' : s.role === 'BARISTA' ? 'Barista' : s.role === 'KITCHEN' ? 'Dapur' : s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Tanggal *</label>
                <input
                  type="date"
                  required
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Jam Masuk</label>
                  <input
                    type="datetime-local"
                    value={manualForm.clockIn}
                    onChange={(e) => setManualForm({ ...manualForm, clockIn: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Jam Pulang</label>
                  <input
                    type="datetime-local"
                    value={manualForm.clockOut}
                    onChange={(e) => setManualForm({ ...manualForm, clockOut: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Catatan</label>
                <input
                  type="text"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  placeholder="Keterangan kehadiran manual"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral text-white text-xs font-bold shadow-md"
                >
                  Simpan Presensi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correction Request Modal */}
      {isCorrectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <ClockAlert className="w-4 h-4 text-komazi-coral" />
                <span>Ajukan Koreksi Presensi</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCorrectionModalOpen(false)}
                className="p-1 rounded-lg text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCorrectionSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Tanggal Presensi *</label>
                <input
                  type="date"
                  required
                  value={correctionForm.date}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Jam Masuk Sebenarnya</label>
                  <input
                    type="datetime-local"
                    value={correctionForm.requestedClockIn}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, requestedClockIn: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Jam Pulang Sebenarnya</label>
                  <input
                    type="datetime-local"
                    value={correctionForm.requestedClockOut}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, requestedClockOut: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Alasan Koreksi *</label>
                <textarea
                  required
                  rows={3}
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  placeholder="Jelaskan alasan mengapa lupa presensi masuk atau pulang..."
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral text-white text-xs font-bold shadow-md"
                >
                  Kirim Pengajuan Koreksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Shift / Tutup Sesi Kasir */}
      {isShiftModalOpen && (
        <ShiftModal
          onClose={() => {
            setIsShiftModalOpen(false);
            fetchMyTodaySchedule?.();
            if (currentUser?.id) fetchTodayAttendance?.(currentUser.id);
          }}
          onProceedToClockOut={() => {
            setIsShiftModalOpen(false);
            fetchMyTodaySchedule?.();
            if (currentUser?.id) fetchTodayAttendance?.(currentUser.id);
            setVerifyModalMode('CLOCK_OUT');
            setIsVerifyModalOpen(true);
          }}
        />
      )}

      {/* Attendance Verification Modal (GPS & Selfie Proof) */}
      <AttendanceVerificationModal
        isOpen={isVerifyModalOpen}
        mode={verifyModalMode}
        onOpenCloseSessionModal={() => setIsShiftModalOpen(true)}
        onClose={() => setIsVerifyModalOpen(false)}
        onSuccess={() => {
          fetchMyTodaySchedule?.();
          if (currentUser?.id) fetchTodayAttendance?.(currentUser.id);
          if (onFetchAttendance) {
            onFetchAttendance({
              date: selectedDate || undefined,
              staffId: staffFilter !== 'ALL' ? staffFilter : undefined,
            });
          }
        }}
      />

      {/* Selfie Photo Preview Modal */}
      {previewPhotoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden p-4 space-y-3 animate-in zoom-in-95 duration-200 text-center"
          >
            <div className="flex items-center justify-between pb-2 border-b border-komazi-border">
              <span className="font-bold text-xs text-komazi-text flex items-center gap-1.5 truncate">
                <Camera className="w-3.5 h-3.5 text-komazi-coral shrink-0" />
                <span className="truncate">
                  {typeof previewPhotoUrl === 'object' && previewPhotoUrl.title
                    ? previewPhotoUrl.title
                    : 'Bukti Foto Selfie Presensi'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="w-7 h-7 rounded-lg bg-komazi-surface-2 text-komazi-muted hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden aspect-square border border-komazi-border bg-black">
              <img
                src={typeof previewPhotoUrl === 'object' ? previewPhotoUrl.url : previewPhotoUrl}
                alt="Foto Selfie Presensi"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
