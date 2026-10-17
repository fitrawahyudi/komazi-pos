import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Search,
  X,
  Check,
  CalendarCheck,
  ShieldAlert,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';

export default function HrisScheduleTab({
  scheduleList = [],
  staffList = [],
  currentUser,
  isManagerOrOwner,
  onCreateSchedule,
  onDeleteSchedule,
}) {
  const [selectedDate, setSelectedDate] = useState('');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    date: new Date().toISOString().split('T')[0],
    shiftPreset: 'PAGI',
    shiftName: 'PAGI',
    startTime: '07:00',
    endTime: '15:00',
    notes: '',
  });

  const SHIFT_PRESETS = [
    { id: 'PAGI', label: 'Sif Pagi (07:00 - 15:00)', start: '07:00', end: '15:00' },
    { id: 'SIANG', label: 'Sif Siang (12:00 - 20:00)', start: '12:00', end: '20:00' },
    { id: 'MALAM', label: 'Sif Malam (15:00 - 23:00)', start: '15:00', end: '23:00' },
    { id: 'FULL_DAY', label: 'Sehari Penuh (08:00 - 21:00)', start: '08:00', end: '21:00' },
    { id: 'CUSTOM', label: 'Sif Khusus', start: '', end: '' },
  ];

  const handlePresetChange = (presetId) => {
    const preset = SHIFT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    if (preset.id === 'CUSTOM') {
      setForm((prev) => ({
        ...prev,
        shiftPreset: 'CUSTOM',
        shiftName: 'CUSTOM',
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        shiftPreset: preset.id,
        shiftName: preset.id,
        startTime: preset.start,
        endTime: preset.end,
      }));
    }
  };

  const filteredSchedules = useMemo(() => {
    return scheduleList.filter((s) => {
      const matchDate = !selectedDate || s.date === selectedDate;
      const matchStaff = staffFilter === 'ALL' || s.userId === Number(staffFilter);
      return matchDate && matchStaff;
    });
  }, [scheduleList, selectedDate, staffFilter]);

  const paginatedSchedules = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredSchedules.slice(start, start + perPage);
  }, [filteredSchedules, page, perPage]);

  // Conflict detection warning in UI
  const hasConflict = useMemo(() => {
    if (!form.userId || !form.date || !form.startTime || !form.endTime) return false;
    return scheduleList.some((s) => {
      if (s.userId !== Number(form.userId) || s.date !== form.date) return false;
      return form.startTime <= s.endTime && form.endTime >= s.startTime;
    });
  }, [form, scheduleList]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.userId) return;
    const ok = await onCreateSchedule({
      userId: Number(form.userId),
      date: form.date,
      shiftName: form.shiftName,
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes,
    });
    if (ok) {
      setIsModalOpen(false);
    }
  };

  const formatRoleName = (role) => {
    if (role === 'OWNER') return 'Pemilik';
    if (role === 'MANAGER') return 'Manajer';
    if (role === 'CASHIER') return 'Kasir';
    if (role === 'BARISTA') return 'Barista';
    if (role === 'KITCHEN') return 'Dapur';
    return role;
  };

  const formatShiftDisplayName = (shiftName) => {
    if (shiftName === 'PAGI') return 'Sif Pagi';
    if (shiftName === 'SIANG') return 'Sif Siang';
    if (shiftName === 'MALAM') return 'Sif Malam';
    if (shiftName === 'FULL_DAY') return 'Sehari Penuh';
    if (shiftName === 'CUSTOM') return 'Sif Khusus';
    return shiftName;
  };

  const { settings, updateSettings } = useSettingsStore();
  const isScheduleEnforced = settings?.enforceScheduleGuard === 'true' || settings?.enforceScheduleGuard === true;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Banner Status Validasi Jadwal Kerja (Schedule Guard) */}
      {isManagerOrOwner && (
        <div className="p-3.5 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isScheduleEnforced ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
            }`}>
              <CalendarCheck className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-komazi-text">Aturan Jadwal &amp; Presensi Kasir</span>
              </div>
              <p className="text-[11px] text-komazi-muted mt-0.5">
                {isScheduleEnforced
                  ? 'Mode Ketat: Staf wajib memiliki jadwal terdaftar hari ini DAN wajib presensi sebelum dapat bertransaksi.'
                  : 'Mode Fleksibel: Staf dapat presensi tanpa jadwal harian, namun tetap wajib presensi sebelum dapat membuka kasir atau bertransaksi.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-[11px] font-semibold text-komazi-muted">Kunci Jadwal:</span>
              <div className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(isScheduleEnforced)}
                  onChange={(e) => {
                    const val = e.target.checked;
                    updateSettings({ enforceScheduleGuard: val });
                    toast.success(
                      val
                        ? 'Validasi jadwal diaktifkan: Staf wajib memiliki jadwal terdaftar hari ini & melakukan presensi.'
                        : 'Mode Fleksibel diaktifkan: Staf dapat presensi tanpa jadwal, namun tetap wajib presensi sebelum bertransaksi.'
                    );
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-komazi-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-komazi-coral"></div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
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
              onClick={() => setSelectedDate('')}
              className="px-2.5 py-1 rounded-xl bg-komazi-surface-2 text-komazi-muted text-[11px] hover:text-white"
            >
              Semua Tanggal
            </button>
          )}

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
                  {s.name} ({formatRoleName(s.role)})
                </option>
              ))}
            </select>
          )}
        </div>

        {isManagerOrOwner && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Jadwal Giliran Kerja</span>
          </button>
        )}
      </div>

      {/* Schedules Table */}
      <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold">
              <tr>
                <th className="py-3 px-4">Pegawai</th>
                <th className="py-3 px-4">Tanggal Giliran Kerja</th>
                <th className="py-3 px-4">Nama Sif</th>
                <th className="py-3 px-4">Jam Kerja</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Catatan</th>
                {isManagerOrOwner && <th className="py-3 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border">
              {paginatedSchedules.length === 0 ? (
                <tr>
                  <td colSpan={isManagerOrOwner ? 7 : 6} className="py-12 text-center text-komazi-muted">
                    <Calendar className="w-8 h-8 mx-auto opacity-30 mb-2" />
                    <p>Belum ada jadwal kerja yang ditugaskan</p>
                  </td>
                </tr>
              ) : (
                paginatedSchedules.map((item) => (
                  <tr key={item.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-komazi-text">{item.user?.name}</div>
                      <div className="text-[10px] text-komazi-muted">
                        @{item.user?.username} • {formatRoleName(item.user?.role)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-komazi-text">{item.date}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 text-[10px] font-bold">
                        {formatShiftDisplayName(item.shiftName)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-komazi-text">
                      {item.startTime} — {item.endTime}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                        {item.status === 'PUBLISHED' ? 'Diterbitkan' : item.status || 'Diterbitkan'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-komazi-muted italic">{item.notes || '—'}</td>
                    {isManagerOrOwner && (
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteSchedule(item.id)}
                          title="Hapus jadwal"
                          className="p-1 rounded-lg text-komazi-muted hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredSchedules.length > 0 && (
          <div className="p-3 border-t border-komazi-border">
            <Pagination
              currentPage={page}
              totalItems={filteredSchedules.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setPerPage(newLimit);
                setPage(1);
              }}
              itemLabel="jadwal"
            />
          </div>
        )}
      </div>

      {/* Add Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-komazi-coral" />
                <span>Tambah Penugasan Giliran Kerja</span>
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Pilih Staf *</label>
                <select
                  required
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                >
                  <option value="">-- Pilih Staf --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatRoleName(s.role)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Tanggal Giliran Kerja *</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                />
              </div>

              {/* Preset Selection */}
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5">Pilihan Cepat Sif</label>
                <div className="grid grid-cols-2 gap-2">
                  {SHIFT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetChange(p.id)}
                      className={`p-2 rounded-xl text-left border text-xs font-semibold transition-all ${
                        form.shiftPreset === p.id
                          ? 'bg-komazi-coral/15 border-komazi-coral text-komazi-coral'
                          : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:border-komazi-muted'
                      }`}
                    >
                      <div>{p.label.split(' (')[0]}</div>
                      {p.start && <div className="text-[10px] opacity-70">{p.start} - {p.end}</div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral font-mono"
                  />
                </div>
              </div>

              {/* Conflict Detection Notice */}
              {hasConflict && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Peringatan: Jadwal bentrok terdeteksi dengan giliran kerja yang sudah ada untuk staf ini.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Contoh: Barista pembuka / Penutupan dapur"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={hasConflict}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
