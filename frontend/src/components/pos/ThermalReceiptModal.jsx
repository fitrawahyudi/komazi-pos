import React, { useState, useEffect } from 'react';
import { formatRupiah, formatDateTime, formatOrderType } from '../../utils/format';
import {
  Printer,
  X,
  Receipt,
  Bluetooth,
  AlertCircle,
  Loader2,
  QrCode,
  CheckCircle2,
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
import LoadingButton from '../ui/loading/LoadingButton';

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
    recordPrintJob,
    activeReceiptPrinter,
    kickCashDrawer,
  } = usePrinterStore();
  const { settings } = useSettingsStore();

  const [paperWidth, setPaperWidth] = useState(defaultPaperWidth || '58mm');
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

  const displayPaymentMethod = (() => {
    if (resolvedPaymentMethod === 'CASH') return 'TUNAI';
    if (resolvedPaymentMethod.includes('QRIS')) return 'QRIS';
    if (resolvedPaymentMethod.includes('TRANSFER')) {
      const ref = order?.payments?.[0]?.reference;
      if (ref && ref.includes(':')) {
        return `TRANSFER (${ref.split(':')[0]})`;
      }
      return 'TRANSFER BANK';
    }
    return resolvedPaymentMethod;
  })();

  const isQrisPayment =
    resolvedPaymentMethod.includes('QRIS') ||
    resolvedPaymentMethod.includes('QR') ||
    Boolean(order?.payments?.some((p) => String(p?.method || '').toUpperCase().includes('QRIS')));

  const isUnpaidBill =
    ['OPEN', 'PENDING_PAYMENT', 'HOLD', 'PENDING', 'SERVED'].includes(String(order?.status || '').toUpperCase()) &&
    (!order?.payments || order?.payments.length === 0 || !order?.paidAt);

  // Toggle QRIS on receipt: defaults to true if QRIS payment, or explicitly flagged
  const [showQrisOnReceipt, setShowQrisOnReceipt] = useState(
    isQrisPayment || (isUnpaidBill && isQrisPayment) || order?.showQris === true
  );

  useEffect(() => {
    setShowQrisOnReceipt(isQrisPayment || (isUnpaidBill && isQrisPayment) || order?.showQris === true);
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
        'Struk untuk pesanan ini sudah pernah dicetak. Apakah Anda ingin mencetak ulang (reprint)?'
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
        await new Promise((r) => setTimeout(r, 120));
      } catch (e) {
        console.warn('[Receipt] QR prep notice:', e);
      }
    }

    // A. Direct Hardware Print (Bluetooth or USB)
    if (isConnected && (connectionType === 'BLUETOOTH' || connectionType === 'USB')) {
      setIsPrinting(true);
      try {
        toast.info('Mengirim struk ke printer thermal...');
        const bytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
          showQris: showQrisOnReceipt,
          kickCashDrawer,
        });
        const copies = printCopies || 1;
        for (let i = 0; i < copies; i++) {
          const ok = await sendRawData(bytes);
          if (!ok) throw new Error('Pengiriman data printer terputus');
          if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
        }
        printQueue.printedJobIds.add(orderJobId);
        toast.success('Struk berhasil dicetak langsung ke printer!');
        await recordPrintJob({
          printerProfileId: activeReceiptPrinter?.id || null,
          orderId: order?.id || null,
          documentType: 'RECEIPT',
          status: 'PRINTED',
          requestedBy: order?.cashierName || order?.cashier?.name || order?.shift?.cashier?.name || 'Kasir',
        });
        setIsPrinting(false);
        return;
      } catch (err) {
        setIsPrinting(false);
        toast.error(`Gagal cetak hardware: ${err.message}`);
        await recordPrintJob({
          printerProfileId: activeReceiptPrinter?.id || null,
          orderId: order?.id || null,
          documentType: 'RECEIPT',
          status: 'FAILED',
          errorCode: 'ERR_PRINT_FAILED',
          errorMessage: err.message,
          requestedBy: order?.cashierName || order?.cashier?.name || order?.shift?.cashier?.name || 'Kasir',
        });
        return;
      }
    }

    // B. Bluetooth selected but not yet connected
    if (connectionType === 'BLUETOOTH' && !isConnected) {
      setIsPrinting(true);
      try {
        const res = await connectBluetooth();
        if (res && res.success) {
          toast.info('Mengirim struk ke printer thermal...');
          const bytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
            showQris: showQrisOnReceipt,
            kickCashDrawer,
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

    // C. Default Universal Browser / System Printer Dialog
    printQueue.printedJobIds.add(orderJobId);

    // On Android Native, route to Android PrintManager HTML service
    if (isAndroid || isNative) {
      const receiptElem = document.getElementById('printable-receipt');
      if (receiptElem) {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: 'Courier New', monospace; width: ${paperWidth}; margin: 0 auto; padding: 4px; font-size: 11px; color: black; line-height: 1.25; }
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
        return;
      }
      const timer = setTimeout(() => {
        handlePrint();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrintOnCheckout, isQrReady, showQrisOnReceipt]);

  if (!order) return null;

  const cols = paperWidth === '80mm' ? 48 : 32;
  const dividerText = '-'.repeat(cols);
  const cashReceived = order.cashReceived || order.payments?.[0]?.tendered;
  const cashChange = order.cashChange ?? order.payments?.[0]?.change;
  const footerText = settings?.receiptFooter && settings.receiptFooter.trim()
    ? settings.receiptFooter.trim()
    : 'Terima Kasih Atas Kunjungan Anda!';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="min-h-full flex items-center justify-center">
        <div className="w-full max-w-lg rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] my-auto">
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
            </div>
          </div>

          {/* Scrollable Receipt Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-900/90 flex justify-center items-start">
            {/* THE RECEIPT PAPER (WYSIWYG 1:1 Monospace POS Receipt) */}
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
              {/* Store Header */}
              <div className="text-center space-y-0.5 mb-2">
                {settings?.receiptShowStoreName !== false && (
                  <div className="text-sm font-bold tracking-wider uppercase text-neutral-950 font-mono">
                    {settings?.storeName || 'KOMAZI COFFEE'}
                  </div>
                )}
                {settings?.receiptShowTagline !== false && settings?.storeTagline && settings.storeTagline.trim() ? (
                  <div className="text-[10px] text-neutral-700">{settings.storeTagline.trim()}</div>
                ) : null}
                {settings?.receiptShowAddress !== false && settings?.address && settings.address.trim() ? (
                  <div className="text-[10px] text-neutral-700">{settings.address.trim()}</div>
                ) : null}
                {settings?.receiptShowPhone !== false && settings?.phone && settings.phone.trim() ? (
                  <div className="text-[10px] text-neutral-700">Telp: {settings.phone.trim()}</div>
                ) : null}
                {settings?.receiptShowHeader !== false && (settings?.headerText || settings?.receiptHeader) && (settings.headerText || settings.receiptHeader).trim() ? (
                  <div className="text-[10px] font-bold text-neutral-900 mt-1">
                    *** {(settings.headerText || settings.receiptHeader).trim()} ***
                  </div>
                ) : null}

                {order.isBillCheck && (
                  <div className="font-bold text-[10px] text-neutral-950 tracking-wider uppercase my-1">
                    *** TAGIHAN SEMENTARA (BILL) ***
                  </div>
                )}
              </div>

              {/* Monospace Divider */}
              <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                {dividerText}
              </div>

              {/* Metadata */}
              <div className="space-y-0.5 text-[10px]">
                {order.isBillCheck && (
                  <div className="flex justify-between font-bold text-neutral-950">
                    <span>Status:</span>
                    <span>BELUM LUNAS</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-700">No. Faktur:</span>
                  <span className="font-bold text-neutral-950">{order.invoiceNo || `KMZ-${order.id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-700">Tanggal:</span>
                  <span className="text-neutral-950">{formatDateTime(order.createdAt || new Date().toISOString())}</span>
                </div>
                {settings?.receiptShowCashier !== false && (
                  <div className="flex justify-between">
                    <span className="text-neutral-700">Kasir:</span>
                    <span className="text-neutral-950">{order?.cashierName || order?.cashier?.name || order?.shift?.cashier?.name || 'Kasir Bertugas'}</span>
                  </div>
                )}
                {settings?.receiptShowCustomer !== false && (
                  <div className="flex justify-between">
                    <span className="text-neutral-700">Pelanggan:</span>
                    <span className="text-neutral-950">{order.customerName || 'Tamu Umum'}</span>
                  </div>
                )}
                {settings?.receiptShowTable !== false && (
                  <div className="flex justify-between font-bold">
                    <span className="text-neutral-700">Layanan:</span>
                    <span className="text-neutral-950">
                      {formatOrderType(order.orderType || order.type)}{' '}
                      {order.tableNo ? `(Meja ${order.tableNo})` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Monospace Divider */}
              <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                {dividerText}
              </div>

              {/* Line Items */}
              <div className="space-y-1.5 my-1.5">
                {(order.items || []).map((item, idx) => {
                  const itemTotal = (item.qty || 1) * Number(item.price || item.unitPrice || 0);
                  const unitPrice = Number(item.price || item.unitPrice || 0);
                  const itemName = item.name || item.productName || 'Item';
                  const variantStr = item.variantName ? ` • ${item.variantName}` : '';
                  return (
                    <div key={idx} className="space-y-0.5 text-[10px]">
                      <div className="flex justify-between items-baseline font-bold text-neutral-950">
                        <span className="truncate pr-1">{itemName}</span>
                        <span className="shrink-0">{formatRupiah(itemTotal)}</span>
                      </div>
                      <div className="text-neutral-600 pl-2">
                        {item.qty} x {formatRupiah(unitPrice)}{variantStr}
                      </div>
                      {settings?.receiptShowNotes !== false && item.note && (
                        <div className="text-neutral-500 italic pl-2 text-[9px]">
                          * {item.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Monospace Divider */}
              <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                {dividerText}
              </div>

              {/* Financial Summary */}
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between text-neutral-800">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(order.subtotal || order.total || 0)}</span>
                </div>

                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-neutral-800">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(order.discount)}</span>
                  </div>
                )}

                {Number(order.tax) > 0 && (
                  <div className="flex justify-between text-neutral-800">
                    <span>PB1 / Pajak (10%):</span>
                    <span>{formatRupiah(order.tax)}</span>
                  </div>
                )}

                {Number(order.serviceFee) > 0 && (
                  <div className="flex justify-between text-neutral-800">
                    <span>Service Fee (5%):</span>
                    <span>{formatRupiah(order.serviceFee)}</span>
                  </div>
                )}

                {/* Monospace Divider */}
                <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                  {dividerText}
                </div>

                <div className="flex justify-between font-bold text-xs text-neutral-950">
                  <span>TOTAL:</span>
                  <span>{formatRupiah(order.total || order.grandTotal || 0)}</span>
                </div>

                {/* Monospace Divider */}
                <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                  {dividerText}
                </div>

                <div className="flex justify-between text-neutral-800">
                  <span>Metode Pembayaran:</span>
                  <span className="font-bold text-neutral-950">{displayPaymentMethod}</span>
                </div>

                {cashReceived ? (
                  <>
                    <div className="flex justify-between text-neutral-800">
                      <span>Bayar Tunai:</span>
                      <span>{formatRupiah(cashReceived)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-neutral-950">
                      <span>Kembalian:</span>
                      <span>{formatRupiah(cashChange || 0)}</span>
                    </div>
                  </>
                ) : null}

                {/* Dynamic QRIS */}
                {settings?.receiptShowQris !== false && showQrisOnReceipt && settings?.qrisEnabled !== false && (
                  <>
                    <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                      {dividerText}
                    </div>
                    <div className="text-center space-y-1 my-1.5">
                      <div className="font-bold text-[11px] text-neutral-950 uppercase tracking-wide">
                        QRIS
                      </div>
                      <div className="text-[10px] text-neutral-800">
                        Total Tagihan: {formatRupiah(order.total || order.grandTotal || 0)}
                      </div>
                      <div className="my-1.5 flex justify-center">
                        {receiptQrisSvg ? (
                          <div
                            className="w-28 h-28 flex items-center justify-center p-1 bg-white border border-neutral-200 rounded print:border-none print:p-0 [&_svg]:w-full [&_svg]:h-full"
                            dangerouslySetInnerHTML={{ __html: receiptQrisSvg }}
                          />
                        ) : receiptQrisUrl ? (
                          <img
                            src={receiptQrisUrl}
                            alt="QRIS Dinamis"
                            className="w-28 h-28 object-contain p-1 bg-white border border-neutral-200 rounded print:border-none print:p-0"
                          />
                        ) : (
                          <div className="w-28 h-28 flex flex-col items-center justify-center text-[9px] text-neutral-400 border border-neutral-200 rounded p-2">
                            <Loader2 className="w-4 h-4 animate-spin text-komazi-coral mb-1" />
                            <span>Memuat QR...</span>
                          </div>
                        )}
                      </div>
                      <div className="text-[9px] text-neutral-600">(Nominal otomatis terisi & terkunci)</div>
                    </div>
                  </>
                )}
              </div>

              {/* Monospace Divider */}
              <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                {dividerText}
              </div>

              {/* Footer Note & Barcode Mock */}
              <div className="text-center space-y-0.5 text-[9px] text-neutral-700 mt-2">
                {settings?.receiptShowFooter !== false && (
                  <div className="font-bold text-[10px] text-neutral-950 whitespace-pre-line">
                    {footerText}
                  </div>
                )}
                {settings?.receiptShowWifi !== false && settings?.wifiName && (
                  <div>WiFi: {settings.wifiName} | Pass: {settings.wifiPass || '-'}</div>
                )}
                <div>Follow IG: @komazicoffee</div>
                {settings?.receiptShowBarcode !== false && (
                  <>
                    <div className="tracking-[3px] font-mono text-[8px] text-neutral-800 pt-1 select-none">
                      ||||| | |||| ||| ||||| |||| || |
                    </div>
                    <div className="text-[8px] text-neutral-500 font-mono tracking-wider">
                      {order.invoiceNo || `KMZ-${order.id}`}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Modal Bottom Actions (Hidden on print) */}
          <div className="p-4 border-t border-komazi-border bg-komazi-surface space-y-3 print:hidden shrink-0">
            {/* Status Connection Badge */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-komazi-surface-2 border border-komazi-border text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {isConnected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-success shrink-0 animate-pulse" />
                    <span className="font-semibold text-komazi-text truncate">
                      {connectionType === 'BLUETOOTH' ? 'Bluetooth: ' : connectionType === 'USB' ? 'USB: ' : 'Printer: '}
                      {connectedDeviceName || 'Printer Thermal Siap'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-komazi-muted shrink-0" />
                    <span className="text-komazi-muted truncate">
                      Driver Cetak Browser / Sistem (Siap Cetak)
                    </span>
                  </>
                )}
              </div>

              {!isConnected && (
                <button
                  type="button"
                  onClick={openBluetoothModal}
                  className="text-[11px] font-semibold text-komazi-coral hover:underline shrink-0 ml-2"
                >
                  Hubungkan
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-komazi-surface-2 hover:bg-neutral-800 text-komazi-muted hover:text-white font-semibold text-xs transition-colors"
              >
                Tutup
              </button>

              <LoadingButton
                type="button"
                isLoading={isPrinting}
                loadingText="Mencetak..."
                variant="primary"
                size="sm"
                icon={Printer}
                onClick={handlePrint}
                className="flex-1 py-2.5 rounded-xl font-bold text-xs shadow-md"
              >
                Cetak Struk
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
