import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Printer,
  Download,
  QrCode as QrIcon,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Palette,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';

const THEMES = {
  'coral-light': {
    id: 'coral-light',
    name: 'Komazi Coral (Light)',
    cardBg: 'bg-white text-stone-900 border-2 border-stone-200 hover:border-[#FF5A4D]/60 shadow-md',
    headerBadge: 'text-[#FF5A4D]',
    subText: 'text-stone-500',
    tableBadge: 'bg-[#FF5A4D] text-white shadow-md shadow-[#FF5A4D]/25',
    qrBox: 'bg-white border-2 border-[#FF5A4D]/20 shadow-inner',
    title: 'text-stone-900',
    desc: 'text-stone-600',
    btnBg: 'bg-stone-100 hover:bg-[#FF5A4D] hover:text-white text-stone-700 border border-stone-200',
    printBorder: 'border-2 border-[#FF5A4D]',
  },
  'coral-dark': {
    id: 'coral-dark',
    name: 'Komazi Dark Luxury',
    cardBg: 'bg-[#141417] text-white border border-[#FF5A4D]/40 hover:border-[#FF5A4D] shadow-xl',
    headerBadge: 'text-[#FF5A4D]',
    subText: 'text-zinc-400',
    tableBadge: 'bg-[#FF5A4D] text-white shadow-md shadow-[#FF5A4D]/35',
    qrBox: 'bg-white border-2 border-[#FF5A4D]/30 shadow-lg',
    title: 'text-white',
    desc: 'text-zinc-400',
    btnBg: 'bg-zinc-800 hover:bg-[#FF5A4D] hover:text-white text-zinc-300 border border-zinc-700',
    printBorder: 'border-2 border-black',
  },
  'monochrome': {
    id: 'monochrome',
    name: 'Monokrom / Thermal',
    cardBg: 'bg-white text-black border-2 border-black shadow-sm',
    headerBadge: 'text-black',
    subText: 'text-stone-600',
    tableBadge: 'bg-black text-white',
    qrBox: 'bg-white border-2 border-black shadow-none',
    title: 'text-black',
    desc: 'text-stone-600',
    btnBg: 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300',
    printBorder: 'border-2 border-black',
  },
};

export default function TableQrCodeModal({ isOpen, onClose }) {
  const { settings } = useSettingsStore();
  const outletName = settings?.outletName || 'Komazi Coffee & Workspace';

  const [tableCount, setTableCount] = useState(15);
  const [customTablesInput, setCustomTablesInput] = useState('');
  const [useCustomList, setUseCustomList] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [tableCodes, setTableCodes] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [colorTheme, setColorTheme] = useState('coral-light');

  const currentTheme = THEMES[colorTheme] || THEMES['coral-light'];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(`${window.location.origin}/meja/`);
    }
  }, []);

  // Compute table list
  const getTableList = () => {
    if (useCustomList && customTablesInput.trim()) {
      return customTablesInput
        .split(/[,;\n]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    const count = Math.max(1, Math.min(100, Number(tableCount) || 10));
    return Array.from({ length: count }, (_, i) => String(i + 1));
  };

  // Helper untuk membersihkan prefix nomor meja (mencegah MEJA MEJA 1)
  const formatTableBadge = (tableNo) => {
    const clean = String(tableNo || '').trim();
    if (/^meja/i.test(clean)) {
      return clean.toUpperCase();
    }
    return `MEJA ${clean}`.toUpperCase();
  };

  // Generate QR codes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const generateAll = async () => {
      setIsGenerating(true);
      const tables = getTableList();
      const prefix = baseUrl || (typeof window !== 'undefined' ? `${window.location.origin}/meja/` : '/meja/');

      try {
        const results = await Promise.all(
          tables.map(async (tableNo) => {
            const cleanNo = String(tableNo).replace(/^meja\s*/i, '');
            const url = `${prefix}${encodeURIComponent(cleanNo)}`;
            const qrDataUrl = await QRCode.toDataURL(url, {
              width: 340,
              margin: 1.5,
              color: {
                dark: '#141414',
                light: '#ffffff',
              },
              errorCorrectionLevel: 'M',
            });
            return {
              tableNo,
              url,
              qrDataUrl,
            };
          })
        );

        if (isMounted) {
          setTableCodes(results);
        }
      } catch (err) {
        console.error('Error generating table QR codes:', err);
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };

    generateAll();

    return () => {
      isMounted = false;
    };
  }, [isOpen, tableCount, customTablesInput, useCustomList, baseUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSingle = (table) => {
    const link = document.createElement('a');
    link.download = `QR-${formatTableBadge(table.tableNo).replace(/\s+/g, '_')}-${outletName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.href = table.qrDataUrl;
    link.click();
    toast.success(`QR ${formatTableBadge(table.tableNo)} berhasil diunduh!`);
  };

  const handleCopyUrl = (url, tableNo) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(tableNo);
    setTimeout(() => setCopiedUrl(null), 2000);
    toast.success(`Link Meja ${tableNo} disalin ke clipboard!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-5xl bg-komazi-surface border border-komazi-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-h-none print:w-full print:bg-white">
        {/* Header - Hidden on print */}
        <div className="px-5 py-4 border-b border-komazi-border flex items-center justify-between bg-komazi-surface-2/60 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral">
              <QrIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-komazi-text">
                Cetak / Download QR Code Meja
              </h2>
              <p className="text-[11px] text-komazi-muted">
                Kode QR meja dengan palet warna brand Komazi untuk ditempel di meja kafe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isGenerating || tableCodes.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Printer size={15} />
              <span>Cetak Sekarang</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Configuration Bar - Hidden on print */}
        <div className="p-4 border-b border-komazi-border bg-komazi-surface space-y-3.5 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Pilihan Tema Warna Desain */}
            <div>
              <label className="block text-[11px] font-bold text-komazi-text mb-1 flex items-center gap-1">
                <Palette size={12} className="text-komazi-coral" />
                <span>Warna Tema Stiker:</span>
              </label>
              <div className="flex items-center gap-1 bg-komazi-surface-2 p-1 rounded-xl border border-komazi-border">
                <button
                  type="button"
                  onClick={() => setColorTheme('coral-light')}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    colorTheme === 'coral-light'
                      ? 'bg-komazi-coral text-white shadow-sm'
                      : 'text-komazi-muted hover:text-white'
                  }`}
                  title="Komazi Coral dengan latar putih (Cocok untuk stiker meja & akrilik)"
                >
                  <span className="w-2 h-2 rounded-full bg-white border border-stone-400 shrink-0" />
                  <span>Coral</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColorTheme('coral-dark')}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    colorTheme === 'coral-dark'
                      ? 'bg-komazi-coral text-white shadow-sm'
                      : 'text-komazi-muted hover:text-white'
                  }`}
                  title="Warna gelap elegan signature Komazi"
                >
                  <span className="w-2 h-2 rounded-full bg-[#141417] border border-komazi-coral shrink-0" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColorTheme('monochrome')}
                  className={`flex-1 py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    colorTheme === 'monochrome'
                      ? 'bg-komazi-coral text-white shadow-sm'
                      : 'text-komazi-muted hover:text-white'
                  }`}
                  title="Hitam putih monokrom untuk printer thermal"
                >
                  <span className="w-2 h-2 rounded-full bg-stone-900 shrink-0" />
                  <span>Mono</span>
                </button>
              </div>
            </div>

            {/* Tipe Penomoran Meja */}
            <div>
              <label className="block text-[11px] font-bold text-komazi-text mb-1">
                Tipe Penomoran Meja:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseCustomList(false)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    !useCustomList
                      ? 'bg-komazi-coral text-white border-komazi-coral'
                      : 'bg-komazi-surface-2 text-komazi-muted border-komazi-border hover:text-white'
                  }`}
                >
                  Urut (1 - N)
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomList(true)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    useCustomList
                      ? 'bg-komazi-coral text-white border-komazi-coral'
                      : 'bg-komazi-surface-2 text-komazi-muted border-komazi-border hover:text-white'
                  }`}
                >
                  Kustom Meja
                </button>
              </div>
            </div>

            {!useCustomList ? (
              <div>
                <label className="block text-[11px] font-bold text-komazi-text mb-1">
                  Jumlah Meja (1 - 100):
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tableCount}
                  onChange={(e) => setTableCount(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-bold focus:border-komazi-coral outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-komazi-text mb-1">
                  Daftar Nama/Nomor Meja:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 1, 2, VIP-1"
                  value={customTablesInput}
                  onChange={(e) => setCustomTablesInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text focus:border-komazi-coral outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-komazi-text mb-1">
                Domain / URL Prefix:
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://pos.kedai.com/meja/"
                className="w-full px-3 py-1.5 rounded-lg bg-komazi-surface-2 border border-komazi-border text-xs font-mono text-komazi-muted focus:text-komazi-text focus:border-komazi-coral outline-none"
              />
            </div>
          </div>
        </div>

        {/* QR Preview Grid & Printable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-komazi-surface-2/40 print:p-0 print:bg-white print:overflow-visible">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-20 text-komazi-muted">
              <RefreshCw className="w-8 h-8 animate-spin mb-3 text-komazi-coral" />
              <p className="text-xs font-medium">Sedang men-generate kode QR meja...</p>
            </div>
          ) : tableCodes.length === 0 ? (
            <div className="text-center py-16 text-komazi-muted">
              <p className="text-xs">Tidak ada data meja untuk ditampilkan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:grid-cols-2 print:gap-6 print:m-0">
              {tableCodes.map((table) => {
                const formattedBadge = formatTableBadge(table.tableNo);

                return (
                  <div
                    key={table.tableNo}
                    style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                    className={`${currentTheme.cardBg} rounded-2xl p-4 flex flex-col items-center text-center relative break-inside-avoid transition-all group print:shadow-none ${currentTheme.printBorder}`}
                  >
                    {/* Outlet Header with Brand Accent */}
                    <div className="w-full border-b border-stone-200/50 pb-2.5 mb-3 flex flex-col items-center">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[11px] uppercase font-black tracking-wider ${currentTheme.headerBadge}`}>
                          {outletName}
                        </span>
                      </div>
                      <span className={`text-[9px] uppercase tracking-widest font-semibold ${currentTheme.subText}`}>
                        SELF-ORDER & PAYMENT
                      </span>
                    </div>

                    {/* Table Badge */}
                    <div className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wider mb-3.5 transition-transform group-hover:scale-105 ${currentTheme.tableBadge}`}>
                      {formattedBadge}
                    </div>

                    {/* QR Image Box */}
                    <div className={`w-44 h-44 p-2 rounded-2xl flex items-center justify-center mb-3.5 ${currentTheme.qrBox}`}>
                      <img
                        src={table.qrDataUrl}
                        alt={`QR Code ${formattedBadge}`}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Instructions */}
                    <p className={`text-xs font-bold leading-tight ${currentTheme.title}`}>
                      Scan untuk Pesan & Bayar
                    </p>
                    <p className={`text-[10px] mt-1 ${currentTheme.desc}`}>
                      Buka kamera HP atau aplikasi QR scanner
                    </p>

                    {/* Action buttons (Screen only) */}
                    <div className="mt-4 pt-3 border-t border-stone-200/50 w-full flex items-center justify-between gap-1.5 print:hidden">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(table.url, table.tableNo)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${currentTheme.btnBg}`}
                        title="Salin Link Meja"
                      >
                        {copiedUrl === table.tableNo ? (
                          <>
                            <Check size={12} className="text-emerald-500" />
                            <span className="text-emerald-500">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Salin Link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(table)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${currentTheme.btnBg}`}
                        title="Download Gambar QR PNG"
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </button>

                      <a
                        href={table.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-1.5 rounded-lg transition-all ${currentTheme.btnBg}`}
                        title="Buka Halaman Meja di Tab Baru"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
