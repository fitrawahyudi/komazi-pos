import React, { useState, useEffect } from 'react';
import { formatRupiah, formatDateTime, formatOrderType } from '../../utils/format';
import {
  Printer,
  Share2,
  X,
  CheckCircle,
  Copy,
  Receipt,
  MessageCircle,
  Bluetooth,
  BluetoothConnected,
  AlertCircle,
  Loader2,
  QrCode,
} from 'lucide-react';
import { toast } from '../../store/toastStore';
import { usePrinterStore } from '../../store/printerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { buildOrderReceiptEscPos } from '../../utils/escpos';
import { generateDynamicQrisForOrder, generateQrDataUrl, generateQrSvgString } from '../../utils/qris';
import { useUiStore } from '../../store/uiStore';
import { printQueue } from '../../services/printQueue.service';
import { AndroidPrinter } from '../../adapters/printer/printer.android';
import { isAndroid, isNative } from '../../services/platform';

export default function ThermalReceiptModal({ order, onClose }) {
  const { openBluetoothModal } = useUiStore();
  const {
    paperWidth: defaultPaperWidth,
    connectionType,
    isConnected,
    connectedDeviceName,
    sendRawData,
    printCopies,
    autoPrintOnCheckout,
    connectBluetooth,
  } = usePrinterStore();
  const { settings } = useSettingsStore();

  const [paperWidth, setPaperWidth] = useState(defaultPaperWidth || '58mm');
  const [customerPhone, setCustomerPhone] = useState(order?.customerPhone || '');
  const [isPrinting, setIsPrinting] = useState(false);
  const [receiptQrisUrl, setReceiptQrisUrl] = useState('');
  const [receiptQrisSvg, setReceiptQrisSvg] = useState('');
  const [isQrReady, setIsQrReady] = useState(false);

  // Extract payment method reliably from order or payments array
  const resolvedPaymentMethod = String(
    order?.paymentMethod ||
    order?.payments?.[0]?.method ||
    order?.payment_method ||
    (Array.isArray(order?.payments) && order.payments.length > 0 ? order.payments[0]?.method : '') ||
    'CASH'
  ).toUpperCase();

  const isQrisPayment =
    resolvedPaymentMethod.includes('QRIS') ||
    resolvedPaymentMethod.includes('QR') ||
    Boolean(order?.payments?.some((p) => String(p?.method || '').toUpperCase().includes('QRIS')));

  const isUnpaidBill =
    ['OPEN', 'PENDING_PAYMENT', 'HOLD', 'PENDING', 'SERVED'].includes(String(order?.status || '').toUpperCase()) &&
    (!order?.payments || order?.payments.length === 0 || !order?.paidAt);

  // Toggle QRIS on receipt: defaults to true if QRIS payment, unpaid bill, or explicitly flagged
  const [showQrisOnReceipt, setShowQrisOnReceipt] = useState(isQrisPayment || isUnpaidBill || order?.showQris === true);

  useEffect(() => {
    setShowQrisOnReceipt(isQrisPayment || isUnpaidBill || order?.showQris === true);
  }, [isQrisPayment, isUnpaidBill, order?.showQris]);

  // Generate Dynamic QRIS if showQrisOnReceipt is active (both SVG and Data URL for print stability)
  useEffect(() => {
    let isCancelled = false;
    if (order && showQrisOnReceipt && settings?.qrisEnabled !== false) {
      setIsQrReady(false);
      const qrisPayload = generateDynamicQrisForOrder(order, settings);
      Promise.all([
        generateQrDataUrl(qrisPayload, { width: 240 }),
        generateQrSvgString(qrisPayload, { width: 140, margin: 1 }),
      ])
        .then(([url, svg]) => {
          if (!isCancelled) {
            setReceiptQrisUrl(url);
            setReceiptQrisSvg(svg);
            setIsQrReady(true);
          }
        })
        .catch((err) => {
          console.error('[Receipt] QR generation error:', err);
        });
    } else {
      setIsQrReady(false);
    }
    return () => {
      isCancelled = true;
    };
  }, [order, settings, showQrisOnReceipt]);

  const handlePrint = async () => {
    const orderJobId = String(order?.orderNumber || order?.invoiceNo || `ORD_${order?.id}`);
    if (printQueue.hasPrinted(orderJobId)) {
      const confirmReprint = window.confirm(
        'Struk untuk pesanan ini sudah pernah dicetak. Apakah Anda yakin ingin mencetak ulang (reprint)?'
      );
      if (!confirmReprint) return;
    }

    // Ensure QR payload is ready before opening print if QR is enabled
    if (showQrisOnReceipt && settings?.qrisEnabled !== false && (!receiptQrisUrl || !receiptQrisSvg)) {
      try {
        const qrisPayload = generateDynamicQrisForOrder(order, settings);
        const [url, svg] = await Promise.all([
          generateQrDataUrl(qrisPayload, { width: 240 }),
          generateQrSvgString(qrisPayload, { width: 140, margin: 1 }),
        ]);
        setReceiptQrisUrl(url);
        setReceiptQrisSvg(svg);
        setIsQrReady(true);
        // Small delay to allow DOM painting before browser print freezes JS
        await new Promise((r) => setTimeout(r, 120));
      } catch (e) {
        console.warn('[Receipt] QR prep notice:', e);
      }
    }

    // If direct Bluetooth or USB is connected, send ESC/POS payload directly
    if (isConnected && (connectionType === 'BLUETOOTH' || connectionType === 'USB')) {
      setIsPrinting(true);
      try {
        toast.info('Mengirim struk ke printer thermal...');
        const bytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
          showQris: showQrisOnReceipt,
        });
        const copies = printCopies || 1;
        for (let i = 0; i < copies; i++) {
          const ok = await sendRawData(bytes);
          if (!ok) throw new Error('Pengiriman data printer terputus');
          if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
        }
        printQueue.printedJobIds.add(orderJobId);
        toast.success('Struk berhasil dicetak langsung ke printer!');
        setIsPrinting(false);
        return;
      } catch (err) {
        setIsPrinting(false);
        toast.error(`Gagal cetak hardware: ${err.message}`);
        return;
      }
    }

    // If connectionType is explicitly BLUETOOTH but not connected yet:
    if (connectionType === 'BLUETOOTH' && !isConnected) {
      setIsPrinting(true);
      try {
        const res = await connectBluetooth();
        if (res && res.success) {
          toast.info('Mengirim struk ke printer thermal...');
          const bytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
            showQris: showQrisOnReceipt,
          });
          const copies = printCopies || 1;
          for (let i = 0; i < copies; i++) {
            const ok = await sendRawData(bytes);
            if (!ok) throw new Error('Pengiriman data printer terputus');
            if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
          }
          printQueue.printedJobIds.add(orderJobId);
          toast.success('Struk berhasil dicetak langsung ke printer!');
        } else if (res && res.needSelectDevice) {
          openBluetoothModal();
        } else if (res && !res.cancelled && res.message) {
          toast.error(res.message);
          if (isAndroid || isNative) openBluetoothModal();
        }
      } catch (err) {
        toast.error(`Gagal cetak Bluetooth: ${err.message}`);
        if (isAndroid || isNative) openBluetoothModal();
      } finally {
        setIsPrinting(false);
      }
      return;
    }

    // Default Browser / System Printer Dialog
    printQueue.printedJobIds.add(orderJobId);

    // On Android Native, route to Android PrintManager instead of window.print()
    if (isAndroid || isNative) {
      const receiptElem = document.getElementById('printable-receipt');
      if (receiptElem) {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: monospace; width: ${paperWidth}; margin: 0 auto; padding: 8px 4px; font-size: 11px; color: black; }
                .print\\:hidden { display: none !important; }
              </style>
            </head>
            <body>
              ${receiptElem.innerHTML}
            </body>
          </html>
        `;
        await AndroidPrinter.printSystemHtml(html, `Struk_${orderJobId}`);
        return;
      }
    }

    window.print();
  };

  // Optional auto print on open if configured (waiting until QR is fully ready)
  useEffect(() => {
    if (autoPrintOnCheckout) {
      if (showQrisOnReceipt && !isQrReady) {
        return; // Will fire once isQrReady becomes true
      }
      const timer = setTimeout(() => {
        handlePrint();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrintOnCheckout, isQrReady, showQrisOnReceipt]);

  if (!order) return null;

  const generateWhatsAppMessage = () => {
    const storeName = settings?.storeName || 'KOMAZI COFFEE';
    const storeAddress = settings?.address || 'Jl. Senopati No. 45, Jakarta Selatan';

    let itemsText = '';
    (order.items || []).forEach((item) => {
      const variant = item.variantName ? ` (${item.variantName})` : '';
      const notes = item.note ? `\n   Note: ${item.note}` : '';
      itemsText += `• ${item.qty}x ${item.name || item.productName}${variant} - ${formatRupiah(item.price || item.unitPrice)}${notes}\n`;
    });

    const text = `🧾 *STRUK PEMBAYARAN - ${storeName}*\n` +
      `📍 ${storeAddress}\n` +
      `--------------------------------\n` +
      `No. Faktur : ${order.invoiceNo || order.id}\n` +
      `Tanggal    : ${formatDateTime(order.createdAt || new Date().toISOString())}\n` +
      `Kasir      : ${order.cashierName || 'Kasir Bertugas'}\n` +
      `Pelanggan  : ${order.customerName || 'Tamu Umum'}\n` +
      `Layanan    : ${formatOrderType(order.orderType || order.type)} ${order.tableNo ? `(Meja ${order.tableNo})` : ''}\n` +
      `--------------------------------\n` +
      itemsText +
      `--------------------------------\n` +
      `Subtotal   : ${formatRupiah(order.subtotal || order.total)}\n` +
      (Number(order.discount) > 0 ? `Diskon     : -${formatRupiah(order.discount)}\n` : '') +
      (Number(order.tax) > 0 ? `PB1 / Pajak (10%): ${formatRupiah(order.tax)}\n` : '') +
      (Number(order.serviceFee) > 0 ? `Service Fee (5%): ${formatRupiah(order.serviceFee)}\n` : '') +
      `*TOTAL     : ${formatRupiah(order.total || order.grandTotal)}*\n` +
      `--------------------------------\n` +
      `Metode     : ${resolvedPaymentMethod}\n` +
      (order.cashReceived ? `Bayar Tunai: ${formatRupiah(order.cashReceived)}\nKembalian  : ${formatRupiah(order.cashChange || 0)}\n` : '') +
      `\n${settings?.receiptFooter || 'Terima Kasih Atas Kunjungan Anda!'}\n` +
      (settings?.wifiName ? `WiFi: ${settings.wifiName} | Pass: ${settings.wifiPass || '-'}\n` : '') +
      `Follow IG: @komazicoffee`;

    return encodeURIComponent(text);
  };

  const handleSendWhatsApp = () => {
    let phone = customerPhone.trim().replace(/[^0-9]/g, '');
    if (!phone) {
      toast.error('Masukkan nomor WhatsApp pelanggan terlebih dahulu');
      return;
    }
    if (phone.startsWith('0')) {
      phone = '62' + phone.slice(1);
    }

    const encodedMsg = generateWhatsAppMessage();
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
    window.open(url, '_blank');
    toast.success('Struk WhatsApp berhasil dibuka!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Toolbar (Hidden on print) */}
        <div className="flex items-center justify-between p-4 border-b border-komazi-border bg-komazi-surface-2 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-komazi-coral" />
            <h3 className="font-bold text-sm text-komazi-text">Pratinjau Struk Kasir</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* QRIS Toggle Button */}
            <button
              type="button"
              onClick={() => setShowQrisOnReceipt(!showQrisOnReceipt)}
              title={showQrisOnReceipt ? 'Sembunyikan QRIS di Struk' : 'Tampilkan QRIS di Struk'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
                showQrisOnReceipt
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-komazi-surface border-komazi-border text-komazi-muted hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQrisOnReceipt ? 'QRIS Aktif' : '+ QRIS'}</span>
            </button>

            {/* Paper Width Toggle */}
            <div className="flex items-center bg-komazi-surface rounded-xl p-0.5 border border-komazi-border text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  paperWidth === '58mm'
                    ? 'bg-komazi-coral text-white'
                    : 'text-komazi-muted hover:text-white'
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  paperWidth === '80mm'
                    ? 'bg-komazi-coral text-white'
                    : 'text-komazi-muted hover:text-white'
                }`}
              >
                80 mm
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-komazi-muted hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-900/90 flex justify-center items-start">
          {/* THE RECEIPT PAPER */}
          <div
            id="printable-receipt"
            style={{ width: paperWidth === '58mm' ? '300px' : '400px' }}
            className={`bg-white text-black font-mono text-[11px] p-5 shadow-2xl rounded-sm print:m-0 print:p-2 print:shadow-none select-text leading-tight ${paperWidth === '58mm' ? 'receipt-58mm' : 'receipt-80mm'}`}
          >
            {/* Store Header */}
            <div className="text-center space-y-1 mb-4">
              <h2 className="text-base font-black tracking-wider uppercase font-sans">
                {settings?.storeName || 'KOMAZI COFFEE'}
              </h2>
              <p className="text-[10px] text-neutral-600">{settings?.storeTagline || 'Coffee & Co-Working Space'}</p>
              <p className="text-[10px] text-neutral-600">{settings?.address || 'Jl. Senopati No. 45, Jakarta Selatan'}</p>
              <p className="text-[10px] text-neutral-600">Telp: {settings?.phone || '0812-3456-7890'}</p>
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Metadata */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>No. Faktur:</span>
                <span className="font-bold">{order.invoiceNo || `KMZ-${order.id}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{formatDateTime(order.createdAt || new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{order.cashierName || 'Kasir Bertugas'}</span>
              </div>
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span>{order.customerName || 'Tamu Umum'}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Layanan:</span>
                <span>
                  {formatOrderType(order.orderType || order.type)}{' '}
                  {order.tableNo ? `(Meja ${order.tableNo})` : ''}
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Items Table */}
            <div className="space-y-2 my-2">
              {(order.items || []).map((item, idx) => {
                const itemTotal = (item.qty || 1) * Number(item.price || item.unitPrice || 0);
                return (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold">
                      <span className="truncate pr-2">
                        {item.name || item.productName}
                      </span>
                      <span className="shrink-0">{formatRupiah(itemTotal)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-neutral-600">
                      <span>
                        {item.qty} x {formatRupiah(item.price || item.unitPrice)}
                        {item.variantName ? ` • ${item.variantName}` : ''}
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-[9px] italic text-neutral-500">
                        * {item.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-b border-dashed border-neutral-400 my-2"></div>

            {/* Financial Summary */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRupiah(order.subtotal || order.total)}</span>
              </div>

              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Diskon:</span>
                  <span>-{formatRupiah(order.discount)}</span>
                </div>
              )}

              {Number(order.tax) > 0 && (
                <div className="flex justify-between">
                  <span>PB1 / Pajak (10%):</span>
                  <span>{formatRupiah(order.tax)}</span>
                </div>
              )}

              {Number(order.serviceFee) > 0 && (
                <div className="flex justify-between">
                  <span>Service Fee (5%):</span>
                  <span>{formatRupiah(order.serviceFee)}</span>
                </div>
              )}

              <div className="border-t border-neutral-800 pt-1.5 flex justify-between font-black text-xs">
                <span>TOTAL:</span>
                <span>{formatRupiah(order.total || order.grandTotal)}</span>
              </div>

              <div className="border-t border-dashed border-neutral-400 my-1 pt-1"></div>

              <div className="flex justify-between">
                <span>Metode Pembayaran:</span>
                <span className="font-bold">{resolvedPaymentMethod}</span>
              </div>

              {(order.cashReceived || order.payments?.[0]?.tendered) && (
                <>
                  <div className="flex justify-between">
                    <span>Bayar Tunai:</span>
                    <span>{formatRupiah(order.cashReceived || order.payments?.[0]?.tendered)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Kembalian:</span>
                    <span>{formatRupiah(order.cashChange ?? order.payments?.[0]?.change ?? 0)}</span>
                  </div>
                </>
              )}

              {/* Dynamic QRIS Block if QRIS is active */}
              {showQrisOnReceipt && settings?.qrisEnabled !== false && (
                <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-300 text-center">
                  <div className="text-[10px] font-bold text-neutral-900 tracking-wide uppercase">
                    Bayar Dengan QRIS
                  </div>
                  <div className="text-[9px] text-neutral-600 font-mono">
                    Nominal: {formatRupiah(order.total || order.grandTotal)}
                  </div>
                  <div className="my-1.5 flex justify-center">
                    {receiptQrisSvg ? (
                      <div
                        className="w-32 h-32 flex items-center justify-center border border-neutral-200 p-1 rounded bg-white shadow-sm print:border-none print:p-0 print:shadow-none [&_svg]:w-full [&_svg]:h-full"
                        dangerouslySetInnerHTML={{ __html: receiptQrisSvg }}
                      />
                    ) : receiptQrisUrl ? (
                      <img
                        src={receiptQrisUrl}
                        alt="QRIS Dinamis"
                        className="w-32 h-32 object-contain border border-neutral-200 p-1 rounded bg-white shadow-sm print:border-none print:p-0 print:shadow-none"
                      />
                    ) : (
                      <div className="w-32 h-32 flex flex-col items-center justify-center text-[9px] text-neutral-400 border border-neutral-200 rounded p-2">
                        <Loader2 className="w-4 h-4 animate-spin text-komazi-coral mb-1" />
                        <span>Memuat QR...</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[8px] text-neutral-500 italic mt-0.5">
                    Scan via BCA, Mandiri, GoPay, Dana dll.
                  </p>
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-neutral-400 my-3"></div>

            {/* Footer Note & Barcode Mock */}
            <div className="text-center space-y-1 text-[10px] text-neutral-600">
              <p className="font-bold text-black">{settings?.receiptFooter || 'Terima Kasih Atas Kunjungan Anda!'}</p>
              {settings?.wifiName && (
                <p>WiFi: {settings.wifiName} | Pass: {settings.wifiPass || '-'}</p>
              )}
              <p className="text-[9px]">Follow IG: @komazicoffee</p>

              {/* Barcode Mock visual */}
              <div className="pt-2 flex justify-center">
                <div className="tracking-[4px] font-mono text-[9px] text-neutral-800">
                  ||||| | |||| ||| ||||| |||| || |
                </div>
              </div>
              <p className="text-[8px] text-neutral-500 font-mono tracking-widest">
                {order.invoiceNo || order.id}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (Hidden on print) */}
        <div className="p-4 border-t border-komazi-border bg-komazi-surface space-y-3 print:hidden shrink-0">
          {/* Printer Connection Status Banner */}
          {isConnected ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-success/10 border border-success/30 text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-success shrink-0 animate-pulse" />
                <span className="font-semibold text-success truncate">
                  Printer: {connectedDeviceName || 'Printer Thermal'}
                </span>
              </div>
              <span className="text-[10px] text-success/90 font-bold bg-success/20 px-2 py-0.5 rounded shrink-0">
                TERHUBUNG
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
              <div className="flex items-center gap-2 text-amber-300 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span className="truncate">Printer belum terhubung</span>
              </div>
              <button
                type="button"
                onClick={openBluetoothModal}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-[11px] shrink-0 transition-colors shadow-sm active:scale-95"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Hubungkan</span>
              </button>
            </div>
          )}

          {/* WhatsApp sender row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MessageCircle className="w-3.5 h-3.5 text-success absolute left-3 top-2.5" />
              <input
                type="tel"
                placeholder="No. WhatsApp Pelanggan (08...)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs text-komazi-text font-mono focus:border-success focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3.5 py-1.5 rounded-xl bg-success/20 hover:bg-success/30 text-success border border-success/30 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Kirim WA</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 text-komazi-muted hover:text-white font-semibold text-xs transition-colors"
            >
              Tutup
            </button>

            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrint}
              className="flex-1 py-2.5 rounded-xl bg-komazi-coral hover:bg-komazi-coral-dark text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mencetak...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Cetak Struk</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
