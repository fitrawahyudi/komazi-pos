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
  Radio,
  Zap,
  Printer,
  Send,
} from 'lucide-react';
import PrinterSettingsCard from '../components/settings/PrinterSettingsCard';
import ReceiptPreviewCard from '../components/settings/ReceiptPreviewCard';
import QrisUploader from '../components/settings/QrisUploader';
import {
  convertStaticToDynamicQris,
  generateQrDataUrl,
  DEFAULT_STATIC_QRIS,
  extractQrisMetadata,
} from '../utils/qris';
import { formatRupiah } from '../utils/format';
import { api } from '../services/api';
import Pagination from '../components/ui/Pagination';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') || 'outlet';

  const TABS = [
    { id: 'outlet', label: 'Profil & Struk', icon: Store, desc: 'Identitas outlet, kontak WhatsApp, WiFi & catatan struk kasir' },
    { id: 'payment', label: 'Pembayaran & QRIS', icon: QrCode, desc: 'QRIS dinamis EMVCo, foto merchant & webhook otomatis' },
    { id: 'tax', label: 'Pajak & Biaya', icon: Percent, desc: 'Kalkulasi persentase PB1 resto & service fee' },
    { id: 'printer', label: 'Printer & Hardware', icon: Printer, desc: 'Koneksi thermal printer, Bluetooth, USB & laci uang' },
    { id: 'integrations', label: 'AI & Bot Telegram', icon: Sparkles, desc: 'Konfigurasi failover AI server & bot Telegram' },
    { id: 'users', label: 'Staf & Hak Akses', icon: Users, desc: 'Manajemen akun kasir, barista, dapur, manager & owner' },
  ];

  const activeTab = TABS.some((t) => t.id === rawTab) ? rawTab : 'outlet';
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

  // QRIS Simulation & Test State
  const [testAmount, setTestAmount] = useState(10000);
  const [testQrUrl, setTestQrUrl] = useState('');
  const [testPayloadStr, setTestPayloadStr] = useState('');
  const [showQrPreviewModal, setShowQrPreviewModal] = useState(false);
  const [isGeneratingTestQr, setIsGeneratingTestQr] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

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
      setTestPayloadStr(payload);
      const url = await generateQrDataUrl(payload, { width: 300 });
      setTestQrUrl(url);
      setShowQrPreviewModal(true);
    } catch (err) {
      toast.error('Gagal membuat preview QRIS: ' + err.message);
    } finally {
      setIsGeneratingTestQr(false);
    }
  };

  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);

  const handleTestWebhookSimulation = async () => {
    setIsSimulatingWebhook(true);
    try {
      const res = await api.payments.simulate({ amount: testAmount });
      if (res && res.success) {
        showToast(res.message || 'Simulasi webhook sukses! Status pesanan berubah ke PAID');
      } else {
        showToast(res.message || 'Gagal simulasi', 'error');
      }
    } catch (err) {
      showToast('Gagal simulasi: ' + err.message, 'error');
    } finally {
      setIsSimulatingWebhook(false);
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

  const handleExtractFromText = () => {
    if (!formState.qrisStaticString || formState.qrisStaticString.trim().length < 20) {
      toast.error('Masukkan string payload QRIS yang valid terlebih dahulu');
      return;
    }
    const meta = extractQrisMetadata(formState.qrisStaticString);
    if (!meta || !meta.isValid) {
      toast.error('Format string QRIS tidak valid atau tag tidak dikenali');
      return;
    }
    setFormState((prev) => ({
      ...prev,
      qrisNmid: meta.nmid || prev.qrisNmid,
      qrisMerchantName: meta.merchantName || prev.qrisMerchantName,
      qrisMerchantCity: meta.merchantCity || prev.qrisMerchantCity,
      qrisPostalCode: meta.postalCode || prev.qrisPostalCode,
    }));
    toast.success('Metadata berhasil diperbarui dari teks QRIS!');
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

  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiStatusData, setAiStatusData] = useState(null);

  const fetchAiStatus = async () => {
    try {
      const res = await api.analytics.getAiStatus();
      if (res && res.success && res.data) {
        setAiStatusData(res.data);
        return res.data;
      }
    } catch {
      // Backend mungkin offline atau rute belum siap
    }
    return null;
  };

  useEffect(() => {
    fetchAiStatus();
  }, []);

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    try {
      const d = await fetchAiStatus();
      if (d) {
        const msg = `Status AI (.env): Groq (${d.groqConfigured ? 'Aktif ✅' : 'Belum diset ⚠️'}), Gemini (${d.geminiConfigured ? 'Aktif ✅' : 'Belum diset ⚠️'}), OpenRouter (${d.openrouterConfigured ? 'Aktif ✅' : 'Belum diset ⚠️'})`;
        showToast(msg);
      } else {
        showToast('Koneksi AI: Mode fallback deterministik lokal aktif otomatis.');
      }
    } catch {
      showToast('Backend offline: Mode fallback deterministik lokal aktif otomatis.');
    } finally {
      setIsTestingAi(false);
    }
  };

  const [telegramStatus, setTelegramStatus] = useState(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const fetchTelegramStatus = async () => {
    try {
      const res = await api.telegram.getStatus();
      if (res && res.success && res.data) {
        setTelegramStatus(res.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchTelegramStatus();
  }, []);

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    try {
      const res = await api.telegram.test();
      if (res && res.success) {
        showToast('Notifikasi uji coba berhasil dikirim ke Telegram!');
      } else {
        showToast(res.message || 'Gagal mengirim pesan Telegram', 'error');
      }
    } catch (err) {
      showToast('Gagal: ' + err.message, 'error');
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const res = await updateSettings(formState);
    setIsSaved(true);
    showToast(res?.message || 'Pengaturan outlet berhasil disimpan!');
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
          <Settings className="w-6 h-6 text-komazi-coral" />
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
                      telegramStatus?.configured ? 'bg-emerald-400' : 'bg-neutral-500'
                    }`}
                    title={telegramStatus?.configured ? 'Telegram Bot Aktif' : 'Telegram Bot Belum Dikonfigurasi'}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Helper Breadcrumb */}
      <div className="flex items-center justify-between text-xs text-komazi-muted px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-komazi-coral"></span>
          <span>
            Kategori: <strong className="text-white">{TABS.find((t) => t.id === activeTab)?.label}</strong> — {TABS.find((t) => t.id === activeTab)?.desc}
          </span>
        </div>
        <span className="text-[11px] text-neutral-500 hidden sm:inline">
          {TABS.findIndex((t) => t.id === activeTab) + 1} dari {TABS.length} Tab
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
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
                value={formState.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 3. WiFi Tamu & Struk Kasir */}
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
          <div className="flex items-center gap-2 border-b border-komazi-border pb-3">
            <Receipt className="w-5 h-5 text-komazi-teal-light" />
            <h2 className="font-bold text-sm text-komazi-text">WiFi Pelanggan & Catatan Struk</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1">
                Nama WiFi (SSID):
              </label>
              <input
                type="text"
                value={formState.wifiName}
                onChange={(e) => handleChange('wifiName', e.target.value)}
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1">
                Password WiFi:
              </label>
              <input
                type="text"
                value={formState.wifiPass}
                onChange={(e) => handleChange('wifiPass', e.target.value)}
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-komazi-muted mb-1">
              Pesan Footer Struk (Thermal Receipt):
            </label>
            <textarea
              rows="3"
              value={formState.receiptFooter}
              onChange={(e) => handleChange('receiptFooter', e.target.value)}
              className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
            />
          </div>
        </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? 'Berhasil Disimpan!' : 'Simpan Profil & Struk'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Konfigurasi Pembayaran QRIS Dinamis */}
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
                  <span>Konfigurasi QRIS Dinamis (Otomatis Nominal)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    EMVCo MPM
                  </span>
                </h2>
                <p className="text-[11px] text-komazi-muted">
                  Pelanggan tidak perlu mengetik nominal manual saat scan via m-banking atau e-wallet
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-komazi-muted">Aktifkan di Kasir & Struk:</span>
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

          {/* Quick Info Alert */}
          <div className="p-3.5 rounded-xl bg-komazi-teal/10 border border-komazi-teal/30 text-xs text-komazi-teal-light flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-komazi-teal-light shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white text-xs">
                Solusi Kompatibilitas ShopeePay, BCA, GoPay & DANA:
              </p>
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Untuk QRIS toko UMKM (seperti DANA Bisnis, BCA, atau ShopeePay Merchant), gunakan <strong className="text-white">Mode Kompatibel</strong>. Mode ini menyuntikkan nominal (<code className="text-komazi-coral font-mono">Tag 54</code>) secara otomatis tanpa mengubah Tag 01 ke '12' dan tanpa Tag 62, sehingga switch perbankan tidak menolak transaksi dengan alert <em>"Terjadi kesalahan sistem"</em>.
              </p>
            </div>
          </div>

          {/* QRIS Input Fields */}
          <div className="space-y-4">
            {/* Mode Pembuatan QRIS */}
            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-2">
                Pilih Mode Injeksi QRIS:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'compatible',
                    title: 'Mode Kompatibel (Direkomendasikan)',
                    badge: 'Bebas Error',
                    desc: 'Tag 01 tetap 11 + Tag 54 Nominal. Sangat cocok untuk QRIS DANA Bisnis, ShopeePay, BCA & GoPay.',
                  },
                  {
                    id: 'dynamic',
                    title: 'Mode Dinamis Penuh',
                    badge: 'Tag 01: 12',
                    desc: 'Untuk merchant dengan API Payment Gateway resmi (Midtrans, Xendit, ShopeePay Enterprise).',
                  },
                  {
                    id: 'raw',
                    title: 'Mode Statis Asli',
                    badge: 'Manual',
                    desc: 'QR asli toko tanpa modifikasi nominal. Pelanggan mengetik nominal bayar secara manual.',
                  },
                ].map((modeItem) => {
                  const isSelected = (formState.qrisMode || 'compatible') === modeItem.id;
                  return (
                    <button
                      key={modeItem.id}
                      type="button"
                      onClick={() => handleChange('qrisMode', modeItem.id)}
                      className={`p-3 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? 'border-komazi-coral bg-komazi-coral/10 text-white shadow-sm ring-1 ring-komazi-coral'
                          : 'border-komazi-border bg-komazi-surface-2 text-komazi-muted hover:border-komazi-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-komazi-text">{modeItem.title}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-komazi-coral text-white' : 'bg-komazi-surface text-komazi-muted'
                          }`}
                        >
                          {modeItem.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-komazi-muted leading-relaxed">{modeItem.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle Include Invoice Tag 62 */}
            <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-komazi-text block">Sertakan Nomor Invoice di QR (Tag 62)</span>
                <span className="text-[10px] text-komazi-muted leading-tight block mt-0.5">
                  Biarkan <strong className="text-neutral-300">Nonaktif</strong> jika menggunakan QRIS UMKM (DANA Bisnis). Menyertakan Tag 62 pada akun UMKM dapat menyebabkan ShopeePay menolak pembayaran.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(formState.qrisIncludeInvoice)}
                  onChange={(e) => handleChange('qrisIncludeInvoice', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-komazi-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-komazi-coral"></div>
              </label>
            </div>

            {/* Upload Foto QRIS Statis Merchant (Auto Decode & Extract) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-komazi-text">
                  Upload Foto / Brosur QRIS Statis Toko:
                </label>
                <span className="text-[11px] font-semibold text-komazi-coral">
                  Ekstraksi Payload & Metadata Otomatis ✨
                </span>
              </div>
              <p className="text-[11px] text-komazi-muted">
                Cukup upload file foto/gambar QRIS merchant Anda (dari aplikasi bank, DANA Bisnis, atau foto akrilik meja). Sistem akan otomatis membaca kode QR, mengekstrak String Payload, NMID, Nama Toko, Kota, dan Kode Pos secara instan tanpa perlu diketik manual!
              </p>
              <QrisUploader
                currentImageUrl={formState.qrisImageUrl}
                onExtracted={handleQrisExtracted}
              />
            </div>

            {/* String Payload QRIS Statis Toko */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold text-komazi-muted">
                  String Payload QRIS Statis Toko:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExtractFromText}
                    className="text-[11px] text-komazi-teal-light hover:underline font-semibold"
                    title="Ekstrak ulang NMID, Nama, Kota dari teks di bawah"
                  >
                    Ekstrak Metadata dari Teks
                  </button>
                  <span className="text-neutral-600">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleChange('qrisStaticString', DEFAULT_STATIC_QRIS);
                      const meta = extractQrisMetadata(DEFAULT_STATIC_QRIS);
                      if (meta) {
                        setFormState((prev) => ({
                          ...prev,
                          qrisStaticString: DEFAULT_STATIC_QRIS,
                          qrisNmid: meta.nmid,
                          qrisMerchantName: meta.merchantName,
                          qrisMerchantCity: meta.merchantCity,
                          qrisPostalCode: meta.postalCode,
                        }));
                      }
                      showToast('Menggunakan template default QRIS Komazi');
                    }}
                    className="text-[11px] text-komazi-coral hover:underline font-semibold"
                  >
                    Gunakan Template Default Komazi
                  </button>
                </div>
              </div>
              <textarea
                rows="3"
                value={formState.qrisStaticString || ''}
                onChange={(e) => handleChange('qrisStaticString', e.target.value)}
                placeholder="Tempelkan raw string QRIS toko atau upload foto di atas (contoh: 00020101021126660014ID.LINKAJA...)"
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono break-all"
              />
              <p className="text-[11px] text-komazi-muted mt-1">
                * Payload ini akan otomatis terisi saat foto QRIS diupload di atas, atau dapat Anda edit manual.
              </p>
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

            {/* Test Simulation Box */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-komazi-coral shrink-0" />
                <div>
                  <span className="text-xs font-bold text-komazi-text block">Uji Coba Scan QRIS Dinamis</span>
                  <span className="text-[11px] text-komazi-muted">
                    Tes generate QRIS dengan nominal tertentu dan coba scan dengan ShopeePay / HP Anda
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isGeneratingTestQr ? 'Memuat...' : 'Uji Scan'}</span>
                </button>
              </div>
            </div>

            {/* Webhook Automation Section */}
            <div className="pt-2 p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-komazi-border/50 pb-2.5">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-komazi-text">
                    Integrasi Webhook Otomatis (Uang Masuk → Langsung PAID)
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 w-fit">
                  Endpoint Siap Digunakan
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-komazi-muted">
                  URL Webhook Backend POS Komazi:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 rounded-lg bg-neutral-900 border border-komazi-border font-mono text-[11px] text-emerald-400 break-all select-all">
                    {typeof window !== 'undefined'
                      ? `${window.location.protocol}//${window.location.hostname}:4000/api/v1/payments/webhook`
                      : 'http://localhost:4000/api/v1/payments/webhook'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const url =
                        typeof window !== 'undefined'
                          ? `${window.location.protocol}//${window.location.hostname}:4000/api/v1/payments/webhook`
                          : 'http://localhost:4000/api/v1/payments/webhook';
                      navigator.clipboard.writeText(url);
                      setCopiedWebhookUrl(true);
                      setTimeout(() => setCopiedWebhookUrl(false), 2000);
                      showToast('URL Webhook berhasil disalin!');
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-komazi-surface border border-komazi-border hover:border-komazi-coral text-xs font-bold text-komazi-text transition-colors shrink-0"
                  >
                    {copiedWebhookUrl ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedWebhookUrl ? 'Tersalin' : 'Salin URL'}</span>
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-[11px] text-komazi-muted leading-relaxed">
                <div className="p-3 rounded-lg bg-komazi-surface border border-komazi-border space-y-1">
                  <span className="font-bold text-white block">Metode 1: DANA Bisnis (Gratis & Mandiri)</span>
                  <p>
                    Pasang aplikasi Android seperti <strong className="text-neutral-200">MacroDroid</strong> atau <strong className="text-neutral-200">Notification Forwarder</strong> di HP toko. Atur rule jika ada notifikasi dari DANA masuk, teruskan HTTP POST ke URL Webhook di atas.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-komazi-surface border border-komazi-border space-y-1">
                  <span className="font-bold text-white block">Metode 2: Payment Gateway (Midtrans/Xendit)</span>
                  <p>
                    Salin URL Webhook di atas dan tempelkan ke menu <strong className="text-neutral-200">Payment Notification URL</strong> pada dashboard Midtrans atau Xendit outlet Anda.
                  </p>
                </div>
              </div>

              {/* Quick Test Webhook Button */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-komazi-border/50">
                <span className="text-[11px] text-komazi-muted">
                  Ingin menguji apakah sistem auto-paid merespons?
                </span>
                <button
                  type="button"
                  onClick={handleTestWebhookSimulation}
                  disabled={isSimulatingWebhook}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isSimulatingWebhook ? 'Menguji...' : 'Uji Kirim Webhook (Simulasi Uang Masuk)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? 'Berhasil Disimpan!' : 'Simpan Konfigurasi QRIS'}</span>
              </button>
            </div>
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
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95"
              >
                {isSaved ? <Check className="w-4 h-4 stroke-[3]" /> : <Save className="w-4 h-4" />}
                <span>{isSaved ? 'Berhasil Disimpan!' : 'Simpan Pajak & Biaya'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. Konfigurasi Printer Kasir & Hardware */}
        {activeTab === 'printer' && (
          <div className="space-y-6 animate-fadeIn">
            <PrinterSettingsCard />
            <ReceiptPreviewCard />
          </div>
        )}

        {/* 5. Integrasi AI & Bot Telegram */}
        {activeTab === 'integrations' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-komazi-border pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-komazi-primary" />
              <div>
                <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                  Integrasi Komazi AI
                </h2>
                <p className="text-[11px] text-komazi-muted">
                  Seluruh API Key kecerdasan buatan dikelola secara aman melalui file environment (<code className="px-1 py-0.5 rounded bg-komazi-surface-2 font-mono text-[10px] text-komazi-primary">.env</code>) di server backend untuk melindungi kredensial.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestAiConnection}
              disabled={isTestingAi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-komazi-primary/10 hover:bg-komazi-primary/20 border border-komazi-primary/30 text-komazi-primary text-xs font-semibold transition-all active:scale-95 shrink-0"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isTestingAi ? 'Memeriksa...' : 'Uji Status AI'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tier 1: Groq Cloud LPU */}
            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Tier 1 (Utama): Groq Cloud LPU
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                  Ultra-Fast (~300ms)
                </span>
              </div>

              {/* Status Box */}
              <div className="p-3 rounded-lg bg-komazi-surface border border-komazi-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-komazi-muted block">Status Kunci API:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {aiStatusData?.groqConfigured || settings.aiGroqConfigured ? (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Terkonfigurasi 
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Belum diatur di .env
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-komazi-muted block">Variabel Server:</span>
                  <code className="text-[11px] font-mono text-komazi-text font-semibold bg-komazi-surface-2 px-1.5 py-0.5 rounded">
                    GROQ_API_KEY
                  </code>
                </div>
              </div>

              {/* Model Info */}
              <div className="p-2.5 rounded-lg bg-komazi-surface/50 border border-komazi-border/50 text-[11px] text-komazi-muted space-y-1">
                <div className="flex items-center justify-between">
                  <span>Model Aktif:</span>
                  <span className="font-mono text-komazi-text font-semibold">
                    {aiStatusData?.groqModel || settings.aiGroqModel || 'openai/gpt-oss-120b'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Akselerasi Inferensi:</span>
                  <span className="text-emerald-400 font-semibold">LPU Hardware Engine</span>
                </div>
              </div>
            </div>

            {/* Tier 2: Google Gemini Cloud AI */}
            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Tier 2 (Fallback 1): Google Gemini
                </span>
                <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded">
                  Generative Cloud AI
                </span>
              </div>

              {/* Status Box */}
              <div className="p-3 rounded-lg bg-komazi-surface border border-komazi-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-komazi-muted block">Status Kunci API:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {aiStatusData?.geminiConfigured || settings.aiGeminiConfigured ? (
                      <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Terkonfigurasi 
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Belum diatur di .env
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-komazi-muted block">Variabel Server:</span>
                  <code className="text-[11px] font-mono text-komazi-text font-semibold bg-komazi-surface-2 px-1.5 py-0.5 rounded">
                    GEMINI_API_KEY
                  </code>
                </div>
              </div>

              {/* Model Info */}
              <div className="p-2.5 rounded-lg bg-komazi-surface/50 border border-komazi-border/50 text-[11px] text-komazi-muted space-y-1">
                <div className="flex items-center justify-between">
                  <span>Model Gemini:</span>
                  <span className="font-mono text-komazi-text font-semibold">
                    {aiStatusData?.geminiModel || settings.aiGeminiModel || 'gemini-1.5-flash'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Akselerasi Model:</span>
                  <span className="text-cyan-400 font-semibold">Google Cloud TPU/Multimodal</span>
                </div>
              </div>
            </div>

            {/* Tier 3: OpenRouter Cloud */}
            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-komazi-text flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  Tier 3 (Fallback 2): OpenRouter
                </span>
                <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded">
                  High-Availability LLM
                </span>
              </div>

              {/* Status Box */}
              <div className="p-3 rounded-lg bg-komazi-surface border border-komazi-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-komazi-muted block">Status Kunci API:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {aiStatusData?.openrouterConfigured || settings.aiOpenRouterConfigured ? (
                      <span className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Terkonfigurasi 
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Belum diatur di .env
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-komazi-muted block">Variabel Server:</span>
                  <code className="text-[11px] font-mono text-komazi-text font-semibold bg-komazi-surface-2 px-1.5 py-0.5 rounded">
                    OPENROUTER_API_KEY
                  </code>
                </div>
              </div>

              {/* Model Info */}
              <div className="p-2.5 rounded-lg bg-komazi-surface/50 border border-komazi-border/50 text-[11px] text-komazi-muted space-y-1">
                <div className="flex items-center justify-between">
                  <span>Model Cadangan:</span>
                  <span className="font-mono text-komazi-text font-semibold">
                    {aiStatusData?.openrouterModel || settings.aiOpenRouterModel || 'meta-llama/llama-3.3-70b-instruct'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Waktu Failover:</span>
                  <span className="text-blue-400 font-semibold">Otomatis (&gt;3.5s / 429)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Secure Environment Variables Notice */}
          <div className="p-3.5 rounded-xl bg-komazi-surface-2/70 border border-komazi-border text-xs text-komazi-muted space-y-1.5">
            <div className="flex items-center gap-2 text-komazi-text font-semibold">
              <ShieldCheck className="w-4 h-4 text-komazi-primary" />
              <span>Panduan Pengaturan API Key (.env)</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Demi keamanan, seluruh API Key tidak diinput melalui browser ini agar tidak terekspos ke perangkat kasir atau pihak lain. Untuk memperbarui atau memasukkan API Key, edit file <code className="px-1 py-0.5 rounded bg-komazi-surface text-komazi-primary font-mono text-[10px]">backend/.env</code> pada server:
            </p>
            <div className="p-2.5 rounded-lg bg-black/40 border border-komazi-border/50 font-mono text-[11px] text-komazi-text space-y-0.5">
              <div><span className="text-komazi-muted"># Tier 1: Groq Cloud LPU (Console: console.groq.com)</span></div>
              <div className="text-emerald-400">GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx</div>
              <div><span className="text-komazi-muted"># Tier 2: Google Gemini (Console: aistudio.google.com)</span></div>
              <div className="text-cyan-400">GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxx</div>
              <div><span className="text-komazi-muted"># Tier 3: OpenRouter (Console: openrouter.ai)</span></div>
              <div className="text-blue-400">OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx</div>
              <div><span className="text-komazi-muted"># Tier 4: Komazi Deterministic Engine (Offline Local Built-in, tanpa API Key)</span></div>
            </div>
            <p className="text-[10px] text-komazi-muted">
              💡 Setelah mengubah file <code className="font-mono">.env</code>, lakukan restart server backend agar nilai baru terbaca.
            </p>
          </div>
        </div>

            {/* Telegram Notification & Control Box */}
            <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
                      <span>Notifikasi & Bot Telegram Realtime</span>
                      {telegramStatus?.configured ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success border border-success/30">
                          Bot Terhubung
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          Belum Diatur di .env
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-komazi-muted">
                      Kirim notifikasi otomatis saat pesanan baru dibayar, peringatan stok menipis, dan cek omzet via Telegram.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={isTestingTelegram}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-xs font-semibold transition-all active:scale-95 shrink-0 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingTelegram ? 'Mengirim...' : 'Uji Kirim Telegram'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                  <span className="font-bold text-komazi-text block">Variabel Server (backend/.env):</span>
                  <div className="font-mono text-[11px] space-y-1 text-neutral-300">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-komazi-border">
                      <div className="text-komazi-muted">TELEGRAM_BOT_TOKEN=...</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-komazi-muted">
                    Notifikasi transaksi otomatis dikirim ke akun dengan role <b>Owner</b> &amp; <b>Manager</b> yang menautkan Telegram melalui tautan staf.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                  <span className="font-bold text-komazi-text block">Perintah Kontrol Bot Tersedia:</span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                    <span className="px-2 py-1 rounded bg-komazi-surface border border-komazi-border/60 text-komazi-coral">/omzet</span>
                    <span className="px-2 py-1 rounded bg-komazi-surface border border-komazi-border/60 text-warning">/stok</span>
                    <span className="px-2 py-1 rounded bg-komazi-surface border border-komazi-border/60 text-success">/menu_laris</span>
                    <span className="px-2 py-1 rounded bg-komazi-surface border border-komazi-border/60 text-teal-400">/laporan</span>
                    <span className="px-2 py-1 rounded bg-komazi-surface border border-komazi-border/60 text-purple-400">/profit</span>
                    <span className="px-2 py-1 rounded bg-komazi-surface border border-komazi-border/60 text-blue-400">/prediksi</span>
                  </div>
                  <p className="text-[10px] text-komazi-muted">
                    Bot otomatis memvalidasi Chat ID admin sebelum menampilkan data omzet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. Manajemen Akun Pengguna */}
        {activeTab === 'users' && (
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
                      {currentUser?.role === 'OWNER' ? (
                        <span className="px-2 py-0.5 rounded-full bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 text-[10px] font-bold">
                          Khusus Owner
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-komazi-muted border border-komazi-border text-[10px] font-bold">
                          Hanya Baca
                        </span>
                      )}
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
                      <span><b>Reset Sandi Staf:</b> Kunci verifikasi darurat di halaman Login jika kasir lupa password.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-komazi-coral" />
              <div>
                <h2 className="font-bold text-sm text-komazi-text">Manajemen Staf & Hak Akses</h2>
                <p className="text-[11px] text-komazi-muted">
                  Kelola staf kasir, supervisor manager, dan pemilik outlet
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-komazi-coral/15 hover:bg-komazi-coral text-komazi-coral hover:text-white font-bold text-xs border border-komazi-coral/30 transition-all active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tambah Akun Staf</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {paginatedUsers.map((u) => {
              const isCurrent = currentUser?.id === u.id || currentUser?.username === u.username;
              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-komazi-border/80 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${u.role === 'OWNER'
                          ? 'bg-komazi-coral/20 text-komazi-coral'
                          : u.role === 'MANAGER'
                            ? 'bg-komazi-teal/20 text-komazi-teal-light'
                            : u.role === 'KITCHEN'
                              ? 'bg-amber-500/20 text-amber-400'
                              : u.role === 'BARISTA'
                                ? 'bg-komazi-teal/20 text-komazi-teal-light'
                                : 'bg-komazi-surface text-komazi-muted'
                        }`}
                    >
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-komazi-text">{u.name}</p>
                        {isCurrent && (
                          <span className="text-[10px] bg-komazi-border text-komazi-muted px-1.5 py-0.2 rounded font-medium">
                            Anda
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-komazi-muted">Username: @{u.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-between sm:justify-end">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${u.role === 'OWNER'
                            ? 'bg-komazi-coral-soft text-komazi-coral border border-komazi-coral/30'
                            : u.role === 'MANAGER'
                              ? 'bg-komazi-teal/15 text-komazi-teal-light border border-komazi-teal/30'
                              : u.role === 'KITCHEN'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : u.role === 'BARISTA'
                                  ? 'bg-komazi-teal/15 text-komazi-teal-light border border-komazi-teal/30'
                                  : 'bg-komazi-surface text-komazi-muted border border-komazi-border'
                          }`}
                      >
                        {u.role === 'KITCHEN' ? 'DAPUR' : u.role === 'BARISTA' ? 'BARISTA' : u.role}
                      </span>
                      <span className="text-success text-[11px] font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                        Aktif
                      </span>

                      {/* Telegram Account Link Status */}
                      {u.telegramId ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-semibold">
                          <Send className="w-2.5 h-2.5" />
                          <span>@{u.telegramUsername || 'Tertaut'}</span>
                          <button
                            type="button"
                            onClick={() => handleUnlinkTelegram(u)}
                            title="Putuskan Tautan Telegram"
                            className="text-neutral-400 hover:text-danger ml-0.5 transition-colors"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenTgLinkModal(u)}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-500/15 hover:bg-blue-500 text-blue-400 hover:text-white font-semibold text-[10px] border border-blue-500/30 transition-all active:scale-95"
                          title="Tautkan akun staf ke Telegram"
                        >
                          <Send className="w-2.5 h-2.5" />
                          <span>Tautkan Telegram</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-komazi-border">
                      {/* Reset Password Button */}
                      <button
                        type="button"
                        title="Reset Password Akun Ini"
                        onClick={() => {
                          setTargetUserForReset(u);
                          setTargetNewPassword('');
                          setTargetConfirmPassword('');
                          setResetError('');
                          setShowResetModal(true);
                        }}
                        className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-coral hover:bg-komazi-surface transition-colors"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      {/* Delete User Button (not allowed for own account) */}
                      <button
                        type="button"
                        title={isCurrent ? 'Tidak bisa menghapus akun yang sedang digunakan' : 'Hapus Akun'}
                        disabled={isCurrent}
                        onClick={() => {
                          setTargetUserForDelete(u);
                          setShowDeleteModal(true);
                        }}
                        className="p-1.5 rounded-lg text-komazi-muted hover:text-danger hover:bg-komazi-surface transition-colors disabled:opacity-30 disabled:hover:text-komazi-muted"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {usersList.length > 0 && (
            <Pagination
              currentPage={userPage}
              totalItems={usersList.length}
              itemsPerPage={usersPerPage}
              onPageChange={setUserPage}
              onItemsPerPageChange={(newLimit) => {
                setUsersPerPage(newLimit);
                setUserPage(1);
              }}
              itemLabel="akun staf"
            />
          )}
        </div>
          </div>
        )}
      </form>

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

              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-block">
                    Tag 54 Nominal: {formatRupiah(testAmount)}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-komazi-coral/15 text-komazi-coral border border-komazi-coral/30 inline-block">
                    {formState.qrisMode === 'dynamic' ? 'Mode Dinamis (Tag 01: 12)' : formState.qrisMode === 'raw' ? 'Mode Statis Asli' : 'Mode Kompatibel UMKM (Tag 01: 11)'}
                  </span>
                </div>
                <p className="font-mono text-xs text-komazi-text font-bold pt-1">
                  {formState.qrisMerchantName || 'KOMAZI COFFEE & WORKSPACE'}
                </p>
                <p className="text-[11px] text-komazi-muted">
                  NMID: {formState.qrisNmid || 'ID1020088920199'} • Kota: {formState.qrisMerchantCity || 'MEDAN'}
                </p>
                {(!formState.qrisMode || formState.qrisMode === 'compatible') && (
                  <p className="text-[10px] text-emerald-400/90 font-medium pt-0.5">
                    ✓ Aman di-scan ShopeePay, BCA, GoPay, dan DANA tanpa error "Kesalahan Sistem"
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-left w-full space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-komazi-muted">Payload EMVCo String:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(testPayloadStr);
                      setCopiedPayload(true);
                      setTimeout(() => setCopiedPayload(false), 2000);
                    }}
                    className="flex items-center gap-1 text-komazi-coral hover:underline"
                  >
                    {copiedPayload ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPayload ? 'Tersalin' : 'Salin String'}</span>
                  </button>
                </div>
                <div className="font-mono text-[10px] text-neutral-300 break-all p-2 rounded bg-neutral-900/50 max-h-20 overflow-y-auto">
                  {testPayloadStr}
                </div>
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

      {/* Modal: Reset Password User oleh Owner */}
      {showResetModal && targetUserForReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Reset Password Staf</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Atur ulang password untuk akun @{targetUserForReset.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-komazi-text">{targetUserForReset.name}</p>
                <p className="text-[11px] text-komazi-muted">@{targetUserForReset.username}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-komazi-border text-komazi-text">
                {targetUserForReset.role}
              </span>
            </div>

            {resetError && (
              <div className="p-3 rounded-xl bg-danger/15 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Password Baru (Min. 6 Karakter):
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={targetNewPassword}
                  onChange={(e) => setTargetNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Konfirmasi Password Baru:
                </label>
                <input
                  type="password"
                  required
                  value={targetConfirmPassword}
                  onChange={(e) => setTargetConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReset}
                  className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isSubmittingReset ? 'Menyimpan...' : 'Perbarui Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
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
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Tautkan Akun Telegram</h3>
                  <p className="text-[11px] text-komazi-muted">
                    Hubungkan akun staf ke bot resmi @KomaziAssistant_bot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTelegramLinkModal(false);
                  fetchUsers();
                }}
                className="p-1.5 rounded-lg text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95"
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
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
