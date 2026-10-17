import React from 'react';
import {
  Users,
  UserCheck,
  Clock,
  Calendar,
  CalendarOff,
  Coins,
  CheckCircle2,
  AlertCircle,
  ClockAlert,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import { formatRupiah } from '../../utils/format';

export default function HrisDashboardTab({
  overview,
  currentUser,
  isManagerOrOwner,
  onNavigateTab,
  staffList = [],
}) {
  const isOwner = currentUser?.role === 'OWNER';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Staf */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Total Pegawai</div>
            <div className="text-xl font-black text-komazi-text">{overview?.totalStaff ?? staffList.length} Orang</div>
            <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
              {overview?.activeStaff ?? staffList.filter((s) => s.isActive).length} Aktif
            </div>
          </div>
        </div>

        {/* Hadir Hari Ini */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-[11px] text-komazi-muted font-medium">Hadir Hari Ini</div>
            <div className="text-xl font-black text-emerald-400">{overview?.presentToday ?? 0} Orang</div>
            <div className="text-[10px] text-komazi-muted font-medium mt-0.5">
              dari {overview?.scheduledToday ?? 0} terjadwal
            </div>
          </div>
        </div>

        {/* Pengajuan Cuti & Izin Pending */}
        <div
          onClick={() => onNavigateTab('leaves')}
          className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center gap-3.5 cursor-pointer hover:border-amber-500/50 transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <CalendarOff className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-komazi-muted font-medium">Cuti Menunggu</div>
            <div className="text-xl font-black text-amber-400">{overview?.pendingLeaves ?? 0} Tiket</div>
            <div className="text-[10px] text-amber-400/80 font-semibold mt-0.5 group-hover:underline">
              Perlu tinjauan →
            </div>
          </div>
        </div>

        {/* Koreksi Presensi / Lembur Pending */}
        <div
          onClick={() => onNavigateTab('attendance')}
          className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center gap-3.5 cursor-pointer hover:border-rose-500/50 transition-all group"
        >
          <div className="w-11 h-11 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
            <ClockAlert className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] text-komazi-muted font-medium">Koreksi Presensi</div>
            <div className="text-xl font-black text-rose-400">{overview?.pendingCorrections ?? 0} Tiket</div>
            <div className="text-[10px] text-rose-400/80 font-semibold mt-0.5 group-hover:underline">
              Verifikasi kehadiran →
            </div>
          </div>
        </div>
      </div>

      {/* 2. Middle Section: Ringkasan Penggajian & Alur Kerja Mandiri */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payroll Summary Card (Owner & Manager) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-komazi-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">Ringkasan Penggajian Outlet</h3>
                <p className="text-[11px] text-komazi-muted">
                  Perhitungan kompensasi berbasis presensi, giliran kerja, dan lembur riil
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('payroll')}
              className="text-xs font-bold text-komazi-coral hover:underline flex items-center gap-1"
            >
              <span>Kelola Penggajian</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {overview?.latestPayroll ? (
            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-komazi-muted">
                  Periode Aktif
                </span>
                <div className="text-base font-black text-komazi-text mt-0.5">
                  {overview.latestPayroll.name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      overview.latestPayroll.status === 'PUBLISHED'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : overview.latestPayroll.status === 'FINALIZED'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
                    }`}
                  >
                    {overview.latestPayroll.status === 'PUBLISHED'
                      ? 'Diterbitkan'
                      : overview.latestPayroll.status === 'FINALIZED'
                      ? 'Difinalisasi'
                      : overview.latestPayroll.status === 'CALCULATED'
                      ? 'Dihitung'
                      : 'Draf'}
                  </span>
                  <span className="text-[11px] text-komazi-muted">Data Tersinkronisasi</span>
                </div>
              </div>

              {isOwner && (
                <div className="sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-komazi-muted">
                    Total Estimasi Pembayaran Gaji
                  </span>
                  <div className="text-xl font-black text-komazi-coral mt-0.5">
                    {formatRupiah(overview.latestPayroll.totalPayout || 0)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center space-y-2">
              <p className="text-xs text-komazi-muted">
                Belum ada periode penggajian yang dibuat untuk bulan ini.
              </p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('payroll')}
                  className="px-4 py-2 rounded-xl bg-komazi-coral text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  + Buat Periode Penggajian
                </button>
              )}
            </div>
          )}

          {/* Maker-Checker & Keamanan Notice */}
          <div className="p-3.5 rounded-xl bg-neutral-900 border border-komazi-border text-[11px] text-komazi-muted flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-komazi-coral shrink-0 mt-0.5" />
            <div>
              <strong className="text-komazi-text">Keamanan Akses Peran &amp; Prinsip Penyetuju Kedua:</strong>
              <p className="mt-0.5">
                Penyetuju dilarang menyetujui koreksi presensi, cuti, atau lemburnya sendiri. Akses komponen upah dirahasiakan khusus untuk Pemilik (Owner).
              </p>
            </div>
          </div>
        </div>

        {/* Quick Shortcuts Card */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm space-y-3.5">
          <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-komazi-coral" />
            <span>Pintasan Cepat HRIS</span>
          </h3>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onNavigateTab('attendance')}
              className="w-full p-3 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-left flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-bold text-komazi-text">Presensi &amp; Jam Kerja</div>
                  <div className="text-[10px] text-komazi-muted">Presensi Masuk/Pulang WIB &amp; Koreksi</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-komazi-muted group-hover:text-komazi-coral group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('schedule')}
              className="w-full p-3 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-left flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-bold text-komazi-text">Jadwal Giliran Kerja</div>
                  <div className="text-[10px] text-komazi-muted">Atur rotasi sif &amp; deteksi bentrok</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-komazi-muted group-hover:text-komazi-coral group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('leaves')}
              className="w-full p-3 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-left flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <CalendarOff className="w-4 h-4 text-rose-400" />
                <div>
                  <div className="text-xs font-bold text-komazi-text">Pengajuan Cuti &amp; Lembur</div>
                  <div className="text-[10px] text-komazi-muted">Izin sakit, tahunan &amp; lembur</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-komazi-muted group-hover:text-komazi-coral group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('payroll')}
              className="w-full p-3 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-left flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Coins className="w-4 h-4 text-komazi-coral" />
                <div>
                  <div className="text-xs font-bold text-komazi-text">Slip Gaji &amp; Penggajian</div>
                  <div className="text-[10px] text-komazi-muted">Unduh slip resmi &amp; rekap gaji</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-komazi-muted group-hover:text-komazi-coral group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
