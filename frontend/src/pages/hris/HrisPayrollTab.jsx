import React, { useState, useEffect } from 'react';
import {
  Coins,
  Calculator,
  Lock,
  Send,
  Eye,
  Plus,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Download,
  X,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { formatRupiah, formatDuration } from '../../utils/format';

export default function HrisPayrollTab({
  payrollPeriods = [],
  selectedPeriodPayslips = [],
  myPayslips = [],
  currentUser,
  isManagerOrOwner,
  onCreatePayrollPeriod,
  onCalculatePayrollPeriod,
  onFinalizePayrollPeriod,
  onPublishPayrollPeriod,
  onFetchPeriodPayslips,
  onFetchMyPayslips,
}) {
  const isOwner = currentUser?.role === 'OWNER';
  const isEmployee = !isManagerOrOwner;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [isPayslipsModalOpen, setIsPayslipsModalOpen] = useState(false);
  const [activeSlipDetail, setActiveSlipDetail] = useState(null);

  const [periodForm, setPeriodForm] = useState({
    name: `Payroll ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
  });

  // Load employee's own payslips if regular staff
  useEffect(() => {
    if (isEmployee) {
      onFetchMyPayslips();
    }
  }, [isEmployee, onFetchMyPayslips]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    await onCreatePayrollPeriod(periodForm);
    setIsCreateModalOpen(false);
  };

  const handleViewPeriodSlips = async (period) => {
    setSelectedPeriod(period);
    await onFetchPeriodPayslips(period.id);
    setIsPayslipsModalOpen(true);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          A. MANAGER / OWNER VIEW: MANAGEMENT & CALCULATION
         ───────────────────────────────────────────────────────────── */}
      {isManagerOrOwner && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <Coins className="w-4 h-4 text-komazi-coral" />
                <span>Penggajian Outlet</span>
              </h3>
              <p className="text-[11px] text-komazi-muted">
                Kalkulasi otomatis dari presensi nyata, uang makan, jam lembur, dan potongan keterlambatan
              </p>
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Buat Periode Baru</span>
              </button>
            )}
          </div>

          {/* Periods Table */}
          <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
                  <tr>
                    <th className="py-3 px-4">Nama Periode</th>
                    <th className="py-3 px-4">Rentang Waktu</th>
                    <th className="py-3 px-4">Status Siklus</th>
                    {isOwner && <th className="py-3 px-4">Total Pembayaran</th>}
                    <th className="py-3 px-4">Jumlah Slip</th>
                    <th className="py-3 px-4 text-right">Aksi Operasional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-komazi-border">
                  {payrollPeriods.length === 0 ? (
                    <tr>
                      <td colSpan={isOwner ? 6 : 5} className="py-12 text-center text-komazi-muted">
                        <Coins className="w-8 h-8 mx-auto opacity-30 mb-2" />
                        <p>Belum ada periode penggajian yang dibuat</p>
                      </td>
                    </tr>
                  ) : (
                    payrollPeriods.map((period) => (
                      <tr key={period.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-komazi-text">{period.name}</td>
                        <td className="py-3.5 px-4 font-mono text-komazi-muted">
                          {period.startDate} s/d {period.endDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              period.status === 'PUBLISHED'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : period.status === 'FINALIZED'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : period.status === 'CALCULATED'
                                ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
                                : 'bg-neutral-800 text-komazi-muted border border-komazi-border'
                            }`}
                          >
                            {period.status === 'PUBLISHED'
                              ? 'Diterbitkan'
                              : period.status === 'FINALIZED'
                              ? 'Difinalisasi'
                              : period.status === 'CALCULATED'
                              ? 'Dihitung'
                              : 'Draf'}
                          </span>
                        </td>

                        {isOwner && (
                          <td className="py-3.5 px-4 font-mono font-bold text-komazi-text">
                            {formatRupiah(period.totalPayout || 0)}
                          </td>
                        )}

                        <td className="py-3.5 px-4 text-komazi-muted">
                          {period._count?.payslips ?? 0} Slip
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* 1. Hitung Ulang (Calculate) */}
                            {period.status !== 'FINALIZED' && period.status !== 'PUBLISHED' && (
                              <button
                                type="button"
                                onClick={() => onCalculatePayrollPeriod(period.id)}
                                title="Hitung otomatis dari presensi"
                                className="px-2.5 py-1 rounded-lg bg-komazi-coral/15 hover:bg-komazi-coral text-komazi-coral hover:text-white font-bold text-[11px] border border-komazi-coral/30 transition-all flex items-center gap-1"
                              >
                                <Calculator className="w-3 h-3" />
                                <span>Hitung</span>
                              </button>
                            )}

                            {/* 2. Finalisasi (Owner only) */}
                            {isOwner && period.status === 'CALCULATED' && (
                              <button
                                type="button"
                                onClick={() => onFinalizePayrollPeriod(period.id)}
                                title="Kunci perhitungan & finalisasi"
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-white font-bold text-[11px] border border-amber-500/30 transition-all flex items-center gap-1"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Kunci</span>
                              </button>
                            )}

                            {/* 3. Publikasikan Slip (Owner only) */}
                            {isOwner && period.status === 'FINALIZED' && (
                              <button
                                type="button"
                                onClick={() => onPublishPayrollPeriod(period.id)}
                                title="Kirim ke ESS staf"
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[11px] border border-emerald-500/30 transition-all flex items-center gap-1"
                              >
                                <Send className="w-3 h-3" />
                                <span>Publikasikan</span>
                              </button>
                            )}

                            {/* 4. Lihat Rincian Slip */}
                            <button
                              type="button"
                              onClick={() => handleViewPeriodSlips(period)}
                              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-komazi-text font-bold text-[11px] transition-all flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-komazi-coral" />
                              <span>Rincian</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          B. EMPLOYEE SELF-SERVICE (ESS): SLIP GAJI SAYA
         ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-komazi-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-komazi-text">Slip Gaji Karyawan</h3>
              <p className="text-[11px] text-komazi-muted">
                Slip gaji resmi yang telah dipublikasikan oleh manajemen outlet
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onFetchMyPayslips}
            className="text-xs font-bold text-komazi-coral hover:underline"
          >
            Segarkan Data
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {myPayslips.length === 0 ? (
            <div className="col-span-full py-8 text-center text-komazi-muted">
              <FileText className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-xs">Belum ada slip gaji yang dipublikasikan untuk akun Anda</p>
            </div>
          ) : (
            myPayslips.map((slip) => (
              <div
                key={slip.id}
                onClick={() => setActiveSlipDetail(slip)}
                className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:border-komazi-coral/50 transition-all cursor-pointer group space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-komazi-text group-hover:text-komazi-coral transition-colors">
                    {slip.period?.name || 'Periode Penggajian'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    Resmi
                  </span>
                </div>

                <div className="text-[11px] text-komazi-muted font-mono">
                  {slip.period?.startDate} s/d {slip.period?.endDate}
                </div>

                <div className="pt-2 border-t border-komazi-border/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-komazi-muted block">Gaji Bersih Diterima</span>
                    <span className="font-mono font-black text-sm text-emerald-400">
                      {formatRupiah(slip.netSalary)}
                    </span>
                  </div>
                  <span className="text-xs text-komazi-coral font-bold group-hover:translate-x-0.5 transition-transform">
                    Lihat Rincian →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Period Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <Coins className="w-4 h-4 text-komazi-coral" />
                <span>Buat Periode Penggajian Baru</span>
              </h3>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Nama Periode Penggajian *</label>
                <input
                  type="text"
                  required
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Tanggal Mulai *</label>
                  <input
                    type="date"
                    required
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral text-white text-xs font-bold shadow-md"
                >
                  Simpan Periode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslips Breakdown Modal (Owner / Manager) */}
      {isPayslipsModalOpen && selectedPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <div>
                <h3 className="font-bold text-sm text-komazi-text">
                  Daftar Slip Gaji — {selectedPeriod.name}
                </h3>
                <p className="text-[11px] text-komazi-muted">
                  {selectedPeriod.startDate} s/d {selectedPeriod.endDate} • Status: {selectedPeriod.status === 'PUBLISHED' ? 'Diterbitkan' : selectedPeriod.status === 'FINALIZED' ? 'Difinalisasi' : selectedPeriod.status === 'CALCULATED' ? 'Dihitung' : 'Draf'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPayslipsModalOpen(false)}
                className="p-1 rounded-lg text-komazi-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Pegawai</th>
                    <th className="py-2.5 px-3">Gaji Pokok</th>
                    <th className="py-2.5 px-3">Uang Makan &amp; Hadir</th>
                    <th className="py-2.5 px-3">Upah Lembur</th>
                    <th className="py-2.5 px-3 text-rose-400">Potongan</th>
                    <th className="py-2.5 px-3 text-emerald-400 font-bold">Gaji Bersih</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-komazi-border font-mono">
                  {selectedPeriodPayslips.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-komazi-muted font-sans">
                        Belum ada kalkulasi slip gaji. Silakan klik tombol "Hitung".
                      </td>
                    </tr>
                  ) : (
                    selectedPeriodPayslips.map((slip) => (
                      <tr key={slip.id} className="hover:bg-komazi-surface-2/60">
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-bold text-komazi-text">{slip.user?.name}</div>
                          <div className="text-[10px] text-komazi-muted">{slip.user?.role}</div>
                        </td>
                        <td className="py-2.5 px-3">{formatRupiah(slip.baseSalary)}</td>
                        <td className="py-2.5 px-3 text-komazi-text">{formatRupiah(slip.allowances)} ({slip.presentDays || 0}h)</td>
                        <td className="py-2.5 px-3 text-amber-400">
                          {formatRupiah(slip.overtimePay)} ({slip.overtimeHours}j)
                        </td>
                        <td className="py-2.5 px-3 text-rose-400">
                          -{formatRupiah(slip.deductions)}
                          {slip.lateMinutes > 0 && (
                            <span className="text-[10px] text-rose-400/80 ml-1 font-sans">
                              ({formatDuration(slip.lateMinutes)})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">
                          {formatRupiah(slip.netSalary)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => setActiveSlipDetail(slip)}
                            className="px-2 py-1 rounded bg-neutral-800 text-[11px] text-komazi-coral hover:text-white"
                          >
                            Cetak Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Slip Gaji Detail / Printable Modal */}
      {activeSlipDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white text-neutral-900 rounded-2xl shadow-2xl p-6 space-y-4">
            {/* Header */}
            <div className="text-center border-b border-neutral-200 pb-3">
              <h2 className="font-black text-base text-neutral-900 tracking-wider">KOMAZI COFFEE &amp; WORKSPACE</h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">
                SLIP PENGGAJIAN RESMI PEGAWAI
              </p>
              <div className="text-xs font-bold text-neutral-800 mt-1">
                {activeSlipDetail.period?.name || selectedPeriod?.name || 'Periode Berjalan'}
              </div>
            </div>

            {/* Profile */}
            <div className="grid grid-cols-2 gap-2 text-xs border-b border-neutral-200 pb-3">
              <div>
                <span className="text-[10px] text-neutral-500 block">Nama Pegawai:</span>
                <strong className="text-neutral-900">{activeSlipDetail.user?.name || currentUser?.name}</strong>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 block">Peran / Jabatan:</span>
                <strong className="text-neutral-900">{activeSlipDetail.user?.role || currentUser?.role}</strong>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">Gaji Pokok:</span>
                <span className="font-mono font-semibold">{formatRupiah(activeSlipDetail.baseSalary)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">
                  Uang Makan &amp; Kehadiran ({activeSlipDetail.presentDays || 0} hari):
                </span>
                <span className="font-mono font-semibold">{formatRupiah(activeSlipDetail.allowances)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">
                  Upah Lembur ({activeSlipDetail.overtimeHours || 0} jam):
                </span>
                <span className="font-mono font-semibold">{formatRupiah(activeSlipDetail.overtimePay)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100 text-rose-600">
                <span>
                  Potongan Keterlambatan{activeSlipDetail.lateMinutes > 0 ? ` (${formatDuration(activeSlipDetail.lateMinutes)})` : ''}:
                </span>
                <span className="font-mono font-semibold">-{formatRupiah(activeSlipDetail.deductions)}</span>
              </div>
              <div className="flex justify-between py-2.5 border-t-2 border-neutral-900 font-bold text-sm text-neutral-900">
                <span>TOTAL GAJI BERSIH:</span>
                <span className="font-mono text-emerald-600">{formatRupiah(activeSlipDetail.netSalary)}</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setActiveSlipDetail(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-bold hover:bg-neutral-200"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
