import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import {
  ExternalLink,
  Settings,
  Store,
  Receipt,
  Percent,
  Users,
  Save,
  Check,
  RotateCcw,
  Wifi,
  Plus,
  KeyRound,
  Trash2,
  X,
  AlertCircle,
  Shield,
  CheckCircle2,
  UserCheck,
  QrCode,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  HelpCircle,
  Sparkles,
  Copy,
  Printer,
  Send,
  UserCog,
  CalendarClock,
  Calendar,
  CalendarCheck,
  CalendarOff,
  Clock,
  Bell,
  Smartphone,
  MapPin,
  Camera,
  LocateFixed,
} from 'lucide-react';
import ReceiptPreviewCard from '../components/settings/ReceiptPreviewCard';
import PrinterPage from './PrinterPage';
import WifiManagerCard from '../components/settings/WifiManagerCard';
import QrisUploader from '../components/settings/QrisUploader';
import BankTransferSettingsCard from '../components/settings/BankTransferSettingsCard';
import TelegramBotSettingsCard from '../components/settings/TelegramBotSettingsCard';
import AndroidNotificationCard from '../components/settings/AndroidNotificationCard';
import OwnerResetPasswordModal from '../components/auth/OwnerResetPasswordModal';
import {
  convertStaticToDynamicQris,
  generateQrDataUrl,
  DEFAULT_STATIC_QRIS,
} from '../utils/qris';
import { formatRupiah } from '../utils/format';
import { api } from '../services/api';
import Pagination from '../components/ui/Pagination';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') || 'outlet';

  const TABS = [
    { id: 'outlet', label: 'Profil & Struk', icon: Store, desc: 'Identitas outlet, kontak WhatsApp, WiFi & catatan struk kasir' },
    { id: 'payment', label: 'Pembayaran & QRIS', icon: QrCode, desc: 'Upload foto QRIS merchant, nominal dinamis & rekening transfer bank kasir' },
    { id: 'tax', label: 'Pajak & Biaya', icon: Percent, desc: 'Kalkulasi persentase PB1 resto & service fee' },
    { id: 'printer', label: 'Printer & Hardware', icon: Printer, desc: 'Koneksi thermal printer, Bluetooth, USB & laci uang' },
    { id: 'integrations', label: 'Notifikasi & Bot', icon: Send, desc: 'Notifikasi & Bot Telegram' },
    { id: 'security', label: 'Keamanan & PIN', icon: ShieldCheck, desc: 'PIN otorisasi void transaksi, refund dana & tautan modul HRIS' },
  ];

  const resolvedTab = rawTab === 'users' ? 'security' : rawTab;
  const activeTab = TABS.some((t) => t.id === resolvedTab) ? resolvedTab : 'outlet';
  const setActiveTab = (tab) => setSearchParams({ tab });

  const { settings, updateSettings, resetToDefault } = useSettingsStore();
  const {
    user: currentUser,
    users,
    fetchUsers,
    addUser,
    resetUserPasswordByOwner,
    deleteUser,
  } = useAuthStore();

  const [formState, setFormState] = useState({ ...settings });
  const [isSaved, setIsSaved] = useState(false);
  const [integrationSubTab, setIntegrationSubTab] = useState('android');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Browser atau perangkat Anda tidak mendukung geolokasi GPS.');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        handleChange('outletLatitude', lat);
        handleChange('outletLongitude', lon);
        updateSettings({ outletLatitude: lat, outletLongitude: lon });
        setIsDetectingLocation(false);
        toast.success(`Koordinat outlet disetel: ${lat}, ${lon} (Akurasi: ±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setIsDetectingLocation(false);
        toast.error(`Gagal mendeteksi lokasi GPS: ${err.message}. Pastikan izin lokasi aktif.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // QRIS Simulation & Test State
  const [testAmount, setTestAmount] = useState(10000);
  const [testQrUrl, setTestQrUrl] = useState('');
  const [showQrPreviewModal, setShowQrPreviewModal] = useState(false);
  const [isGeneratingTestQr, setIsGeneratingTestQr] = useState(false);

  // User Management Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('CASHIER');
  const [addError, setAddError] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Reset Password Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [targetUserForReset, setTargetUserForReset] = useState(null);
  const [targetNewPassword, setTargetNewPassword] = useState('');
  const [targetConfirmPassword, setTargetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Delete User Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [targetUserForDelete, setTargetUserForDelete] = useState(null);

  // Telegram Link Modal State
  const [showTelegramLinkModal, setShowTelegramLinkModal] = useState(false);
  const [targetUserForTgLink, setTargetUserForTgLink] = useState(null);
  const [generatedTgCode, setGeneratedTgCode] = useState('');
  const [isGeneratingTgCode, setIsGeneratingTgCode] = useState(false);
  const [copiedTgCode, setCopiedTgCode] = useState(false);

  // Supervisor PIN Management State (Section 33 / Owner Security)
  const [showPin, setShowPin] = useState(false);
  const [newSupervisorPin, setNewSupervisorPin] = useState('');
  const [confirmSupervisorPin, setConfirmSupervisorPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  const handleSavePin = async (e) => {
    e.preventDefault();
    setPinError('');

    if (currentUser?.role !== 'OWNER') {
      showToast('Hanya akun dengan role OWNER yang dapat mengubah PIN Otorisasi.', 'error');
      return;
    }

    if (!newSupervisorPin.trim()) {
      setPinError('PIN baru tidak boleh kosong.');
      return;
    }

    if (!/^\d{4,6}$/.test(newSupervisorPin.trim())) {
      setPinError('PIN harus berupa 4 hingga 6 digit angka.');
      return;
    }

    if (newSupervisorPin.trim() !== confirmSupervisorPin.trim()) {
      setPinError('Konfirmasi PIN baru tidak cocok.');
      return;
    }

    setIsSavingPin(true);
    try {
      const updated = {
        ...formState,
        supervisorPin: newSupervisorPin.trim(),
      };
      const res = await updateSettings(updated);
      setFormState(updated);
      setNewSupervisorPin('');
      setConfirmSupervisorPin('');
      showToast('PIN Otorisasi Supervisor berhasil diperbarui!');
    } catch (err) {
      setPinError(err.message || 'Gagal menyimpan PIN baru.');
    } finally {
      setIsSavingPin(false);
    }
  };

  // Toast feedback
  const [toastMsg, setToastMsg] = useState(null);

  // Pagination for Staff & Access Tab
  const [userPage, setUserPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);

  const handleOpenTestQr = async () => {
    setIsGeneratingTestQr(true);
    try {
      const payload = convertStaticToDynamicQris(
        formState.qrisStaticString || DEFAULT_STATIC_QRIS,
        testAmount,
        {
          mode: formState.qrisMode || 'compatible',
          includeInvoice: formState.qrisIncludeInvoice === true || formState.qrisIncludeInvoice === 'true',
          invoiceNo: 'KMZ-TEST-001',
        }
      );
      const url = await generateQrDataUrl(payload, { width: 300 });
      setTestQrUrl(url);
      setShowQrPreviewModal(true);
    } catch (err) {
      toast.error('Gagal membuat preview QRIS: ' + err.message);
    } finally {
      setIsGeneratingTestQr(false);
    }
  };

  const handleQrisExtracted = ({ rawPayload, metadata, imageUrl }) => {
    setFormState((prev) => ({
      ...prev,
      qrisStaticString: rawPayload || prev.qrisStaticString,
      qrisNmid: metadata?.nmid || prev.qrisNmid,
      qrisMerchantName: metadata?.merchantName || prev.qrisMerchantName,
      qrisMerchantCity: metadata?.merchantCity || prev.qrisMerchantCity,
      qrisPostalCode: metadata?.postalCode || prev.qrisPostalCode,
      qrisImageUrl: imageUrl || prev.qrisImageUrl,
    }));
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setFormState({ ...settings });
  }, [settings]);

  const showToast = (text, type = 'success') => {
    if (type === 'error') {
      toast.error(text);
    } else {
      toast.success(text);
    }
  };



  const handleChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const payload = {
      ...formState,
      receiptHeader: formState.headerText ?? '',
      footerText: formState.receiptFooter ?? '',
    };
    const res = await updateSettings(payload);
    setIsSaved(true);
    const successMsg =
      activeTab === 'integrations'
        ? (res?.message || 'Pengaturan Bot Telegram & preferensi berhasil disimpan!')
        : (res?.message || 'Pengaturan outlet berhasil disimpan!');
    showToast(successMsg);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Add Account Handler
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setAddError('');

    if (!newName.trim() || !newUsername.trim() || !newPassword) {
      setAddError('Semua kolom wajib diisi');
      return;
    }

    if (newPassword.length < 6) {
      setAddError('Password minimal 6 karakter');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await addUser({
        name: newName.trim(),
        username: newUsername.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
      });

      if (res.success) {
        showToast(`Akun staf "${newName}" berhasil ditambahkan!`);
        setShowAddModal(false);
        setNewName('');
        setNewUsername('');
        setNewPassword('');
        setNewRole('CASHIER');
      } else {
        setAddError(res.message || 'Gagal menambahkan akun');
      }
    } catch (err) {
      setAddError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Reset Password Handler
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');

    if (targetNewPassword.length < 6) {
      setResetError('Password baru minimal 6 karakter');
      return;
    }

    if (targetNewPassword !== targetConfirmPassword) {
      setResetError('Konfirmasi password tidak cocok');
      return;
    }

    setIsSubmittingReset(true);
    try {
      const res = await resetUserPasswordByOwner(targetUserForReset.id, targetNewPassword);
      if (res.success) {
        showToast(`Password untuk @${targetUserForReset.username} berhasil direset!`);
        setShowResetModal(false);
        setTargetUserForReset(null);
        setTargetNewPassword('');
        setTargetConfirmPassword('');
      } else {
        setResetError(res.message || 'Gagal memperbarui password');
      }
    } catch (err) {
      setResetError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Delete User Handler
  const handleDeleteUserSubmit = async () => {
    if (!targetUserForDelete) return;

    try {
      await deleteUser(targetUserForDelete.id);
      showToast(`Akun @${targetUserForDelete.username} berhasil dihapus.`);
      setShowDeleteModal(false);
      setTargetUserForDelete(null);
    } catch {
      showToast('Gagal menghapus akun', 'error');
    }
  };

  // Telegram Link Handlers
  const handleOpenTgLinkModal = async (targetUser) => {
    setTargetUserForTgLink(targetUser);
    setIsGeneratingTgCode(true);
    setGeneratedTgCode('');
    setShowTelegramLinkModal(true);
    try {
      const res = await api.telegram.generateLinkCode(targetUser.id);
      if (res && res.success && res.data?.code) {
        setGeneratedTgCode(res.data.code);
      } else {
        toast.error(res?.message || 'Gagal membuat kode tautan Telegram');
      }
    } catch (err) {
      toast.error('Gagal membuat kode: ' + err.message);
    } finally {
      setIsGeneratingTgCode(false);
    }
  };

  const handleUnlinkTelegram = async (targetUser) => {
    if (!window.confirm(`Putuskan tautan Telegram untuk @${targetUser.username}?`)) return;
    try {
      const res = await api.telegram.unlink(targetUser.id);
      if (res && res.success) {
        showToast(`Tautan Telegram untuk @${targetUser.username} berhasil diputus.`);
        fetchUsers();
      } else {
        showToast(res?.message || 'Gagal memutuskan tautan', 'error');
      }
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  const usersList = users || [];
  const paginatedUsers = React.useMemo(() => {
    const startIndex = (userPage - 1) * usersPerPage;
    return usersList.slice(startIndex, startIndex + usersPerPage);
  }, [usersList, userPage, usersPerPage]);

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-6 space-y-6 max-w-5xl mx-auto select-none">
      {/* Header */}
      <div>
        <h1 className="font-display font-black text-2xl text-komazi-text flex items-center gap-2">
          <span>Pengaturan Usaha</span>
        </h1>
        <p className="text-xs text-komazi-muted mt-0.5">
          Konfigurasi profil outlet, pembayaran QRIS, kalkulasi pajak, printer thermal & akun staf kasir.
        </p>
      </div>

      {/* Tab Navigation Pill Bar */}
      <div className="bg-komazi-surface/80 backdrop-blur-sm border border-komazi-border p-1.5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-komazi-coral text-white shadow-md shadow-komazi-coral/25 scale-[1.01]'
                    : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-komazi-muted'}`} />
                <span>{tab.label}</span>

                {/* Status Badges */}
                {tab.id === 'users' && usersList.length > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-komazi-surface-2 text-neutral-400'
                    }`}
                  >
                    {usersList.length}
                  </span>
                )}

                {tab.id === 'payment' && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : formState.qrisEnabled !== false
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    {formState.qrisEnabled !== false ? 'EMVCo' : 'OFF'}
                  </span>
                )}

                {tab.id === 'tax' && formState.taxEnabled && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {formState.taxPercentage}%
                  </span>
                )}

                {tab.id === 'integrations' && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      formState.botEnabled !== false ? 'bg-emerald-400' : 'bg-neutral-500'
                    }`}
                    title={formState.botEnabled !== false ? 'Telegram Bot Aktif' : 'Telegram Bot Nonaktif'}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {activeTab === 'printer' ? (
        <div className="space-y-6 animate-fadeIn">
          <PrinterPage isEmbedded={true} />
        </div>
      ) : (
        <div className="space-y-6">
        {/* 1. Profil Usaha & WiFi Struk */}
        {activeTab === 'outlet' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
              <div className="flex items-center gap-2 border-b border-komazi-border pb-3">
                <Store className="w-5 h-5 text-komazi-coral" />
                <h2 className="font-bold text-sm text-komazi-text">Profil Outlet</h2>
              </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1">
                Nama Outlet:
              </label>
              <input
                type="text"
                value={formState.storeName}
                onChange={(e) => handleChange('storeName', e.target.value)}
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1">
                Tagline:
              </label>
              <input
                type="text"
                value={formState.storeTagline}
                onChange={(e) => handleChange('storeTagline', e.target.value)}
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1">
                Alamat Lengkap:
              </label>
              <input
                type="text"
                value={formState.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1">
                Nomor WhatsApp Kasir:
              </label>
              <input
                type="text"
                value={formState.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Manajemen Jaringan WiFi Outlet & Tamu (CRUD) */}
        {/* <WifiManagerCard /> */}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? 'Berhasil Disimpan!' : 'Simpan Profil & Struk'}</span>
              </button>
            </div>
          </div>
        )}
        {/* 2. Konfigurasi Pembayaran QRIS */}
        {activeTab === 'payment' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                    <QrCode className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                      <span>Konfigurasi QRIS Toko</span>
                    </h2>
                    <p className="text-[11px] text-komazi-muted">
                      Pelanggan langsung scan QRIS dengan nominal pesanan otomatis tanpa perlu ketik manual
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-semibold text-komazi-muted">Aktifkan di Kasir:</span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.qrisEnabled !== false}
                        onChange={(e) => handleChange('qrisEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-komazi-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-komazi-coral"></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Upload Foto QRIS Statis Merchant (Auto Decode & Extract) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-komazi-text">
                    Foto / Gambar QRIS Toko:
                  </label>
                  <span className="text-[11px] font-semibold text-komazi-coral">
                    Otomatis Mendeteksi Data Toko ✨
                  </span>
                </div>
                <p className="text-[11px] text-komazi-muted">
                  Upload file foto atau scan QRIS merchant Anda (dari DANA Bisnis, BCA, ShopeePay, atau foto akrilik kasir). Sistem membaca kode QR secara instan dan mengaktifkan QRIS dinamis otomatis.
                </p>
                <QrisUploader
                  currentImageUrl={formState.qrisImageUrl}
                  onExtracted={handleQrisExtracted}
                />
              </div>

              {/* Informasi Merchant QRIS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-komazi-border/50 pb-2">
                  <span className="text-xs font-bold text-komazi-text">Informasi Merchant QRIS</span>
                  <span className="text-[10px] text-komazi-muted">Terisi otomatis dari hasil upload foto</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-komazi-muted mb-1">
                      NMID (National Merchant ID):
                    </label>
                    <input
                      type="text"
                      value={formState.qrisNmid || ''}
                      onChange={(e) => handleChange('qrisNmid', e.target.value)}
                      placeholder="ID1020088920199"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-komazi-muted mb-1">
                      Nama Merchant QRIS:
                    </label>
                    <input
                      type="text"
                      value={formState.qrisMerchantName || ''}
                      onChange={(e) => handleChange('qrisMerchantName', e.target.value)}
                      placeholder="KOMAZI COFFEE & WORKSPACE"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-komazi-muted mb-1">
                      Kota Merchant:
                    </label>
                    <input
                      type="text"
                      value={formState.qrisMerchantCity || ''}
                      onChange={(e) => handleChange('qrisMerchantCity', e.target.value)}
                      placeholder="MEDAN"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-komazi-muted mb-1">
                      Kode Pos:
                    </label>
                    <input
                      type="text"
                      value={formState.qrisPostalCode || ''}
                      onChange={(e) => handleChange('qrisPostalCode', e.target.value)}
                      placeholder="20112"
                      className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Uji Coba Scan QRIS Dinamis */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-komazi-coral/15 flex items-center justify-center text-komazi-coral shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-komazi-text block">Uji Coba Scan QRIS Dinamis</span>
                    <span className="text-[11px] text-komazi-muted">
                      Masukkan nominal untuk mencoba generate QRIS dan scan langsung dengan aplikasi bank atau e-wallet Anda
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-32">
                    <span className="absolute left-2.5 top-1.5 text-[11px] font-bold text-komazi-muted font-mono">Rp</span>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      value={testAmount}
                      onChange={(e) => setTestAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs font-bold font-mono text-komazi-text focus:border-komazi-coral outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenTestQr}
                    disabled={isGeneratingTestQr}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isGeneratingTestQr ? 'Memuat...' : 'Uji Scan'}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : <Save className="w-4 h-4" />}
                  <span>{isSaved ? 'Berhasil Disimpan!' : 'Simpan Konfigurasi QRIS'}</span>
                </button>
              </div>
            </div>

            {/* Konfigurasi Transfer Bank Toko */}
            <BankTransferSettingsCard
              formState={formState}
              setFormState={setFormState}
            />
          </div>
        )}

        {/* 3. Pajak, Service Fee & Pembulatan */}
        {activeTab === 'tax' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
              <div className="flex items-center gap-2 border-b border-komazi-border pb-3">
                <Percent className="w-5 h-5 text-warning" />
                <h2 className="font-bold text-sm text-komazi-text">Kalkulasi Pajak & Service Charge</h2>
              </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* PPN / PB1 */}
            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-komazi-text">Pajak PB1 / PPN Resto</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.taxEnabled}
                    onChange={(e) => handleChange('taxEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-komazi-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-komazi-coral"></div>
                </label>
              </div>
              <div>
                <label className="block text-[11px] text-komazi-muted mb-1">Persentase (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formState.taxPercentage}
                  onChange={(e) => handleChange('taxPercentage', Number(e.target.value))}
                  className="w-full p-2 rounded-lg bg-komazi-surface border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>
            </div>

            {/* Service Charge */}
            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-komazi-text">Service Charge</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.serviceFeeEnabled}
                    onChange={(e) => handleChange('serviceFeeEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-komazi-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-komazi-teal"></div>
                </label>
              </div>
              <div>
                <label className="block text-[11px] text-komazi-muted mb-1">Persentase (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formState.serviceFeePercentage}
                  onChange={(e) => handleChange('serviceFeePercentage', Number(e.target.value))}
                  className="w-full p-2 rounded-lg bg-komazi-surface border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>
            </div>
          </div>
        </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? 'Berhasil Disimpan!' : 'Simpan Pajak & Biaya'}</span>
              </button>
            </div>
          </div>
        )}


        {/* 4. Printer & Hardware Thermal POS */}
        {activeTab === 'printer' && (
          <PrinterPage isEmbedded={true} />
        )}

        {/* 5. Notifikasi & Bot Telegram */}
        {activeTab === 'integrations' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Sub-tab Switcher: Android vs Telegram */}
            <div className="flex items-center gap-1.5 p-1 bg-komazi-surface border border-komazi-border rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setIntegrationSubTab('android')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  integrationSubTab === 'android'
                    ? 'bg-komazi-coral text-white shadow-sm'
                    : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notifikasi</span>
              </button>
              <button
                type="button"
                onClick={() => setIntegrationSubTab('telegram')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  integrationSubTab === 'telegram'
                    ? 'bg-komazi-coral text-white shadow-sm'
                    : 'text-komazi-muted hover:text-white hover:bg-komazi-surface-2'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Bot Telegram</span>
              </button>
            </div>

            {integrationSubTab === 'android' ? (
              <div className="animate-fadeIn">
                <AndroidNotificationCard />
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                <TelegramBotSettingsCard
                  formState={formState}
                  setFormState={setFormState}
                  currentUser={currentUser}
                  onSave={handleSave}
                  isSaved={isSaved}
                />

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={currentUser?.role !== 'OWNER'}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 ${
                      currentUser?.role === 'OWNER'
                        ? 'bg-komazi-coral hover:bg-komazi-coral-dark text-white cursor-pointer'
                        : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-komazi-border'
                    }`}
                  >
                    {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : <Save className="w-4 h-4" />}
                    <span>{isSaved ? 'Berhasil Disimpan!' : 'Simpan Pengaturan Bot Telegram'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. Keamanan & PIN Supervisor serta Hub HRIS */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-fadeIn">
            {/* PIN Otorisasi Supervisor & Keamanan Card */}
            <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                    <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-sm text-komazi-text">PIN Otorisasi Supervisor &amp; Keamanan Outlet</h2>
                    </div>
                    <p className="text-[11px] text-komazi-muted">
                      PIN otorisasi mandiri untuk pembatalan transaksi (Void), pengembalian dana (Refund), dan reset kata sandi
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center gap-2 text-xs">
                    <span className="text-[11px] text-komazi-muted font-medium">PIN Aktif:</span>
                    <span className="font-mono font-bold text-komazi-text tracking-widest">
                      {showPin ? (formState.supervisorPin || '1234') : '••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="p-1 text-komazi-muted hover:text-komazi-text transition-colors"
                      title={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                    >
                      {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
                {/* Form Ubah PIN */}
                <div className="lg:col-span-7 space-y-4">
                  <form onSubmit={handleSavePin} className="space-y-3.5">
                    {pinError && (
                      <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{pinError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-komazi-muted mb-1 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-komazi-coral" />
                          <span>PIN Baru (4-6 Digit):</span>
                        </label>
                        <input
                          type={showPin ? 'text' : 'password'}
                          maxLength={6}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={newSupervisorPin}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setNewSupervisorPin(val);
                            if (pinError) setPinError('');
                          }}
                          placeholder="Contoh: 8899"
                          disabled={currentUser?.role !== 'OWNER' || isSavingPin}
                          className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none tracking-widest font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-komazi-muted mb-1 flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-komazi-coral" />
                          <span>Konfirmasi PIN Baru:</span>
                        </label>
                        <input
                          type={showPin ? 'text' : 'password'}
                          maxLength={6}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={confirmSupervisorPin}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setConfirmSupervisorPin(val);
                            if (pinError) setPinError('');
                          }}
                          placeholder="Ketik ulang PIN"
                          disabled={currentUser?.role !== 'OWNER' || isSavingPin}
                          className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none tracking-widest font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <p className="text-[11px] text-komazi-muted">
                        PIN bawaan sistem: <code className="bg-komazi-surface-2 px-1.5 py-0.5 rounded border border-komazi-border text-komazi-coral font-mono font-bold">1234</code>
                      </p>

                      <button
                        type="submit"
                        disabled={currentUser?.role !== 'OWNER' || isSavingPin || !newSupervisorPin}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                        <span>{isSavingPin ? 'Menyimpan...' : 'Simpan PIN Otorisasi'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Panduan Penggunaan PIN */}
                <div className="lg:col-span-5 p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2.5 text-xs">
                  <span className="font-bold text-komazi-text flex items-center gap-1.5 text-xs">
                    <Shield className="w-4 h-4 text-komazi-teal-light" />
                    <span>Lingkup Otorisasi PIN:</span>
                  </span>

                  <ul className="space-y-2 text-[11px] text-komazi-muted">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                      <span><b>Void Transaksi:</b> Kasir wajib meminta PIN ini saat pesanan PAID dibatalkan.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                      <span><b>Refund Dana:</b> Diperlukan saat memproses pengembalian uang penjualan kasir.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-komazi-coral mt-1.5 shrink-0" />
                      <span><b>Otorisasi Manajerial:</b> Kunci verifikasi darurat Void &amp; Refund di POS (reset password staf dikelola via token di modul Staf / HRIS).</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Card Pengaturan: Aturan Validasi Jadwal Kerja (Schedule Guard) */}
            <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    formState.enforceScheduleGuard
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    <CalendarCheck className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                      <span>Keamanan Presensi Staf</span>
                    </h2>
                    <p className="text-[11px] text-komazi-muted">
                      Atur validasi jadwal kerja untuk presensi staf
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-semibold text-komazi-muted">Wajibkan Jadwal:</span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(formState.enforceScheduleGuard)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          handleChange('enforceScheduleGuard', val);
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

              <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  {formState.enforceScheduleGuard ? (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold text-komazi-text">
                      {formState.enforceScheduleGuard
                        ? 'Mode Ketat Aktif: Staf wajib memiliki jadwal terdaftar hari ini DAN wajib presensi sebelum dapat membuka kasir & bertransaksi.'
                        : 'Mode Fleksibel Aktif: Staf dapat presensi tanpa jadwal harian, namun tetap wajib presensi sebelum membuka kasir & bertransaksi.'}
                    </p>
                    <p className="text-[11px] text-komazi-muted leading-relaxed">
                      {formState.enforceScheduleGuard
                        ? 'Pastikan Owner atau Manajer selalu menginput jadwal staf setiap hari sebelum outlet buka agar staf dapat presensi dan melayani transaksi kasir.'
                        : 'Jika Owner belum sempat menginput jadwal kerja, staf tetap dapat bekerja dengan melakukan presensi mandiri terlebih dahulu untuk membuka akses kasir.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Anti-Fraud & Validasi Kehadiran Presensi */}
              <div className="pt-4 border-t border-komazi-border/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                        <span>Anti-Fraud &amp; Validasi Presensi Staf</span>
                      </h3>
                      <p className="text-[11px] text-komazi-muted">
                        Cegah presensi titip/palsu dari luar outlet dengan Geofencing GPS dan Foto Selfie
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-grid options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option 1: Geofencing GPS */}
                  <div className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-komazi-coral" />
                        <span className="font-bold text-xs text-komazi-text">Validasi Lokasi (GPS)</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(formState.attendanceGeofenceEnabled)}
                          onChange={(e) => {
                            const val = e.target.checked;
                            handleChange('attendanceGeofenceEnabled', val);
                            updateSettings({ attendanceGeofenceEnabled: val });
                            toast.success(
                              val
                                ? 'Validasi Geofencing GPS diaktifkan: Staf harus berada di area outlet.'
                                : 'Validasi Geofencing dinonaktifkan: Staf dapat presensi bebas lokasi.'
                            );
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-komazi-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-komazi-coral"></div>
                      </label>
                    </div>

                    <p className="text-[11px] text-komazi-muted leading-relaxed">
                      Staf wajib mengaktifkan GPS dan berada dalam radius outlet untuk dapat melakukan presensi.
                    </p>

                    {formState.attendanceGeofenceEnabled && (
                      <div className="space-y-3 pt-2 border-t border-komazi-border/60">
                        {/* Koordinat Outlet */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold uppercase text-komazi-muted">
                              Titik Koordinat Outlet:
                            </label>
                            <button
                              type="button"
                              onClick={handleDetectCurrentLocation}
                              disabled={isDetectingLocation}
                              className="text-[10px] text-komazi-coral hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <LocateFixed className={`w-3 h-3 ${isDetectingLocation ? 'animate-spin' : ''}`} />
                              <span>{isDetectingLocation ? 'Mendeteksi...' : 'Ambil Lokasi Saya Sekarang'}</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Latitude (mis: -6.2088)"
                              value={formState.outletLatitude || ''}
                              onChange={(e) => {
                                handleChange('outletLatitude', e.target.value);
                                updateSettings({ outletLatitude: e.target.value });
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Longitude (mis: 106.8456)"
                              value={formState.outletLongitude || ''}
                              onChange={(e) => {
                                handleChange('outletLongitude', e.target.value);
                                updateSettings({ outletLongitude: e.target.value });
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral outline-none"
                            />
                          </div>
                        </div>

                        {/* Radius Toleransi */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-komazi-muted mb-1">
                            Batas Radius Maksimal:
                          </label>
                          <select
                            value={formState.attendanceRadiusMeters || 100}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              handleChange('attendanceRadiusMeters', val);
                              updateSettings({ attendanceRadiusMeters: val });
                              toast.success(`Radius presensi outlet disetel ke ${val} meter`);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-text focus:border-komazi-coral outline-none"
                          >
                            <option value={50}>50 meter (Sangat Ketat - Di Dalam Cafe)</option>
                            <option value={100}>100 meter (Standar Outlet Cafe)</option>
                            <option value={200}>200 meter (Area Parkir &amp; Sekitarnya)</option>
                            <option value={500}>500 meter (Kompleks Ruko / Gedung Mall)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Option 2: Live Selfie Photo */}
                  <div className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-komazi-coral" />
                        <span className="font-bold text-xs text-komazi-text">Wajib Foto Selfie</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(formState.attendanceSelfieRequired)}
                          onChange={(e) => {
                            const val = e.target.checked;
                            handleChange('attendanceSelfieRequired', val);
                            updateSettings({ attendanceSelfieRequired: val });
                            toast.success(
                              val
                                ? 'Bukti foto selfie diaktifkan: Staf wajib mengambil selfie saat presensi.'
                                : 'Bukti foto selfie dinonaktifkan.'
                            );
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-komazi-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-komazi-coral"></div>
                      </label>
                    </div>

                    <p className="text-[11px] text-komazi-muted leading-relaxed">
                      Mewajibkan staf mengambil foto selfie langsung menggunakan kamera perangkat saat Clock-In untuk mencegah titip presensi antar staf.
                    </p>

                    <div className="p-3 rounded-xl bg-komazi-surface border border-komazi-border text-[11px] text-komazi-muted space-y-1">
                      <div className="flex items-center gap-1.5 text-komazi-text font-semibold">
                        <Sparkles className="w-3.5 h-3.5 text-komazi-coral" />
                        <span>Verifikasi Visual untuk Owner</span>
                      </div>
                      <p>
                        Foto selfie staf akan tersimpan di riwayat presensi HRIS dan dapat ditinjau oleh Owner/Manajer sewaktu-waktu.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Modal: Simulasi & Uji Coba QRIS Dinamis */}
      {showQrPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                  <QrCode className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Simulasi QRIS Dinamis</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Uji coba pemindaian langsung dengan m-Banking / e-Wallet Anda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrPreviewModal(false)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center text-center space-y-3 pt-2">
              <div className="p-3 bg-white rounded-2xl border-4 border-komazi-coral shadow-lg">
                {testQrUrl ? (
                  <img src={testQrUrl} alt="Preview QRIS" className="w-52 h-52 object-contain" />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-xs text-neutral-400">
                    Memuat QR...
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-block font-mono">
                    Nominal Uji: {formatRupiah(testAmount)}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 inline-block">
                    QRIS Dinamis Otomatis
                  </span>
                </div>
                <p className="font-mono text-xs text-komazi-text font-bold pt-1">
                  {formState.qrisMerchantName || 'KOMAZI COFFEE & WORKSPACE'}
                </p>
                <p className="text-[11px] text-komazi-muted">
                  NMID: {formState.qrisNmid || 'ID1020088920199'} • Kota: {formState.qrisMerchantCity || 'MEDAN'}
                </p>
                <p className="text-[10px] text-emerald-400/90 font-medium pt-0.5">
                  ✓ Siap di-scan dengan ShopeePay, BCA, GoPay, DANA, dan semua m-Banking
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowQrPreviewModal(false)}
                className="w-full py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                Tutup Simulasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Akun Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Tambah Akun Staf Baru</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Buat kredensial kasir, manager, atau pemilik
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                  Nama Lengkap Staf:
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="contoh: Siti Nurhaliza"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                  Username Akun (Untuk Login):
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="contoh: sitikasir"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                  Password Awal (Min. 6 Karakter):
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                  Pilih Role / Hak Akses:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { role: 'CASHIER', label: 'Kasir', desc: 'Akses POS & Meja' },
                    { role: 'BARISTA', label: 'Barista', desc: 'KDS Khusus Minuman' },
                    { role: 'KITCHEN', label: 'Dapur', desc: 'KDS Khusus Makanan' },
                    { role: 'MANAGER', label: 'Manager', desc: 'Stok & Shift' },
                    { role: 'OWNER', label: 'Owner', desc: 'Akses Penuh' },
                  ].map((item) => (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => setNewRole(item.role)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${newRole === item.role
                          ? 'border-komazi-coral bg-komazi-coral/10 text-komazi-coral'
                          : 'border-komazi-border bg-komazi-surface-2 text-komazi-muted hover:border-komazi-muted'
                        }`}
                    >
                      <p className="font-bold text-xs">{item.label}</p>
                      <p className="text-[10px] opacity-80 mt-0.5 leading-snug">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isSubmittingAdd ? 'Menyimpan...' : 'Simpan & Buat Akun'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Otorisasi Token Reset Password oleh Owner */}
      {showResetModal && targetUserForReset && (
        <OwnerResetPasswordModal
          targetUser={targetUserForReset}
          onClose={() => {
            setShowResetModal(false);
            setTargetUserForReset(null);
          }}
          onSuccess={() => {
            fetchUsers?.();
          }}
        />
      )}

      {/* Modal: Konfirmasi Hapus Akun */}
      {showDeleteModal && targetUserForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-sm text-komazi-text">Hapus Akun Staf?</h3>
              <p className="text-xs text-komazi-muted">
                Apakah Anda yakin ingin menghapus akun{' '}
                <strong className="text-komazi-text">{targetUserForDelete.name}</strong> (@
                {targetUserForDelete.username})? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUserSubmit}
                className="flex-1 py-2.5 rounded-xl bg-danger hover:bg-danger/80 text-white text-xs font-bold transition-colors shadow-md shadow-danger/20"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tautkan Akun Telegram Staf */}
      {showTelegramLinkModal && targetUserForTgLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 text-komazi-coral flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Tautkan Akun Telegram</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Hubungkan akun staf ke bot resmi @KomaziAssistant_bot
                  </p>
                </div>
              </div>
            </div>

            {/* Profil Staf Target */}
            <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-komazi-text text-sm">{targetUserForTgLink.name}</p>
                <p className="text-[11px] text-komazi-muted">Username: @{targetUserForTgLink.username}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30">
                {targetUserForTgLink.role}
              </span>
            </div>

            {/* Area Kode Tautan */}
            {isGeneratingTgCode ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-6 h-6 border-2 border-komazi-coral border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-komazi-muted">Membuat kode verifikasi aman...</p>
              </div>
            ) : generatedTgCode ? (
              <div className="space-y-3.5">
                <div className="p-4 rounded-xl bg-neutral-900 border border-komazi-border text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold text-komazi-muted tracking-wider block">
                    Kode Tautan Sekali Pakai (Berlaku 10 Menit)
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-2xl font-black text-komazi-coral tracking-widest select-all">
                      {generatedTgCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedTgCode);
                        setCopiedTgCode(true);
                        setTimeout(() => setCopiedTgCode(false), 2000);
                      }}
                      className="p-2 rounded-lg bg-komazi-surface hover:bg-komazi-surface-2 text-komazi-muted hover:text-komazi-coral border border-komazi-border transition-colors"
                      title="Salin Kode"
                    >
                      {copiedTgCode ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-komazi-muted">
                    {copiedTgCode ? '✅ Kode berhasil disalin ke clipboard!' : 'Klik tombol salin atau gunakan link langsung di bawah.'}
                  </p>
                </div>

                {/* Tombol Deep Link Telegram */}
                <a
                  href={`https://t.me/KomaziAssistant_bot?start=${generatedTgCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-komazi-coral/20 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Buka di Aplikasi Telegram (@KomaziAssistant_bot)</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>

                {/* Petunjuk Manual & Proteksi */}
                <div className="p-3 rounded-xl bg-komazi-surface-2/60 border border-komazi-border/60 text-[11px] space-y-1.5 text-neutral-300">
                  <p className="font-semibold text-komazi-text flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-success" />
                    <span>Cara Menautkan Manual:</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-komazi-muted text-[10.5px]">
                    <li>Buka bot Telegram <code className="text-komazi-coral font-mono">@KomaziAssistant_bot</code></li>
                    <li>Kirim perintah: <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">/start {generatedTgCode}</code></li>
                    <li>Atau cukup paste kode 8 digit tersebut langsung ke bot</li>
                  </ol>
                  <div className="pt-1 border-t border-komazi-border/40 text-[10px] text-komazi-muted flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Pengguna asing tanpa kode resmi akan otomatis ditolak dengan pesan alert.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs text-center">
                Gagal memuat kode tautan. Silakan tutup dan coba lagi.
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowTelegramLinkModal(false);
                  fetchUsers();
                }}
                className="w-full py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-text text-xs font-bold transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}