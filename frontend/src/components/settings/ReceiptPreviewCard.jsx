import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Receipt,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { usePrinterStore } from '../../store/printerStore';
import { useSettingsStore } from '../../store/settingsStore';
import TestReceiptModal from './TestReceiptModal';
import { formatRupiah } from '../../utils/format';

export default function ReceiptPreviewCard() {
  const { paperWidth, setPaperWidth, testPrint } = usePrinterStore();
  const { settings } = useSettingsStore();
  const [showTestModal, setShowTestModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [previewType, setPreviewType] = useState('customer');

  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      const isDirectHardware = await testPrint(settings);
      if (!isDirectHardware) {
        setShowTestModal(true);
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const storeName = settings?.storeName !== undefined ? settings.storeName : 'KOMAZI COFFEE & WORKSPACE';
  const tagline = settings?.storeTagline !== undefined ? settings.storeTagline : '';
  const address = settings?.address !== undefined ? settings.address : '';
  const phone = settings?.phone !== undefined ? settings.phone : '';
  const headerText = settings?.headerText || settings?.receiptHeader || '';
  const receiptFooter = settings?.receiptFooter !== undefined ? settings.receiptFooter : '';
  const wifiName = settings?.wifiName;
  const wifiPass = settings?.wifiPass;

  // Pajak & Biaya calculation for preview
  const taxPercentage = settings?.taxPercentage ? parseFloat(settings.taxPercentage) : 10;
  const isTaxEnabled = settings?.taxEnabled === true || settings?.taxEnabled === 'true';
  const subtotal = 50000;
  const taxAmount = isTaxEnabled ? Math.round((subtotal * taxPercentage) / 100) : 0;
  const totalAmount = subtotal + taxAmount;

  return (
    <>
      <div className="p-5 rounded-2xl bg-komazi-surface border border-komazi-border space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-komazi-border pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-komazi-coral" />
            <div>
              <h2 className="font-bold text-sm text-komazi-text">
                Live Preview Template Struk Kasir
              </h2>
              <p className="text-[11px] text-komazi-muted">
                Simulasi tampilan cetak struk otomatis mengikuti pengaturan profil usaha & format kertas ({paperWidth}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Template Type Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-komazi-surface-2 border border-komazi-border">
              <button
                type="button"
                onClick={() => setPreviewType('customer')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  previewType === 'customer'
                    ? 'bg-komazi-coral text-white shadow-xs'
                    : 'text-komazi-muted hover:text-white'
                }`}
              >
                Pelanggan
              </button>
              <button
                type="button"
                onClick={() => setPreviewType('merchant')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  previewType === 'merchant'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-komazi-muted hover:text-white'
                }`}
                title="Pratinjau Struk Pertinggal (Salinan Kasir / Arsip)"
              >
                Pertinggal
              </button>
            </div>

            {/* Paper Width Switcher */}
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

            {/* Test Print Button */}
            <button
              type="button"
              onClick={handleTestPrint}
              disabled={isPrinting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isPrinting ? 'Mencetak...' : 'Cetak Contoh Struk'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Paper Preview Container */}
        <div className="p-6 bg-neutral-900/90 rounded-xl flex justify-center items-start overflow-x-auto border border-neutral-800">
          <div
            style={{ width: paperWidth === '58mm' ? '300px' : '400px' }}
            className="bg-white text-black font-mono text-[11px] p-5 shadow-2xl rounded-sm leading-tight transition-all"
          >
            {/* Store Header */}
            <div className="text-center space-y-1 mb-3">
              <h3 className="text-base font-black tracking-wider uppercase font-sans">
                {storeName}
              </h3>
              {tagline && tagline.trim() ? <p className="text-[10px] text-neutral-600">{tagline.trim()}</p> : null}
              {address && address.trim() ? <p className="text-[10px] text-neutral-600">{address.trim()}</p> : null}
              {phone && phone.trim() ? <p className="text-[10px] text-neutral-600">Telp: {phone.trim()}</p> : null}
              {headerText && headerText.trim() ? (
                <p className="text-[10px] font-bold text-neutral-800">*** {headerText.trim()} ***</p>
              ) : null}
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Transaction Tag */}
            <div className="text-center py-1 bg-neutral-100 rounded my-2 border border-neutral-300">
              <p className="font-bold text-[11px] text-neutral-800">
                {previewType === 'merchant' ? '*** STRUK PERTINGGAL ***' : 'STRUK TRANSAKSI POS'}
              </p>
              {previewType !== 'merchant' && (
                <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-mono">
                  KMZ-INV-20261008-001
                </p>
              )}
            </div>

            {/* Order Meta */}
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

            {/* Item List */}
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
                <span>25.000</span>
              </div>
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Summary */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRupiah(subtotal).replace('Rp ', '')}</span>
              </div>
              {isTaxEnabled && (
                <div className="flex justify-between">
                  <span>Pajak ({taxPercentage}%):</span>
                  <span>{formatRupiah(taxAmount).replace('Rp ', '')}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300">
                <span>TOTAL:</span>
                <span>{formatRupiah(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-neutral-600 pt-0.5">
                <span>Pembayaran:</span>
                <span className="font-bold">QRIS Dinamis (LUNAS)</span>
              </div>
            </div>

            {/* Receipt Footer Notes (Khusus Struk Pelanggan) */}
            {previewType !== 'merchant' && (
              <>
                <div className="border-b border-dashed border-neutral-400 my-2"></div>
                <div className="text-center space-y-1 pt-1">
                  <p className="font-bold text-[10px]">Terima Kasih atas Kunjungan Anda!</p>
                  {receiptFooter && receiptFooter.trim() ? (
                    <p className="text-[9px] text-neutral-500 whitespace-pre-line">
                      {receiptFooter.trim()}
                    </p>
                  ) : null}
                  {wifiName && settings?.receiptShowWifi !== false && (
                    <p className="text-[9px] text-neutral-600 pt-1">
                      WiFi: {wifiName} | Password: {wifiPass || '-'}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Test Receipt Fallback Modal (Browser Print) */}
      {showTestModal && <TestReceiptModal onClose={() => setShowTestModal(false)} />}
    </>
  );
}
