import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  X,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Info,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { usePrinterStore } from '../../store/printerStore';
import { toast } from '../../store/toastStore';
import { isAndroid, isNative } from '../../services/platform';

export default function BluetoothModal({ onClose }) {
  const {
    isConnected,
    isConnecting,
    connectedDeviceName,
    connectedDeviceAddress,
    setConnectionType,
    connectBluetooth,
    connectBluetoothDevice,
    disconnectPrinter,
    testPrint,
    pairedDevices,
    isLoadingPairedDevices,
    loadPairedDevices,
  } = usePrinterStore();

  const [errorMsg, setErrorMsg] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const isAndroidPlatform = isAndroid || isNative;
  const supported = isAndroidPlatform || (typeof navigator !== 'undefined' && !!navigator.bluetooth);
  const secure = isAndroidPlatform || (typeof window !== 'undefined' && window.isSecureContext === true);

  const status = isConnected ? 'connected' : isConnecting ? 'connecting' : 'idle';

  // Load paired Bluetooth devices automatically on Android
  useEffect(() => {
    if (isAndroidPlatform) {
      loadPairedDevices();
    }
  }, [isAndroidPlatform]);

  // Connect to specific device (Android or Web)
  const handleConnectDevice = async (device) => {
    setErrorMsg('');
    try {
      const res = await connectBluetoothDevice(device);
      if (res && res.success) {
        // Success
      } else if (res && res.message && !res.cancelled) {
        setErrorMsg(res.message);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyambungkan Bluetooth.');
    }
  };

  // General connect button (auto scan or connect)
  const handleConnect = async () => {
    setErrorMsg('');
    try {
      const res = await connectBluetooth();
      if (res && res.success) {
        // Connected!
      } else if (res && res.message && !res.cancelled) {
        setErrorMsg(res.message);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyambungkan Bluetooth.');
    }
  };

  // ── Test Print Handler ────────────────────────────────────────────────────
  const handleTestPrint = async () => {
    setIsTesting(true);
    setErrorMsg('');
    try {
      const ok = await testPrint();
      if (!ok) {
        setErrorMsg('Gagal mengirim data uji coba ke printer. Pastikan printer menyala.');
      }
    } catch (err) {
      setErrorMsg(`Uji cetak gagal: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  // ── Switch to Driver Mode ─────────────────────────────────────────────────
  const handleUseBrowserDriver = () => {
    setConnectionType('BROWSER');
    toast.info('Mode printer diatur ke Driver Windows / Dialog Browser.');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn select-none"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="min-h-full flex items-center justify-center">
        <div className="w-full max-w-md bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-1.5rem)] my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-komazi-border bg-komazi-surface-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bluetooth className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-komazi-text">Koneksi Printer Bluetooth</h2>
              <p className="text-[11px] text-komazi-muted">
                {isAndroidPlatform ? 'Android Native ESC/POS (SPP)' : 'Direct Thermal ESC/POS (Wireless)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-komazi-muted hover:text-white hover:bg-komazi-border transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[80vh]">
          {/* ── CASE 1: Insecure Context (Web Only) ── */}
          {!isAndroidPlatform && !secure && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-300">Koneksi HTTPS Diperlukan</p>
                  <p className="text-xs text-amber-400/90 leading-relaxed mt-0.5">
                    Kebijakan browser mewajibkan <strong>HTTPS</strong> atau <strong>localhost</strong> untuk mengakses Bluetooth langsung di browser.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/20 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleUseBrowserDriver}
                  className="w-full py-2 px-3 rounded-lg bg-komazi-surface border border-komazi-border hover:border-komazi-coral text-xs font-bold text-komazi-text hover:text-komazi-coral transition-all text-center"
                >
                  Gunakan Mode Driver Windows / Mac (Bisa di HTTP)
                </button>
              </div>
            </div>
          )}

          {/* ── CASE 2: Browser Not Supported (Web Only) ── */}
          {!isAndroidPlatform && secure && !supported && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-300">Browser Belum Mendukung Web Bluetooth</p>
                  <p className="text-xs text-amber-400/80 mt-1 leading-relaxed">
                    Gunakan <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> versi desktop untuk koneksi Bluetooth langsung.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUseBrowserDriver}
                className="w-full py-2 px-3 rounded-lg bg-komazi-surface border border-komazi-border hover:border-komazi-coral text-xs font-bold text-komazi-text transition-all"
              >
                Gunakan Driver Windows / Print Dialog
              </button>
            </div>
          )}

          {/* ── Error Message Banner ── */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-danger/10 border border-danger/25 text-xs text-danger/90">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-danger">Koneksi Tidak Berhasil</p>
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* ── VIEW A: CONNECTED STATE ── */}
          {isConnected && (
            <div className="p-4 rounded-xl bg-success/8 border border-success/25 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-sm font-bold text-success">Printer Siap Digunakan</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-success/20 text-success border border-success/30">
                  Online
                </span>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center text-success shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-komazi-text truncate">
                    {connectedDeviceName || 'Printer Thermal Bluetooth'}
                  </p>
                  <p className="text-[11px] text-komazi-muted font-mono truncate">
                    {connectedDeviceAddress ? `MAC: ${connectedDeviceAddress}` : isAndroidPlatform ? 'Jalur: Android Native SPP' : 'Jalur: Web Bluetooth LE'}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Connected Printer */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isTesting}
                  className="py-2.5 px-3 rounded-xl bg-komazi-surface-2 hover:bg-komazi-border border border-komazi-border text-komazi-text text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 text-komazi-coral" />}
                  <span>{isTesting ? 'Mencetak...' : 'Uji Cetak'}</span>
                </button>

                <button
                  type="button"
                  onClick={isAndroidPlatform ? loadPairedDevices : handleConnect}
                  disabled={isConnecting}
                  className="py-2.5 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                  title="Pilih printer bluetooth lain"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Ganti Printer</span>
                </button>
              </div>

              <button
                type="button"
                onClick={disconnectPrinter}
                className="w-full py-2 rounded-xl bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <BluetoothOff className="w-3.5 h-3.5" />
                <span>Putuskan Sambungan Printer</span>
              </button>
            </div>
          )}

          {/* ── VIEW B: NOT CONNECTED STATE (ANDROID PLATFORM FLOW) ── */}
          {!isConnected && isAndroidPlatform && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-komazi-surface-2/60 border border-komazi-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-komazi-text">Perangkat Bluetooth Terpasang (HP):</span>
                  </div>
                  <button
                    type="button"
                    onClick={loadPairedDevices}
                    disabled={isLoadingPairedDevices}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingPairedDevices ? 'animate-spin' : ''}`} />
                    <span>Segarkan</span>
                  </button>
                </div>

                {isLoadingPairedDevices ? (
                  <div className="py-6 text-center text-xs text-komazi-muted flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    <span>Membaca perangkat Bluetooth HP...</span>
                  </div>
                ) : pairedDevices.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {pairedDevices.map((dev) => (
                      <div
                        key={dev.address}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface border border-komazi-border hover:border-blue-500/50 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Printer className="w-4 h-4 text-komazi-coral shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-komazi-text truncate">{dev.name}</p>
                            <p className="text-[10px] text-komazi-muted font-mono truncate">{dev.address}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleConnectDevice(dev)}
                          disabled={isConnecting}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 transition-colors shadow-sm disabled:opacity-50"
                        >
                          {isConnecting ? 'Menghubungkan...' : 'Hubungkan'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
                    <p className="text-xs font-bold text-amber-300">Belum Ada Printer yang Dipasangkan</p>
                    <p className="text-[11px] text-komazi-muted leading-relaxed">
                      1. Buka <strong>Pengaturan Bluetooth</strong> di HP Anda.<br />
                      2. Cari & sandingkan (pair) printer kasir (PIN: <code className="bg-komazi-surface px-1 py-0.5 rounded text-white">0000</code> atau <code className="bg-komazi-surface px-1 py-0.5 rounded text-white">1234</code>).<br />
                      3. Tekan tombol <strong>Segarkan</strong> di atas.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── VIEW C: NOT CONNECTED STATE (WEB BROWSER FLOW) ── */}
          {!isConnected && !isAndroidPlatform && supported && secure && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-komazi-surface-2/60 border border-komazi-border text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mx-auto text-blue-400">
                  <Bluetooth className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Belum Terhubung ke Printer</h3>
                  <p className="text-xs text-komazi-muted mt-1 leading-relaxed">
                    Klik tombol di bawah untuk memilih printer thermal Bluetooth Anda.
                  </p>
                </div>

                {/* Primary Single-Click Action Button */}
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menghubungkan Printer...</span>
                    </>
                  ) : (
                    <>
                      <BluetoothConnected className="w-4 h-4" />
                      <span>Hubungkan Printer Bluetooth</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => connectBluetooth({ useBroadScan: true })}
                  disabled={isConnecting}
                  className="w-full text-[11px] text-komazi-muted hover:text-komazi-text transition-colors underline pt-0.5"
                >
                  Printer tidak muncul? Pindai semua perangkat BLE
                </button>
              </div>

              {/* Troubleshooting & Guide Accordion */}
              <div className="border border-komazi-border rounded-xl overflow-hidden bg-komazi-surface-2/30">
                <button
                  type="button"
                  onClick={() => setShowTips(!showTips)}
                  className="w-full p-3 flex items-center justify-between text-xs font-semibold text-komazi-muted hover:text-komazi-text transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                    <span>Panduan & Solusi Kendala Printer</span>
                  </span>
                  {showTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showTips && (
                  <div className="p-3.5 border-t border-komazi-border space-y-2.5 text-[11px] text-komazi-muted leading-relaxed">
                    <div>
                      <strong className="text-komazi-text">1. Printer Tidak Terdeteksi:</strong>
                      <p>
                        Pastikan printer menyala, lampu Bluetooth berkedip, dan <strong>putuskan dari HP/tablet lain</strong> karena printer hanya bisa terhubung ke 1 alat.
                      </p>
                    </div>

                    <div>
                      <strong className="text-komazi-text">2. PIN Pairing:</strong>
                      <p>
                        Jika sistem meminta PIN sandi, masukkan kode standar <code className="bg-komazi-surface px-1 py-0.5 rounded text-white font-mono">0000</code> atau <code className="bg-komazi-surface px-1 py-0.5 rounded text-white font-mono">1234</code>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
