import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileText,
  SlidersHorizontal,
  Play,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  Store,
  Eye,
  Receipt,
  Coffee,
  Utensils,
  Check,
} from 'lucide-react';
import { usePrinterStore } from '../../store/printerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { isAndroid, isNative } from '../../services/platform';

/**
 * Modal Pengaturan Printer & Struk Khusus KDS/BDS
 * Memungkinkan staf dapur & bar menyambungkan printer thermal Bluetooth,
 * melihat live preview kertas (58mm / 80mm), mengatur auto-print saat pesanan masuk,
 * serta kustomisasi format struk kasir & tiket dapur.
 */
export default function KdsPrinterModal({ isOpen, onClose }) {
  const {
    isConnected,
    isConnecting,
    connectedDeviceName,
    connectionType,
    paperWidth,
    setPaperWidth,
    autoPrintKitchenOnCheckout,
    setAutoPrintKitchenOnCheckout,
    connectBluetooth,
    connectBluetoothDevice,
    disconnectPrinter,
    testPrint,
    feedPaper,
    pairedDevices,
    isLoadingPairedDevices,
    loadPairedDevices,
    printKitchenTicketForOrder,
  } = usePrinterStore();

  const { settings, updateSettings } = useSettingsStore();

  const [activeTab, setActiveTab] = useState('bluetooth'); // 'bluetooth' | 'settings' | 'preview'
  const [isTesting, setIsTesting] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState('kitchen'); // 'kitchen' | 'receipt'

  // Form state untuk pengaturan struk lokal
  const [receiptHeader, setReceiptHeader] = useState(
    settings?.receiptHeader || settings?.storeName || 'KOMAZI COFFEE'
  );
  const [receiptFooter, setReceiptFooter] = useState(
    settings?.receiptFooter || 'Terima kasih atas kunjungan Anda'
  );
  const [showTable, setShowTable] = useState(settings?.receiptShowTable !== false);
  const [showNotes, setShowNotes] = useState(settings?.receiptShowNotes !== false);
  const [showCashier, setShowCashier] = useState(settings?.receiptShowCashier !== false);

  const isAndroidPlatform = isAndroid || isNative;

  useEffect(() => {
    if (isOpen && isAndroidPlatform) {
      loadPairedDevices();
    }
  }, [isOpen, isAndroidPlatform]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    const res = await connectBluetooth();
    if (res?.success) {
      toast.success(`Terhubung ke ${res.name || 'Printer Bluetooth'}`);
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      const ok = await testPrint({
        receiptHeader,
        receiptFooter,
        receiptShowTable: showTable,
        receiptShowNotes: showNotes,
        receiptShowCashier: showCashier,
      });
      if (ok) {
        toast.success('Struk tes berhasil dicetak!');
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handlePrintPreview = async () => {
    if (!isConnected) {
      toast.error('Printer belum terhubung. Sambungkan printer di tab Bluetooth terlebih dahulu.');
      setActiveTab('bluetooth');
      return;
    }
    setIsTesting(true);
    try {
      if (previewTemplate === 'kitchen') {
        const sampleOrder = {
          id: 88,
          invoiceNo: 'KMZ-SAMPLE-0088',
          createdAt: new Date().toISOString(),
          orderType: 'DINE_IN',
          tableNo: showTable ? '04' : null,
          customerName: 'Budi Santoso',
          cashierName: showCashier ? 'Ahmad Kasir' : null,
          note: 'Tolong diantar bersamaan',
          items: [
            {
              qty: 2,
              name: 'Kopi Susu Senja',
              variantName: 'Ice Less Sugar',
              modifiers: 'Oatmilk',
              note: showNotes ? 'Pisahkan es batu' : null,
            },
            {
              qty: 1,
              name: 'Croissant Butter',
              note: showNotes ? 'Hangatkan 30 dtk' : null,
            },
            {
              qty: 1,
              name: 'Nasi Goreng Spesial',
              note: showNotes ? 'Pedas sedang' : null,
            },
          ],
        };
        const res = await printKitchenTicketForOrder(sampleOrder, {
          paperWidth,
          stationName: 'DAPUR / BAR',
        });
        if (res?.success) {
          toast.success('Contoh tiket dapur berhasil dicetak!');
        } else {
          toast.error(res?.message || 'Gagal mencetak contoh tiket');
        }
      } else {
        const ok = await testPrint({
          receiptHeader,
          receiptFooter,
          receiptShowTable: showTable,
          receiptShowNotes: showNotes,
          receiptShowCashier: showCashier,
        });
        if (ok) {
          toast.success('Contoh struk kasir berhasil dicetak!');
        }
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleFeed = async () => {
    setIsFeeding(true);
    try {
      await feedPaper(3);
    } finally {
      setIsFeeding(false);
    }
  };

  const handleSaveSettings = () => {
    updateSettings({
      receiptHeader,
      receiptFooter,
      receiptShowTable: showTable,
      receiptShowNotes: showNotes,
      receiptShowCashier: showCashier,
    });
    toast.success('Pengaturan format struk berhasil disimpan.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-komazi-surface rounded-2xl border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-komazi-border bg-komazi-surface-2/60 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner shrink-0 ${
                isConnected
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400'
              }`}
            >
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-base sm:text-lg text-komazi-text">
                  Printer & Struk KDS
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                    }`}
                  />
                  <span>{isConnected ? 'TERHUBUNG' : 'TERPUTUS'}</span>
                </span>
              </div>
              <p className="text-xs text-komazi-muted mt-0.5">
                Koneksi Bluetooth, pratinjau kertas thermal & auto-print pesanan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-komazi-surface hover:bg-komazi-border text-komazi-muted hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-komazi-border bg-komazi-surface-2/30 px-3 sm:px-4 pt-2 gap-1 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('bluetooth')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'bluetooth'
                ? 'border-komazi-coral text-komazi-coral'
                : 'border-transparent text-komazi-muted hover:text-white'
            }`}
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>Koneksi Bluetooth</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-komazi-coral text-komazi-coral'
                : 'border-transparent text-komazi-muted hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Format & Fitur</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'preview'
                ? 'border-komazi-coral text-komazi-coral'
                : 'border-transparent text-komazi-muted hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Pratinjau Kertas</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: BLUETOOTH */}
          {activeTab === 'bluetooth' && (
            <div className="space-y-4">
              {/* Status Kartu Koneksi */}
              <div
                className={`p-4 rounded-2xl border ${
                  isConnected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-komazi-surface-2 border-komazi-border text-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isConnected
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {isConnected ? (
                        <BluetoothConnected className="w-5 h-5" />
                      ) : (
                        <BluetoothOff className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {isConnected
                          ? connectedDeviceName || 'Printer Bluetooth'
                          : 'Belum Ada Printer Terhubung'}
                      </h4>
                      <p className="text-xs text-komazi-muted mt-0.5">
                        {isConnected
                          ? `Jalur: Bluetooth • Lebar Kertas: ${paperWidth}`
                          : 'Hubungkan printer thermal kasir/dapur via Bluetooth.'}
                      </p>
                    </div>
                  </div>

                  {isConnected ? (
                    <button
                      type="button"
                      onClick={disconnectPrinter}
                      className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold transition-all cursor-pointer shrink-0"
                    >
                      Putuskan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md cursor-pointer shrink-0"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mencari...</span>
                        </>
                      ) : (
                        <>
                          <Bluetooth className="w-3.5 h-3.5" />
                          <span>Hubungkan</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Daftar Paired Devices di Android */}
              {isAndroidPlatform && pairedDevices.length > 0 && !isConnected && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-komazi-muted uppercase tracking-wider">
                      Printer Terpasang di HP ({pairedDevices.length})
                    </span>
                    <button
                      type="button"
                      onClick={loadPairedDevices}
                      className="text-komazi-coral hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Segarkan</span>
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {pairedDevices.map((device, idx) => (
                      <div
                        key={device.address || idx}
                        className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-bold text-white block">
                            {device.name || 'Printer Bluetooth'}
                          </span>
                          <span className="text-[10px] text-komazi-muted font-mono">
                            {device.address}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => connectBluetoothDevice(device)}
                          className="px-3 py-1.5 rounded-lg bg-komazi-coral text-white font-bold text-xs hover:bg-komazi-coral-dark transition-colors cursor-pointer"
                        >
                          Pilih
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tombol Aksi Uji Coba Printer */}
              <div className="p-4 rounded-2xl bg-komazi-surface-2 border border-komazi-border space-y-3">
                <h4 className="font-bold text-xs text-komazi-muted uppercase tracking-wider">
                  Uji Coba & Perawatan Printer
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={!isConnected || isTesting}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-komazi-surface hover:bg-komazi-border border border-komazi-border text-komazi-text text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-komazi-coral" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-komazi-coral" />
                    )}
                    <span>Tes Cetak Struk</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFeed}
                    disabled={!isConnected || isFeeding}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-komazi-surface hover:bg-komazi-border border border-komazi-border text-komazi-text text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isFeeding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>Feed Kertas (3 Baris)</span>
                  </button>
                </div>
              </div>

              {/* Petunjuk Koneksi */}
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Tips Koneksi Bluetooth:</span>
                  <p className="text-[11px] leading-relaxed text-sky-200/80">
                    Nyalakan printer Bluetooth dan pastikan lampu indikator menyala. Jika memakai Android,
                    pastikan perangkat sudah di-Pairing di menu Pengaturan Bluetooth HP terlebih dahulu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FORMAT & FITUR */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Toggle Cetak Otomatis saat Pesanan Masuk (Auto-Print) */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-white block">
                        Cetak Otomatis saat Pesanan Masuk (Auto-Print)
                      </span>
                      <span className="text-[10px] text-amber-200/80">
                        Tiket dapur/bar otomatis dicetak langsung saat ada pesanan baru dari Kasir/POS.
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={autoPrintKitchenOnCheckout}
                      onChange={(e) => {
                        setAutoPrintKitchenOnCheckout(e.target.checked);
                        toast.success(
                          e.target.checked
                            ? 'Cetak otomatis pesanan baru diaktifkan'
                            : 'Cetak otomatis pesanan baru dimatikan'
                        );
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-komazi-coral"></div>
                  </label>
                </div>
                {!isConnected && autoPrintKitchenOnCheckout && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 pt-1 border-t border-amber-500/20">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Printer belum terhubung. Sambungkan printer di tab Bluetooth agar auto-print berfungsi.
                    </span>
                  </div>
                )}
              </div>

              {/* Ukuran Kertas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs text-komazi-text block">
                    Ukuran Kertas Thermal:
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className="text-[11px] text-komazi-coral hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Lihat Pratinjau Kertas</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaperWidth('58mm');
                      toast.info('Format kertas diubah ke 58mm');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      paperWidth === '58mm'
                        ? 'bg-komazi-coral/15 border-komazi-coral text-white ring-1 ring-komazi-coral'
                        : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">58mm (Kecil)</span>
                      {paperWidth === '58mm' && <CheckCircle2 className="w-4 h-4 text-komazi-coral" />}
                    </div>
                    <span className="text-[10px] text-komazi-muted mt-0.5 block">
                      32 karakter/baris (Standar printer Bluetooth portable)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaperWidth('80mm');
                      toast.info('Format kertas diubah ke 80mm');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      paperWidth === '80mm'
                        ? 'bg-komazi-coral/15 border-komazi-coral text-white ring-1 ring-komazi-coral'
                        : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">80mm (Lebar)</span>
                      {paperWidth === '80mm' && <CheckCircle2 className="w-4 h-4 text-komazi-coral" />}
                    </div>
                    <span className="text-[10px] text-komazi-muted mt-0.5 block">
                      48 karakter/baris (Standar printer kasir desktop/dapur)
                    </span>
                  </button>
                </div>
              </div>

              {/* Teks Header & Footer */}
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-xs text-komazi-text block mb-1">
                    Nama Toko / Judul Header:
                  </label>
                  <input
                    type="text"
                    value={receiptHeader}
                    onChange={(e) => setReceiptHeader(e.target.value)}
                    placeholder="Contoh: KOMAZI COFFEE"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-white placeholder-komazi-muted focus:outline-none focus:border-komazi-coral"
                  />
                </div>

                <div>
                  <label className="font-bold text-xs text-komazi-text block mb-1">
                    Pesan Footer Struk:
                  </label>
                  <input
                    type="text"
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    placeholder="Contoh: Terima kasih atas kunjungan Anda"
                    className="w-full px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-white placeholder-komazi-muted focus:outline-none focus:border-komazi-coral"
                  />
                </div>
              </div>

              {/* Toggle Opsi Cetak */}
              <div className="space-y-2 pt-2 border-t border-komazi-border">
                <span className="font-bold text-xs text-komazi-muted uppercase tracking-wider block">
                  Elemen yang Ditampilkan di Struk / Tiket
                </span>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer text-xs">
                  <span className="text-white">Tampilkan Nomor Meja</span>
                  <input
                    type="checkbox"
                    checked={showTable}
                    onChange={(e) => setShowTable(e.target.checked)}
                    className="rounded accent-komazi-coral w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer text-xs">
                  <span className="text-white">Tampilkan Catatan / Note Khusus Menu</span>
                  <input
                    type="checkbox"
                    checked={showNotes}
                    onChange={(e) => setShowNotes(e.target.checked)}
                    className="rounded accent-komazi-coral w-4 h-4 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl bg-komazi-surface-2 border border-komazi-border cursor-pointer text-xs">
                  <span className="text-white">Tampilkan Nama Kasir Bertugas</span>
                  <input
                    type="checkbox"
                    checked={showCashier}
                    onChange={(e) => setShowCashier(e.target.checked)}
                    className="rounded accent-komazi-coral w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="w-full py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs transition-colors shadow-md cursor-pointer"
                >
                  Simpan Pengaturan Struk
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PRATINJAU KERTAS THERMAL */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-komazi-surface-2 border border-komazi-border">
                {/* Template Selector */}
                <div className="flex items-center p-1 rounded-xl bg-komazi-surface border border-komazi-border gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate('kitchen')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      previewTemplate === 'kitchen'
                        ? 'bg-komazi-coral text-white shadow-sm'
                        : 'text-komazi-muted hover:text-white'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Tiket Dapur / Bar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTemplate('receipt')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      previewTemplate === 'receipt'
                        ? 'bg-komazi-coral text-white shadow-sm'
                        : 'text-komazi-muted hover:text-white'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Struk Kasir</span>
                  </button>
                </div>

                {/* Paper Width & Test Button */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center p-1 rounded-xl bg-komazi-surface border border-komazi-border">
                    <button
                      type="button"
                      onClick={() => setPaperWidth('58mm')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        paperWidth === '58mm'
                          ? 'bg-neutral-700 text-white shadow-sm'
                          : 'text-komazi-muted hover:text-white'
                      }`}
                    >
                      58mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperWidth('80mm')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        paperWidth === '80mm'
                          ? 'bg-neutral-700 text-white shadow-sm'
                          : 'text-komazi-muted hover:text-white'
                      }`}
                    >
                      80mm
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handlePrintPreview}
                    disabled={isTesting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                    title={
                      isConnected
                        ? 'Cetak contoh pratinjau ini ke printer Bluetooth'
                        : 'Printer belum terhubung'
                    }
                  >
                    {isTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    <span>Cetak Contoh</span>
                  </button>
                </div>
              </div>

              {/* Realistic Thermal Paper Simulation Container */}
              <div className="p-4 sm:p-6 bg-neutral-950/90 rounded-2xl border border-neutral-800 flex justify-center items-start overflow-x-auto shadow-inner">
                <div
                  style={{ width: paperWidth === '58mm' ? '290px' : '380px' }}
                  className="bg-white text-neutral-900 font-mono text-[11px] p-4 sm:p-5 shadow-2xl rounded-t-sm leading-tight transition-all select-text"
                >
                  {previewTemplate === 'kitchen' ? (
                    /* ── TEMPLATE TIKET DAPUR / BAR ── */
                    <div className="space-y-2">
                      <div className="text-center space-y-0.5">
                        <span className="font-sans font-black text-sm block tracking-wider uppercase">
                          [ORDER] DAPUR / BAR
                        </span>
                        <div className="border-b border-dashed border-neutral-400 my-1"></div>
                      </div>

                      <div className="space-y-0.5 text-[10px]">
                        <div className="flex justify-between">
                          <span>No. Pesanan:</span>
                          <span className="font-bold">KMZ-20261020-0088</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Waktu:</span>
                          <span>20/10/2026 14:45</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tipe:</span>
                          <span className="font-bold">
                            DINE IN {showTable ? '(Meja 04)' : ''}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pelanggan:</span>
                          <span className="font-bold">Budi Santoso</span>
                        </div>
                        {showCashier && (
                          <div className="flex justify-between">
                            <span>Kasir:</span>
                            <span className="font-bold">Ahmad Kasir</span>
                          </div>
                        )}
                      </div>

                      <div className="border-b border-dashed border-neutral-400 my-1.5"></div>

                      {/* Items */}
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between font-bold">
                            <span>2x Kopi Susu Senja</span>
                          </div>
                          <div className="text-[10px] text-neutral-600 pl-2">
                            • Varian: Less Sugar, Less Ice
                          </div>
                          <div className="text-[10px] text-neutral-600 pl-2">
                            • Topping/Mod: Oatmilk
                          </div>
                          {showNotes && (
                            <div className="text-[10px] font-bold text-neutral-800 pl-2">
                              &gt;&gt; NOTE: Pisahkan es batu
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex justify-between font-bold">
                            <span>1x Croissant Butter</span>
                          </div>
                          {showNotes && (
                            <div className="text-[10px] font-bold text-neutral-800 pl-2">
                              &gt;&gt; NOTE: Tolong hangatkan 30 dtk
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex justify-between font-bold">
                            <span>1x Nasi Goreng Spesial</span>
                          </div>
                          {showNotes && (
                            <div className="text-[10px] font-bold text-neutral-800 pl-2">
                              &gt;&gt; NOTE: Pedas sedang, tanpa timun
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border-b border-dashed border-neutral-400 my-1.5"></div>

                      <div className="text-[10px]">
                        <span className="font-bold">Catatan Khusus:</span>
                        <p className="text-neutral-700 italic">Tolong diantar bersamaan.</p>
                      </div>

                      <div className="border-b border-dashed border-neutral-400 my-1"></div>
                    </div>
                  ) : (
                    /* ── TEMPLATE STRUK TRANSAKSI POS ── */
                    <div className="space-y-2">
                      <div className="text-center space-y-0.5">
                        <span className="font-sans font-black text-sm block tracking-wider uppercase">
                          {receiptHeader || 'KOMAZI COFFEE'}
                        </span>
                        <p className="text-[10px] text-neutral-600">Jl. Pandanaran No. 42, Semarang</p>
                        <div className="border-b border-dashed border-neutral-400 my-1"></div>
                        <span className="font-bold text-[10px] block">STRUK TRANSAKSI POS</span>
                        <span className="text-[9px] text-neutral-500">KMZ-20261020-0088</span>
                      </div>

                      <div className="space-y-0.5 text-[10px]">
                        {showCashier && (
                          <div className="flex justify-between">
                            <span>Kasir:</span>
                            <span className="font-bold">Ahmad Kasir</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Tipe:</span>
                          <span className="font-bold">
                            DINE IN {showTable ? '• Meja 04' : ''}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Waktu:</span>
                          <span>20/10/2026 14:45 WIB</span>
                        </div>
                      </div>

                      <div className="border-b border-dashed border-neutral-400 my-1.5"></div>

                      {/* Items */}
                      <div className="space-y-1.5 text-[10px]">
                        <div>
                          <div className="flex justify-between">
                            <span>2x Kopi Susu Senja</span>
                            <span>48.000</span>
                          </div>
                          {showNotes && (
                            <div className="text-[9px] text-neutral-500 pl-2">
                              (Less Sugar • Oatmilk)
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex justify-between">
                            <span>1x Croissant Butter</span>
                            <span>25.000</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between">
                            <span>1x Nasi Goreng Spesial</span>
                            <span>35.000</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-b border-dashed border-neutral-400 my-1.5"></div>

                      <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>108.000</span>
                        </div>
                        <div className="flex justify-between">
                          <span>PB1 (10%):</span>
                          <span>10.800</span>
                        </div>
                        <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300">
                          <span>TOTAL:</span>
                          <span>Rp 118.800</span>
                        </div>
                        <div className="flex justify-between text-neutral-600">
                          <span>Metode:</span>
                          <span className="font-bold">QRIS DYNAMIC</span>
                        </div>
                      </div>

                      <div className="border-b border-dashed border-neutral-400 my-1.5"></div>

                      {receiptFooter && (
                        <div className="text-center text-[10px] font-bold text-neutral-700 py-1">
                          {receiptFooter}
                        </div>
                      )}

                      <div className="text-center text-[9px] text-neutral-500">
                        Follow IG: @komazicoffee
                      </div>
                    </div>
                  )}

                  {/* Jagged / Sawtooth Torn Bottom Edge */}
                  <div className="w-full h-3 overflow-hidden flex -mx-4 sm:-mx-5 mt-4">
                    {Array.from({ length: paperWidth === '58mm' ? 26 : 34 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white shrink-0"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Note */}
              <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border text-[11px] text-komazi-muted flex items-center justify-between">
                <span>
                  Format saat ini: <strong className="text-white">{paperWidth}</strong> •{' '}
                  {previewTemplate === 'kitchen' ? 'Tiket Dapur/Bar' : 'Struk Kasir'}
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Live Preview Aktif
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
