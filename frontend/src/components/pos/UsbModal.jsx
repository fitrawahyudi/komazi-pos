import React, { useState } from 'react';
import {
  Usb,
  X,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Wallet,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { usePrinterStore, formatFriendlyPrinterError } from '../../store/printerStore';
import { toast } from '../../store/toastStore';

export default function UsbModal({ onClose }) {
  const {
    isConnected,
    isConnecting,
    connectionType,
    usbSubtype,
    usbBaudRate,
    connectedDeviceName,
    setUsbBaudRate,
    connectUsbDirect,
    connectUsbSerial,
    disconnectPrinter,
    testPrint,
    feedPaper,
    openCashDrawer,
  } = usePrinterStore();

  const [selectedBaud, setSelectedBaud] = useState(usbBaudRate || 9600);
  const [errorMsg, setErrorMsg] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [isKicking, setIsKicking] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const isUsbConnected = isConnected && connectionType === 'USB';

  const hasWebUsb = typeof navigator !== 'undefined' && !!navigator.usb;
  const hasWebSerial = typeof navigator !== 'undefined' && !!navigator.serial;
  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext === true;

  // Handle Direct WebUSB Connect
  const handleConnectDirect = async () => {
    setErrorMsg('');
    try {
      const res = await connectUsbDirect();
      if (!res.success && res.message && !res.cancelled) {
        setErrorMsg(formatFriendlyPrinterError(res.message));
      }
    } catch (err) {
      setErrorMsg(formatFriendlyPrinterError(err));
    }
  };

  // Handle Web Serial Connect with chosen Baud Rate
  const handleConnectSerial = async () => {
    setErrorMsg('');
    setUsbBaudRate(selectedBaud);
    try {
      const res = await connectUsbSerial(selectedBaud);
      if (!res.success && res.message && !res.cancelled) {
        setErrorMsg(formatFriendlyPrinterError(res.message));
      }
    } catch (err) {
      setErrorMsg(formatFriendlyPrinterError(err));
    }
  };

  // Handle Test Print
  const handleTestPrint = async () => {
    setIsTesting(true);
    setErrorMsg('');
    try {
      const ok = await testPrint();
      if (!ok) {
        setErrorMsg('Pengiriman data uji coba gagal. Pastikan kabel printer terpasang kuat.');
      }
    } catch (err) {
      setErrorMsg(`Uji cetak gagal: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Handle Paper Feed
  const handleFeed = async () => {
    setIsFeeding(true);
    try {
      await feedPaper(3);
    } catch (err) {
      setErrorMsg(`Feed gagal: ${err.message}`);
    } finally {
      setIsFeeding(false);
    }
  };

  // Handle Cash Drawer Kick
  const handleKick = async () => {
    setIsKicking(true);
    try {
      await openCashDrawer();
    } catch (err) {
      setErrorMsg(`Buka laci gagal: ${err.message}`);
    } finally {
      setIsKicking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="usb-modal-title"
    >
      <div className="relative w-full max-w-lg bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 1. Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-komazi-border/80 bg-gradient-to-r from-komazi-surface to-komazi-surface-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Usb className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 id="usb-modal-title" className="font-bold text-base text-komazi-text tracking-tight flex items-center gap-2">
                Koneksi Kabel USB Thermal
              </h2>
              <p className="text-xs text-komazi-muted">
                Hubungkan printer struk melalui kabel USB langsung atau port COM
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-komazi-muted hover:text-komazi-text hover:bg-komazi-surface-2 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Security / Context Warning */}
          {!isSecureContext && (
            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Koneksi Tidak Aman (Insecure Context)</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  WebUSB dan Web Serial hanya diizinkan oleh browser pada koneksi aman (HTTPS atau localhost).
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Perhatian</p>
                <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="text-danger hover:opacity-75 text-xs font-bold shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* A. If Connected: Connected Device Card */}
          {isUsbConnected ? (
            <div className="p-4 rounded-xl bg-gradient-to-br from-success/10 via-komazi-surface-2 to-komazi-surface border border-success/30 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/20 text-success flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/30 uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      Terhubung
                    </span>
                    <h3 className="font-bold text-sm text-komazi-text mt-1">
                      {connectedDeviceName || 'Printer Thermal USB'}
                    </h3>
                    <p className="text-xs text-komazi-muted mt-0.5">
                      Metode: {usbSubtype === 'SERIAL' ? `Port Serial COM (${selectedBaud} bps)` : 'USB Langsung'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Hardware Test Action Buttons */}
              <div className="pt-2 border-t border-komazi-border/50 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isTesting}
                  className="py-2 px-2.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-xs font-bold text-komazi-text border border-komazi-border flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Kirim struk uji coba ESC/POS"
                >
                  {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 text-komazi-teal-light" />}
                  <span>{isTesting ? 'Mencetak...' : 'Uji Cetak'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFeed}
                  disabled={isFeeding}
                  className="py-2 px-2.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-xs font-bold text-komazi-text border border-komazi-border flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Majukan kertas 3 baris"
                >
                  {isFeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isFeeding ? 'Feed...' : 'Feed Kertas'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleKick}
                  disabled={isKicking}
                  className="py-2 px-2.5 rounded-lg bg-komazi-surface-2 hover:bg-komazi-border text-xs font-bold text-komazi-text border border-komazi-border flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Kirim sinyal pulsa RJ-11 untuk membuka laci kasir"
                >
                  {isKicking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{isKicking ? 'Buka...' : 'Buka Laci'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={disconnectPrinter}
                className="w-full py-2 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 text-xs font-bold transition-colors"
              >
                Putuskan Sambungan USB
              </button>
            </div>
          ) : (
            /* B. When Disconnected: Dual Connection Modes */
            <div className="space-y-4">
              <p className="text-xs text-komazi-muted">
                Pilih metode koneksi kabel printer thermal sesuai dengan tipe antarmuka perangkat Anda:
              </p>

              {/* Option 1: Direct WebUSB (Plug & Play) */}
              <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:border-amber-500/40 transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Usb className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-komazi-text">Opsi 1: USB Langsung</h4>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Rekomendasi
                        </span>
                      </div>
                      <p className="text-[11px] text-komazi-muted mt-0.5">
                        Cocok untuk printer USB POS (Epson, Xprinter, Panda, Iware, POS-58, POS-80). Plug &amp; play tanpa driver serial.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConnectDirect}
                  disabled={isConnecting || !hasWebUsb}
                  className="w-full py-2.5 px-4 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Membuka Daftar USB...</span>
                    </>
                  ) : (
                    <>
                      <Usb className="w-4 h-4" />
                      <span>Pilih Perangkat USB Langsung</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
                    </>
                  )}
                </button>
              </div>

              {/* Option 2: Web Serial COM Port */}
              <div className="p-4 rounded-xl bg-komazi-surface-2 border border-komazi-border hover:border-purple-500/40 transition-all space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-komazi-text">Opsi 2: Port Serial COM</h4>
                      <p className="text-[11px] text-komazi-muted mt-0.5">
                        Untuk kabel konverter USB-Serial (CH340, CP2102, FTDI) atau Virtual COM port.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Baud Rate Selector */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <label htmlFor="baud-rate-select" className="text-xs font-semibold text-komazi-muted shrink-0">
                    Baud Rate:
                  </label>
                  <select
                    id="baud-rate-select"
                    value={selectedBaud}
                    onChange={(e) => {
                      const b = Number(e.target.value);
                      setSelectedBaud(b);
                      setUsbBaudRate(b);
                    }}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-komazi-surface border border-komazi-border text-xs font-mono font-bold text-komazi-text focus:border-purple-500 outline-none cursor-pointer"
                  >
                    <option value={9600}>9600 bps (Standar Printer Thermal)</option>
                    <option value={19200}>19200 bps</option>
                    <option value={38400}>38400 bps</option>
                    <option value={57600}>57600 bps</option>
                    <option value={115200}>115200 bps (High Speed POS)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleConnectSerial}
                  disabled={isConnecting || !hasWebSerial}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Membuka Port Serial...</span>
                    </>
                  ) : (
                    <>
                      <Sliders className="w-4 h-4" />
                      <span>Pilih Port Serial (COM)</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-70" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 3. Collapsible Troubleshooting & Help */}
          <div className="border border-komazi-border/70 rounded-xl overflow-hidden bg-komazi-surface-2/40">
            <button
              type="button"
              onClick={() => setShowTips(!showTips)}
              className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-komazi-muted hover:text-komazi-text transition-colors"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-komazi-coral" />
                Panduan &amp; Tips Mengatasi Masalah Kabel USB
              </span>
              {showTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTips && (
              <div className="px-3.5 pb-4 space-y-2 text-[11px] text-komazi-muted leading-relaxed border-t border-komazi-border/50 pt-3">
                <div className="space-y-1">
                  <p className="font-bold text-komazi-text">1. Printer terhubung tetapi mencetak huruf aneh / lambat?</p>
                  <p>
                    Jika menggunakan mode <strong>Port Serial COM</strong>, sesuaikan <em>Baud Rate</em>. Kebanyakan printer mini 58mm menggunakan 9600 bps, sedangkan printer 80mm modern terkadang disetel ke 115200 bps atau 38400 bps.
                  </p>
                </div>
                <div className="space-y-1 pt-1">
                  <p className="font-bold text-komazi-text">2. Muncul pesan "Akses antarmuka diblokir oleh driver OS"?</p>
                  <p>
                    Pada Windows, jika driver printer Windows resmi sudah terpasang, Windows akan mengunci port USB langsung. Solusi: Gunakan mode <strong>Driver Sistem / Browser</strong> pada menu Printer, atau hubungkan via <strong>Port Serial COM</strong>.
                  </p>
                </div>
                <div className="space-y-1 pt-1">
                  <p className="font-bold text-komazi-text">3. Menggunakan Tablet Android dengan Kabel OTG?</p>
                  <p>
                    Colokkan kabel USB ke adapter OTG tablet. Buka browser Google Chrome, pilih <strong>USB Langsung</strong>, lalu berikan izin akses perangkat USB saat diminta sistem.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
