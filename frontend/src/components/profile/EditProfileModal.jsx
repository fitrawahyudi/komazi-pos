import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import {
  User,
  Camera,
  X,
  Check,
  Lock,
  Phone,
  Shield,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Loader2,
  Clock,
  Calendar,
  Send,
  Copy,
  ExternalLink,
  Unlink,
  RefreshCw,
  Bell,
  LogOut,
  Tv,
  Volume2,
  VolumeX,
  Coffee,
  Utensils,
  ChefHat,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  ArrowRight,
} from 'lucide-react';
import LoadingButton from '../ui/loading/LoadingButton';
import { useShiftStore } from '../../store/shiftStore';
import { toast } from '../../store/toastStore';
import { formatRupiah, formatDateTime } from '../../utils/format';
import { playKitchenChime } from '../../utils/audio';
import AndroidNotificationCard from '../settings/AndroidNotificationCard';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
];

export default function EditProfileModal({
  onClose,
  initialTab = 'profile',
  isKdsMode = false,
  kdsProps = null,
}) {
  const {
    user,
    updateProfile,
    refreshProfile,
    generateTelegramLinkCode,
    unlinkTelegram,
    logout,
  } = useAuthStore();
  const { activeShift } = useShiftStore();
  const fileInputRef = useRef(null);

  const isKdsStaff = isKdsMode || user?.role === 'BARISTA' || user?.role === 'KITCHEN';

  // Active tab state
  const [activeTab, setActiveTab] = useState(initialTab || 'profile');

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Telegram bot linking states
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isCheckingLinkStatus, setIsCheckingLinkStatus] = useState(false);
  const [linkData, setLinkData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  // Status and feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Sync latest profile on mount
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Auto-polling verification while link code is displayed
  useEffect(() => {
    if (!linkData) return;

    const interval = setInterval(async () => {
      const res = await refreshProfile();
      if (res?.success && res.user?.telegramId) {
        setLinkData(null);
        toast.success('Bot Telegram berhasil ditautkan ke akun Anda');
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [linkData, refreshProfile]);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting && !isUploadingAvatar) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSubmitting, isUploadingAvatar]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setErrorMsg('');
    setSuccessMsg('');
  };

  // Upload photo to Cloudinary
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Hanya file gambar (JPG, PNG, WebP) yang didukung');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 5 MB');
      return;
    }

    setErrorMsg('');
    setIsUploadingAvatar(true);

    try {
      const res = await api.upload(file);
      if (res && res.success && res.data?.url) {
        setAvatarUrl(res.data.url);
        setSuccessMsg('Foto profil berhasil diunggah');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(res?.message || 'Gagal mengunggah foto');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengunggah foto');
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  // Submit profile details
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Nama lengkap tidak boleh kosong');
      return;
    }

    if (!username.trim()) {
      setErrorMsg('Username tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        avatarUrl,
      };

      const res = await updateProfile(payload);
      if (res.success) {
        setSuccessMsg('Profil dan data akun berhasil disimpan');
        toast.success('Profil berhasil diperbarui');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(res.message || 'Gagal memperbarui profil');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit password change
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword) {
      setErrorMsg('Masukkan password saat ini untuk konfirmasi');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password baru minimal 6 karakter');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        currentPassword,
        newPassword,
      };

      const res = await updateProfile(payload);
      if (res.success) {
        setSuccessMsg('Password berhasil diperbarui');
        toast.success('Password berhasil diperbarui');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(res.message || 'Gagal memperbarui password');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Telegram handlers
  const handleGenerateCode = async () => {
    try {
      setIsGeneratingCode(true);
      setErrorMsg('');
      const res = await generateTelegramLinkCode();
      if (res?.success && res.data?.code) {
        setLinkData(res.data);
        setCopiedCode(false);
        toast.info('Kode tautan dibuat. Hubungkan melalui bot Telegram.');
      } else {
        toast.error(res?.message || 'Gagal membuat kode tautan');
      }
    } catch {
      toast.error('Terjadi kesalahan saat membuat kode tautan');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCheckLinkStatus = async () => {
    try {
      setIsCheckingLinkStatus(true);
      const res = await refreshProfile();
      if (res?.success && res.user?.telegramId) {
        setLinkData(null);
        toast.success('Bot Telegram berhasil ditautkan');
      } else {
        toast.info('Belum ada penautan terdeteksi. Silakan jalankan perintah di bot Telegram.');
      }
    } catch {
      toast.error('Gagal memeriksa status penautan');
    } finally {
      setIsCheckingLinkStatus(false);
    }
  };

  const handleUnlink = async () => {
    try {
      setIsUnlinking(true);
      const res = await unlinkTelegram();
      if (res?.success) {
        setShowUnlinkConfirm(false);
        toast.success('Tautan bot Telegram berhasil diputuskan');
      } else {
        toast.error(res?.message || 'Gagal memutuskan tautan');
      }
    } catch {
      toast.error('Gagal memutuskan tautan');
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('Kode tautan disalin');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const TABS = [
    {
      id: 'profile',
      label: 'Profil Akun',
      icon: User,
      badge: activeShift && !isKdsStaff ? 'Shift Aktif' : null,
      badgeVariant: 'success',
    },
    {
      id: 'notifications',
      label: 'Notifikasi HP',
      icon: Bell,
    },
    ...(isKdsMode
      ? [
          {
            id: 'kds',
            label: 'Layar KDS/BDS',
            icon: Tv,
          },
        ]
      : []),
    {
      id: 'telegram',
      label: 'Bot Telegram',
      icon: Send,
    },
    {
      id: 'security',
      label: 'Kata Sandi',
      icon: KeyRound,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none"
    >
      <div className="w-full max-w-xl bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shadow-inner">
              {isKdsMode ? <Tv className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="profile-dialog-title" className="font-display font-bold text-sm text-komazi-text">
                {isKdsMode ? 'Pengaturan KDS & Profil Akun' : 'Pengaturan Profil'}
              </h2>
              <p className="text-[11px] text-komazi-muted">
                {isKdsMode
                  ? 'Profil staf, notifikasi Android, suara lonceng, dan kata sandi'
                  : 'Profil staf, notifikasi, Telegram, dan kata sandi'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan akun"
            disabled={isSubmitting || isUploadingAvatar}
            className="p-1.5 rounded-xl text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-komazi-border bg-komazi-surface shrink-0">
          <div
            role="tablist"
            aria-label="Kategori pengaturan profil"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth p-1 bg-komazi-surface-2/80 rounded-xl border border-komazi-border/60"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none ${
                    isActive
                      ? 'bg-komazi-coral text-white shadow-sm'
                      : 'text-komazi-muted hover:text-white hover:bg-komazi-surface/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-komazi-muted'}`} />
                  <span>{tab.label}</span>

                  {tab.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : tab.badgeVariant === 'emerald'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : tab.badgeVariant === 'success'
                              ? 'bg-success/15 text-success'
                              : 'bg-sky-500/15 text-sky-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notification Banners */}
        {errorMsg && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2 shrink-0 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-semibold flex items-center gap-2 shrink-0 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Panel Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1">
          {/* TAB 1: PROFIL AKUN */}
          {activeTab === 'profile' && (
            <form
              id="panel-profile"
              role="tabpanel"
              aria-labelledby="tab-profile"
              onSubmit={handleSaveProfile}
              className="space-y-4 animate-fadeIn"
            >
              {/* Foto Profil & Avatar */}
              <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-komazi-muted">
                  Foto Profil
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative group shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-komazi-surface border-2 border-komazi-border flex items-center justify-center shadow-lg relative">
                      {isUploadingAvatar ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-black/70 text-komazi-coral">
                          <Loader2 className="w-6 h-6 animate-spin text-komazi-coral" />
                          <span className="text-[9px] font-bold mt-1 text-white">Upload...</span>
                        </div>
                      ) : avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xl text-komazi-coral bg-komazi-coral/10">
                          {name ? name.substring(0, 2).toUpperCase() : 'KM'}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Unggah foto profil baru"
                      className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white shadow-md transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-komazi-coral focus-visible:outline-none"
                      title="Upload Foto"
                    >
                      <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>

                  <div className="space-y-2 flex-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl('')}
                          className="px-2.5 py-1.5 rounded-xl bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus Foto</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] text-komazi-muted">Atau pilih avatar siap pakai:</p>
                      <div className="flex items-center justify-center sm:justify-start gap-1.5">
                        {AVATAR_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAvatarUrl(preset)}
                            className={`w-7 h-7 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                              avatarUrl === preset ? 'border-komazi-coral scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={preset} alt="preset" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Diri Staf */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="profile-full-name" className="block text-xs font-semibold text-komazi-muted mb-1">
                    Nama Lengkap:
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                    <input
                      id="profile-full-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:ring-2 focus:ring-komazi-coral/20 outline-none transition-all"
                      placeholder="Nama Lengkap Staf"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="profile-username" className="block text-xs font-semibold text-komazi-muted mb-1">
                      Username Akun:
                    </label>
                    <div className="relative">
                      <span className="text-xs text-komazi-muted font-bold absolute left-3.5 top-2.5">@</span>
                      <input
                        id="profile-username"
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:ring-2 focus:ring-komazi-coral/20 outline-none transition-all"
                        placeholder="username"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="profile-phone" className="block text-xs font-semibold text-komazi-muted mb-1">
                      Nomor WhatsApp / HP:
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-komazi-muted absolute left-3.5 top-3" />
                      <input
                        id="profile-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:ring-2 focus:ring-komazi-coral/20 outline-none transition-all"
                        placeholder="0812-xxxx-xxxx"
                      />
                    </div>
                  </div>
                </div>

                {/* Hak Akses / Role (Read-only) */}
                <div>
                  <label className="block text-xs font-semibold text-komazi-muted mb-1">
                    Hak Akses / Peran Akun:
                  </label>
                  <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-komazi-teal-light" />
                      <span className="text-komazi-text font-bold">
                        {user?.role === 'OWNER'
                          ? 'Pemilik Usaha (Owner)'
                          : user?.role === 'MANAGER'
                            ? 'Supervisor / Manager'
                            : user?.role === 'BARISTA'
                              ? 'Barista (KDS Minuman)'
                              : user?.role === 'KITCHEN'
                                ? 'Kitchen (KDS Makanan)'
                                : 'Kasir (Cashier)'}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        user?.role === 'OWNER'
                          ? 'bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30'
                          : user?.role === 'MANAGER'
                            ? 'bg-komazi-teal/15 text-komazi-teal-light border border-komazi-teal/30'
                            : 'bg-komazi-surface text-komazi-muted border border-komazi-border'
                      }`}
                    >
                      {user?.role}
                    </span>
                  </div>
                </div>

                {/* Status Shift & Akun */}
                <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-komazi-muted flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-komazi-teal-light" />
                      <span>{isKdsStaff ? 'Status Stasiun KDS:' : 'Status Shift Kasir:'}</span>
                    </span>
                    {isKdsStaff ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Online & Siap Produksi</span>
                      </span>
                    ) : activeShift ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 border border-success/30 text-success">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        <span>Shift Aktif #{activeShift.id}</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-komazi-surface border border-komazi-border text-komazi-muted">
                        Tidak Ada Shift Aktif
                      </span>
                    )}
                  </div>

                  {!isKdsStaff && activeShift && (
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-komazi-border/50">
                      <div>
                        <span className="text-komazi-muted block text-[10px]">Mulai Shift:</span>
                        <span className="font-semibold text-komazi-text">
                          {activeShift.openedAt ? formatDateTime(activeShift.openedAt) : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-komazi-muted block text-[10px]">Modal Awal:</span>
                        <span className="font-mono font-semibold text-komazi-text">
                          {formatRupiah(activeShift.openingCash || 0)}
                        </span>
                      </div>
                    </div>
                  )}

                  {user?.createdAt && (
                    <div className="flex items-center justify-between text-[11px] text-komazi-muted pt-1 border-t border-komazi-border/50">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Terdaftar Sejak:</span>
                      </span>
                      <span className="font-medium text-komazi-text">
                        {formatDateTime(user.createdAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 rounded-xl transition-colors cursor-pointer"
                  title="Keluar dari akun staf dan ganti akun"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Ganti Akun / Logout</span>
                </button>

                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting || isUploadingAvatar}
                  loadingText={isUploadingAvatar ? 'Mengunggah...' : 'Menyimpan...'}
                  variant="primary"
                  size="sm"
                  icon={Check}
                  className="px-5 py-2.5 text-xs font-bold shadow-md cursor-pointer"
                >
                  Simpan Profil
                </LoadingButton>
              </div>
            </form>
          )}

          {/* TAB 2: NOTIFIKASI ANDROID (CAPACITOR) */}
          {activeTab === 'notifications' && (
            <div
              id="panel-notifications"
              role="tabpanel"
              aria-labelledby="tab-notifications"
              className="space-y-4 animate-fadeIn"
            >
              <AndroidNotificationCard isKdsMode={isKdsMode} />
            </div>
          )}

          {/* TAB 2.5: PENGATURAN KDS & BDS */}
          {activeTab === 'kds' && (
            <div
              id="panel-kds"
              role="tabpanel"
              aria-labelledby="tab-kds"
              className="space-y-4 animate-fadeIn"
            >
              <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shrink-0">
                      <Tv className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-komazi-text">
                        Preferensi Layar KDS & BDS
                      </h3>
                      <p className="text-[10px] text-komazi-muted">
                        Kontrol audio lonceng, stasiun operasional, dan layar produksi
                      </p>
                    </div>
                  </div>
                </div>

                {/* 1. Suara Lonceng Pesanan Baru */}
                <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-komazi-text block">
                          Suara Lonceng Pesanan Baru (Chime)
                        </span>
                        <span className="text-[10px] text-komazi-muted">
                          Bunyikan denting audio lonceng saat pesanan baru masuk dari kasir
                        </span>
                      </div>
                    </div>

                    {kdsProps?.setIsSoundEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          kdsProps.setIsSoundEnabled(!kdsProps.isSoundEnabled);
                          toast.success(
                            !kdsProps.isSoundEnabled
                              ? 'Suara lonceng KDS diaktifkan'
                              : 'Suara lonceng KDS dimatikan'
                          );
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          kdsProps.isSoundEnabled ? 'bg-emerald-500' : 'bg-neutral-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            kdsProps.isSoundEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-komazi-border/50 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        playKitchenChime();
                        toast.info('🔔 Memutar suara lonceng dapur/bar');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-semibold border border-komazi-border transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Uji Coba Suara Lonceng</span>
                    </button>
                  </div>
                </div>

                {/* 2. Pilihan Stasiun Tampilan */}
                {kdsProps?.setStationFilter && (
                  <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border space-y-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-komazi-coral" />
                      <span className="text-xs font-bold text-komazi-text">
                        Filter Stasiun Produksi
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'ALL', label: 'Semua Station', icon: ChefHat },
                        { key: 'KITCHEN', label: 'Dapur (KDS)', icon: Utensils },
                        { key: 'BAR', label: 'Barista (BDS)', icon: Coffee },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            kdsProps.setStationFilter(key);
                            toast.success(`Filter stasiun diubah ke: ${label}`);
                          }}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all gap-1.5 ${
                            kdsProps.stationFilter === key
                              ? 'bg-komazi-coral/15 border-komazi-coral text-komazi-coral shadow-sm'
                              : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-[11px] text-center">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Notifikasi Android Quick Link */}
                <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-komazi-text block">
                        Notifikasi Sistem Android
                      </span>
                      <span className="text-[10px] text-komazi-muted">
                        Terima heads-up notifikasi & getaran pesanan di HP Android
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('notifications')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span>Atur Notifikasi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 4. Layar Penuh (Fullscreen) */}
                {kdsProps?.toggleFullscreen && (
                  <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-komazi-text block">
                        Mode Layar Penuh (Fullscreen TV)
                      </span>
                      <span className="text-[10px] text-komazi-muted">
                        KDS tampil optimal pada Smart TV atau tablet dapur
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={kdsProps.toggleFullscreen}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-bold border border-komazi-border transition-colors cursor-pointer"
                    >
                      {kdsProps.isFullscreen ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5" />
                          <span>Kecilkan</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Layar Penuh</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BOT TELEGRAM */}
          {activeTab === 'telegram' && (
            <div
              id="panel-telegram"
              role="tabpanel"
              aria-labelledby="tab-telegram"
              className="space-y-4 animate-fadeIn"
            >
              <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-komazi-text flex items-center gap-1.5">
                        <span>Bot Telegram Komazi</span>
                      </h3>
                      <p className="text-[10px] text-komazi-muted">
                        Notifikasi operasional transaksi dan asisten perintah bot
                      </p>
                    </div>
                  </div>

                  {user?.telegramId ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Tertaut</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-komazi-surface border border-komazi-border text-komazi-muted">
                      Belum Ditautkan
                    </span>
                  )}
                </div>

                {/* A. Akun Sudah Tertaut */}
                {user?.telegramId ? (
                  <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-komazi-surface-2/60 border border-komazi-border/60">
                        <span className="text-[10px] text-komazi-muted block font-medium">ID Telegram:</span>
                        <span className="font-mono font-bold text-komazi-text text-xs tracking-wide">
                          {user.telegramId}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-komazi-surface-2/60 border border-komazi-border/60">
                        <span className="text-[10px] text-komazi-muted block font-medium">Username:</span>
                        <span className="font-semibold text-komazi-text text-xs">
                          {user.telegramUsername ? `@${user.telegramUsername}` : '-'}
                        </span>
                      </div>
                    </div>

                    {user.telegramLinkedAt && (
                      <div className="flex items-center justify-between text-[11px] text-komazi-muted pt-1 border-t border-komazi-border/40">
                        <span>Waktu Penautan:</span>
                        <span className="font-medium text-komazi-text">
                          {formatDateTime(user.telegramLinkedAt)}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <p className="text-[10px] text-komazi-muted leading-relaxed">
                        Akun aktif menerima laporan penjualan dan notifikasi sesuai hak akses.
                      </p>

                      {showUnlinkConfirm ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isUnlinking}
                            onClick={handleUnlink}
                            className="px-2.5 py-1.5 rounded-lg bg-danger hover:bg-danger/90 text-white text-[11px] font-bold flex items-center gap-1 transition-all"
                          >
                            {isUnlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                            <span>Ya, Putuskan</span>
                          </button>
                          <button
                            type="button"
                            disabled={isUnlinking}
                            onClick={() => setShowUnlinkConfirm(false)}
                            className="px-2.5 py-1.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-[11px] text-komazi-muted hover:text-white"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowUnlinkConfirm(true)}
                          className="px-3 py-1.5 rounded-lg border border-danger/30 bg-danger/10 hover:bg-danger/20 text-danger text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span>Putuskan Tautan</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : linkData ? (
                  /* B. Kode Tautan Aktif */
                  <div className="p-3.5 rounded-xl bg-komazi-surface border border-sky-500/30 space-y-3 animate-fadeIn">
                    <div className="text-center space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                        Kode Tautan Sekali Pakai (Berlaku 10 Menit)
                      </span>
                      <div className="p-2.5 rounded-xl bg-komazi-surface-2 border border-sky-500/20 flex items-center justify-center gap-3">
                        <span className="font-mono text-2xl font-black text-komazi-coral tracking-widest select-all">
                          {linkData.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(linkData.code)}
                          className="p-1.5 rounded-lg bg-komazi-surface hover:bg-komazi-border text-komazi-text transition-colors"
                          title="Salin Kode"
                        >
                          {copiedCode ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-komazi-muted" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <a
                        href={`https://t.me/${linkData.botUsername || 'KomaziBot'}?start=${linkData.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Buka di Telegram</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>

                      <button
                        type="button"
                        disabled={isCheckingLinkStatus}
                        onClick={handleCheckLinkStatus}
                        className="px-3 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-semibold flex items-center justify-center gap-1.5 border border-komazi-border transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isCheckingLinkStatus ? 'animate-spin text-komazi-coral' : ''}`} />
                        <span>{isCheckingLinkStatus ? 'Memeriksa...' : 'Cek Status Penautan'}</span>
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/15 text-[11px] text-komazi-muted space-y-1">
                      <span className="font-semibold text-sky-400 block text-[10px]">Panduan Cepat:</span>
                      <ol className="list-decimal list-inside space-y-0.5 text-[10px] leading-relaxed">
                        <li>
                          Klik <b>"Buka di Telegram"</b> di atas.
                        </li>
                        <li>
                          Tekan tombol <b>Start</b> atau kirim perintah:{' '}
                          <code className="bg-black/40 px-1 py-0.5 rounded text-komazi-text font-mono font-bold">
                            /start {linkData.code}
                          </code>
                        </li>
                        <li>Penautan terdeteksi otomatis oleh sistem.</li>
                      </ol>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setLinkData(null)}
                        className="text-[11px] text-komazi-muted hover:text-white transition-colors"
                      >
                        Batal / Tutup Kode
                      </button>
                    </div>
                  </div>
                ) : (
                  /* C. Belum Tertaut */
                  <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-komazi-text">
                        Tautkan akun POS ke Bot Telegram
                      </p>
                      <p className="text-[11px] text-komazi-muted leading-relaxed">
                        Terima alert transaksi, laporan shift, dan ringkasan penjualan otomatis.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isGeneratingCode}
                      onClick={handleGenerateCode}
                      className="px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {isGeneratingCode ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{isGeneratingCode ? 'Membuat Kode...' : 'Tautkan Bot Telegram'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: KATA SANDI / KEAMANAN */}
          {activeTab === 'security' && (
            <form
              id="panel-security"
              role="tabpanel"
              aria-labelledby="tab-security"
              onSubmit={handleSavePassword}
              className="space-y-4 animate-fadeIn"
            >
              <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3.5">
                <div className="flex items-center gap-2 border-b border-komazi-border/50 pb-2.5">
                  <KeyRound className="w-4 h-4 text-komazi-coral" />
                  <span className="text-xs font-bold text-komazi-text">Perbarui Kata Sandi Akun</span>
                </div>

                <div>
                  <label htmlFor="sec-current-password" className="block text-xs font-semibold text-komazi-muted mb-1">
                    Password Saat Ini:
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-komazi-muted absolute left-3 top-2.5" />
                    <input
                      id="sec-current-password"
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:ring-2 focus:ring-komazi-coral/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sec-new-password" className="block text-xs font-semibold text-komazi-muted mb-1">
                      Password Baru (Min. 6 Karakter):
                    </label>
                    <input
                      id="sec-new-password"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:ring-2 focus:ring-komazi-coral/20 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="sec-confirm-password" className="block text-xs font-semibold text-komazi-muted mb-1">
                      Konfirmasi Password Baru:
                    </label>
                    <input
                      id="sec-confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang password baru"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:ring-2 focus:ring-komazi-coral/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-komazi-muted leading-relaxed">
                  Gunakan kombinasi huruf dan angka agar akun kasir Anda tetap terlindungi.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end pt-3 border-t border-komazi-border">
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Menyimpan..."
                  variant="primary"
                  size="sm"
                  icon={Check}
                  className="px-5 py-2.5 text-xs font-bold shadow-md cursor-pointer"
                >
                  Perbarui Kata Sandi
                </LoadingButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

