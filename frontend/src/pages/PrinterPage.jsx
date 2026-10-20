import React, { useState, useEffect } from 'react';
import {
  Printer,
  Bluetooth,
  Usb,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  Save,
  Check,
  Radio,
  FileText,
  Sliders,
  Wifi,
  Loader2,
  HelpCircle,
  Info,
  Eye,
  CheckSquare,
  Square,
  QrCode,
  Store,
  Receipt,
} from 'lucide-react';
import { usePrinterStore } from '../store/printerStore';
import { useSettingsStore } from '../store/settingsStore';
import { useUiStore } from '../store/uiStore';
import { toast } from '../store/toastStore';
import TestReceiptModal from '../components/settings/TestReceiptModal';
import { formatDateTime, formatRupiah } from '../utils/format';
import { generateQrSvgString, DEFAULT_STATIC_QRIS } from '../utils/qris';
import { isAndroid, isNative } from '../services/platform';

export default function PrinterPage({ isEmbedded = false }) {
  const { openBluetoothModal } = useUiStore();
  const {
    connectionType,
    paperWidth,
    autoPrintOnCheckout,
    autoPrintMerchantCopy,
    printCopies,
    kickCashDrawer,
    isConnected,
    isConnecting,
    connectedDeviceName,
    lastTestedAt,
    setPaperWidth,
    setConnectionType,
    setAutoPrintOnCheckout,
    setAutoPrintMerchantCopy,
    setPrintCopies,
    setKickCashDrawer,
    connectBluetooth,
    connectUsb,
    disconnectPrinter,
    testPrint,
    feedPaper,
  } = usePrinterStore();

  const { settings, updateSettings } = useSettingsStore();

  // Test receipt modal for browser driver testing
  const [showTestModal, setShowTestModal] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testQrSvg, setTestQrSvg] = useState('');

  // Receipt formatting & element visibility state
  const [receiptForm, setReceiptForm] = useState({
    storeName: settings?.storeName || 'Komazi Coffee',
    storeTagline: settings?.storeTagline || '',
    address: settings?.address || '',
    phone: settings?.phone || '',
    headerText: settings?.headerText || settings?.receiptHeader || '',
    receiptFooter: settings?.receiptFooter || settings?.footerText || 'Terima Kasih Atas Kunjungan Anda!',
    wifiName: settings?.wifiName || '',
    wifiPass: settings?.wifiPass || '',
    // Element Visibility Checkboxes
    receiptShowStoreName: settings?.receiptShowStoreName !== false,
    receiptShowTagline: settings?.receiptShowTagline !== false,
    receiptShowAddress: settings?.receiptShowAddress !== false,
    receiptShowPhone: settings?.receiptShowPhone !== false,
    receiptShowHeader: settings?.receiptShowHeader !== false,
    receiptShowCashier: settings?.receiptShowCashier !== false,
    receiptShowCustomer: settings?.receiptShowCustomer !== false,
    receiptShowTable: settings?.receiptShowTable !== false,
    receiptShowNotes: settings?.receiptShowNotes !== false,
    receiptShowWifi: settings?.receiptShowWifi !== false,
    receiptShowFooter: settings?.receiptShowFooter !== false,
    receiptShowQris: settings?.receiptShowQris !== false,
    receiptShowBarcode: settings?.receiptShowBarcode !== false,
  });

  const [isSavingForm, setIsSavingForm] = useState(false);

  // Synchronize form when settings update
  useEffect(() => {
    if (settings) {
      setReceiptForm((prev) => ({
        ...prev,
        storeName: settings?.storeName !== undefined ? settings.storeName : prev.storeName,
        storeTagline: settings?.storeTagline !== undefined ? settings.storeTagline : prev.storeTagline,
        address: settings?.address !== undefined ? settings.address : prev.address,
        phone: settings?.phone !== undefined ? settings.phone : prev.phone,
        headerText: settings?.headerText || settings?.receiptHeader || prev.headerText,
        receiptFooter: settings?.receiptFooter || settings?.footerText || prev.receiptFooter,
        wifiName: settings?.wifiName !== undefined ? settings.wifiName : prev.wifiName,
        wifiPass: settings?.wifiPass !== undefined ? settings.wifiPass : prev.wifiPass,
        receiptShowStoreName: settings?.receiptShowStoreName !== false,
        receiptShowTagline: settings?.receiptShowTagline !== false,
        receiptShowAddress: settings?.receiptShowAddress !== false,
        receiptShowPhone: settings?.receiptShowPhone !== false,
        receiptShowHeader: settings?.receiptShowHeader !== false,
        receiptShowCashier: settings?.receiptShowCashier !== false,
        receiptShowCustomer: settings?.receiptShowCustomer !== false,
        receiptShowTable: settings?.receiptShowTable !== false,
        receiptShowNotes: settings?.receiptShowNotes !== false,
        receiptShowWifi: settings?.receiptShowWifi !== false,
        receiptShowFooter: settings?.receiptShowFooter !== false,
        receiptShowQris: settings?.receiptShowQris !== false,
        receiptShowBarcode: settings?.receiptShowBarcode !== false,
      }));
    }
  }, [settings]);

  // Generate QR for preview
  useEffect(() => {
    generateQrSvgString(settings?.qrisStaticString || DEFAULT_STATIC_QRIS, { width: 110, margin: 1 })
      .then(setTestQrSvg)
      .catch(() => {});
  }, [settings?.qrisStaticString]);

  // Handle Bluetooth Click
  const handleBluetoothClick = async () => {
    if (isConnected && connectionType === 'BLUETOOTH') {
      await disconnectPrinter();
      return;
    }

    if (isAndroid || isNative) {
      openBluetoothModal();
    } else {
      const res = await connectBluetooth();
      if (res && res.needSelectDevice) {
        openBluetoothModal();
      }
    }
  };

  // Handle USB Click
  const handleUsbClick = async () => {
    if (isConnected && connectionType === 'USB') {
      await disconnectPrinter();
      return;
    }
    await connectUsb();
  };

  // Handle Select Universal Browser Driver
  const handleSelectBrowserDriver = async () => {
    if (isConnected) {
      await disconnectPrinter();
    }
    setConnectionType('BROWSER');
    toast.info('Mode Cetak Browser / Driver Sistem Aktif');
  };

  // Handle Test Print
  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      if (isConnected && (connectionType === 'BLUETOOTH' || connectionType === 'USB')) {
        const ok = await testPrint(settings);
        if (!ok) {
          toast.warning('Pengiriman data printer fisik gagal. Menampilkan dialog cetak sistem...');
          setShowTestModal(true);
        }
      } else {
        setShowTestModal(true);
      }
    } catch (err) {
      toast.error(`Gagal uji cetak: ${err.message}`);
      setShowTestModal(true);
    } finally {
      setIsTesting(false);
    }
  };

  // Handle Feed Paper
  const handleFeedPaper = async () => {
    if (!isConnected) {
      toast.warning('Feed kertas hanya tersedia untuk printer thermal fisik (Bluetooth atau USB).');
      return;
    }
    setIsFeeding(true);
    try {
      await feedPaper(3);
    } finally {
      setIsFeeding(false);
    }
  };

  // Handle Save Receipt Info & Checkboxes
  const handleSaveReceiptSettings = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSavingForm(true);
    try {
      await updateSettings(receiptForm);
      toast.success('Pengaturan format & visibilitas nota berhasil disimpan!');
    } catch (err) {
      toast.error(`Gagal menyimpan pengaturan: ${err.message}`);
    } finally {
      setIsSavingForm(false);
    }
  };

  // Toggle helper for checkboxes
  const toggleField = (field) => {
    setReceiptForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Live Monospace Columns Calculation
  const cols = paperWidth === '80mm' ? 48 : 32;
  const dividerText = '-'.repeat(cols);

  return (
    <div className={`space-y-6 ${isEmbedded ? '' : 'max-w-6xl mx-auto p-4 sm:p-6'}`}>
      {/* Page Header (if standalone) */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-komazi-border pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shadow-inner">
              <Printer className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-komazi-text tracking-tight">Pengaturan Printer & Nota Kasir</h1>
              <p className="text-xs text-komazi-muted">
                Kelola koneksi hardware printer, atur visibilitas elemen struk, dan lihat pratinjau kertas thermal secara langsung.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success/15 border border-success/30 text-xs font-semibold text-success shadow-sm">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span>Terhubung: {connectedDeviceName || 'Printer Thermal'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-komazi-surface border border-komazi-border text-xs text-komazi-muted">
                <span className="w-2 h-2 rounded-full bg-komazi-muted" />
                <span>Driver Cetak Universal Aktif</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 1: KONEKSI PRINTER (SEMUA METODE) ─────────────────────────────────── */}
      <div className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-komazi-border pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-komazi-coral" />
            <h2 className="font-bold text-sm text-komazi-text">Pilih Jalur Koneksi Printer</h2>
          </div>
          <span className="text-[11px] text-komazi-muted">Pilih satu metode yang sesuai perangkat Anda</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tile 1: Bluetooth Thermal */}
          <div
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
              connectionType === 'BLUETOOTH'
                ? 'bg-komazi-coral/10 border-komazi-coral/40 shadow-sm'
                : 'bg-komazi-surface-2 border-komazi-border hover:border-komazi-muted/40'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Bluetooth className="w-5 h-5" />
                </div>
                {isConnected && connectionType === 'BLUETOOTH' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/30">
                    TERHUBUNG
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400">
                    Nirkabel
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">Bluetooth Thermal</h3>
                <p className="text-[11px] text-komazi-muted leading-relaxed">
                  Printer portable Bluetooth (58mm/80mm). Mendukung Web Bluetooth (Chrome/Edge) & Android POS.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-komazi-border/50 mt-4 space-y-2">
              <div className="text-[11px] text-neutral-400 truncate">
                Status:{' '}
                <span className="font-semibold text-komazi-text">
                  {isConnected && connectionType === 'BLUETOOTH'
                    ? connectedDeviceName || 'Terhubung'
                    : 'Belum Terhubung'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleBluetoothClick}
                disabled={isConnecting}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  isConnected && connectionType === 'BLUETOOTH'
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-rose-400 border border-neutral-700'
                    : 'bg-komazi-coral hover:bg-komazi-coral-dark text-white'
                }`}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : isConnected && connectionType === 'BLUETOOTH' ? (
                  <span>Putuskan Bluetooth</span>
                ) : (
                  <>
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>Sambungkan Bluetooth</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tile 2: USB Thermal (Kabel POS) */}
          <div
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
              connectionType === 'USB'
                ? 'bg-komazi-coral/10 border-komazi-coral/40 shadow-sm'
                : 'bg-komazi-surface-2 border-komazi-border hover:border-komazi-muted/40'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Usb className="w-5 h-5" />
                </div>
                {isConnected && connectionType === 'USB' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/30">
                    TERHUBUNG
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400">
                    Kabel USB
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">USB Serial (Kabel)</h3>
                <p className="text-[11px] text-komazi-muted leading-relaxed">
                  Printer thermal USB langsung ke komputer kasir (Chrome/Edge Web Serial COM Port).
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-komazi-border/50 mt-4 space-y-2">
              <div className="text-[11px] text-neutral-400 truncate">
                Status:{' '}
                <span className="font-semibold text-komazi-text">
                  {isConnected && connectionType === 'USB'
                    ? connectedDeviceName || 'Port COM Aktif'
                    : 'Belum Terhubung'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleUsbClick}
                disabled={isConnecting}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  isConnected && connectionType === 'USB'
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-rose-400 border border-neutral-700'
                    : 'bg-komazi-coral hover:bg-komazi-coral-dark text-white'
                }`}
              >
                {isConnected && connectionType === 'USB' ? (
                  <span>Putuskan USB</span>
                ) : (
                  <>
                    <Usb className="w-3.5 h-3.5" />
                    <span>Sambungkan USB (COM)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Tile 3: Driver Sistem / Browser Print */}
          <div
            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
              connectionType === 'BROWSER'
                ? 'bg-komazi-coral/10 border-komazi-coral/40 shadow-sm'
                : 'bg-komazi-surface-2 border-komazi-border hover:border-komazi-muted/40'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Monitor className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  UNIVERSAL
                </span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-komazi-text">Driver Sistem / Browser</h3>
                <p className="text-[11px] text-komazi-muted leading-relaxed">
                  Menggunakan printer yang sudah terpasang di Windows/Mac tanpa perlu konfigurasi port serial.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-komazi-border/50 mt-4 space-y-2">
              <div className="text-[11px] text-neutral-400">
                Status: <span className="font-semibold text-emerald-400">Selalu Siap Pakai</span>
              </div>
              <button
                type="button"
                onClick={handleSelectBrowserDriver}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  connectionType === 'BROWSER'
                    ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                    : 'bg-komazi-surface border border-komazi-border hover:bg-neutral-800 text-komazi-text'
                }`}
              >
                {connectionType === 'BROWSER' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    <span>Mode Aktif</span>
                  </>
                ) : (
                  <span>Gunakan Driver Sistem</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: FORMAT KERTAS & LIVE TEST ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Opsi Kertas & Perilaku */}
        <div className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-komazi-border pb-3">
            <Sliders className="w-4 h-4 text-komazi-coral" />
            <h2 className="font-bold text-sm text-komazi-text">Format Kertas & Perilaku POS</h2>
          </div>

          {/* Paper Width Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-komazi-text flex items-center justify-between">
              <span>Ukuran Kertas Thermal</span>
              <span className="text-[11px] text-komazi-muted font-normal">
                {paperWidth === '58mm' ? '32 Kolom (Standar Kasir)' : '48 Kolom (Lebar)'}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`py-2.5 px-4 rounded-xl border text-center font-bold text-xs transition-all ${
                  paperWidth === '58mm'
                    ? 'bg-komazi-coral text-white border-komazi-coral shadow-sm'
                    : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-white'
                }`}
              >
                58 mm (Standar)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`py-2.5 px-4 rounded-xl border text-center font-bold text-xs transition-all ${
                  paperWidth === '80mm'
                    ? 'bg-komazi-coral text-white border-komazi-coral shadow-sm'
                    : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-white'
                }`}
              >
                80 mm (Besar)
              </button>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-center justify-between p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer hover:bg-neutral-800/60 transition-colors">
              <div>
                <span className="text-xs font-bold text-komazi-text block">Cetak Otomatis Setelah Bayar</span>
                <span className="text-[10px] text-komazi-muted">Langsung mencetak struk kasir saat checkout selesai</span>
              </div>
              <input
                type="checkbox"
                checked={autoPrintOnCheckout}
                onChange={(e) => setAutoPrintOnCheckout(e.target.checked)}
                className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer hover:bg-neutral-800/60 transition-colors">
              <div>
                <span className="text-xs font-bold text-komazi-text block">Cetak Struk Pertinggal Otomatis</span>
                <span className="text-[10px] text-komazi-muted">Otomatis mencetak 1 lembar struk pertinggal (salinan kasir/arsip) tiap pembayaran selesai</span>
              </div>
              <input
                type="checkbox"
                checked={autoPrintMerchantCopy}
                onChange={(e) => setAutoPrintMerchantCopy(e.target.checked)}
                className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer hover:bg-neutral-800/60 transition-colors">
              <div>
                <span className="text-xs font-bold text-komazi-text block">Buka Laci Kasir (Cash Drawer)</span>
                <span className="text-[10px] text-komazi-muted">Kirim sinyal pulsa RJ11 laci saat struk dicetak</span>
              </div>
              <input
                type="checkbox"
                checked={kickCashDrawer}
                onChange={(e) => setKickCashDrawer(e.target.checked)}
                className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
              />
            </label>

            <div className="flex items-center justify-between p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
              <div>
                <span className="text-xs font-bold text-komazi-text block">Jumlah Salinan Struk</span>
                <span className="text-[10px] text-komazi-muted">Berapa lembar dicetak per transaksi</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPrintCopies(num)}
                    className={`w-8 h-8 rounded-lg font-bold text-xs border transition-colors ${
                      printCopies === num
                        ? 'bg-komazi-coral text-white border-komazi-coral'
                        : 'bg-komazi-surface text-komazi-muted border-komazi-border hover:text-white'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card: Live Hardware Test */}
        <div className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-komazi-border pb-3">
              <Play className="w-4 h-4 text-komazi-coral" />
              <h2 className="font-bold text-sm text-komazi-text">Uji Coba Printer Fisik</h2>
            </div>

            <p className="text-xs text-komazi-muted leading-relaxed">
              Kirim perintah pengujian langsung ke printer thermal aktif untuk memeriksa motor penggulung kertas dan keselarasan karakter monospaced.
            </p>

            <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-komazi-muted">Jalur Aktif:</span>
                <span className="font-bold text-komazi-text">
                  {connectionType === 'BLUETOOTH' ? 'Bluetooth Thermal' : connectionType === 'USB' ? 'USB COM Port' : 'Driver Browser'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-komazi-muted">Uji Terakhir:</span>
                <span className="text-komazi-text">
                  {lastTestedAt ? new Date(lastTestedAt).toLocaleTimeString('id-ID') : 'Belum pernah'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTesting}
              className="w-full py-2.5 px-4 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengirim Data Uji Coba...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Uji Cetak Struk (Test Print)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleFeedPaper}
              disabled={isFeeding || !isConnected}
              className="w-full py-2.5 px-4 rounded-xl bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-text border border-komazi-border font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFeeding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-komazi-coral" />
                  <span>Menggulung...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Feed Kertas (Gulung 3 Baris)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: CHECKBOX KONTROL ELEMEN & LIVE PREVIEW KERTAS (WYSIWYG) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* KOLOM KIRI: FORM & CHECKBOX VISIBILITAS ELEMEN (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSaveReceiptSettings}
            className="p-5 sm:p-6 rounded-2xl bg-komazi-surface border border-komazi-border space-y-6 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-komazi-border pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-komazi-coral" />
                <h2 className="font-bold text-sm text-komazi-text">Kontrol Elemen & Teks Struk</h2>
              </div>
              <span className="text-[11px] text-komazi-muted">Pilih elemen yang ingin dicetak pada struk</span>
            </div>

            {/* Kelompok 1: Header & Identitas Toko */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-komazi-coral uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <span>1. Header & Identitas Toko</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Store Name Toggle & Input */}
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-komazi-text select-none">
                    <input
                      type="checkbox"
                      checked={receiptForm.receiptShowStoreName}
                      onChange={() => toggleField('receiptShowStoreName')}
                      className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                    />
                    <span>Nama Toko</span>
                  </label>
                  <input
                    type="text"
                    disabled={!receiptForm.receiptShowStoreName}
                    value={receiptForm.storeName}
                    onChange={(e) => setReceiptForm({ ...receiptForm, storeName: e.target.value })}
                    placeholder="Contoh: Komazi Coffee"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text disabled:opacity-50 focus:outline-none focus:border-komazi-coral"
                  />
                </div>

                {/* Tagline Toggle & Input */}
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-komazi-text select-none">
                    <input
                      type="checkbox"
                      checked={receiptForm.receiptShowTagline}
                      onChange={() => toggleField('receiptShowTagline')}
                      className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                    />
                    <span>Slogan / Tagline</span>
                  </label>
                  <input
                    type="text"
                    disabled={!receiptForm.receiptShowTagline}
                    value={receiptForm.storeTagline}
                    onChange={(e) => setReceiptForm({ ...receiptForm, storeTagline: e.target.value })}
                    placeholder="Contoh: Coffee & Workspace"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text disabled:opacity-50 focus:outline-none focus:border-komazi-coral"
                  />
                </div>

                {/* Address Toggle & Input */}
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-komazi-text select-none">
                    <input
                      type="checkbox"
                      checked={receiptForm.receiptShowAddress}
                      onChange={() => toggleField('receiptShowAddress')}
                      className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                    />
                    <span>Alamat Toko</span>
                  </label>
                  <input
                    type="text"
                    disabled={!receiptForm.receiptShowAddress}
                    value={receiptForm.address}
                    onChange={(e) => setReceiptForm({ ...receiptForm, address: e.target.value })}
                    placeholder="Jl. Diponegoro No. 42"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text disabled:opacity-50 focus:outline-none focus:border-komazi-coral"
                  />
                </div>

                {/* Phone Toggle & Input */}
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-komazi-text select-none">
                    <input
                      type="checkbox"
                      checked={receiptForm.receiptShowPhone}
                      onChange={() => toggleField('receiptShowPhone')}
                      className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                    />
                    <span>Nomor Telepon</span>
                  </label>
                  <input
                    type="text"
                    disabled={!receiptForm.receiptShowPhone}
                    value={receiptForm.phone}
                    onChange={(e) => setReceiptForm({ ...receiptForm, phone: e.target.value })}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text disabled:opacity-50 focus:outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              {/* Header Greeting Input */}
              <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-komazi-text select-none">
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowHeader}
                    onChange={() => toggleField('receiptShowHeader')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                  <span>Pesan Sambutan Header (*** TEKS ***)</span>
                </label>
                <input
                  type="text"
                  disabled={!receiptForm.receiptShowHeader}
                  value={receiptForm.headerText}
                  onChange={(e) => setReceiptForm({ ...receiptForm, headerText: e.target.value })}
                  placeholder="Contoh: SELAMAT DATANG DI KOMAZI"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text disabled:opacity-50 focus:outline-none focus:border-komazi-coral"
                />
              </div>
            </div>

            {/* Kelompok 2: Data Transaksi & Pesanan */}
            <div className="space-y-3 pt-2 border-t border-komazi-border">
              <h3 className="text-xs font-bold text-komazi-coral uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                <span>2. Informasi Transaksi & Meja</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer select-none text-xs text-komazi-text hover:bg-neutral-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowCashier}
                    onChange={() => toggleField('receiptShowCashier')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                  <span>Nama Kasir</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer select-none text-xs text-komazi-text hover:bg-neutral-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowCustomer}
                    onChange={() => toggleField('receiptShowCustomer')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                  <span>Pelanggan</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer select-none text-xs text-komazi-text hover:bg-neutral-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowTable}
                    onChange={() => toggleField('receiptShowTable')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                  <span>Layanan/Meja</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer select-none text-xs text-komazi-text hover:bg-neutral-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowNotes}
                    onChange={() => toggleField('receiptShowNotes')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                  <span>Catatan Item</span>
                </label>
              </div>
            </div>

            {/* Kelompok 3: Bagian Bawah & Catatan Kaki */}
            <div className="space-y-3 pt-2 border-t border-komazi-border">
              <h3 className="text-xs font-bold text-komazi-coral uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>3. Catatan Kaki, QRIS & Promosi</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* QRIS Toggle */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer select-none">
                  <div>
                    <span className="text-xs font-bold text-komazi-text block">Tampilkan QR Code QRIS</span>
                    <span className="text-[10px] text-komazi-muted">Cetak QRIS Dinamis saat metode bayar QRIS</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowQris}
                    onChange={() => toggleField('receiptShowQris')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                </label>

                {/* Barcode Mock Toggle */}
                <label className="flex items-center justify-between p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer select-none">
                  <div>
                    <span className="text-xs font-bold text-komazi-text block">Tampilkan Barcode Struk</span>
                    <span className="text-[10px] text-komazi-muted">Cetak barcode garis visual & nomor faktur</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowBarcode}
                    onChange={() => toggleField('receiptShowBarcode')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                </label>
              </div>

              {/* Footer Note Text */}
              <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-komazi-text select-none">
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowFooter}
                    onChange={() => toggleField('receiptShowFooter')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                  <span>Pesan Kaki (Footer Struk)</span>
                </label>
                <input
                  type="text"
                  disabled={!receiptForm.receiptShowFooter}
                  value={receiptForm.receiptFooter}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receiptFooter: e.target.value })}
                  placeholder="Terima Kasih Atas Kunjungan Anda!"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text disabled:opacity-50 focus:outline-none focus:border-komazi-coral"
                />
              </div>

              {/* WiFi Info */}
              <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-komazi-text select-none">
                  <input
                    type="checkbox"
                    checked={receiptForm.receiptShowWifi}
                    onChange={() => toggleField('receiptShowWifi')}
                    className="w-4 h-4 rounded text-komazi-coral focus:ring-komazi-coral"
                  />
                  <span>Informasi Akses WiFi Toko</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    disabled={!receiptForm.receiptShowWifi}
                    value={receiptForm.wifiName}
                    onChange={(e) => setReceiptForm({ ...receiptForm, wifiName: e.target.value })}
                    placeholder="Nama WiFi (SSID)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text disabled:opacity-50 focus:outline-none focus:border-komazi-coral"
                  />
                  <input
                    type="text"
                    disabled={!receiptForm.receiptShowWifi}
                    value={receiptForm.wifiPass}
                    onChange={(e) => setReceiptForm({ ...receiptForm, wifiPass: e.target.value })}
                    placeholder="Password WiFi"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-komazi-surface border border-komazi-border text-xs text-komazi-text disabled:opacity-50 focus:outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>
            </div>

            {/* Tombol Simpan Form */}
            <div className="pt-3 border-t border-komazi-border flex items-center justify-end">
              <button
                type="submit"
                disabled={isSavingForm}
                className="py-2.5 px-6 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-98"
              >
                {isSavingForm ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Pengaturan Struk</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* KOLOM KANAN: LIVE PREVIEW KERTAS STRUK (WYSIWYG 1:1) (5 COLS) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-komazi-surface border border-komazi-border shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-komazi-border pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-komazi-coral" />
                <h3 className="font-bold text-xs text-komazi-text">Pratinjau</h3>
              </div>
            </div>

            {/* THE LIVE RECEIPT PAPER CONTAINER */}
            <div className="p-4 sm:p-6 bg-neutral-900/90 rounded-xl flex justify-center items-start overflow-x-auto">
              <div
                className={`bg-white text-black font-mono text-[11px] leading-[1.3] shadow-2xl rounded-sm p-4 sm:p-5 select-text transition-all ${
                  paperWidth === '58mm' ? 'w-[280px] max-w-[280px]' : 'w-[370px] max-w-[370px]'
                }`}
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  letterSpacing: '-0.02em',
                }}
              >
                {/* Store Header */}
                <div className="text-center space-y-0.5 mb-2">
                  {receiptForm.receiptShowStoreName && (
                    <div className="text-sm font-bold tracking-wider uppercase text-neutral-950 font-mono">
                      {receiptForm.storeName || 'KOMAZI COFFEE'}
                    </div>
                  )}
                  {receiptForm.receiptShowTagline && receiptForm.storeTagline?.trim() ? (
                    <div className="text-[10px] text-neutral-700">{receiptForm.storeTagline.trim()}</div>
                  ) : null}
                  {receiptForm.receiptShowAddress && receiptForm.address?.trim() ? (
                    <div className="text-[10px] text-neutral-700">{receiptForm.address.trim()}</div>
                  ) : null}
                  {receiptForm.receiptShowPhone && receiptForm.phone?.trim() ? (
                    <div className="text-[10px] text-neutral-700">Telp: {receiptForm.phone.trim()}</div>
                  ) : null}
                  {receiptForm.receiptShowHeader && receiptForm.headerText?.trim() ? (
                    <div className="text-[10px] font-bold text-neutral-900 mt-1">
                      *** {receiptForm.headerText.trim()} ***
                    </div>
                  ) : null}
                </div>

                {/* Monospace Divider */}
                <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                  {dividerText}
                </div>

                {/* Metadata */}
                <div className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-neutral-700">No. Faktur:</span>
                    <span className="font-bold text-neutral-950">KMZ-PREVIEW-001</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-700">Tanggal:</span>
                    <span className="text-neutral-950">{formatDateTime(new Date().toISOString())}</span>
                  </div>
                  {receiptForm.receiptShowCashier && (
                    <div className="flex justify-between">
                      <span className="text-neutral-700">Kasir:</span>
                      <span className="text-neutral-950">Kasir Bertugas</span>
                    </div>
                  )}
                  {receiptForm.receiptShowCustomer && (
                    <div className="flex justify-between">
                      <span className="text-neutral-700">Pelanggan:</span>
                      <span className="text-neutral-950">Tamu Umum</span>
                    </div>
                  )}
                  {receiptForm.receiptShowTable && (
                    <div className="flex justify-between font-bold">
                      <span className="text-neutral-700">Layanan:</span>
                      <span className="text-neutral-950">DINE IN (Meja 04)</span>
                    </div>
                  )}
                </div>

                {/* Monospace Divider */}
                <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                  {dividerText}
                </div>

                {/* Sample Items */}
                <div className="space-y-1.5 my-1.5">
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between items-baseline font-bold text-neutral-950">
                      <span>Americano Ice</span>
                      <span>Rp 24.000</span>
                    </div>
                    <div className="text-neutral-600 pl-2">
                      1 x Rp 24.000 • Less Sugar
                    </div>
                    {receiptForm.receiptShowNotes && (
                      <div className="text-neutral-500 italic pl-2 text-[9px]">
                        * Jangan terlalu manis
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between items-baseline font-bold text-neutral-950">
                      <span>Croissant Butter</span>
                      <span>Rp 28.000</span>
                    </div>
                    <div className="text-neutral-600 pl-2">
                      1 x Rp 28.000
                    </div>
                  </div>
                </div>

                {/* Monospace Divider */}
                <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                  {dividerText}
                </div>

                {/* Financial Totals */}
                <div className="space-y-0.5 text-[10px]">
                  <div className="flex justify-between text-neutral-800">
                    <span>Subtotal:</span>
                    <span>Rp 52.000</span>
                  </div>
                  <div className="flex justify-between text-neutral-800">
                    <span>Diskon:</span>
                    <span>-Rp 5.000</span>
                  </div>
                  <div className="flex justify-between text-neutral-800">
                    <span>PB1 / Pajak (10%):</span>
                    <span>Rp 4.700</span>
                  </div>

                  {/* Monospace Divider */}
                  <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                    {dividerText}
                  </div>

                  <div className="flex justify-between font-bold text-xs text-neutral-950">
                    <span>TOTAL:</span>
                    <span>Rp 51.700</span>
                  </div>

                  {/* Monospace Divider */}
                  <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                    {dividerText}
                  </div>

                  <div className="flex justify-between text-neutral-800">
                    <span>Metode Pembayaran:</span>
                    <span className="font-bold text-neutral-950">CASH</span>
                  </div>
                  <div className="flex justify-between text-neutral-800">
                    <span>Bayar Tunai:</span>
                    <span>Rp 100.000</span>
                  </div>
                  <div className="flex justify-between font-bold text-neutral-950">
                    <span>Kembalian:</span>
                    <span>Rp 48.300</span>
                  </div>
                </div>

                {/* Dynamic QRIS Mock (if active) */}
                {receiptForm.receiptShowQris && (
                  <>
                    <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                      {dividerText}
                    </div>
                    <div className="text-center space-y-1 my-2">
                      <div className="text-[10px] font-bold text-neutral-950 uppercase tracking-wide">
                        SCAN QR CODE UNTUK MEMBAYAR
                      </div>
                      <div className="text-[9px] text-neutral-600">Tagihan: Rp 51.700</div>
                      <div className="my-1.5 flex justify-center">
                        {testQrSvg ? (
                          <div
                            className="w-24 h-24 flex items-center justify-center p-1 bg-white border border-neutral-200 rounded [&_svg]:w-full [&_svg]:h-full"
                            dangerouslySetInnerHTML={{ __html: testQrSvg }}
                          />
                        ) : (
                          <div className="w-24 h-24 bg-neutral-100 flex items-center justify-center text-[9px] text-neutral-400 border border-neutral-200">
                            [QRIS CODE]
                          </div>
                        )}
                      </div>
                      <div className="text-[8px] text-neutral-400 italic">(Nominal otomatis terisi)</div>
                    </div>
                  </>
                )}

                {/* Monospace Divider */}
                <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                  {dividerText}
                </div>

                {/* Footer Note & Barcode Mock */}
                <div className="text-center space-y-0.5 text-[9px] text-neutral-700 mt-2">
                  {receiptForm.receiptShowFooter && (
                    <div className="font-bold text-[10px] text-neutral-950 whitespace-pre-line">
                      {receiptForm.receiptFooter || 'Terima Kasih Atas Kunjungan Anda!'}
                    </div>
                  )}
                  {receiptForm.receiptShowWifi && receiptForm.wifiName?.trim() && (
                    <div>WiFi: {receiptForm.wifiName.trim()} | Pass: {receiptForm.wifiPass || '-'}</div>
                  )}
                  <div>Follow IG: @komazicoffee</div>
                  {receiptForm.receiptShowBarcode && (
                    <>
                      <div className="tracking-[3px] font-mono text-[8px] text-neutral-800 pt-1 select-none">
                        ||||| | |||| ||| ||||| |||| || |
                      </div>
                      <div className="text-[8px] text-neutral-500 font-mono tracking-wider">
                        KMZ-PREVIEW-001
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isTesting}
              className="w-full py-2.5 px-3 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Contoh Struk Ini</span>
            </button>
          </div>
        </div>
      </div>

      {/* Test Print Dialog Modal (if testing via browser) */}
      {showTestModal && (
        <TestReceiptModal onClose={() => setShowTestModal(false)} />
      )}
    </div>
  );
}
