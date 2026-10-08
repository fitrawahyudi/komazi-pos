import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { usePrinterStore } from '../../store/printerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { generateQrDataUrl, generateQrSvgString, DEFAULT_STATIC_QRIS } from '../../utils/qris';

export default function TestReceiptModal({ onClose }) {
  const { paperWidth, connectedDeviceName, connectionType } = usePrinterStore();
  const { settings } = useSettingsStore();

  const storeName = settings?.storeName || 'KOMAZI COFFEE';
  const tagline = settings?.storeTagline || 'Coffee & Co-Working Space';
  const address = settings?.address || 'Jl. Senopati No. 45, Jakarta Selatan';
  const phone = settings?.phone || '0812-3456-7890';

  const currentTime = new Date();
  const formattedTime = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const [testQrUrl, setTestQrUrl] = useState('');
  const [testQrSvg, setTestQrSvg] = useState('');
  const [isQrReady, setIsQrReady] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    // Generate QR test image and SVG
    const staticPayload = settings?.qrisStaticString || DEFAULT_STATIC_QRIS;
    Promise.all([
      generateQrDataUrl(staticPayload, { width: 160 }),
      generateQrSvgString(staticPayload, { width: 120, margin: 1 }),
    ])
      .then(([url, svg]) => {
        setTestQrUrl(url);
        setTestQrSvg(svg);
        setIsQrReady(true);
      })
      .catch((err) => {
        console.error('Failed to generate test QR:', err);
        setIsQrReady(true);
      });
  }, [settings?.qrisStaticString]);

  useEffect(() => {
    if (!isQrReady) return;
    // Trigger print dialog once QR is painted
    const timer = setTimeout(() => {
      window.print();
    }, 250);
    return () => clearTimeout(timer);
  }, [isQrReady]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Toolbar (Hidden on print) */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border bg-komazi-surface-2 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-komazi-coral" />
            <div>
              <h3 className="font-bold text-sm text-komazi-text">Uji Coba Cetak Struk</h3>
              <p className="text-[11px] text-komazi-muted">Ukuran kertas: {paperWidth}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-komazi-muted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-900/90 flex justify-center items-start">
          {/* THE RECEIPT PAPER */}
          <div
            id="printable-receipt"
            style={{ width: paperWidth === '58mm' ? '300px' : '400px' }}
            className="bg-white text-black font-mono text-[11px] p-5 shadow-2xl rounded-sm print:m-0 print:p-0 print:shadow-none print:w-full select-text leading-tight"
          >
            {/* Header */}
            <div className="text-center space-y-1 mb-3">
              <h2 className="text-base font-black tracking-wider uppercase font-sans">
                {storeName}
              </h2>
              <p className="text-[10px] text-neutral-600">{tagline}</p>
              <p className="text-[10px] text-neutral-600">{address}</p>
              <p className="text-[10px] text-neutral-600">Telp: {phone}</p>
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Test Banner */}
            <div className="text-center py-1 bg-neutral-100 rounded my-2 border border-neutral-300">
              <p className="font-bold text-[11px] text-neutral-800">*** UJI COBA PRINTER OK ***</p>
              <p className="text-[9px] text-neutral-500 uppercase tracking-widest">
                {connectionType === 'BLUETOOTH' ? `Bluetooth: ${connectedDeviceName || 'Thermal'}` : 'Driver POS Ready'}
              </p>
            </div>

            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{formattedTime} WIB</span>
              </div>
              <div className="flex justify-between">
                <span>Lebar Kertas:</span>
                <span className="font-bold">{paperWidth} Thermal</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold text-emerald-700">SIAP MENCETAK</span>
              </div>
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Sample items */}
            <div className="space-y-1.5 my-2">
              <div className="flex justify-between font-bold">
                <span>1x Kopi Susu Aren</span>
                <span>22.000</span>
              </div>
              <div className="flex justify-between text-[10px] text-neutral-500">
                <span>Ukuran Regular • Less Sugar</span>
              </div>

              <div className="flex justify-between font-bold pt-1">
                <span>1x Butter Croissant</span>
                <span>28.000</span>
              </div>
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>50.000</span>
              </div>
              <div className="flex justify-between">
                <span>Pajak Resto (10%):</span>
                <span>5.000</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300">
                <span>TOTAL TEST:</span>
                <span>Rp 55.000</span>
              </div>
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Test QR Code visual */}
            <div className="text-center my-2 space-y-1">
              <p className="font-bold text-[10px]">UJI CETAK QR CODE</p>
              <div className="flex justify-center my-1">
                {testQrSvg ? (
                  <div
                    className="w-28 h-28 flex items-center justify-center border border-neutral-200 p-1 rounded bg-white print:border-none print:p-0 [&_svg]:w-full [&_svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: testQrSvg }}
                  />
                ) : testQrUrl ? (
                  <img
                    src={testQrUrl}
                    alt="Test QR"
                    className="w-28 h-28 object-contain border border-neutral-200 p-1 rounded bg-white print:border-none print:p-0"
                  />
                ) : (
                  <div className="w-28 h-28 flex items-center justify-center text-[9px] text-neutral-400 border border-neutral-200">
                    Memuat QR...
                  </div>
                )}
              </div>
              <p className="text-[8px] text-neutral-500">TEST QR SCAN OK</p>
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Footer */}
            <div className="text-center space-y-1 pt-1">
              <p className="font-bold text-[10px]">Printer berhasil terhubung!</p>
              <p className="text-[9px] text-neutral-500">
                Sistem POS Komazi siap mencetak transaksi kasir secara otomatis.
              </p>
              {settings?.wifiName && (
                <p className="text-[9px] text-neutral-600 pt-1">
                  WiFi: {settings.wifiName} | Pass: {settings.wifiPass || '-'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions (Hidden on print) */}
        <div className="p-4 border-t border-komazi-border bg-komazi-surface-2 print:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-komazi-surface hover:bg-komazi-border text-komazi-muted text-xs font-bold transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-komazi-coral/20"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Ulang</span>
          </button>
        </div>
      </div>
    </div>
  );
}
