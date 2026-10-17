import React, { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { usePrinterStore } from '../../store/printerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { generateQrDataUrl, generateQrSvgString, DEFAULT_STATIC_QRIS } from '../../utils/qris';

export default function TestReceiptModal({ onClose }) {
  const { paperWidth, connectedDeviceName, connectionType } = usePrinterStore();
  const { settings } = useSettingsStore();

  const storeName = settings?.storeName !== undefined ? settings.storeName : 'KOMAZI COFFEE';
  const tagline = settings?.storeTagline !== undefined ? settings.storeTagline : '';
  const address = settings?.address !== undefined ? settings.address : '';
  const phone = settings?.phone !== undefined ? settings.phone : '';
  const headerText = settings?.headerText || settings?.receiptHeader || '';
  const receiptFooter = settings?.receiptFooter || settings?.footerText || '';

  const currentTime = new Date();
  const formattedTime = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const [testQrUrl, setTestQrUrl] = useState('');
  const [testQrSvg, setTestQrSvg] = useState('');
  const [isQrReady, setIsQrReady] = useState(false);

  const cols = paperWidth === '80mm' ? 48 : 32;
  const dividerText = '-'.repeat(cols);

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
            className={`bg-white text-black font-mono text-[11px] leading-[1.3] shadow-2xl rounded-sm p-4 sm:p-5 select-text print:m-0 print:p-0 print:shadow-none ${
              paperWidth === '58mm' ? 'w-[290px] max-w-[290px] receipt-58mm' : 'w-[390px] max-w-[390px] receipt-80mm'
            }`}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              letterSpacing: '-0.02em',
            }}
          >
            {/* Header */}
            <div className="text-center space-y-0.5 mb-2">
              <div className="text-sm font-bold tracking-wider uppercase text-neutral-950 font-mono">
                {storeName || 'KOMAZI COFFEE'}
              </div>
              {tagline && tagline.trim() ? <div className="text-[10px] text-neutral-700">{tagline.trim()}</div> : null}
              {address && address.trim() ? <div className="text-[10px] text-neutral-700">{address.trim()}</div> : null}
              {phone && phone.trim() ? <div className="text-[10px] text-neutral-700">Telp: {phone.trim()}</div> : null}
              {headerText && headerText.trim() ? (
                <div className="text-[10px] font-bold text-neutral-900 mt-1">*** {headerText.trim()} ***</div>
              ) : null}
            </div>

            <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
              {dividerText}
            </div>

            {/* Test Banner */}
            <div className="text-center py-1 bg-neutral-100 rounded my-1 border border-neutral-300">
              <div className="font-bold text-[11px] text-neutral-950">*** UJI COBA PRINTER OK ***</div>
              <div className="text-[9px] text-neutral-600 uppercase tracking-widest">
                {connectionType === 'BLUETOOTH' ? `Bluetooth: ${connectedDeviceName || 'Thermal'}` : 'Driver POS Ready'}
              </div>
            </div>

            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-neutral-700">Tanggal:</span>
                <span className="text-neutral-950">{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-700">Waktu:</span>
                <span className="text-neutral-950">{formattedTime} WIB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-700">Lebar Kertas:</span>
                <span className="font-bold text-neutral-950">{paperWidth} Thermal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-700">Status:</span>
                <span className="font-bold text-emerald-700">SIAP MENCETAK</span>
              </div>
            </div>

            <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
              {dividerText}
            </div>

            {/* Sample items */}
            <div className="space-y-1.5 my-1.5">
              <div className="text-[10px]">
                <div className="flex justify-between font-bold text-neutral-950">
                  <span>Americano Ice</span>
                  <span>Rp 24.000</span>
                </div>
                <div className="text-neutral-600 pl-2">
                  1 x Rp 24.000 • Less Sugar
                </div>
              </div>

              <div className="text-[10px]">
                <div className="flex justify-between font-bold text-neutral-950">
                  <span>Croissant Butter</span>
                  <span>Rp 28.000</span>
                </div>
                <div className="text-neutral-600 pl-2">
                  1 x Rp 28.000
                </div>
              </div>
            </div>

            <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
              {dividerText}
            </div>

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

              <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                {dividerText}
              </div>

              <div className="flex justify-between font-bold text-xs text-neutral-950">
                <span>TOTAL:</span>
                <span>Rp 51.700</span>
              </div>

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

            <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
              {dividerText}
            </div>

            {/* Test QR Code visual */}
            <div className="text-center my-2 space-y-1">
              <div className="font-bold text-[10px] text-neutral-950">UJI CETAK QR CODE</div>
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
              <div className="text-[8px] text-neutral-500">TEST QR SCAN OK</div>
            </div>

            <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
              {dividerText}
            </div>

            {/* Footer */}
            <div className="text-center space-y-0.5 pt-1 text-[9px] text-neutral-700">
              <div className="font-bold text-[10px] text-neutral-950">Printer berhasil terhubung!</div>
              <div className="text-neutral-500">
                Sistem POS Komazi siap mencetak transaksi kasir secara otomatis.
              </div>
              {receiptFooter && receiptFooter.trim() ? (
                <div className="text-neutral-600 pt-0.5 whitespace-pre-line">
                  {receiptFooter.trim()}
                </div>
              ) : null}
              {settings?.wifiName && settings?.receiptShowWifi !== false && (
                <div className="text-neutral-600 pt-1">
                  WiFi: {settings.wifiName} | Pass: {settings.wifiPass || '-'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions (Hidden on print) */}
        <div className="p-4 border-t border-komazi-border bg-komazi-surface-2 print:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-komazi-surface hover:bg-neutral-800 text-komazi-muted text-xs font-bold transition-colors"
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
