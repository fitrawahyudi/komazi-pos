import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  History,
  Filter,
  Search,
  Calendar,
  User,
  UserPlus,
  UserCheck,
  UserX,
  Users,
  Clock,
  Trash2,
  FileText,
  FileEdit,
  CheckCircle2,
  XCircle,
  CalendarOff,
  CalendarX,
  Ban,
  Wallet,
  Calculator,
  CheckCheck,
  Send,
  RefreshCw,
  Download,
  Info,
  ArrowRight,
  Eye,
  X,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { formatDateTime, formatRupiah } from '../../utils/format';

// Konfigurasi tindakan bisnis yang ramah pengguna
const ACTION_CONFIG = {
  STAFF_CREATE: {
    label: 'Tambah Karyawan Baru',
    icon: UserPlus,
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  STAFF_UPDATE: {
    label: 'Perbarui Data Karyawan',
    icon: UserCheck,
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
  STAFF_DEACTIVATE: {
    label: 'Nonaktifkan Karyawan',
    icon: UserX,
    badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
  STAFF_BULK_CREATE: {
    label: 'Import Massal Karyawan',
    icon: Users,
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  ATTENDANCE_MANUAL_ENTRY: {
    label: 'Input Presensi Manual',
    icon: Clock,
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  ATTENDANCE_DELETE: {
    label: 'Hapus Catatan Presensi',
    icon: Trash2,
    badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
  CORRECTION_REQUEST: {
    label: 'Pengajuan Koreksi Presensi',
    icon: FileText,
    badgeColor: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  },
  CORRECTION_APPROVED: {
    label: 'Koreksi Presensi Disetujui',
    icon: CheckCircle2,
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  CORRECTION_REJECTED: {
    label: 'Koreksi Presensi Ditolak',
    icon: XCircle,
    badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
  SCHEDULE_CREATE: {
    label: 'Penetapan Jadwal Shift',
    icon: Calendar,
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
  SCHEDULE_DELETE: {
    label: 'Penghapusan Jadwal Shift',
    icon: CalendarX,
    badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
  LEAVE_REQUEST: {
    label: 'Pengajuan Cuti / Izin',
    icon: CalendarOff,
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  LEAVE_APPROVED: {
    label: 'Persetujuan Cuti / Izin',
    icon: CheckCircle2,
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  LEAVE_REJECTED: {
    label: 'Penolakan Cuti / Izin',
    icon: XCircle,
    badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
  LEAVE_CANCEL: {
    label: 'Pembatalan Cuti',
    icon: Ban,
    badgeColor: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30',
  },
  OVERTIME_REQUEST: {
    label: 'Pengajuan Jam Lembur',
    icon: Clock,
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
  OVERTIME_APPROVED: {
    label: 'Persetujuan Jam Lembur',
    icon: CheckCircle2,
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  OVERTIME_REJECTED: {
    label: 'Penolakan Jam Lembur',
    icon: XCircle,
    badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
  PAYROLL_PERIOD_CREATE: {
    label: 'Pembukaan Periode Penggajian',
    icon: Wallet,
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  },
  PAYROLL_CALCULATE: {
    label: 'Kalkulasi Gaji Karyawan',
    icon: Calculator,
    badgeColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
  },
  PAYROLL_FINALIZE: {
    label: 'Finalisasi Periode Gaji',
    icon: CheckCheck,
    badgeColor: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  },
  PAYROLL_PUBLISH: {
    label: 'Penerbitan Slip Gaji',
    icon: Send,
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
};

// Konfigurasi modul / entitas
const ENTITY_CONFIG = {
  STAFF: { label: 'Karyawan', icon: User, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  ATTENDANCE: { label: 'Presensi', icon: Clock, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  CORRECTION: { label: 'Koreksi Presensi', icon: FileEdit, color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  SCHEDULE: { label: 'Jadwal Shift', icon: Calendar, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  LEAVE: { label: 'Cuti & Izin', icon: CalendarOff, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  OVERTIME: { label: 'Lembur', icon: Clock, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
  PAYROLL: { label: 'Penggajian', icon: Wallet, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
};

// Peran pengguna
const ROLE_LABELS = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  CASHIER: 'Kasir',
  KITCHEN: 'Kitchen',
  STAFF: 'Karyawan',
};

// Helper penerjemah rincian JSON teknis menjadi kalimat bahasa Indonesia
function formatAuditDetails(rawDetails) {
  if (!rawDetails) return 'Tindakan berhasil diproses dan dicatat';

  let data = rawDetails;
  if (typeof rawDetails === 'string') {
    try {
      data = JSON.parse(rawDetails);
    } catch {
      return rawDetails;
    }
  }

  if (typeof data !== 'object' || data === null) {
    return String(data);
  }

  const items = [];

  if (data.totalPayout !== undefined) {
    items.push(`Total Pembayaran: ${formatRupiah(data.totalPayout)}`);
  }
  if (data.name) {
    items.push(`"${data.name}"`);
  }
  if (data.username && data.role) {
    items.push(`Akun: @${data.username} (${ROLE_LABELS[data.role] || data.role})`);
  } else if (data.username) {
    items.push(`Akun: @${data.username}`);
  }
  if (data.createdCount !== undefined) {
    items.push(`${data.createdCount} karyawan ditambahkan${data.skippedCount ? `, ${data.skippedCount} dilewati` : ''}`);
  }
  if (data.startDate && data.endDate) {
    const typeLabel = { ANNUAL: 'Cuti Tahunan', SICK: 'Sakit', SPECIAL: 'Izin Khusus' }[data.type] || data.type || '';
    items.push(`Periode: ${data.startDate} s/d ${data.endDate}${typeLabel ? ` (${typeLabel})` : ''}`);
  }
  if (data.date && data.shiftName) {
    items.push(`Shift ${data.shiftName} (${data.date})`);
  } else if (data.date && data.reason) {
    items.push(`Tanggal ${data.date} — "${data.reason}"`);
  } else if (data.date) {
    items.push(`Tanggal: ${data.date}`);
  }
  if (data.durationHours !== undefined) {
    items.push(`Durasi: ${data.durationHours} Jam`);
  }
  if (data.reason && !items.some((i) => i.includes(data.reason))) {
    items.push(`Alasan: "${data.reason}"`);
  }
  if (data.status) {
    const statusLabel =
      { APPROVED: 'Disetujui', REJECTED: 'Ditolak', PENDING: 'Menunggu', CANCELLED: 'Dibatalkan' }[data.status] ||
      data.status;
    items.push(`Status: ${statusLabel}`);
  }

  if (items.length === 0) {
    const keys = Object.keys(data);
    if (keys.length > 0) {
      return `Pembaruan data (${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''})`;
    }
    return 'Tindakan berhasil diproses';
  }

  return items.join(' • ');
}

export default function HrisAuditTab({ auditLogs = [], onRefresh }) {
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Manual refresh handler with spin animation
  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  // Ringkasan KPI audit
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = auditLogs.filter((log) => {
      try {
        return new Date(log.createdAt).toISOString().split('T')[0] === todayStr;
      } catch {
        return false;
      }
    }).length;

    const uniqueUsers = new Set(auditLogs.map((l) => l.userId || l.user?.id).filter(Boolean)).size;

    return {
      total: auditLogs.length,
      today: todayCount,
      users: uniqueUsers,
    };
  }, [auditLogs]);

  // Tab filter data & counts
  const filterTabs = useMemo(() => {
    const counts = {
      ALL: auditLogs.length,
      STAFF: 0,
      ATTENDANCE: 0,
      LEAVE: 0,
      OVERTIME: 0,
      PAYROLL: 0,
    };

    auditLogs.forEach((l) => {
      if (counts[l.entityType] !== undefined) {
        counts[l.entityType]++;
      }
    });

    return [
      { id: 'ALL', label: 'Semua Aktivitas', count: counts.ALL },
      { id: 'STAFF', label: 'Karyawan', count: counts.STAFF },
      { id: 'ATTENDANCE', label: 'Presensi', count: counts.ATTENDANCE },
      { id: 'LEAVE', label: 'Cuti & Izin', count: counts.LEAVE },
      { id: 'OVERTIME', label: 'Lembur', count: counts.OVERTIME },
      { id: 'PAYROLL', label: 'Penggajian', count: counts.PAYROLL },
    ];
  }, [auditLogs]);

  // Filter logs berdasarkan tab dan pencarian
  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return auditLogs.filter((log) => {
      const matchEntity = entityFilter === 'ALL' || log.entityType === entityFilter;
      if (!matchEntity) return false;

      if (!q) return true;

      const actionText = ACTION_CONFIG[log.action]?.label?.toLowerCase() || log.action?.toLowerCase() || '';
      const userName = log.user?.name?.toLowerCase() || '';
      const userRole = log.user?.role?.toLowerCase() || '';
      const details = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || '').toLowerCase();
      const entityLabel = ENTITY_CONFIG[log.entityType]?.label?.toLowerCase() || '';

      return (
        actionText.includes(q) ||
        userName.includes(q) ||
        userRole.includes(q) ||
        details.includes(q) ||
        entityLabel.includes(q)
      );
    });
  }, [auditLogs, entityFilter, search]);

  // Pagination slice
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredLogs.slice(start, start + perPage);
  }, [filteredLogs, page, perPage]);

  // Ekspor audit log ke file CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Waktu', 'Pengguna', 'Peran', 'Aktivitas', 'Modul', 'Rincian'];
    const rows = filteredLogs.map((log) => [
      formatDateTime(log.createdAt),
      log.user?.name || `Staf #${log.userId}`,
      ROLE_LABELS[log.user?.role] || log.user?.role || '-',
      ACTION_CONFIG[log.action]?.label || log.action,
      ENTITY_CONFIG[log.entityType]?.label || log.entityType,
      formatAuditDetails(log.details).replace(/"/g, '""'),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_aktivitas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header Informasi & Rekap KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-komazi-muted uppercase tracking-wider">Total Riwayat</p>
            <p className="text-2xl font-black text-komazi-text mt-0.5">{stats.total.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-komazi-muted mt-0.5">Catatan aktivitas terekam</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-komazi-muted uppercase tracking-wider">Aktivitas Hari Ini</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{stats.today.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-komazi-muted mt-0.5">Operasional berlangsung hari ini</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-komazi-muted uppercase tracking-wider">Petugas Terlibat</p>
            <p className="text-2xl font-black text-sky-400 mt-0.5">{stats.users.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-komazi-muted mt-0.5">Akun staf berwenang aktif</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Control Toolbar: Filter Tabs, Search & Action Buttons */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-komazi-text flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-komazi-coral" />
              <span>Riwayat Aktivitas &amp; Audit Operasional</span>
            </h3>
            <p className="text-xs text-komazi-muted mt-0.5">
              Rekam jejak tindakan pendaftaran staf, perizinan cuti, lembur, dan pembayaran gaji
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text border border-komazi-border text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              title="Perbarui daftar aktivitas"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-komazi-teal-light ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
              title="Unduh rekam jejak audit ke format file CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-komazi-border/60 pt-3">
          {filterTabs.map((tab) => {
            const active = entityFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setEntityFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border active:scale-95 ${
                  active
                    ? 'bg-komazi-coral text-white border-komazi-coral shadow-sm shadow-komazi-coral/20'
                    : 'bg-komazi-surface-2 text-komazi-muted border-komazi-border hover:text-komazi-text hover:bg-komazi-border/50'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    active ? 'bg-black/20 text-white' : 'bg-komazi-surface-3 text-komazi-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-komazi-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama petugas, jenis tindakan, atau rincian keterangan..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text placeholder-komazi-muted focus:border-komazi-coral focus:outline-none transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-komazi-muted hover:text-komazi-text p-0.5"
              title="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Table Rekam Jejak Aktivitas */}
      <div className="rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-komazi-surface-2 border-b border-komazi-border text-komazi-muted font-bold tracking-wider uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Waktu &amp; Tanggal</th>
                <th className="py-3 px-4">Petugas Pelaksana</th>
                <th className="py-3 px-4">Aktivitas</th>
                <th className="py-3 px-4">Modul</th>
                <th className="py-3 px-4">Ringkasan Keterangan</th>
                <th className="py-3 px-4 text-center w-24">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-komazi-border">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-komazi-muted">
                    <History className="w-10 h-10 mx-auto text-komazi-muted/40 mb-2.5" />
                    <p className="font-bold text-sm text-komazi-text">Tidak ada rekam aktivitas yang cocok</p>
                    <p className="text-xs text-komazi-muted mt-1 max-w-sm mx-auto">
                      {search || entityFilter !== 'ALL'
                        ? 'Coba sesuaikan kata kunci pencarian atau pilih filter modul yang lain.'
                        : 'Seluruh tindakan penting operasional staf akan otomatis tercatat dan tersimpan rapi di sini.'}
                    </p>
                    {(search || entityFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('');
                          setEntityFilter('ALL');
                          setPage(1);
                        }}
                        className="mt-3.5 px-3 py-1.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-xs text-komazi-coral font-bold border border-komazi-border transition-colors"
                      >
                        Reset Filter &amp; Pencarian
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action] || {
                    label: log.action.replace(/_/g, ' '),
                    icon: Info,
                    badgeColor: 'text-neutral-300 bg-neutral-500/10 border-neutral-500/30',
                  };
                  const ActionIcon = actionCfg.icon;

                  const entityCfg = ENTITY_CONFIG[log.entityType] || {
                    label: log.entityType,
                    icon: Layers,
                    color: 'text-neutral-300 bg-neutral-500/10 border-neutral-500/30',
                  };
                  const EntityIcon = entityCfg.icon;

                  const userName = log.user?.name || `Staf #${log.userId}`;
                  const userRole = ROLE_LABELS[log.user?.role] || log.user?.role || 'Karyawan';
                  const summaryText = formatAuditDetails(log.details);

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-komazi-surface-2/60 transition-colors cursor-pointer group"
                    >
                      {/* 1. Waktu & Tanggal */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-komazi-text">
                          {new Date(log.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-komazi-muted mt-0.5 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 inline text-komazi-muted" />
                          <span>
                            {new Date(log.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            WIB
                          </span>
                        </div>
                      </td>

                      {/* 2. Petugas Pelaksana */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-komazi-surface-2 border border-komazi-border text-komazi-coral flex items-center justify-center font-bold text-xs shrink-0 group-hover:border-komazi-coral/40 transition-colors">
                            {userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-komazi-text truncate group-hover:text-komazi-coral transition-colors">
                              {userName}
                            </p>
                            <span className="inline-block text-[10px] font-semibold text-komazi-muted px-1.5 py-0.2 rounded bg-komazi-surface-2 border border-komazi-border/60 mt-0.5">
                              {userRole}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Aktivitas */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${actionCfg.badgeColor}`}
                        >
                          <ActionIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{actionCfg.label}</span>
                        </span>
                      </td>

                      {/* 4. Modul */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${entityCfg.color}`}
                        >
                          <EntityIcon className="w-3 h-3" />
                          <span>{entityCfg.label}</span>
                        </span>
                      </td>

                      {/* 5. Ringkasan Keterangan */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <p className="text-komazi-text truncate font-normal" title={summaryText}>
                          {summaryText}
                        </p>
                      </td>

                      {/* 6. Aksi Detail */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-coral hover:bg-komazi-coral/10 border border-komazi-border transition-all active:scale-95 inline-flex items-center justify-center"
                          title="Lihat rincian lengkap aktivitas"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredLogs.length > 0 && (
          <div className="p-3 border-t border-komazi-border bg-komazi-surface">
            <Pagination
              currentPage={page}
              totalItems={filteredLogs.length}
              itemsPerPage={perPage}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setPerPage(newLimit);
                setPage(1);
              }}
              itemLabel="catatan aktivitas"
            />
          </div>
        )}
      </div>

      {/* 4. Modal Detail Aktivitas Audit */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-komazi-border bg-komazi-surface-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-komazi-text">Rincian Audit Aktivitas</h4>
                  <p className="text-[11px] text-komazi-muted">Catatan autentik kepatuhan dan rekam jejak operasional</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface transition-colors"
                title="Tutup dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Konten Modal */}
            <div className="p-5 space-y-4 text-xs">
              {/* Box Petugas & Waktu */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                <div>
                  <p className="text-[10px] uppercase font-bold text-komazi-muted">Waktu Pencatatan</p>
                  <p className="font-bold text-komazi-text mt-0.5">{formatDateTime(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-komazi-muted">Petugas Pelaksana</p>
                  <p className="font-bold text-komazi-text mt-0.5">
                    {selectedLog.user?.name || `Staf #${selectedLog.userId}`}
                  </p>
                  <p className="text-[10px] text-komazi-muted">
                    {ROLE_LABELS[selectedLog.user?.role] || selectedLog.user?.role || 'Karyawan'}
                  </p>
                </div>
              </div>

              {/* Status Tindakan */}
              <div>
                <p className="text-[10px] uppercase font-bold text-komazi-muted mb-1.5">Tindakan Operasional</p>
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30">
                      <Activity className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-bold text-komazi-text">
                        {ACTION_CONFIG[selectedLog.action]?.label || selectedLog.action}
                      </p>
                      <p className="text-[11px] text-komazi-muted">
                        Modul: {ENTITY_CONFIG[selectedLog.entityType]?.label || selectedLog.entityType}
                      </p>
                    </div>
                  </div>
                  {selectedLog.entityId && (
                    <span className="px-2 py-1 rounded-lg bg-komazi-surface text-[10px] font-mono text-komazi-muted border border-komazi-border">
                      ID #{selectedLog.entityId}
                    </span>
                  )}
                </div>
              </div>

              {/* Rincian Perubahan Data */}
              <div>
                <p className="text-[10px] uppercase font-bold text-komazi-muted mb-1.5">Rincian Perubahan Data</p>
                <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                  <p className="text-komazi-text font-medium leading-relaxed">
                    {formatAuditDetails(selectedLog.details)}
                  </p>
                </div>
              </div>

              {/* Catatan Jaringan & Keamanan */}
              <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border/80 text-[11px] text-komazi-muted flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-komazi-muted shrink-0" />
                  <span>Jaringan / Sumber Akses:</span>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-komazi-surface-2 border border-komazi-border text-komazi-text">
                  {selectedLog.ipAddress && selectedLog.ipAddress !== '::1' && selectedLog.ipAddress !== '127.0.0.1'
                    ? selectedLog.ipAddress
                    : 'Koneksi Lokal Kasir / Server'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
