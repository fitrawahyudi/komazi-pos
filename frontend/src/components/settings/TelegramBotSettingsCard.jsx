import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Shield,
  ShieldCheck,
  Zap,
  Users,
  Copy,
  Check,
  Unlink,
  ExternalLink,
  MessageSquare,
  DollarSign,
  Clock,
  AlertTriangle,
  Ban,
  CheckCheck,
  BarChart3,
  Coffee,
  Info,
  RefreshCw,
  Lock,
  Receipt,
  Sparkles,
  Save,
  Download,
  Star,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../store/toastStore';
import { formatRupiah } from '../../utils/format';
import { useSettingsStore } from '../../store/settingsStore';

export default function TelegramBotSettingsCard({
  formState,
  setFormState,
  currentUser,
  onSave,
  isSaved = false,
}) {
  const isOwner = currentUser?.role === 'OWNER';

  // Telegram status & test states
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  // Staff linking states
  const [staffList, setStaffList] = useState([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [linkModalData, setLinkModalData] = useState(null); // { user, code }
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);

  // Load status bot & staf tertaut
  const loadTelegramStatus = async () => {
    try {
      setIsLoadingStatus(true);
      const res = await api.telegram.getStatus();
      if (res?.success && res.data) {
        setTelegramStatus(res.data);
      }
    } catch (err) {
      console.warn('[TelegramCard] Failed to fetch status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const loadStaffList = async () => {
    try {
      setIsLoadingStaff(true);
      const res = await api.telegram.getStaff();
      if (res?.success && Array.isArray(res.data)) {
        setStaffList(res.data);
      }
    } catch (err) {
      console.warn('[TelegramCard] Failed to fetch staff:', err);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    loadTelegramStatus();
    if (isOwner) {
      loadStaffList();
    }
  }, [isOwner]);

  const handleTestTelegram = async () => {
    try {
      setIsTestingTelegram(true);
      const res = await api.telegram.test({
        message: `🔔 <b>UJI COBA NOTIFIKASI BOT KOMAZI</b>\n\nNotifikasi bot berhasil dikirim dari panel Pengaturan Komazi POS.\nWaktu: <b>${new Date().toLocaleTimeString('id-ID')} WIB</b>\nOleh: <b>${currentUser?.name || 'Owner'} (${currentUser?.role})</b>\n\n✅ Sistem bot siap mengirimkan log transaksi dan alert operasional.`,
      });
      if (res?.success) {
        toast.success('Pesan uji coba berhasil dikirim ke akun Telegram Owner/Manager!');
        loadTelegramStatus();
      } else {
        toast.error(res?.message || 'Gagal mengirim pesan uji coba');
      }
    } catch (err) {
      toast.error('Gagal terhubung ke Telegram API');
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleGenerateLinkCode = async (user) => {
    if (!isOwner) {
      toast.error('Hanya role OWNER yang dapat membuat kode tautan staf');
      return;
    }
    try {
      setIsGeneratingCode(true);
      const res = await api.telegram.generateLinkCode(user.id);
      if (res?.success && res.data?.code) {
        setLinkModalData({ user, code: res.data.code });
        setCopiedCode(false);
      } else {
        toast.error(res?.message || 'Gagal membuat kode tautan');
      }
    } catch {
      toast.error('Terjadi kesalahan saat membuat kode');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleUnlinkStaff = async (user) => {
    if (!isOwner) {
      toast.error('Hanya role OWNER yang dapat memutuskan tautan staf');
      return;
    }
    if (!window.confirm(`Yakin ingin memutuskan tautan Telegram untuk "${user.name}"?`)) {
      return;
    }
    try {
      setUnlinkingId(user.id);
      const res = await api.telegram.unlink(user.id);
      if (res?.success) {
        toast.success(`Tautan Telegram untuk "${user.name}" berhasil diputuskan`);
        loadStaffList();
        loadTelegramStatus();
      } else {
        toast.error(res?.message || 'Gagal memutuskan tautan');
      }
    } catch {
      toast.error('Gagal memutuskan tautan Telegram');
    } finally {
      setUnlinkingId(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    toast.success('Kode berhasil disalin!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const { updateSettings } = useSettingsStore();
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (isSaved) {
      setHasUnsavedChanges(false);
    }
  }, [isSaved]);

  const handleSaveSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isOwner) {
      toast.info('Pengaturan bot Telegram dikunci. Hanya role OWNER yang dapat mengubah.');
      return;
    }
    setIsSavingLocal(true);
    try {
      if (onSave) {
        await onSave(e);
      } else {
        const res = await updateSettings(formState);
        toast.success(res?.message || 'Pengaturan Bot Telegram & preferensi berhasil disimpan!');
      }
      setHasUnsavedChanges(false);
    } catch (err) {
      toast.error('Gagal menyimpan pengaturan: ' + (err?.message || 'Kesalahan sistem'));
    } finally {
      setTimeout(() => setIsSavingLocal(false), 2000);
    }
  };

  const toggleSetting = (key) => {
    if (!isOwner) {
      toast.info('Pengaturan bot Telegram dikunci. Hanya role OWNER yang dapat mengubah.');
      return;
    }
    setFormState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setHasUnsavedChanges(true);
  };

  const handleMinAmountChange = (e) => {
    if (!isOwner) return;
    const rawVal = e.target.value.replace(/\D/g, '');
    const num = Number(rawVal) || 0;
    setFormState((prev) => ({
      ...prev,
      botVoidMinAmount: num,
    }));
    setHasUnsavedChanges(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card: Bot Status & Test Connection */}
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                  <span>Notifikasi Bot Telegram</span>
                </h2>
                {telegramStatus?.configured ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success border border-success/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Bot Terhubung
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Token Belum Diatur (.env)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-komazi-muted mt-0.5">
                Konfigurasikan notifikasi otomatis log transaksi, tutup shift, stok kritis, dan approval kasir ke Telegram Owner &amp; Manager.
              </p>
            </div>
          </div>
        </div>

        {/* Status Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-komazi-muted block font-medium">Status Mesin Bot</span>
              <span className="text-xs font-bold text-komazi-text flex items-center gap-1 mt-0.5">
                {telegramStatus?.configured ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />Aktif
                  </span>
                ) : (
                  <span className="text-amber-400">Menunggu Token</span>
                )}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-komazi-muted block font-medium">Penerima Notifikasi Admin</span>
              <span className="text-xs font-bold text-komazi-text flex items-center gap-1 mt-0.5">
                <Users className="w-3.5 h-3.5 text-komazi-coral" />
                <span>{telegramStatus?.linkedAdminsCount || 0} Akun Owner/Manager Tertaut</span>
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-komazi-muted block font-medium">Hak Otoritas Konfigurasi</span>
              <span className="text-xs font-bold text-komazi-text flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-komazi-teal-light" />
                <span>{isOwner ? 'Otoritas Owner Penuh' : 'Mode Pratinjau (Staf)'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Master Bot Switch */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-komazi-text">Master Bot Notifikasi</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                formState.botEnabled !== false
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-danger/15 text-danger border border-danger/30'
              }`}
            >
              {formState.botEnabled !== false ? 'AKTIF' : 'DINONAKTIFKAN'}
            </span>
          </div>
          <p className="text-xs text-komazi-muted leading-relaxed">
            Nyalakan atau matikan seluruh pengiriman pesan dari sistem ke Telegram secara global tanpa menghapus konfigurasi.
          </p>
        </div>

        <button
          type="button"
          disabled={!isOwner}
          onClick={() => toggleSetting('botEnabled')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
            formState.botEnabled !== false ? 'bg-komazi-coral' : 'bg-komazi-border'
          } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          title={isOwner ? 'Toggle status bot' : 'Khusus Owner'}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              formState.botEnabled !== false ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 3. Event Notification Toggles Grid */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-komazi-muted">
              Preferensi Jenis Notifikasi
            </h3>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Belum Disimpan
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Card 1: Log Transaksi Lunas */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              formState.botNotifyTransaction !== false
                ? 'bg-komazi-surface border-komazi-coral/30 shadow-sm'
                : 'bg-komazi-surface-2/60 border-komazi-border opacity-75'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
                    <span>Log Transaksi Lunas (Paid)</span>
                    <span className="text-[10px] font-normal text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                      Real-time
                    </span>
                  </h4>
                  <p className="text-[11px] text-komazi-muted mt-1 leading-relaxed">
                    Kirim notifikasi otomatis seketika pesanan dibayar di kasir, mencakup no invoice, kasir, tipe order, rincian menu, dan metode pembayaran.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!isOwner}
                onClick={() => toggleSetting('botNotifyTransaction')}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  formState.botNotifyTransaction !== false ? 'bg-komazi-coral' : 'bg-komazi-border'
                } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    formState.botNotifyTransaction !== false ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Card 2: Laporan Buka / Tutup Shift */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              formState.botNotifyShift !== false
                ? 'bg-komazi-surface border-komazi-coral/30 shadow-sm'
                : 'bg-komazi-surface-2/60 border-komazi-border opacity-75'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
                    <span>Laporan Buka / Tutup Shift Kasir</span>
                  </h4>
                  <p className="text-[11px] text-komazi-muted mt-1 leading-relaxed">
                    Kirim laporan kas saat kasir menutup shift: modal awal, kas aktual fisik, kalkulasi selisih laci kas (*surplus / defisit*), dan catatan shift.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!isOwner}
                onClick={() => toggleSetting('botNotifyShift')}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  formState.botNotifyShift !== false ? 'bg-komazi-coral' : 'bg-komazi-border'
                } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    formState.botNotifyShift !== false ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Card 3: Peringatan Stok Menipis */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              formState.botNotifyLowStock !== false
                ? 'bg-komazi-surface border-komazi-coral/30 shadow-sm'
                : 'bg-komazi-surface-2/60 border-komazi-border opacity-75'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
                    <span>Peringatan Stok Bahan Baku Menipis</span>
                  </h4>
                  <p className="text-[11px] text-komazi-muted mt-1 leading-relaxed">
                    Pemberitahuan otomatis saat kuantitas bahan baku kopi/dapur berada di bawah batas minimum (*safety stock*) agar segera dipesan kembali.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!isOwner}
                onClick={() => toggleSetting('botNotifyLowStock')}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  formState.botNotifyLowStock !== false ? 'bg-komazi-coral' : 'bg-komazi-border'
                } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    formState.botNotifyLowStock !== false ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Card 4: Permintaan Persetujuan (Approval) */}
          <div
            className={`p-4 rounded-xl border transition-all ${
              formState.botNotifyApproval !== false
                ? 'bg-komazi-surface border-komazi-coral/30 shadow-sm'
                : 'bg-komazi-surface-2/60 border-komazi-border opacity-75'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-komazi-teal/20 border border-komazi-teal-light/30 flex items-center justify-center text-komazi-teal-light shrink-0 mt-0.5">
                  <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
                    <span>Permintaan Persetujuan (Inline Approval)</span>
                  </h4>
                  <p className="text-[11px] text-komazi-muted mt-1 leading-relaxed">
                    Kirim permohonan pembatalan/diskon dari kasir ke Telegram dengan tombol inline [Setujui] dan [Tolak] langsung tanpa buka web POS.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!isOwner}
                onClick={() => toggleSetting('botNotifyApproval')}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  formState.botNotifyApproval !== false ? 'bg-komazi-coral' : 'bg-komazi-border'
                } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    formState.botNotifyApproval !== false ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Card 5: Peringatan Void & Threshold Nominal */}
          <div
            className={`p-4 rounded-xl border transition-all md:col-span-2 ${
              formState.botNotifyVoid !== false
                ? 'bg-komazi-surface border-komazi-coral/30 shadow-sm'
                : 'bg-komazi-surface-2/60 border-komazi-border opacity-75'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-danger/15 border border-danger/30 flex items-center justify-center text-danger shrink-0 mt-0.5">
                  <Ban className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
                    <span>Peringatan Pembatalan Pesanan</span>
                  </h4>
                  <p className="text-[11px] text-komazi-muted leading-relaxed">
                    Kirim alert keamanan darurat jika ada transaksi dibatalkan (void) dengan total nominal mencapai atau melebihi batas minimum.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={!isOwner}
                  onClick={() => toggleSetting('botNotifyVoid')}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                    formState.botNotifyVoid !== false ? 'bg-komazi-coral' : 'bg-komazi-border'
                  } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      formState.botNotifyVoid !== false ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Threshold Input */}
            {formState.botNotifyVoid !== false && (
              <div className="mt-3.5 pt-3.5 border-t border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                <label className="text-xs text-komazi-muted font-medium flex items-center gap-1.5">
                  <span>Batas Nominal Void Alert:</span>
                  <span className="text-[11px] text-komazi-text font-bold">
                    ({formatRupiah(formState.botVoidMinAmount || 100000)})
                  </span>
                </label>
                <div className="flex items-center gap-2 max-w-xs w-full sm:w-auto">
                  <span className="text-xs font-bold text-komazi-muted font-mono">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!isOwner}
                    value={Number(formState.botVoidMinAmount || 100000).toLocaleString('id-ID')}
                    onChange={handleMinAmountChange}
                    className="w-full sm:w-36 px-2.5 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral outline-none disabled:opacity-50"
                    placeholder="100.000"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Barista Group/Channel Routing */}
      <div className="p-4 rounded-2xl bg-komazi-surface border border-komazi-border space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
            <Coffee className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-komazi-text">
              ID Grup Telegram Tiket Barista (KDS/BDS Dispatch)
            </h4>
            <p className="text-[11px] text-komazi-muted">
              Tiket pesanan baru akan dikirimkan ke grup barista ini. Jika dikosongkan, bot otomatis mengirim via pesan pribadi (DM) ke barista yang sedang bertugas.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            disabled={!isOwner}
            value={formState.botBaristaChatId || ''}
            onChange={(e) => {
              setFormState((prev) => ({
                ...prev,
                botBaristaChatId: e.target.value.trim(),
              }));
              setHasUnsavedChanges(true);
            }}
            placeholder="Contoh: -1001234567890 (Grup ID)"
            className="flex-1 px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral outline-none disabled:opacity-50"
          />
          <div className="text-[10px] text-komazi-muted flex items-center gap-1 sm:self-center">
            <Info className="w-3.5 h-3.5 text-komazi-teal-light shrink-0" />
            <span>Awali dengan tanda minus (-) untuk ID Grup Telegram.</span>
          </div>
        </div>
      </div>

      {/* 5. Link Code Modal */}
      {linkModalData && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
          <div className="w-full max-w-sm bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-komazi-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-komazi-text">Kode Tautan Telegram</h4>
                  <p className="text-[11px] text-komazi-muted">Staf: {linkModalData.user.name}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border text-center space-y-2">
              <span className="text-[10px] text-komazi-muted uppercase tracking-wider font-semibold block">
                Kode Verifikasi Sekali Pakai (Berlaku 10 Menit)
              </span>
              <div className="font-mono text-2xl font-black text-komazi-coral tracking-widest select-all">
                {linkModalData.code}
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(linkModalData.code)}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border hover:border-komazi-coral text-xs font-semibold text-komazi-text transition-all active:scale-95"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-success" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-komazi-muted" />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-komazi-muted space-y-1.5 leading-relaxed">
              <span className="font-bold text-blue-400 block">Langkah Penautan:</span>
              <ol className="list-decimal list-inside space-y-1">
                <li>Buka Bot Telegram Komazi di ponsel staf.</li>
                <li>
                  Kirim perintah:{' '}
                  <code className="text-komazi-text font-mono font-bold bg-black/40 px-1 py-0.5 rounded">
                    /start {linkModalData.code}
                  </code>
                </li>
                <li>Bot akan otomatis mengonfirmasi dan mengaktifkan menu staf.</li>
              </ol>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setLinkModalData(null);
                  loadStaffList();
                  loadTelegramStatus();
                }}
                className="w-full py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-bold transition-all"
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
