import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Check,
  Save,
  QrCode,
  ExternalLink,
  Printer,
  ShieldCheck,
  AlertCircle,
  Building2,
  Sparkles,
  Info,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { qrOrderService } from '../../services/qrOrderService';
import { useSettingsStore } from '../../store/settingsStore';
import { api } from '../../services/api';
import { toast } from '../../store/toastStore';
import TableQrCodeModal from './TableQrCodeModal';

const BANK_OPTIONS = [
  'BCA',
  'Bank Mandiri',
  'BRI',
  'BNI',
  'BSI',
  'Bank Jago',
  'SeaBank',
  'CIMB Niaga',
  'Permata Bank',
  'Bank Lainnya',
];

export default function QrOrderSettingsCard() {
  const [config, setConfig] = useState({
    enabled: false,
    bankName: 'BCA',
    accountNo: '',
    accountHolder: '',
    qrisUrl: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isUploadingQris, setIsUploadingQris] = useState(false);
  const fileInputRef = useRef(null);
  const { settings } = useSettingsStore();

  const handleUploadQrisFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (PNG, JPG, JPEG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    setIsUploadingQris(true);
    try {
      const res = await api.upload(file);
      const uploadedUrl = res?.url || res?.data?.url;
      if (uploadedUrl) {
        handleChange('qrisUrl', uploadedUrl);
        toast.success('Foto QRIS berhasil diunggah ke Cloudinary!');
      } else {
        throw new Error(res?.message || 'Gagal mengunggah gambar');
      }
    } catch (err) {
      toast.error(`Gagal upload ke Cloudinary: ${err.message}`);
    } finally {
      setIsUploadingQris(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUseStoreQris = () => {
    if (settings?.qrisImageUrl) {
      handleChange('qrisUrl', settings.qrisImageUrl);
      toast.success('URL QRIS Toko berhasil diterapkan!');
    } else {
      toast.warning('QRIS Toko belum diupload di tab Pembayaran & QRIS');
    }
  };

  // Fetch current config on mount
  useEffect(() => {
    let isMounted = true;
    qrOrderService
      .getConfig()
      .then((res) => {
        if (isMounted && res && res.success && res.data) {
          setConfig({
            enabled: Boolean(res.data.enabled),
            bankName: res.data.bankName || 'BCA',
            accountNo: res.data.accountNo || '',
            accountHolder: res.data.accountHolder || '',
            qrisUrl: res.data.qrisUrl || '',
          });
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat konfigurasi QR Order:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      await qrOrderService.updateSettings({
        enabled: config.enabled,
        bankName: config.bankName,
        accountNo: config.accountNo,
        accountHolder: config.accountHolder,
        qrisUrl: config.qrisUrl,
      });

      setIsSaved(true);
      toast.success(
        config.enabled
          ? 'Fitur QR Order Meja berhasil diaktifkan!'
          : 'Pengaturan QR Order berhasil disimpan.'
      );
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      toast.error(`Gagal menyimpan pengaturan: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-5">
        {/* Header & Status Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shrink-0">
              <Smartphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-komazi-text">
                  Customer Self-Order
                </h2>
                
              </div>
              <p className="text-[11px] text-komazi-muted mt-0.5">
                Pelanggan memesan & upload bukti transfer langsung dari smartphone via scan QR meja
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 self-start sm:self-auto bg-komazi-surface-2 px-3 py-1.5 rounded-xl border border-komazi-border">
            {config.enabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Aktif 
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-stone-500/15 text-stone-400 border border-stone-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                Nonaktif 
              </span>
            )}

            <label className="relative inline-flex items-center cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-komazi-coral cursor-pointer"></div>
            </label>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border/80 flex items-start gap-3">
          <Info className="w-4 h-4 text-komazi-coral shrink-0 mt-0.5" />
          <div className="text-[11px] text-komazi-muted space-y-1">
            <p className="font-semibold text-komazi-text">
              Bagaimana Alur Fitur Ini Berjalan?
            </p>
            <p>
              1. Tamu scan QR di meja &rarr; 2. Pilih menu & cek ketersediaan stok &rarr; 3. Transfer bank / scan QRIS & upload foto struk &rarr; 4. Kasir menerima notifikasi & memverifikasi bukti bayar di POS &rarr; 5. Pesanan langsung masuk antrean KDS dapur/bar.
            </p>
            <p className="text-amber-400/90 font-medium">
              *Jika status <strong>Nonaktif</strong>, halaman meja tetap bisa dibuka namun pelanggan diberi pesan ramah untuk memesan langsung ke kasir.
            </p>
          </div>
        </div>

        {/* Payment Destination Setup */}
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between border-b border-komazi-border pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-komazi-coral" />
              <h3 className="text-xs font-bold text-komazi-text">
                Rekening Pembayaran & QRIS untuk Pelanggan Meja
              </h3>
            </div>
            <span className="text-[10px] text-komazi-muted">
              Data ini akan ditampilkan di layar smartphone tamu saat checkout
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                Nama Bank / E-Wallet
              </label>
              <select
                value={config.bankName}
                onChange={(e) => handleChange('bankName', e.target.value)}
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
              >
                {BANK_OPTIONS.map((b) => (
                  <option key={b} value={b} className="bg-komazi-surface text-white">
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                Nomor Rekening / No. Virtual Account
              </label>
              <input
                type="text"
                value={config.accountNo}
                onChange={(e) => handleChange('accountNo', e.target.value)}
                placeholder="Contoh: 1234567890"
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-komazi-muted mb-1.5">
                Nama Pemilik Rekening 
              </label>
              <input
                type="text"
                value={config.accountHolder}
                onChange={(e) => handleChange('accountHolder', e.target.value)}
                placeholder="Contoh: KOMAZI COFFEE"
                className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none uppercase"
              />
            </div>
          </div>

          {/* Upload QRIS ke Cloudinary & URL */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-komazi-muted">
                QRIS Toko
              </label>

              {settings?.qrisImageUrl && (
                <button
                  type="button"
                  onClick={handleUseStoreQris}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-komazi-surface-2 hover:bg-komazi-surface border border-komazi-border text-[11px] font-semibold text-komazi-coral transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
                  title="Gunakan QRIS toko yang sudah diunggah di Pengaturan Kasir"
                >
                  <Sparkles size={12} />
                  <span>Gunakan QRIS Toko</span>
                </button>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadQrisFile}
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
              {/* Preview Thumbnail Box */}
              <div className="sm:col-span-3 lg:col-span-2">
                {config.qrisUrl ? (
                  <div className="relative group w-full aspect-square bg-white rounded-xl border border-komazi-border overflow-hidden flex items-center justify-center p-2 shadow-inner">
                    <img
                      src={config.qrisUrl}
                      alt="Preview QRIS"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => handleChange('qrisUrl', '')}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/75 hover:bg-rose-600 text-white rounded-lg transition-colors cursor-pointer opacity-90 group-hover:opacity-100"
                      title="Hapus Gambar QRIS"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingQris}
                    className="w-full aspect-square rounded-xl border-2 border-dashed border-komazi-border hover:border-komazi-coral/50 bg-komazi-surface-2/60 flex flex-col items-center justify-center gap-1.5 text-komazi-muted hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingQris ? (
                      <Loader2 size={20} className="animate-spin text-komazi-coral" />
                    ) : (
                      <Upload size={20} className="text-komazi-coral" />
                    )}
                    <span className="text-[10px] font-bold text-center px-1">
                      {isUploadingQris ? 'Mengunggah...' : 'Upload QRIS'}
                    </span>
                  </button>
                )}
              </div>

              {/* Upload Action & URL Input */}
              <div className="sm:col-span-9 lg:col-span-10 space-y-2">
                <div className="flex items-center gap-2">

                  {config.qrisUrl && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                      <CheckCircle2 size={12} />
                      <span className="hidden sm:inline">Tersimpan</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={config.qrisUrl}
                    onChange={(e) => handleChange('qrisUrl', e.target.value)}
                    placeholder="Atau tempel URL Cloudinary: https://res.cloudinary.com/.../qris.png"
                    className="w-full p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-text focus:border-komazi-coral outline-none"
                  />
                </div>
                <p className="text-[10px] text-komazi-muted">
                  Klik tombol <strong>Upload QRIS</strong> untuk memilih file gambar (PNG, JPG, WebP) dari laptop/HP Anda. 
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Save */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-komazi-border">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-komazi-surface-2 hover:bg-komazi-surface border border-komazi-border text-xs font-bold text-komazi-text transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 text-komazi-coral" />
              <span>Cetak / Download QR Meja</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Pengaturan Tersimpan!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan QR Order'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Printable QR Code Modal */}
      <TableQrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </>
  );
}

