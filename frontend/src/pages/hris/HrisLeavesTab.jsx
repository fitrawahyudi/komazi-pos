import React, { useState, useMemo } from 'react';
import {
  CalendarOff,
  ClockAlert,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  X,
  Check,
  TrendingUp,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';

export default function HrisLeavesTab({
  leaveList = [],
  overtimeList = [],
  currentUser,
  isManagerOrOwner,
  onCreateLeave,
  onUpdateLeaveStatus,
  onDeleteLeave,
  onCreateOvertime,
  onReviewOvertime,
}) {
  const [subTab, setSubTab] = useState('leaves'); // 'leaves' or 'overtime'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Modals
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);

  // Leave Form
  const [leaveForm, setLeaveForm] = useState({
    type: 'ANNUAL',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    days: 1,
    reason: '',
  });

  // Overtime Form
  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    durationHours: 2,
    reason: '',
  });

  // Filtered lists
  const filteredLeaves = useMemo(() => {
    return leaveList.filter((l) => {
      return statusFilter === 'ALL' || l.status === statusFilter;
    });
  }, [leaveList, statusFilter]);

  const paginatedLeaves = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredLeaves.slice(start, start + perPage);
  }, [filteredLeaves, page, perPage]);

  const filteredOvertimes = useMemo(() => {
    return overtimeList.filter((o) => {
      return statusFilter === 'ALL' || o.status === statusFilter;
    });
  }, [overtimeList, statusFilter]);

  const paginatedOvertimes = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredOvertimes.slice(start, start + perPage);
  }, [filteredOvertimes, page, perPage]);

  // Submit Handlers
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    await onCreateLeave(leaveForm);
    setIsLeaveModalOpen(false);
    setLeaveForm({
      type: 'ANNUAL',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      days: 1,
      reason: '',
    });
  };

  const handleOvertimeSubmit = async (e) => {
    e.preventDefault();
    await onCreateOvertime(overtimeForm);
    setIsOvertimeModalOpen(false);
    setOvertimeForm({
      date: new Date().toISOString().split('T')[0],
      durationHours: 2,
      reason: '',
    });
  };

  const STATUS_OPTIONS = [
    { id: 'ALL', label: 'Semua' },
    { id: 'PENDING', label: 'Menunggu' },
    { id: 'APPROVED', label: 'Disetujui' },
    { id: 'REJECTED', label: 'Ditolak' },
  ];

  const handleStartDateChange = (val) => {
    setLeaveForm((prev) => {
      const end = prev.endDate && prev.endDate < val ? val : prev.endDate;
      const days = Math.max(1, Math.round((new Date(end) - new Date(val)) / (1000 * 60 * 60 * 24)) + 1);
      return { ...prev, startDate: val, endDate: end, days };
    });
  };

  const handleEndDateChange = (val) => {
    setLeaveForm((prev) => {
      const start = prev.startDate && prev.startDate > val ? val : prev.startDate;
      const days = Math.max(1, Math.round((new Date(val) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1);
      return { ...prev, endDate: val, startDate: start, days };
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Switcher: Cuti vs Lembur */}
      <div className="flex items-center justify-between border-b border-komazi-border pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSubTab('leaves');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'leaves'
                ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <CalendarOff className="w-4 h-4" />
            <span>Pengajuan Cuti &amp; Izin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubTab('overtime');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              subTab === 'overtime'
                ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
                : 'text-komazi-muted hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Pengajuan Lembur</span>
          </button>
        </div>

        {/* Action Button */}
        {subTab === 'leaves' ? (
          <button
            type="button"
            onClick={() => setIsLeaveModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Ajukan Cuti Baru</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOvertimeModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Ajukan Lembur Baru</span>
          </button>
        )}
      </div>

      {/* Filter by Status */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-komazi-muted font-medium">Filter Status:</span>
        {STATUS_OPTIONS.map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => {
              setStatusFilter(st.id);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
              statusFilter === st.id
                ? 'bg-komazi-coral text-white'
                : 'bg-komazi-surface-2 text-komazi-muted hover:text-komazi-text'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: CUTI & IZIN
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'leaves' && (
        <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
                <tr>
                  <th className="py-3 px-4">Pegawai</th>
                  <th className="py-3 px-4">Tipe Cuti</th>
                  <th className="py-3 px-4">Rentang Tanggal</th>
                  <th className="py-3 px-4">Durasi</th>
                  <th className="py-3 px-4">Alasan</th>
                  <th className="py-3 px-4">Status &amp; Peninjau</th>
                  <th className="py-3 px-4 text-right">Aksi / Keputusan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-komazi-border">
                {paginatedLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-komazi-muted">
                      <CalendarOff className="w-8 h-8 mx-auto opacity-30 mb-2" />
                      <p>Tidak ada permohonan cuti</p>
                    </td>
                  </tr>
                ) : (
                  paginatedLeaves.map((item) => {
                    const isSelf = currentUser?.id === item.userId;
                    return (
                      <tr key={item.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-komazi-text">{item.user?.name}</div>
                          <div className="text-[10px] text-komazi-muted">@{item.user?.username}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-komazi-surface-2 text-komazi-text border border-komazi-border text-[10px] font-bold">
                            {item.type === 'ANNUAL'
                              ? 'Cuti Tahunan'
                              : item.type === 'SICK'
                              ? 'Izin Sakit'
                              : item.type === 'EMERGENCY'
                              ? 'Keperluan Mendesak'
                              : item.type === 'UNPAID'
                              ? 'Cuti Tanpa Gaji'
                              : item.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-komazi-text">
                          {item.startDate} s/d {item.endDate}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-komazi-coral">{item.days} Hari</td>
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
                            {item.approvedBy && (
                              <span className="text-[10px] text-komazi-muted">Oleh: {item.approvedBy.name}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {item.status === 'PENDING' ? (
                            isSelf ? (
                              <button
                                type="button"
                                onClick={() => onDeleteLeave(item.id)}
                                className="px-2.5 py-1 rounded-lg bg-neutral-800 text-rose-400 hover:bg-neutral-700 text-[11px] font-bold"
                              >
                                Batalkan Tiket
                              </button>
                            ) : isManagerOrOwner ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onUpdateLeaveStatus(item.id, { status: 'APPROVED' })}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[11px] border border-emerald-500/30 transition-all"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onUpdateLeaveStatus(item.id, { status: 'REJECTED' })}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-[11px] border border-rose-500/30 transition-all"
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : null
                          ) : (
                            <span className="text-[10px] text-komazi-muted">Selesai</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredLeaves.length > 0 && (
            <div className="p-3 border-t border-komazi-border">
              <Pagination
                currentPage={page}
                totalItems={filteredLeaves.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={(newLimit) => {
                  setPerPage(newLimit);
                  setPage(1);
                }}
                itemLabel="cuti"
              />
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: LEMBUR (OVERTIME)
         ───────────────────────────────────────────────────────────── */}
      {subTab === 'overtime' && (
        <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
                <tr>
                  <th className="py-3 px-4">Pegawai</th>
                  <th className="py-3 px-4">Tanggal Lembur</th>
                  <th className="py-3 px-4">Durasi Jam</th>
                  <th className="py-3 px-4">Alasan Lembur</th>
                  <th className="py-3 px-4">Status &amp; Peninjau</th>
                  {isManagerOrOwner && <th className="py-3 px-4 text-right">Keputusan</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-komazi-border">
                {paginatedOvertimes.length === 0 ? (
                  <tr>
                    <td colSpan={isManagerOrOwner ? 6 : 5} className="py-12 text-center text-komazi-muted">
                      <TrendingUp className="w-8 h-8 mx-auto opacity-30 mb-2" />
                      <p>Tidak ada pengajuan lembur</p>
                    </td>
                  </tr>
                ) : (
                  paginatedOvertimes.map((item) => {
                    const isSelf = currentUser?.id === item.userId;
                    return (
                      <tr key={item.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-komazi-text">{item.user?.name}</div>
                          <div className="text-[10px] text-komazi-muted">@{item.user?.username}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-komazi-text">{item.date}</td>
                        <td className="py-3.5 px-4 font-bold text-amber-400">{item.durationHours} Jam</td>
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
                            {item.approvedBy && (
                              <span className="text-[10px] text-komazi-muted">Oleh: {item.approvedBy.name}</span>
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
                                    onClick={() => onReviewOvertime(item.id, { status: 'APPROVED' })}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[11px] border border-emerald-500/30 transition-all"
                                  >
                                    Setujui
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onReviewOvertime(item.id, { status: 'REJECTED' })}
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

          {filteredOvertimes.length > 0 && (
            <div className="p-3 border-t border-komazi-border">
              <Pagination
                currentPage={page}
                totalItems={filteredOvertimes.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={(newLimit) => {
                  setPerPage(newLimit);
                  setPage(1);
                }}
                itemLabel="lembur"
              />
            </div>
          )}
        </div>
      )}

      {/* Leave Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-komazi-coral" />
                <span>Formulir Pengajuan Cuti / Izin</span>
              </h3>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Tipe Izin / Cuti *</label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                >
                  <option value="ANNUAL">Cuti Tahunan</option>
                  <option value="SICK">Izin Sakit</option>
                  <option value="EMERGENCY">Keperluan Mendesak</option>
                  <option value="UNPAID">Cuti Tanpa Gaji</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Jumlah Hari Kerja</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  required
                  value={leaveForm.days}
                  onChange={(e) => setLeaveForm({ ...leaveForm, days: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Alasan Pengajuan *</label>
                <textarea
                  required
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Keterangan keperluan cuti..."
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral text-white text-xs font-bold shadow-md"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Overtime Modal */}
      {isOvertimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-komazi-coral" />
                <span>Formulir Pengajuan Lembur</span>
              </h3>
            </div>

            <form onSubmit={handleOvertimeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Tanggal Lembur *</label>
                <input
                  type="date"
                  required
                  value={overtimeForm.date}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Durasi Lembur (Jam) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  required
                  value={overtimeForm.durationHours}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, durationHours: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Alasan Lembur *</label>
                <textarea
                  required
                  rows={3}
                  value={overtimeForm.reason}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, reason: e.target.value })}
                  placeholder="Keterangan tugas lembur (contoh: Penutupan inventaris akhir pekan)..."
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsOvertimeModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral text-white text-xs font-bold shadow-md"
                >
                  Kirim Pengajuan Lembur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
