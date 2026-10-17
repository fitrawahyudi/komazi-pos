import React, { useState } from 'react';
import {
  Wifi,
  Plus,
  Trash2,
  Edit2,
  QrCode,
  Copy,
  Check,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  Lock,
  MapPin,
  Sparkles,
  Download,
  Printer,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { generateQrDataUrl } from '../../utils/qris';

export default function WifiManagerCard() {
  const {
    settings,
    addWifiNetwork,
    updateWifiNetwork,
    deleteWifiNetwork,
    setDefaultWifiOnReceipt,
  } = useSettingsStore();

  const wifiList = settings?.wifiNetworks || [];

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrTargetNetwork, setQrTargetNetwork] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password visibility map (id -> boolean)
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPassword = (id, password) => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Password WiFi disalin ke clipboard');
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormName('');
    setFormPassword('');
    setFormLocation('Area Utama & Kasir');
    setFormIsDefault(wifiList.length === 0);
    setShowAddEditModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setFormPassword(item.password || '');
    setFormLocation(item.location || '');
    setFormIsDefault(Boolean(item.isDefaultOnReceipt));
    setShowAddEditModal(true);
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Nama WiFi (SSID) wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateWifiNetwork(editingItem.id, {
          name: formName,
          password: formPassword,
          location: formLocation,
          isDefaultOnReceipt: formIsDefault,
        });
        toast.success(`Jaringan WiFi "${formName}" diperbarui`);
      } else {
        await addWifiNetwork({
          name: formName,
          password: formPassword,
          location: formLocation,
          isDefaultOnReceipt: formIsDefault,
        });
        toast.success(`Jaringan WiFi "${formName}" berhasil ditambahkan`);
      }
      setShowAddEditModal(false);
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan jaringan WiFi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (confirm(`Hapus jaringan WiFi "${item.name}"?`)) {
      try {
        await deleteWifiNetwork(item.id);
        toast.success(`Jaringan WiFi "${item.name}" dihapus`);
      } catch (err) {
        toast.error('Gagal menghapus jaringan WiFi');
      }
    }
  };

  const handleSetDefault = async (item) => {
    try {
      await setDefaultWifiOnReceipt(item.id);
      toast.success(`WiFi "${item.name}" ditetapkan sebagai default struk`);
    } catch (err) {
      toast.error('Gagal mengatur WiFi default struk');
    }
  };

  const handleOpenQrModal = async (item) => {
    setQrTargetNetwork(item);
    // Standard Wi-Fi QR string: WIFI:S:<SSID>;T:<WPA|WEP|nopass>;P:<password>;;
    const wifiString = `WIFI:S:${item.name};T:${item.password ? 'WPA' : 'nopass'};P:${item.password || ''};;`;
    try {
      const url = await generateQrDataUrl(wifiString, { width: 280, margin: 1 });
      setQrDataUrl(url);
      setShowQrModal(true);
    } catch (err) {
      toast.error('Gagal membuat QR Code WiFi: ' + err.message);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-komazi-teal/15 border border-komazi-teal/30 flex items-center justify-center text-komazi-teal-light shrink-0">
            <Wifi className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-komazi-text flex items-center gap-2">
              <span>Manajemen WiFi Outlet &amp; Tamu (CRUD)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-komazi-teal/10 text-komazi-teal-light border border-komazi-teal/20">
                {wifiList.length} Jaringan
              </span>
            </h2>
            <p className="text-[11px] text-komazi-muted">
              Kelola SSID dan password WiFi untuk pelanggan, cetak otomatis di struk belanja, dan QR Code untuk scan langsung tanpa ketik password.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md shadow-komazi-coral/25 transition-all active:scale-95 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah WiFi</span>
        </button>
      </div>

      {/* List of WiFi Networks */}
      {wifiList.length === 0 ? (
        <div className="p-8 text-center bg-komazi-surface-2 rounded-xl border border-dashed border-komazi-border space-y-2">
          <Wifi className="w-8 h-8 text-komazi-muted mx-auto stroke-1" />
          <p className="text-xs font-bold text-komazi-text">Belum ada data jaringan WiFi</p>
          <p className="text-[11px] text-komazi-muted">
            Tambahkan nama WiFi dan password agar tercetak di struk kasir dan dapat di-scan pelanggan.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-komazi-coral text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {wifiList.map((item) => {
            const isVisible = visiblePasswords[item.id];
            const isCopied = copiedId === item.id;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl bg-komazi-surface-2 border transition-all space-y-3 ${
                  item.isDefaultOnReceipt
                    ? 'border-komazi-teal/60 shadow-sm'
                    : 'border-komazi-border hover:border-komazi-border/80'
                }`}
              >
                {/* Top Row: SSID and Default Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-komazi-coral shrink-0" />
                    <div>
                      <span className="font-mono font-bold text-sm text-komazi-text block tracking-tight">
                        {item.name}
                      </span>
                      {item.location && (
                        <span className="text-[10px] text-komazi-muted flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-neutral-500" />
                          {item.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {item.isDefaultOnReceipt ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 border border-success/30 text-success shrink-0">
                      <Check className="w-3 h-3" />
                      Aktif di Struk
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(item)}
                      className="px-2 py-0.5 rounded-lg bg-komazi-surface border border-komazi-border text-[10px] font-semibold text-komazi-muted hover:text-white transition-colors shrink-0"
                    >
                      Set di Struk
                    </button>
                  )}
                </div>

                {/* Password Strip */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-komazi-surface border border-komazi-border text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Lock className="w-3.5 h-3.5 text-komazi-muted shrink-0" />
                    <span className="text-[11px] text-komazi-muted shrink-0">Password:</span>
                    <span className="font-mono font-bold text-komazi-text truncate">
                      {isVisible ? item.password || '(Tanpa Password)' : '••••••••••••'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(item.id)}
                      className="p-1 rounded text-komazi-muted hover:text-white transition-colors"
                      title={isVisible ? 'Sembunyikan' : 'Tampilkan Password'}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyPassword(item.id, item.password)}
                      className="p-1 rounded text-komazi-muted hover:text-white transition-colors"
                      title="Salin Password"
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions Bottom Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-komazi-border/50 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleOpenQrModal(item)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-komazi-teal/15 hover:bg-komazi-teal/25 border border-komazi-teal/30 text-komazi-teal-light font-bold transition-all active:scale-95"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Code Tamu</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg bg-komazi-surface hover:bg-komazi-surface-2 border border-komazi-border text-komazi-muted hover:text-white transition-colors"
                      title="Edit WiFi"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger transition-colors"
                      title="Hapus WiFi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: TAMBAH / EDIT WIFI */}
      {/* ============================================================= */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-komazi-border bg-komazi-surface-2">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-komazi-coral" />
                <h3 className="font-bold text-sm text-komazi-text">
                  {editingItem ? 'Edit Jaringan WiFi' : 'Tambah Jaringan WiFi Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="p-1 rounded-lg text-komazi-muted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Nama WiFi (SSID) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: KOMAZI_HIGH_SPEED"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Password WiFi
                </label>
                <input
                  type="text"
                  placeholder="Contoh: kopikomazi2026"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-komazi-muted mb-1">
                  Lokasi / Area Pemasangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Lantai 1 Area Bar, Ruang VIP Coworking"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded accent-komazi-coral w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-komazi-text block">
                    Jadikan Default di Struk Kasir
                  </span>
                  <span className="text-[10px] text-komazi-muted">
                    Nama dan password WiFi ini akan otomatis tercetak di struk belanja kasir.
                  </span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-komazi-border">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface text-xs font-bold text-komazi-muted"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-md shadow-komazi-coral/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Jaringan WiFi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: QR CODE WIFI TAMU (SCAN LANGSUNG KONEK) */}
      {/* ============================================================= */}
      {showQrModal && qrTargetNetwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <div className="flex items-center gap-2 text-left">
                <div className="w-8 h-8 rounded-lg bg-komazi-coral/15 flex items-center justify-center text-komazi-coral">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">QR Code Akses WiFi</h3>
                  <p className="text-[10px] text-komazi-muted">Scan langsung via kamera HP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-lg text-komazi-muted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Image Box */}
            <div className="p-3 bg-white rounded-2xl border-4 border-komazi-coral/40 shadow-inner mx-auto inline-block">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR WiFi ${qrTargetNetwork.name}`}
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-500">
                  Membuat QR...
                </div>
              )}
            </div>

            {/* Network Info */}
            <div className="space-y-1">
              <span className="font-mono font-black text-sm text-komazi-text block tracking-wide">
                {qrTargetNetwork.name}
              </span>
              <div className="text-[11px] text-komazi-muted">
                Password: <strong className="font-mono text-white">{qrTargetNetwork.password || '(Tanpa Password)'}</strong>
              </div>
              {qrTargetNetwork.location && (
                <span className="text-[10px] text-neutral-400 block">
                  Lokasi: {qrTargetNetwork.location}
                </span>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-komazi-surface-2 text-[10px] text-komazi-muted text-left border border-komazi-border">
              💡 <strong>Tips:</strong> Tamu kafe tinggal membuka kamera di iPhone atau Android, lalu arahkan ke QR ini untuk langsung tersambung tanpa mengetik password manual.
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-komazi-border">
              <button
                type="button"
                onClick={() => handleCopyPassword(qrTargetNetwork.id, qrTargetNetwork.password)}
                className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-text transition-colors flex-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Pass</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold transition-all active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
