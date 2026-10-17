import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { toast } from '../../store/toastStore';
import { formatDateTime } from '../../utils/format';
import {
  Database,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileCheck,
  Lock,
  HardDrive,
  Copy,
  Check,
  Play,
  Layers,
  Archive,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import Pagination from '../ui/Pagination';

export default function BackupRecoveryCard() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modal States
  const [detailModalRecord, setDetailModalRecord] = useState(null);
  const [testRestoreModalData, setTestRestoreModalData] = useState(null);
  const [isTestingRestore, setIsTestingRestore] = useState(false);

  const [restoreTargetRecord, setRestoreTargetRecord] = useState(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  const [copiedChecksum, setCopiedChecksum] = useState(null);

  // Fetch summary data
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.backup.getSummary();
      if (res && res.success) {
        setSummary(res.data);
      } else if (res && !res.success && res.message) {
        console.warn('[BackupCard] Error loading summary:', res.message);
      }
    } catch (err) {
      console.warn('[BackupCard] Error loading summary:', err);
    }
  }, []);

  // Fetch history list
  const loadHistory = useCallback(
    async (page = 1) => {
      try {
        setIsLoading(true);
        const params = { page, limit: pagination.limit };
        if (statusFilter !== 'ALL') params.status = statusFilter;
        if (typeFilter !== 'ALL') params.backupType = typeFilter;

        const res = await api.backup.getHistory(params);
        if (res && res.success) {
          setHistory(Array.isArray(res.data) ? res.data : []);
          if (res.meta) {
            setPagination(res.meta);
          }
        } else {
          setHistory([]);
          if (res?.message) {
            toast.error(res.message);
          }
        }
      } catch (err) {
        toast.error('Gagal memuat riwayat backup: ' + (err?.message || 'Terjadi kesalahan sistem'));
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.limit, statusFilter, typeFilter]
  );

  useEffect(() => {
    loadSummary();
    loadHistory(1);
  }, [loadSummary, loadHistory]);

  // Handle Trigger Manual Backup
  const handleTriggerBackup = async () => {
    if (isBackingUp) return;
    try {
      setIsBackingUp(true);
      toast.info('Membuat cadangan data baru...');
      const res = await api.backup.triggerManual({
        retentionCategory: 'MANUAL',
        isProtected: false,
      });

      if (res && res.success) {
        toast.success('Cadangan data berhasil dibuat dan tersimpan aman!');
        loadSummary();
        loadHistory(1);
      } else {
        toast.error(res?.message || 'Gagal membuat cadangan data.');
      }
    } catch (err) {
      toast.error('Gagal mencadangkan database: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handle Verify Integrity
  const handleVerify = async (record) => {
    try {
      toast.info(`Memeriksa keamanan file cadangan #${record.id}...`);
      const res = await api.backup.verifyIntegrity(record.id);
      if (res && res.success) {
        toast.success('Pemeriksaan berhasil: File cadangan aman dan utuh!');
        loadHistory(pagination.page);
        loadSummary();
      } else {
        toast.error(res?.message || 'Pemeriksaan file gagal.');
      }
    } catch (err) {
      toast.error('Gagal verifikasi: ' + err.message);
    }
  };

  // Handle Dry-run Test Restore
  const handleTestRestore = async (record) => {
    try {
      setIsTestingRestore(true);
      toast.info('Sedang menguji file cadangan...');
      const res = await api.backup.testRestore(record.id);
      if (res && res.success) {
        setTestRestoreModalData(res.data);
      } else {
        toast.error(res?.message || 'Uji coba pemulihan gagal.');
      }
    } catch (err) {
      toast.error('Uji coba pemulihan gagal: ' + err.message);
    } finally {
      setIsTestingRestore(false);
    }
  };

  // Handle Execute Controlled Restore
  const handleExecuteRestoreSubmit = async (e) => {
    e.preventDefault();
    if (confirmationPhrase !== 'RESTORE-DATABASE') {
      toast.error("Kata konfirmasi belum sesuai. Harap ketik 'RESTORE-DATABASE'.");
      return;
    }

    try {
      setIsRestoring(true);
      toast.info('Menyimpan cadangan pengaman & memulihkan data...');
      const res = await api.backup.executeRestore(restoreTargetRecord.id, confirmationPhrase);

      if (res && res.success) {
        toast.success('Data toko berhasil dipulihkan!');
        setRestoreTargetRecord(null);
        setConfirmationPhrase('');
        loadSummary();
        loadHistory(1);
      } else {
        toast.error(res?.message || 'Pemulihan data belum berhasil.');
      }
    } catch (err) {
      toast.error('Pemulihan belum berhasil: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Handle Copy Checksum
  const handleCopyChecksum = (hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedChecksum(hash);
    setTimeout(() => setCopiedChecksum(null), 2000);
    toast.success('Kode keamanan berhasil disalin');
  };

  // Format File Size
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 animate-fadeIn select-none">
      {/* 1. Header & Summary Grid */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center shrink-0 shadow-inner">
            <Database className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <p className="text-xs text-komazi-muted mt-0.5">
              Salinan data penjualan, menu, dan stok tersimpan otomatis agar toko Anda selalu aman.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              loadSummary();
              loadHistory(pagination.page);
            }}
            className="p-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-white transition-all text-xs font-bold flex items-center gap-1.5"
            title="Muat Ulang Status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleTriggerBackup}
            disabled={isBackingUp}
            className="px-4 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-komazi-coral/25 transition-all active:scale-95 disabled:opacity-50"
          >
            {isBackingUp ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Mencadangkan...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Cadangkan Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Backup Terakhir */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border space-y-2">
          <div className="flex items-center justify-between text-komazi-muted text-xs font-semibold">
            <span>Backup Terakhir</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-komazi-text truncate">
              {summary?.lastSuccess
                ? formatDateTime(summary.lastSuccess.finishedAt || summary.lastSuccess.startedAt)
                : 'Belum ada data'}
            </p>
            <p className="text-[11px] text-komazi-muted mt-0.5">
              {summary?.lastSuccess
                ? `${formatBytes(summary.lastSuccess.fileSizeBytes)} • ${summary.lastSuccess.tablesCount} Tabel`
                : 'Pencadangan belum pernah dieksekusi'}
            </p>
          </div>
          <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Terverifikasi Round-Trip</span>
          </div>
        </div>

        {/* Card 2: Jadwal Otomatis */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border space-y-2">
          <div className="flex items-center justify-between text-komazi-muted text-xs font-semibold">
            <span>Jadwal Otomatis</span>
            <Clock className="w-4 h-4 text-komazi-coral" />
          </div>
          <div>
            <p className="text-sm font-bold text-komazi-text">Setiap Hari 02:00 WIB</p>
            <p className="text-[11px] text-komazi-muted mt-0.5">
              UTC: 19:00 (H-1) • Cron: <code>0 19 * * *</code>
            </p>
          </div>
          <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Scheduler Backend Aktif</span>
          </div>
        </div>

        {/* Card 3: Keamanan & Enkripsi */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border space-y-2">
          <div className="flex items-center justify-between text-komazi-muted text-xs font-semibold">
            <span>Keamanan Data</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-komazi-text">Terkunci & Terlindungi</p>
            <p className="text-[11px] text-komazi-muted mt-0.5">
              Berkas cadangan terproteksi dan tidak bisa diubah sembarangan
            </p>
          </div>
          <div className="pt-1 flex items-center gap-1.5 text-[10px] text-amber-400 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Sandi Keamanan Aktif</span>
          </div>
        </div>

        {/* Card 4: Kebijakan Retensi */}
        <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border space-y-2">
          <div className="flex items-center justify-between text-komazi-muted text-xs font-semibold">
            <span>Masa Simpan Data</span>
            <Archive className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-komazi-text">
              {summary ? `${summary.totalCount} Cadangan Tersimpan` : 'Memuat...'}
            </p>
            <p className="text-[11px] text-komazi-muted mt-0.5">
              Tersedia arsip harian, mingguan, dan bulanan
            </p>
          </div>
          <div className="pt-1 flex items-center gap-1.5 text-[10px] text-sky-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cadangan Terakhir Dilindungi</span>
          </div>
        </div>
      </div>

      {/* 3. Table Filter & Controls */}
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-komazi-border">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-komazi-text">Riwayat Pencadangan</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-komazi-surface-2 text-komazi-muted">
              {pagination.total} Catatan
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
            >
              <option value="ALL">Semua Status</option>
              <option value="SUCCESS">Berhasil (SUCCESS)</option>
              <option value="FAILED">Gagal (FAILED)</option>
              <option value="RUNNING">Sedang Berjalan</option>
            </select>

            {/* Filter Tipe */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text outline-none focus:border-komazi-coral"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="MANUAL">Manual</option>
              <option value="SCHEDULED">Terjadwal</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-komazi-muted space-y-2">
            <div className="w-6 h-6 border-2 border-komazi-coral border-t-transparent rounded-full animate-spin" />
            <p className="text-xs">Memuat riwayat backup...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-komazi-surface-2 flex items-center justify-center text-komazi-muted">
              <HardDrive className="w-6 h-6 stroke-[1.5]" />
            </div>
            <p className="text-sm font-bold text-komazi-text">Belum ada riwayat backup</p>
            <p className="text-xs text-komazi-muted max-w-sm">
              Klik tombol "Backup Sekarang" di pojok kanan atas untuk membuat pencadangan database perdana.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-komazi-border text-komazi-muted font-bold">
                  <th className="pb-3 pl-1">Waktu</th>
                  <th className="pb-3">Tipe</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Ukuran & Tabel</th>
                  <th className="pb-3">Durasi</th>
                  <th className="pb-3">Kode Keamanan File</th>
                  <th className="pb-3">Pemicu</th>
                  <th className="pb-3 text-right pr-1">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-komazi-border/50 text-komazi-text">
                {history.map((record) => {
                  const isSuccess = record.status === 'SUCCESS';
                  const isFailed = record.status === 'FAILED';

                  return (
                    <tr key={record.id} className="hover:bg-komazi-surface-2/60 transition-colors">
                      <td className="py-3 pl-1 whitespace-nowrap">
                        <p className="font-bold">{formatDateTime(record.startedAt)}</p>
                        <p className="text-[10px] text-komazi-muted font-mono">{record.executionId}</p>
                      </td>

                      <td className="py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            record.backupType === 'SCHEDULED'
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              : 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/20'
                          }`}
                        >
                          {record.backupType === 'SCHEDULED' ? 'Otomatis' : 'Manual'}
                        </span>
                      </td>

                      <td className="py-3 whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Berhasil</span>
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/10 text-danger border border-danger/20">
                            <XCircle className="w-3 h-3" />
                            <span>Gagal</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3 animate-spin" />
                            <span>{record.status}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 whitespace-nowrap">
                        <p className="font-bold">{formatBytes(record.fileSizeBytes)}</p>
                        <p className="text-[10px] text-komazi-muted">
                          {record.tablesCount || 0} tabel • {(record.totalRows || 0).toLocaleString('id-ID')} baris
                        </p>
                      </td>

                      <td className="py-3 whitespace-nowrap text-komazi-muted font-mono">
                        {record.durationSeconds ? `${record.durationSeconds}s` : '-'}
                      </td>

                      <td className="py-3 whitespace-nowrap">
                        {record.checksumSha256 ? (
                          <button
                            type="button"
                            onClick={() => handleCopyChecksum(record.checksumSha256)}
                            className="flex items-center gap-1 font-mono text-[11px] text-komazi-muted hover:text-komazi-coral transition-colors"
                            title="Klik untuk menyalin kode keamanan"
                          >
                            <span>{record.checksumSha256.slice(0, 10)}...</span>
                            {copiedChecksum === record.checksumSha256 ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-60" />
                            )}
                          </button>
                        ) : (
                          <span className="text-komazi-muted">-</span>
                        )}
                      </td>

                      <td className="py-3 whitespace-nowrap text-[11px] text-komazi-muted">
                        {record.triggeredBy}
                      </td>

                      <td className="py-3 pr-1 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Detail */}
                          <button
                            type="button"
                            onClick={() => setDetailModalRecord(record)}
                            className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-white transition-colors"
                            title="Lihat Rincian & Status File"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Verify */}
                          {isSuccess && (
                            <button
                              type="button"
                              onClick={() => handleVerify(record)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                              title="Verifikasi Ulang Checksum"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Download */}
                          {isSuccess && (
                            <a
                              href={api.backup.downloadUrl(record.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted hover:text-komazi-coral transition-colors"
                              title="Unduh Berkas Terenkripsi"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Test Restore (Dry run) */}
                          {isSuccess && (
                            <button
                              type="button"
                              onClick={() => handleTestRestore(record)}
                              disabled={isTestingRestore}
                              className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-colors"
                              title="Uji Simulasi Restore (Dry Run)"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Restore Button */}
                          {isSuccess && (
                            <button
                              type="button"
                              onClick={() => {
                                setRestoreTargetRecord(record);
                                setConfirmationPhrase('');
                              }}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
                              title="Pulihkan Database (Terkontrol)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="pt-3 border-t border-komazi-border">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => loadHistory(page)}
            />
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: Detail Metadata & Verifikasi                          */}
      {/* ============================================================== */}
      {detailModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-komazi-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center">
                  <FileCheck className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Metadata Pencadangan</h3>
                  <p className="text-[11px] text-komazi-muted">ID: {detailModalRecord.executionId}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                <div>
                  <span className="text-komazi-muted text-[11px]">Nama Berkas:</span>
                  <p className="font-mono text-komazi-text font-bold text-[11px] break-all">
                    {detailModalRecord.fileName}
                  </p>
                </div>
                <div>
                  <span className="text-komazi-muted text-[11px]">Ukuran Berkas:</span>
                  <p className="font-bold text-komazi-text">{formatBytes(detailModalRecord.fileSizeBytes)}</p>
                </div>
                <div>
                  <span className="text-komazi-muted text-[11px]">Waktu Mulai:</span>
                  <p className="font-bold text-komazi-text">{formatDateTime(detailModalRecord.startedAt)}</p>
                </div>
                <div>
                  <span className="text-komazi-muted text-[11px]">Durasi Eksekusi:</span>
                  <p className="font-bold text-komazi-text">{detailModalRecord.durationSeconds || 0} detik</p>
                </div>
                <div>
                  <span className="text-komazi-muted text-[11px]">Enkripsi:</span>
                  <p className="font-bold text-emerald-400">
                    {detailModalRecord.isEncrypted ? 'AES-256-GCM (Aktif)' : 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-komazi-muted text-[11px]">Status Verifikasi:</span>
                  <p className="font-bold text-emerald-400">
                    {detailModalRecord.isVerified ? 'File Aman & Terverifikasi' : 'Belum Diverifikasi'}
                  </p>
                </div>
              </div>

              {/* Full Hash Box */}
              <div>
                <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                  Kode Keamanan File (Verifikasi):
                </label>
                <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-komazi-text break-all">
                    {detailModalRecord.checksumSha256 || 'Tidak tersedia'}
                  </span>
                  {detailModalRecord.checksumSha256 && (
                    <button
                      type="button"
                      onClick={() => handleCopyChecksum(detailModalRecord.checksumSha256)}
                      className="p-1 rounded-lg text-komazi-muted hover:text-komazi-coral shrink-0"
                      title="Salin Hash"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {detailModalRecord.errorMessage && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-[11px]">
                  <strong>Pesan Kesalahan:</strong> {detailModalRecord.errorMessage}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setDetailModalRecord(null)}
                className="w-full py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-bold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: Uji Simulasi Restore (Dry-Run Test Result)            */}
      {/* ============================================================== */}
      {testRestoreModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-komazi-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                  <Play className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Hasil Uji Simulasi Restore</h3>
                  <p className="text-[11px] text-komazi-muted">Mode Dry-Run: Validasi parser tanpa mutasi database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestRestoreModalData(null)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-bold">{testRestoreModalData.message}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <p className="text-[10px] text-komazi-muted">Total Statement SQL</p>
                  <p className="text-base font-black text-komazi-text mt-0.5">
                    {testRestoreModalData.totalStatements}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <p className="text-[10px] text-komazi-muted">Tabel Valid</p>
                  <p className="text-base font-black text-komazi-coral mt-0.5">
                    {testRestoreModalData.createTableCount}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <p className="text-[10px] text-komazi-muted">Kueri INSERT Data</p>
                  <p className="text-base font-black text-sky-400 mt-0.5">
                    {testRestoreModalData.insertCount}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-komazi-muted mb-1.5">
                  Tabel yang Terverifikasi Siap Dipulihkan:
                </p>
                <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex flex-wrap gap-1.5 font-mono text-[10px]">
                  {(testRestoreModalData.tablesIdentified || []).map((tbl) => (
                    <span
                      key={tbl}
                      className="px-2 py-0.5 rounded bg-komazi-surface border border-komazi-border text-komazi-text font-semibold"
                    >
                      {tbl}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setTestRestoreModalData(null)}
                className="w-full py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-bold transition-colors"
              >
                Tutup Hasil Simulasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: Konfirmasi Pemulihan Database Terkontrol             */}
      {/* ============================================================== */}
      {restoreTargetRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-komazi-surface border border-danger/40 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-display font-black text-base text-komazi-text">
                Konfirmasi Pemulihan Data Toko
              </h3>
              <p className="text-xs text-komazi-muted leading-relaxed">
                Anda akan memulihkan data dari salinan tanggal{' '}
                <strong className="text-komazi-text">
                  {formatDateTime(restoreTargetRecord.startedAt)}
                </strong>
                .
              </p>
            </div>

            {/* Peringatan Konsekuensi */}
            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-[11px] space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>PENTING DIKETAHUI:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-danger/90">
                <li>Data transaksi baru setelah tanggal cadangan ini akan disesuaikan.</li>
                <li>
                  Sistem akan otomatis membuat <strong>cadangan pengaman</strong> dari data saat ini sebelum memulai.
                </li>
                <li>Jangan menutup halaman sampai proses selesai.</li>
              </ul>
            </div>

            <form onSubmit={handleExecuteRestoreSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-komazi-muted mb-1">
                  Ketik kata <span className="text-danger font-mono font-bold">RESTORE-DATABASE</span> untuk konfirmasi:
                </label>
                <input
                  type="text"
                  required
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  placeholder="RESTORE-DATABASE"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono text-center tracking-wider focus:border-danger outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRestoreTargetRecord(null);
                    setConfirmationPhrase('');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={confirmationPhrase !== 'RESTORE-DATABASE' || isRestoring}
                  className="flex-1 py-2.5 rounded-xl bg-danger hover:bg-danger/80 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-danger/25 disabled:opacity-40"
                >
                  {isRestoring ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Memulihkan...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Ya, Pulihkan Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
