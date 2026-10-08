import React, { useState } from 'react';
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
  Info,
  HelpCircle,
  Sliders,
  Receipt,
  FileText,
  Radio,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { usePrinterStore } from '../store/printerStore';
import { useSettingsStore } from '../store/settingsStore';
import TestReceiptModal from '../components/settings/TestReceiptModal';
import PrinterSettingsCard from '../components/settings/PrinterSettingsCard';
import { generateQrDataUrl, DEFAULT_STATIC_QRIS } from '../utils/qris';

export default function PrinterPage() {
  const {
    connectionType,
    paperWidth,
    autoPrintOnCheckout,
    printCopies,
    kickCashDrawer,
    isConnected,
    isConnecting,
    connectedDeviceName,
    lastTestedAt,
    setPaperWidth,
    setConnectionType,
    setAutoPrintOnCheckout,
    setPrintCopies,
    setKickCashDrawer,
    connectBluetooth,
    connectUsb,
    disconnectPrinter,
    testPrint,
  } = usePrinterStore();

  const { settings } = useSettingsStore();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'connection' | 'formatting' | 'preview' | 'troubleshoot'
  const [showTestModal, setShowTestModal] = useState(false);

  const handleTestPrint = async () => {
    const isDirectHardware = await testPrint(settings);
    // If browser mode or direct ESC/POS hardware is not connected, open modal
    if (!isDirectHardware) {
      setShowTestModal(true);
    }
  };

  const storeName = settings?.storeName || 'KOMAZI COFFEE & WORKSPACE';
  const tagline = settings?.storeTagline || 'Coffee, Food & Productivity Space';
  const address = settings?.address || 'Jl. Gatot Subroto No. 88, Medan';
  const phone = settings?.phone || '0812-6899-7721';

  return (
    <div className="p-4 sm:p-6 pb-24 lg:pb-8 space-y-6 max-w-5xl mx-auto select-none animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-komazi-surface p-5 sm:p-6 rounded-2xl border border-komazi-border shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shadow-inner shrink-0">
            <Printer className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display font-black text-xl sm:text-2xl text-komazi-text tracking-tight">
                Printer Kasir &amp; Struk
              </h1>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-success/15 border border-success/30 text-success">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Terhubung: {connectedDeviceName || 'Thermal POS'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-komazi-surface-2 border border-komazi-border text-komazi-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-komazi-muted" />
                  Mode Driver Windows / Browser
                </span>
              )}
            </div>
            <p className="text-xs text-komazi-muted mt-1 leading-relaxed">
              Pusat koneksi hardware printer struk kasir, lebar kertas (58mm/80mm), opsi laci kasir, dan pengujian cetak.
            </p>
          </div>
        </div>

        {/* Quick Action Button */}
        <button
          type="button"
          onClick={handleTestPrint}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md shadow-komazi-coral/25 transition-all active:scale-95 shrink-0 self-start sm:self-auto"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Uji Coba Cetak (Test Print)</span>
        </button>
      </div>

      {/* 2. Quick Status Indicator Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-komazi-muted block">
            Metode Aktif
          </span>
          <div className="flex items-center gap-2 mt-1">
            {connectionType === 'BLUETOOTH' ? (
              <Bluetooth className="w-4 h-4 text-blue-400" />
            ) : connectionType === 'USB' ? (
              <Usb className="w-4 h-4 text-purple-400" />
            ) : (
              <Monitor className="w-4 h-4 text-komazi-teal-light" />
            )}
            <span className="text-xs font-bold text-komazi-text">
              {connectionType === 'BLUETOOTH'
                ? 'Bluetooth'
                : connectionType === 'USB'
                ? 'Kabel USB'
                : 'Driver Sistem'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-komazi-muted block">
            Ukuran Kertas
          </span>
          <div className="flex items-center gap-2 mt-1">
            <Receipt className="w-4 h-4 text-komazi-coral" />
            <span className="text-xs font-bold text-komazi-text">
              {paperWidth} Thermal
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-komazi-surface border border-komazi-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-komazi-muted block">
            Cetak Otomatis
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                autoPrintOnCheckout ? 'bg-success' : 'bg-komazi-muted'
              }`}
            />
            <span className="text-xs font-bold text-komazi-text">
              {autoPrintOnCheckout ? 'Aktif (Saat Checkout)' : 'Manual (Sesuai Tombol)'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sub-Tab Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-komazi-border/60">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-komazi-coral text-white shadow-sm'
              : 'text-komazi-muted hover:text-white hover:bg-komazi-surface'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Semua Pengaturan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('connection')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'connection'
              ? 'bg-komazi-coral text-white shadow-sm'
              : 'text-komazi-muted hover:text-white hover:bg-komazi-surface'
          }`}
        >
          <Bluetooth className="w-3.5 h-3.5" />
          <span>Koneksi Hardware</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('formatting')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'formatting'
              ? 'bg-komazi-coral text-white shadow-sm'
              : 'text-komazi-muted hover:text-white hover:bg-komazi-surface'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Format &amp; Otomasi Struk</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'preview'
              ? 'bg-komazi-coral text-white shadow-sm'
              : 'text-komazi-muted hover:text-white hover:bg-komazi-surface'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Preview Struk Kasir</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('troubleshoot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'troubleshoot'
              ? 'bg-komazi-coral text-white shadow-sm'
              : 'text-komazi-muted hover:text-white hover:bg-komazi-surface'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Panduan Solusi</span>
        </button>
      </div>

      {/* 4. Tab Contents */}

      {/* A. View: All / Main Settings Card */}
      {(activeTab === 'all' || activeTab === 'connection' || activeTab === 'formatting') && (
        <div className="space-y-6">
          <PrinterSettingsCard />
        </div>
      )}

      {/* B. View: Live Receipt Preview */}
      {(activeTab === 'all' || activeTab === 'preview') && (
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-komazi-coral" />
              <div>
                <h2 className="font-bold text-sm text-komazi-text">
                  Live Preview Template Struk Kasir
                </h2>
                <p className="text-[11px] text-komazi-muted">
                  Simulasi tampilan struk cetak kasir dengan format kertas saat ini ({paperWidth}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center p-0.5 rounded-lg bg-komazi-surface-2 border border-komazi-border">
                <button
                  type="button"
                  onClick={() => setPaperWidth('58mm')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    paperWidth === '58mm'
                      ? 'bg-komazi-coral text-white shadow-xs'
                      : 'text-komazi-muted hover:text-white'
                  }`}
                >
                  58mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth('80mm')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    paperWidth === '80mm'
                      ? 'bg-komazi-coral text-white shadow-xs'
                      : 'text-komazi-muted hover:text-white'
                  }`}
                >
                  80mm
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestPrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-sm transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Contoh</span>
              </button>
            </div>
          </div>

          {/* Interactive Paper Preview Container */}
          <div className="p-6 bg-neutral-900/90 rounded-xl flex justify-center items-start overflow-x-auto border border-neutral-800">
            <div
              style={{ width: paperWidth === '58mm' ? '300px' : '400px' }}
              className="bg-white text-black font-mono text-[11px] p-5 shadow-2xl rounded-sm leading-tight transition-all"
            >
              <div className="text-center space-y-1 mb-3">
                <h3 className="text-base font-black tracking-wider uppercase font-sans">
                  {storeName}
                </h3>
                <p className="text-[10px] text-neutral-600">{tagline}</p>
                <p className="text-[10px] text-neutral-600">{address}</p>
                <p className="text-[10px] text-neutral-600">Telp: {phone}</p>
              </div>

              <div className="border-b border-dashed border-neutral-400 my-2"></div>

              <div className="text-center py-1 bg-neutral-100 rounded my-2 border border-neutral-300">
                <p className="font-bold text-[11px] text-neutral-800">STRUK TRANSAKSI POS</p>
                <p className="text-[9px] text-neutral-500 uppercase tracking-widest">
                  KMZ-INV-20261008-001
                </p>
              </div>

              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Kasir:</span>
                  <span className="font-bold">Kasir Shift Pagi</span>
                </div>
                <div className="flex justify-between">
                  <span>Tipe:</span>
                  <span className="font-bold">Dine-In • Meja 05</span>
                </div>
                <div className="flex justify-between">
                  <span>Waktu:</span>
                  <span>{new Date().toLocaleTimeString('id-ID')} WIB</span>
                </div>
              </div>

              <div className="border-b border-dashed border-neutral-400 my-2"></div>

              <div className="space-y-1.5 my-2">
                <div className="flex justify-between font-bold">
                  <span>1x Aren Latte</span>
                  <span>22.000</span>
                </div>
                <div className="flex justify-between text-[10px] text-neutral-500">
                  <span>Oat Milk • Less Ice</span>
                  <span>+3.000</span>
                </div>

                <div className="flex justify-between font-bold pt-1">
                  <span>1x Almond Croissant</span>
                  <span>28.000</span>
                </div>
              </div>

              <div className="border-b border-dashed border-neutral-400 my-2"></div>

              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>53.000</span>
                </div>
                <div className="flex justify-between">
                  <span>Pajak (10%):</span>
                  <span>5.300</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300">
                  <span>TOTAL:</span>
                  <span>Rp 58.300</span>
                </div>
                <div className="flex justify-between text-[10px] text-neutral-600 pt-0.5">
                  <span>Pembayaran:</span>
                  <span className="font-bold">QRIS Dinamis (LUNAS)</span>
                </div>
              </div>

              <div className="border-b border-dashed border-neutral-400 my-2"></div>

              <div className="text-center space-y-1 pt-1">
                <p className="font-bold text-[10px]">Terima Kasih atas Kunjungan Anda!</p>
                <p className="text-[9px] text-neutral-500">
                  {settings?.receiptFooter || 'Follow IG kami: @komazi.coffee'}
                </p>
                {settings?.wifiName && (
                  <p className="text-[9px] text-neutral-600 pt-1">
                    WiFi: {settings.wifiName} | Password: {settings.wifiPass || '-'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* C. View: Comprehensive Troubleshooting Guide */}
      {(activeTab === 'all' || activeTab === 'troubleshoot') && (
        <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
          <div className="flex items-center gap-2 border-b border-komazi-border pb-3">
            <HelpCircle className="w-5 h-5 text-komazi-coral" />
            <div>
              <h2 className="font-bold text-sm text-komazi-text">
                Panduan Lengkap &amp; Solusi Printer Thermal Kasir
              </h2>
              <p className="text-[11px] text-komazi-muted">
                Langkah troubleshoot untuk menghubungkan berbagai merk printer thermal (POS-58, RPP02N, Panda, Eppos, Xprinter, Goojprt).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                1. Printer Bluetooth SPP vs BLE di Browser
              </span>
              <p className="text-[11px] text-komazi-muted leading-relaxed">
                Mayoritas printer thermal mini di Indonesia menggunakan <em>Bluetooth Classic (SPP)</em>. Browser web standar hanya mengizinkan <em>Bluetooth Low Energy (BLE)</em>.
              </p>
              <div className="p-2.5 rounded-lg bg-komazi-surface text-[11px] text-komazi-text space-y-1 border border-komazi-border">
                <p className="font-semibold text-emerald-400">Rekomendasi Terbaik untuk Windows:</p>
                <p>1. Buka <em>Windows Settings &gt; Bluetooth &amp; Devices</em> dan hubungkan printer Anda.</p>
                <p>2. Jika diminta PIN, masukkan <code className="bg-neutral-800 px-1 py-0.5 rounded text-white font-mono">0000</code> atau <code className="bg-neutral-800 px-1 py-0.5 rounded text-white font-mono">1234</code>.</p>
                <p>3. Di aplikasi ini, pilih metode <span className="text-komazi-coral font-bold">Driver Windows / Mac</span>.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                2. Menggunakan Port Kabel USB (Serial COM)
              </span>
              <p className="text-[11px] text-komazi-muted leading-relaxed">
                Koneksi kabel USB langsung adalah metode paling stabil tanpa risiko disconnect baterai atau sinyal:
              </p>
              <div className="p-2.5 rounded-lg bg-komazi-surface text-[11px] text-komazi-text space-y-1 border border-komazi-border">
                <p>1. Tancapkan kabel USB printer ke perangkat kasir (Laptop / PC POS).</p>
                <p>2. Klik tombol <span className="text-purple-400 font-bold">Pilih Port USB</span> di tab Koneksi.</p>
                <p>3. Pilih port COM atau USB Device yang muncul di jendela dialog Chrome, lalu klik Connect.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-komazi-coral" />
                3. Pengaturan Margin Rapi (Dialog Print)
              </span>
              <p className="text-[11px] text-komazi-muted leading-relaxed">
                Saat mencetak melalui dialog browser (Ctrl + P):
              </p>
              <ul className="list-disc list-inside text-[11px] text-komazi-muted space-y-1">
                <li>Ubah <strong>Margins</strong> menjadi: <span className="text-white font-semibold">None (Tidak Ada)</span>.</li>
                <li>Hilangkan centang pada <strong>Headers and Footers</strong> agar URL atau tanggal browser tidak tercetak.</li>
                <li>Pilih ukuran kertas sesuai printer: 58mm (Roll) atau 80mm (Roll).</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                4. Cek Fisik Kertas &amp; Kepala Pemanas
              </span>
              <p className="text-[11px] text-komazi-muted leading-relaxed">
                Jika printer bergerak tetapi struk keluar kosong putih:
              </p>
              <ul className="list-disc list-inside text-[11px] text-komazi-muted space-y-1">
                <li>Gulungan kertas thermal terpasang terbalik. Sisi licin/mengkilap harus menghadap ke kepala pemanas.</li>
                <li>Baterai printer mini lemah (tegangan tidak cukup untuk memanaskan jarum). Cas printer hingga lampu indikator stabil.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Test Receipt Modal */}
      {showTestModal && <TestReceiptModal onClose={() => setShowTestModal(false)} />}
    </div>
  );
}
