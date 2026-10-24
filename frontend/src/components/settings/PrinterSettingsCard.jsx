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
  Info,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Camera,
  Bell,
  ScanBarcode,
} from 'lucide-react';
import { usePrinterStore } from '../../store/printerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUiStore } from '../../store/uiStore';
import { HardwareService } from '../../services/hardware.service';
import TestReceiptModal from './TestReceiptModal';
import { isAndroid, isNative } from '../../services/platform';

export default function PrinterSettingsCard() {
  const { openBluetoothModal, openUsbModal } = useUiStore();
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

  const [showTestModal, setShowTestModal] = useState(false);
  const [isTroubleshootingOpen, setIsTroubleshootingOpen] = useState(false);
  const [hardwareInfo, setHardwareInfo] = useState(null);

  const handleBluetoothClick = async () => {
    if (isAndroid || isNative) {
      openBluetoothModal();
    } else {
      const res = await connectBluetooth();
      if (res?.needSelectDevice) {
        openBluetoothModal();
      }
    }
  };

  useEffect(() => {
    HardwareService.getCapabilities().then(setHardwareInfo);
  }, [isConnected]);

  const handleTestPrint = async () => {
    const isDirectHardware = await testPrint(settings);
    // If not direct hardware (e.g. BROWSER mode or fallback), open modal to trigger print dialog
    if (!isDirectHardware) {
      setShowTestModal(true);
    }
  };

  return (
    <>
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <Printer className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-komazi-text">Koneksi & Pengaturan Printer Kasir</h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 border border-success/30 text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Terhubung
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-komazi-surface-2 border border-komazi-border text-komazi-muted">
                    Driver Browser Aktif
                  </span>
                )}
              </div>
              <p className="text-[11px] text-komazi-muted mt-0.5">
                Hubungkan printer thermal struk via Bluetooth nirkabel, kabel USB, atau Driver Windows.
              </p>
            </div>
          </div>

          {/* Test Print Action Button */}
          <button
            type="button"
            onClick={handleTestPrint}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md shadow-komazi-coral/20 transition-all active:scale-95 shrink-0"
            title="Kirim struk uji coba ke printer kasir"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Uji Coba Cetak (Test Print)</span>
          </button>
        </div>

        {/* Hardware Capability Status Bar (Section 39 Blueprint) */}
        <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-komazi-coral" />
              <span className="text-xs font-bold text-komazi-text">Diagnostik Hardware & Runtime Platform</span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-komazi-surface border border-komazi-border text-komazi-coral font-bold font-mono">
              Platform: {hardwareInfo?.isAndroid ? 'Android APK (Capacitor)' : 'Web Browser (Chrome/Edge)'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-komazi-surface border border-komazi-border/60">
              <Bluetooth className={`w-3.5 h-3.5 shrink-0 ${hardwareInfo?.capabilities?.bluetooth ? 'text-blue-400' : 'text-komazi-muted'}`} />
              <div className="truncate">
                <div className="text-[10px] text-komazi-muted">Bluetooth</div>
                <div className="font-semibold text-komazi-text truncate">{hardwareInfo?.capabilities?.bluetooth ? 'Didukung' : 'Tidak Ada'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-komazi-surface border border-komazi-border/60">
              <Printer className={`w-3.5 h-3.5 shrink-0 ${isConnected ? 'text-success' : 'text-amber-400'}`} />
              <div className="truncate">
                <div className="text-[10px] text-komazi-muted">Thermal Printer</div>
                <div className="font-semibold text-komazi-text truncate">{isConnected ? 'Terhubung' : 'Siap Browser'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-komazi-surface border border-komazi-border/60">
              <Camera className={`w-3.5 h-3.5 shrink-0 ${hardwareInfo?.capabilities?.camera ? 'text-purple-400' : 'text-komazi-muted'}`} />
              <div className="truncate">
                <div className="text-[10px] text-komazi-muted">Kamera</div>
                <div className="font-semibold text-komazi-text truncate">{hardwareInfo?.capabilities?.camera ? 'Tersedia' : 'Terbatas'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-komazi-surface border border-komazi-border/60">
              <Bell className={`w-3.5 h-3.5 shrink-0 ${hardwareInfo?.capabilities?.notifications ? 'text-teal-400' : 'text-komazi-muted'}`} />
              <div className="truncate">
                <div className="text-[10px] text-komazi-muted">Notifikasi</div>
                <div className="font-semibold text-komazi-text truncate">{hardwareInfo?.capabilities?.notifications ? 'Didukung' : 'Nonaktif'}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-komazi-surface border border-komazi-border/60">
              <ScanBarcode className="w-3.5 h-3.5 shrink-0 text-komazi-coral" />
              <div className="truncate">
                <div className="text-[10px] text-komazi-muted">Barcode Scanner</div>
                <div className="font-semibold text-komazi-text truncate">Siap (Kamera/USB)</div>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Connection Method Cards */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-komazi-muted">
            Pilih Metode Koneksi Printer:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* A. Bluetooth Card */}
            <div
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                connectionType === 'BLUETOOTH'
                  ? 'border-komazi-coral bg-komazi-coral/5 shadow-sm'
                  : 'border-komazi-border bg-komazi-surface-2 hover:border-komazi-muted/60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Bluetooth className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-komazi-text">Bluetooth (Wireless)</h3>
                    <p className="text-[10px] text-komazi-muted">Mini printer 58/80mm nirkabel</p>
                  </div>
                </div>
              </div>

              {connectionType === 'BLUETOOTH' && isConnected ? (
                <div className="space-y-2">
                  <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-[11px] text-success font-semibold flex items-center justify-between">
                    <span className="truncate">{connectedDeviceName || 'Thermal Bluetooth'}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <button
                    type="button"
                    onClick={disconnectPrinter}
                    className="w-full py-1.5 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 text-[11px] font-bold transition-colors"
                  >
                    Putus Sambungan
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleBluetoothClick}
                  disabled={isConnecting}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{isConnecting ? 'Mencari Perangkat...' : 'Hubungkan Bluetooth'}</span>
                </button>
              )}
            </div>

            {/* B. USB / Serial COM Card */}
            <div
              className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                connectionType === 'USB'
                  ? 'border-komazi-coral bg-komazi-coral/5 shadow-sm'
                  : 'border-komazi-border bg-komazi-surface-2 hover:border-komazi-muted/60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Usb className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-komazi-text">Kabel USB (Thermal)</h3>
                    <p className="text-[10px] text-komazi-muted">Direct USB &amp; Serial COM</p>
                  </div>
                </div>
              </div>

              {connectionType === 'USB' && isConnected ? (
                <div className="space-y-2">
                  <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-[11px] text-success font-semibold flex items-center justify-between">
                    <span className="truncate">{connectedDeviceName || 'Printer USB'}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={openUsbModal}
                      className="py-1.5 rounded-lg border border-komazi-border hover:bg-komazi-surface text-komazi-text text-[11px] font-bold transition-colors"
                    >
                      Kelola
                    </button>
                    <button
                      type="button"
                      onClick={disconnectPrinter}
                      className="py-1.5 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 text-[11px] font-bold transition-colors"
                    >
                      Putus
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openUsbModal}
                  disabled={isConnecting}
                  className="w-full py-2 rounded-lg bg-komazi-coral hover:bg-komazi-coral-dark disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Usb className="w-3.5 h-3.5" />
                  <span>Sambungkan Kabel USB</span>
                </button>
              )}
            </div>

            {/* C. Driver Sistem / Browser Card */}
            <div
              onClick={() => {
                disconnectPrinter();
                setConnectionType('BROWSER');
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                connectionType === 'BROWSER'
                  ? 'border-komazi-coral bg-komazi-coral/5 shadow-sm'
                  : 'border-komazi-border bg-komazi-surface-2 hover:border-komazi-muted/60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-komazi-teal/15 border border-komazi-teal/30 flex items-center justify-center text-komazi-teal-light">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-komazi-text">Driver Windows / Mac</h3>
                    <p className="text-[10px] text-komazi-muted">Dialog cetak bawaan browser</p>
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-komazi-surface border border-komazi-border text-[11px] text-komazi-muted flex items-center justify-between">
                <span>{connectionType === 'BROWSER' ? 'Metode Aktif' : 'Klik untuk Aktifkan'}</span>
                {connectionType === 'BROWSER' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-komazi-coral" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Paper Size and Print Preferences */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Paper Width Selector */}
          <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-komazi-text">Lebar Kertas Thermal</span>
              <span className="text-[10px] text-komazi-coral font-bold uppercase tracking-wider">
                {paperWidth}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  paperWidth === '58mm'
                    ? 'border-komazi-coral bg-komazi-coral text-white shadow-sm'
                    : 'border-komazi-border bg-komazi-surface text-komazi-muted hover:text-white'
                }`}
              >
                58 mm (Standar Kasir)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  paperWidth === '80mm'
                    ? 'border-komazi-coral bg-komazi-coral text-white shadow-sm'
                    : 'border-komazi-border bg-komazi-surface text-komazi-muted hover:text-white'
                }`}
              >
                80 mm (Restoran Lebar)
              </button>
            </div>
            <p className="text-[10px] text-komazi-muted">
              Pilih 58mm untuk printer thermal mini/portable, atau 80mm untuk printer desktop kasir.
            </p>
          </div>

          {/* Checkout & Hardware Behavior */}
          <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border space-y-3">
            <span className="font-bold text-xs text-komazi-text block">Opsi Cetak Otomatis</span>

            <div className="space-y-2.5">
              {/* Auto print toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-komazi-text">Otomatis cetak setelah pembayaran</span>
                <input
                  type="checkbox"
                  checked={autoPrintOnCheckout}
                  onChange={(e) => setAutoPrintOnCheckout(e.target.checked)}
                  className="w-4 h-4 rounded text-komazi-coral focus:ring-0 bg-komazi-surface border-komazi-border"
                />
              </label>

              {/* Number of copies */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-komazi-text">Jumlah rangkap cetak:</span>
                <div className="flex items-center gap-1 bg-komazi-surface p-0.5 rounded-lg border border-komazi-border">
                  {[1, 2].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPrintCopies(num)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                        printCopies === num
                          ? 'bg-komazi-coral text-white'
                          : 'text-komazi-muted hover:text-white'
                      }`}
                    >
                      {num} Lembar
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Status Bar & Troubleshooting Collapsible */}
        <div className="pt-2 border-t border-komazi-border/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-komazi-muted">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-komazi-teal-light" />
              <span>
                {lastTestedAt
                  ? `Uji coba terakhir: ${new Date(lastTestedAt).toLocaleTimeString('id-ID')} WIB`
                  : 'Belum pernah melakukan uji coba cetak'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsTroubleshootingOpen(!isTroubleshootingOpen)}
              className="flex items-center gap-1 text-komazi-coral hover:underline font-semibold"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{isTroubleshootingOpen ? 'Tutup Panduan' : 'Printer belum berhasil? Lihat Solusi'}</span>
              {isTroubleshootingOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Troubleshooting Accordion */}
          {isTroubleshootingOpen && (
            <div className="p-3.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text space-y-2 animate-in fade-in duration-200">
              <p className="font-bold text-komazi-coral flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Langkah Mengatasi Printer yang Belum Berhasil Mencetak:</span>
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-komazi-muted text-[11px] leading-relaxed">
                <li>
                  <strong className="text-amber-400">Muncul "Perangkat Tidak Dikenal atau Tidak Didukung":</strong> Sebagian besar printer thermal mini (seperti POS-58, RPP02N, Panda, Eppos, Goojprt) menggunakan protokol <em>Bluetooth Classic (SPP)</em>, sedangkan browser Chrome Web Bluetooth hanya mendukung <em>Bluetooth Low Energy (BLE)</em>. <strong>Solusinya:</strong>
                  <div className="pl-4 pt-1 space-y-1 text-white">
                    <p>• <strong>Cara 1 (Paling Mudah &amp; Direkomendasikan di Windows):</strong> Sambungkan printer di menu Bluetooth Windows (<em>Windows Settings &gt; Bluetooth</em>). Lalu di aplikasi ini, pilih metode <span className="text-komazi-coral font-bold">"Driver Windows / Mac"</span>. Saat mencetak, pilih printer thermal Anda di jendela print.</p>
                    <p>• <strong>Cara 2 (Port COM):</strong> Setelah tersambung di Windows Bluetooth, Windows otomatis membuat Port Serial (COM). Anda bisa klik metode <span className="text-purple-400 font-bold">"Kabel USB (Serial)"</span> lalu pilih port COM printer tersebut.</p>
                    <p>• <strong>Cara 3 (Jika Printer BLE):</strong> Pastikan printer menyala, lampu Bluetooth berkedip (mode pairing), dan <em>putuskan sambungan printer dari HP/tablet lain</em> terlebih dahulu karena printer hanya bisa terhubung ke 1 perangkat.</p>
                  </div>
                </li>
                <li>
                  <strong className="text-white">PIN Pairing Bluetooth Windows:</strong> Jika diminta PIN saat pairing di Windows, gunakan kode standar <code className="bg-komazi-surface px-1 py-0.5 rounded text-white font-mono">0000</code> atau <code className="bg-komazi-surface px-1 py-0.5 rounded text-white font-mono">1234</code>.
                </li>
                <li>
                  <strong className="text-white">Format Cetak Rapi:</strong> Pada jendela cetak browser (Ctrl + P), pastikan atur <strong>Margins: None (Tidak Ada)</strong> serta nonaktifkan <strong>Headers and Footers</strong> agar struk rapi tanpa tanggal/URL browser.
                </li>
                <li>
                  <strong className="text-white">Cek Kertas Thermal:</strong> Pastikan sisi peka panas (mengkilap) menghadap ke kepala pemanas printer dan lampu indikator printer berwarna hijau/biru stabil.
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showTestModal && <TestReceiptModal onClose={() => setShowTestModal(false)} />}
    </>
  );
}
