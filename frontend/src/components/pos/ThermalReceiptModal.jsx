import React, { useState, useEffect } from 'react';
import { formatRupiah, formatDateTime, formatOrderType, isDrinkItem, isKitchenItem, isBaristaItem } from '../../utils/format';
import { usePosStore } from '../../store/posStore';
import {
  Printer,
  X,
  Receipt,
  Bluetooth,
  Usb,
  AlertCircle,
  Loader2,
  QrCode,
  CheckCircle2,
  FileText,
  Copy,
  Coffee,
  ChefHat,
} from 'lucide-react';
import { toast } from '../../store/toastStore';
import { usePrinterStore, formatFriendlyPrinterError } from '../../store/printerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { buildOrderReceiptEscPos, buildKitchenTicketEscPos } from '../../utils/escpos';
import { generateDynamicQrisForOrder, generateQrDataUrl, generateQrSvgString } from '../../utils/qris';
import { useUiStore } from '../../store/uiStore';
import { printQueue } from '../../services/printQueue.service';
import { AndroidPrinter } from '../../adapters/printer/printer.android';
import { isAndroid, isNative } from '../../services/platform';
import LoadingButton from '../ui/loading/LoadingButton';

export default function ThermalReceiptModal({ order, onClose, initialType = 'customer' }) {
  const { openBluetoothModal, openUsbModal } = useUiStore();
  const {
    paperWidth: defaultPaperWidth,
    connectionType,
    setConnectionType,
    isConnected,
    connectedDeviceName,
    sendRawData,
    printCopies,
    autoPrintOnCheckout,
    autoPrintMerchantCopy,
    connectBluetooth,
    connectUsb,
    recordPrintJob,
    activeReceiptPrinter,
    kickCashDrawer,
  } = usePrinterStore();
  const { settings } = useSettingsStore();

  const [receiptType, setReceiptType] = useState(order?.initialReceiptType || initialType || 'customer');
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

  // Station item filtering (Barista vs Dapur)
  const { products = [], stations = [] } = usePosStore();
  const orderItems = Array.isArray(order?.items)
    ? order.items.filter((item) => item.status !== 'CANCELLED')
    : [];

  const baristaItems = orderItems.filter((item) => isBaristaItem(item, { products, stations }));
  const kitchenItems = orderItems.filter((item) => isKitchenItem(item, { products, stations }));

  const isKitchenStationTicket = receiptType === 'barista' || receiptType === 'kitchen';
  const isBaristaTicket = receiptType === 'barista';
  const isKitchenTicket = receiptType === 'kitchen';
  const stationTicketItems = isBaristaTicket ? baristaItems : isKitchenTicket ? kitchenItems : orderItems;

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

  const handlePrint = async (targetType = receiptType) => {
    const isBoth = targetType === 'both';
    const isMerch = targetType === 'merchant';
    const isBar = targetType === 'barista';
    const isKitchen = targetType === 'kitchen';
    const isStation = isBar || isKitchen;
    const orderJobId = String(order?.orderNumber || order?.invoiceNo || `ORD_${order?.id}`);
    const checkJobId = isMerch
      ? `${orderJobId}_PERTINGGAL`
      : isBar
        ? `${orderJobId}_BARISTA`
        : isKitchen
          ? `${orderJobId}_KITCHEN`
          : orderJobId;

    if (!isBoth && printQueue.hasPrinted(checkJobId)) {
      const typeLabel = isMerch
        ? 'pertinggal'
        : isBar
          ? 'tiket barista'
          : isKitchen
            ? 'tiket dapur'
            : 'pelanggan';
      const confirmReprint = window.confirm(
        `Struk/tiket ${typeLabel} untuk pesanan ini sudah pernah dicetak. Apakah Anda ingin mencetak ulang (reprint)?`
      );
      if (!confirmReprint) return;
    }

    // Ensure QR payload is ready before opening print if QR is enabled
    if (!isMerch && !isStation && showQrisOnReceipt && settings?.qrisEnabled !== false && (!receiptQrisUrl || !receiptQrisSvg)) {
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
        if (isBoth) {
          const custBytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
            showQris: showQrisOnReceipt,
            kickCashDrawer,
            isMerchantCopy: false,
          });
          const ok1 = await sendRawData(custBytes);
          if (!ok1) throw new Error('Pengiriman data struk pelanggan terputus');
          printQueue.printedJobIds.add(orderJobId);

          await new Promise((r) => setTimeout(r, 500));

          const merchBytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
            showQris: false,
            kickCashDrawer: false,
            isMerchantCopy: true,
          });
          const ok2 = await sendRawData(merchBytes);
          if (!ok2) throw new Error('Pengiriman data struk pertinggal terputus');
          printQueue.printedJobIds.add(`${orderJobId}_PERTINGGAL`);

          toast.success('Struk pelanggan & struk pertinggal berhasil dicetak!');
        } else if (isStation) {
          const itemsToPrint = isBar ? baristaItems : kitchenItems;
          const stationName = isBar ? 'BARISTA' : 'DAPUR';
          if (itemsToPrint.length === 0) {
            toast.warning(`Tidak ada item untuk stasiun ${stationName}`);
            setIsPrinting(false);
            return;
          }
          const bytes = buildKitchenTicketEscPos(order, {
            paperWidth,
            stationName,
            items: itemsToPrint,
          });
          const copies = printCopies || 1;
          for (let i = 0; i < copies; i++) {
            const ok = await sendRawData(bytes);
            if (!ok) throw new Error('Pengiriman data printer terputus');
            if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
          }
          printQueue.printedJobIds.add(checkJobId);
          toast.success(`Tiket ${stationName.toLowerCase()} berhasil dicetak langsung ke printer!`);
        } else {
          const bytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
            showQris: !isMerch && showQrisOnReceipt,
            kickCashDrawer,
            isMerchantCopy: isMerch,
          });
          const copies = printCopies || 1;
          for (let i = 0; i < copies; i++) {
            const ok = await sendRawData(bytes);
            if (!ok) throw new Error('Pengiriman data printer terputus');
            if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
          }
          printQueue.printedJobIds.add(checkJobId);
          toast.success(`Struk ${isMerch ? 'pertinggal' : 'pelanggan'} berhasil dicetak langsung ke printer!`);
        }

        await recordPrintJob({
          printerProfileId: activeReceiptPrinter?.id || null,
          orderId: order?.id || null,
          documentType: isMerch
            ? 'MERCHANT_RECEIPT'
            : isBar
              ? 'BARISTA_TICKET'
              : isKitchen
                ? 'KITCHEN_TICKET'
                : 'RECEIPT',
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
          documentType: isMerch
            ? 'MERCHANT_RECEIPT'
            : isBar
              ? 'BARISTA_TICKET'
              : isKitchen
                ? 'KITCHEN_TICKET'
                : 'RECEIPT',
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
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        toast.warning(
          'Akses Bluetooth dibatasi browser pada koneksi HTTP. Silakan gunakan mode "Driver Sistem" atau buka via localhost/HTTPS.'
        );
        openBluetoothModal();
        return;
      }
      setIsPrinting(true);
      try {
        const res = await connectBluetooth();
        if (res && res.success) {
          toast.info('Mengirim struk ke printer thermal...');
          if (isBoth) {
            const custBytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
              showQris: showQrisOnReceipt,
              kickCashDrawer,
              isMerchantCopy: false,
            });
            await sendRawData(custBytes);
            await new Promise((r) => setTimeout(r, 500));
            const merchBytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
              showQris: false,
              kickCashDrawer: false,
              isMerchantCopy: true,
            });
            await sendRawData(merchBytes);
            toast.success('Struk pelanggan & pertinggal berhasil dicetak!');
          } else if (isStation) {
            const itemsToPrint = isBar ? baristaItems : kitchenItems;
            const stationName = isBar ? 'BARISTA' : 'DAPUR';
            if (itemsToPrint.length === 0) {
              toast.warning(`Tidak ada item untuk stasiun ${stationName}`);
              setIsPrinting(false);
              return;
            }
            const bytes = buildKitchenTicketEscPos(order, {
              paperWidth,
              stationName,
              items: itemsToPrint,
            });
            await sendRawData(bytes);
            toast.success(`Tiket ${stationName.toLowerCase()} berhasil dicetak!`);
          } else {
            const bytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
              showQris: !isMerch && showQrisOnReceipt,
              kickCashDrawer,
              isMerchantCopy: isMerch,
            });
            const copies = printCopies || 1;
            for (let i = 0; i < copies; i++) {
              const ok = await sendRawData(bytes);
              if (!ok) throw new Error('Pengiriman data printer terputus');
              if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
            }
            toast.success(`Struk ${isMerch ? 'pertinggal' : 'pelanggan'} berhasil dicetak langsung ke printer!`);
          }
          printQueue.printedJobIds.add(checkJobId);
        } else if (res && res.needSelectDevice) {
          openBluetoothModal();
        } else if (res && !res.cancelled && res.message) {
          if (!res.message.toLowerCase().includes('user gesture') && !res.message.toLowerCase().includes('klik langsung')) {
            toast.warning(formatFriendlyPrinterError(res.message));
          }
          openBluetoothModal();
        }
      } catch (err) {
        toast.info('Silakan hubungkan printer Bluetooth Anda.');
        openBluetoothModal();
      } finally {
        setIsPrinting(false);
      }
      return;
    }

    // C. USB selected but not yet connected
    if (connectionType === 'USB' && !isConnected) {
      if (typeof window !== 'undefined' && window.isSecureContext === false && !navigator?.usb && !navigator?.serial) {
        toast.warning(
          'Fitur WebUSB/Serial dibatasi browser pada koneksi HTTP. Silakan gunakan mode "Driver Sistem" atau buka via localhost/HTTPS.'
        );
        openUsbModal();
        return;
      }
      setIsPrinting(true);
      try {
        const res = await connectUsb();
        if (res && res.success) {
          toast.info('Mengirim struk ke printer thermal USB...');
          if (isBoth) {
            const custBytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
              showQris: showQrisOnReceipt,
              kickCashDrawer,
              isMerchantCopy: false,
            });
            await sendRawData(custBytes);
            await new Promise((r) => setTimeout(r, 500));
            const merchBytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
              showQris: false,
              kickCashDrawer: false,
              isMerchantCopy: true,
            });
            await sendRawData(merchBytes);
            toast.success('Struk pelanggan & pertinggal berhasil dicetak!');
          } else if (isStation) {
            const itemsToPrint = isBar ? baristaItems : kitchenItems;
            const stationName = isBar ? 'BARISTA' : 'DAPUR';
            if (itemsToPrint.length === 0) {
              toast.warning(`Tidak ada item untuk stasiun ${stationName}`);
              setIsPrinting(false);
              return;
            }
            const bytes = buildKitchenTicketEscPos(order, {
              paperWidth,
              stationName,
              items: itemsToPrint,
            });
            await sendRawData(bytes);
            toast.success(`Tiket ${stationName.toLowerCase()} berhasil dicetak!`);
          } else {
            const bytes = buildOrderReceiptEscPos(order, settings, paperWidth, {
              showQris: !isMerch && showQrisOnReceipt,
              kickCashDrawer,
              isMerchantCopy: isMerch,
            });
            const copies = printCopies || 1;
            for (let i = 0; i < copies; i++) {
              const ok = await sendRawData(bytes);
              if (!ok) throw new Error('Pengiriman data printer terputus');
              if (i < copies - 1) await new Promise((r) => setTimeout(r, 400));
            }
            toast.success(`Struk ${isMerch ? 'pertinggal' : 'pelanggan'} berhasil dicetak langsung ke printer!`);
          }
          printQueue.printedJobIds.add(checkJobId);
        } else if (res && !res.cancelled) {
          openUsbModal();
        }
      } catch (err) {
        toast.info('Silakan hubungkan printer USB Anda.');
        openUsbModal();
      } finally {
        setIsPrinting(false);
      }
      return;
    }

    // D. Default Universal Browser / System Printer Dialog
    if (targetType !== receiptType && !isBoth) {
      setReceiptType(targetType);
      await new Promise((r) => setTimeout(r, 100));
    }

    printQueue.printedJobIds.add(checkJobId);

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
        const prefix = isMerch ? 'Pertinggal_' : isBar ? 'Barista_' : isKitchen ? 'Dapur_' : '';
        await AndroidPrinter.printSystemHtml(html, `Struk_${prefix}${orderJobId}`);
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
      // Web Bluetooth & WebUSB/Serial memerlukan interaksi pengguna jika belum terhubung
      if ((connectionType === 'BLUETOOTH' || connectionType === 'USB') && !isConnected) {
        return;
      }
      const timer = setTimeout(() => {
        handlePrint(autoPrintMerchantCopy ? 'both' : 'customer');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrintOnCheckout, autoPrintMerchantCopy, isConnected, connectionType, isQrReady, showQrisOnReceipt]);

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
        <div className="w-full max-w-4xl lg:max-w-5xl rounded-2xl bg-komazi-surface border border-komazi-border shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[calc(100dvh-2rem)] my-auto">

          {/* ─── KOLOM KIRI: STAGE PRATINJAU KERTAS STRUK (WYSIWYG 1:1) ─── */}
          <div className="flex-1 md:w-7/12 lg:w-3/5 bg-neutral-950 flex flex-col border-b md:border-b-0 md:border-r border-komazi-border min-h-0 overflow-hidden">
            {/* Canvas Stage Header */}
            <div className="px-4 py-3 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-neutral-200">
                  Pratinjau Kertas Struk
                </span>
              </div>
            </div>

            {/* Scrollable Receipt Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center items-start">
              {/* THE RECEIPT PAPER (WYSIWYG 1:1 Monospace POS Receipt) */}
              <div
                id="printable-receipt"
                className={`bg-white text-black font-mono text-[11px] leading-[1.3] shadow-2xl rounded-sm p-4 sm:p-5 select-text print:m-0 print:p-0 print:shadow-none transition-all ${paperWidth === '58mm' ? 'w-[290px] max-w-[290px] receipt-58mm' : 'w-[390px] max-w-[390px] receipt-80mm'
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

                  {order.isBillCheck && !isKitchenStationTicket ? (
                    <div className="font-bold text-[10px] text-neutral-950 tracking-wider uppercase my-1">
                      *** TAGIHAN SEMENTARA (BILL) ***
                    </div>
                  ) : receiptType === 'merchant' ? (
                    <div className="font-bold text-[10px] text-neutral-950 tracking-wider uppercase my-1 bg-neutral-100 py-1 border-y border-dashed border-neutral-400">
                      *** STRUK PERTINGGAL ***
                    </div>
                  ) : isBaristaTicket ? (
                    <div className="font-bold text-[11px] text-neutral-950 tracking-wider uppercase my-1 bg-neutral-100 py-1 border-y-2 border-dashed border-neutral-800">
                      *** TIKET BARISTA (BAR) ***
                    </div>
                  ) : isKitchenTicket ? (
                    <div className="font-bold text-[11px] text-neutral-950 tracking-wider uppercase my-1 bg-neutral-100 py-1 border-y-2 border-dashed border-neutral-800">
                      *** TIKET DAPUR (KITCHEN) ***
                    </div>
                  ) : null}
                </div>

                {/* Monospace Divider */}
                <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                  {dividerText}
                </div>

                {/* Metadata */}
                <div className="space-y-0.5 text-[10px]">
                  {order.isBillCheck && !isKitchenStationTicket && (
                    <div className="flex justify-between font-bold text-neutral-950">
                      <span>Status:</span>
                      <span>BELUM LUNAS</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-neutral-700">No. Invoice:</span>
                    <span className="font-bold text-neutral-950">{order.invoiceNo || `KMZ-${order.id}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-700">{isKitchenStationTicket ? 'Waktu:' : 'Tanggal:'}</span>
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

                {isKitchenStationTicket ? (
                  <>
                    {/* Line Items for Kitchen/Barista Station (Tiket Kerja Tanpa Harga) */}
                    <div className="space-y-2 my-1.5">
                      {stationTicketItems.length === 0 ? (
                        <div className="text-center text-neutral-500 py-3 italic text-[10px]">
                          Tidak ada item {isBaristaTicket ? 'minuman / bar' : 'makanan / dapur'} pada pesanan ini.
                        </div>
                      ) : (
                        stationTicketItems.map((item, idx) => {
                          const itemName = item.name || item.productName || 'Item';
                          return (
                            <div key={idx} className="space-y-0.5 text-[11px] border-b border-dashed border-neutral-300 pb-1.5 last:border-b-0">
                              <div className="flex items-baseline font-bold text-neutral-950 text-xs">
                                <span className="w-7 shrink-0">{item.qty}x</span>
                                <span className="truncate">{itemName}</span>
                              </div>
                              {item.variantName && (
                                <div className="text-neutral-700 pl-7 text-[10px]">
                                  Varian: {item.variantName}
                                </div>
                              )}
                              {item.modifiers && (
                                <div className="text-neutral-700 pl-7 text-[10px]">
                                  Mod: {item.modifiers}
                                </div>
                              )}
                              {item.note && (
                                <div className="text-neutral-950 font-bold pl-7 text-[10px] mt-0.5 bg-neutral-100 p-0.5 rounded">
                                  &gt;&gt; NOTE: {item.note}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Catatan Pesanan Khusus (Jika ada) */}
                    {(order.note || order.orderNote || order.notes) && (
                      <>
                        <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                          {dividerText}
                        </div>
                        <div className="text-[10px] space-y-0.5 bg-neutral-100 p-1.5 rounded">
                          <span className="font-bold text-neutral-950 block">Catatan Pesanan:</span>
                          <span className="text-neutral-800 italic">{order.note || order.orderNote || order.notes}</span>
                        </div>
                      </>
                    )}

                    {/* Monospace Divider */}
                    <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                      {dividerText}
                    </div>

                    {/* Ringkasan Total Item Tiket Kerja */}
                    <div className="text-center font-bold text-[10px] text-neutral-950 tracking-wider py-1 uppercase">
                      *** TOTAL: {stationTicketItems.reduce((acc, it) => acc + (Number(it.qty) || 1), 0)} ITEM UNTUK DISIAPKAN ***
                    </div>
                  </>
                ) : (
                  <>
                    {/* Line Items Struk Penjualan (Pelanggan / Pertinggal) */}
                    <div className="space-y-1.5 my-1.5">
                      {(orderItems || []).map((item, idx) => {
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
                        <div className="flex justify-between text-neutral-800 font-bold">
                          <span>Diskon{order.promoName ? ` (${order.promoName})` : ''}:</span>
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

                      {/* Dynamic QRIS (khusus struk pelanggan) */}
                      {receiptType !== 'merchant' && settings?.receiptShowQris !== false && showQrisOnReceipt && settings?.qrisEnabled !== false && (
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

                    {/* Monospace Divider & Footer (Khusus Struk Pelanggan) */}
                    {receiptType !== 'merchant' && (
                      <>
                        <div className="font-mono text-neutral-400 select-none overflow-hidden my-1 text-center font-normal tracking-tighter leading-none" aria-hidden="true">
                          {dividerText}
                        </div>

                        <div className="text-center space-y-0.5 text-[9px] text-neutral-700 mt-2">
                          {settings?.receiptShowFooter !== false && (
                            <div className="font-bold text-[10px] text-neutral-950 whitespace-pre-line">
                              {footerText}
                            </div>
                          )}
                          {settings?.receiptShowWifi !== false && settings?.wifiName && (
                            <div>WiFi: {settings.wifiName} | Pass: {settings.wifiPass || '-'}</div>
                          )}
                          {!footerText.toLowerCase().includes('follow ig') &&
                            !footerText.toLowerCase().includes('@komazi') &&
                            !footerText.toLowerCase().includes('instagram') && (
                              <div>Follow IG: @komazicoffee</div>
                            )}
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
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ─── KOLOM KANAN: PANEL KONTROL & PENGATURAN CETAK (INSPECTOR) ─── */}
          <div className="flex-1 md:w-5/12 lg:w-2/5 bg-komazi-surface flex flex-col justify-between print:hidden min-h-0 overflow-hidden">
            {/* Header Panel */}
            <div className="p-4 sm:p-5 border-b border-komazi-border flex items-center justify-between shrink-0 bg-komazi-surface-2/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-komazi-coral/15 border border-komazi-coral/30 flex items-center justify-center text-komazi-coral shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-komazi-text">Pengaturan Cetak</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-komazi-muted hover:text-white hover:bg-komazi-surface-2 transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body Controls */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* 1. Tipe Struk Selector (Cards) */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-komazi-muted uppercase tracking-wider block">
                  Jenis Struk
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Card: Pelanggan */}
                  <button
                    type="button"
                    onClick={() => setReceiptType('customer')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${receiptType === 'customer'
                        ? 'bg-komazi-coral/15 border-komazi-coral text-white shadow-xs'
                        : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:border-neutral-600 hover:text-neutral-200'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Receipt className={`w-4 h-4 ${receiptType === 'customer' ? 'text-komazi-coral' : 'text-komazi-muted'}`} />
                      {receiptType === 'customer' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-komazi-coral" />
                      )}
                    </div>
                    <div className="font-bold text-xs text-white">Struk Pelanggan</div>
                    <div className="text-[10px] text-komazi-muted mt-0.5 leading-tight">Untuk konsumen & QRIS</div>
                  </button>

                  {/* Card: Pertinggal */}
                  <button
                    type="button"
                    onClick={() => setReceiptType('merchant')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${receiptType === 'merchant'
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-xs'
                        : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:border-neutral-600 hover:text-neutral-200'
                      }`}
                    title="Struk Pertinggal / Salinan Kasir untuk Arsip"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <FileText className={`w-4 h-4 ${receiptType === 'merchant' ? 'text-amber-400' : 'text-komazi-muted'}`} />
                      {receiptType === 'merchant' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <div className="font-bold text-xs text-white">Struk Pertinggal</div>
                    <div className="text-[10px] text-komazi-muted mt-0.5 leading-tight">Arsip kasir & toko</div>
                  </button>

                  {/* Card: Barista */}
                  <button
                    type="button"
                    onClick={() => setReceiptType('barista')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${receiptType === 'barista'
                        ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-xs'
                        : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:border-neutral-600 hover:text-neutral-200'
                      }`}
                    title="Tiket Pesanan Barista / Minuman"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Coffee className={`w-4 h-4 ${receiptType === 'barista' ? 'text-cyan-400' : 'text-komazi-muted'}`} />
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${baristaItems.length > 0 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-neutral-800 text-neutral-500'
                          }`}>
                          {baristaItems.length}
                        </span>
                        {receiptType === 'barista' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                      </div>
                    </div>
                    <div className="font-bold text-xs text-white">Struk Barista</div>
                    <div className="text-[10px] text-komazi-muted mt-0.5 leading-tight">Tiket minuman (Bar)</div>
                  </button>

                  {/* Card: Dapur */}
                  <button
                    type="button"
                    onClick={() => setReceiptType('kitchen')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${receiptType === 'kitchen'
                        ? 'bg-orange-500/15 border-orange-500 text-white shadow-xs'
                        : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:border-neutral-600 hover:text-neutral-200'
                      }`}
                    title="Tiket Pesanan Dapur / Makanan"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <ChefHat className={`w-4 h-4 ${receiptType === 'kitchen' ? 'text-orange-400' : 'text-komazi-muted'}`} />
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${kitchenItems.length > 0 ? 'bg-orange-500/20 text-orange-300' : 'bg-neutral-800 text-neutral-500'
                          }`}>
                          {kitchenItems.length}
                        </span>
                        {receiptType === 'kitchen' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />
                        )}
                      </div>
                    </div>
                    <div className="font-bold text-xs text-white">Struk Dapur</div>
                    <div className="text-[10px] text-komazi-muted mt-0.5 leading-tight">Tiket makanan (Kitchen)</div>
                  </button>
                </div>
              </div>

              {/* 2. Format Kertas Thermal (58mm vs 80mm) */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-komazi-muted uppercase tracking-wider block">
                  Ukuran Kertas
                </label>
                <div className="grid grid-cols-2 gap-2 bg-komazi-surface-2 p-1 rounded-xl border border-komazi-border">
                  <button
                    type="button"
                    onClick={() => setPaperWidth('58mm')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${paperWidth === '58mm'
                        ? 'bg-komazi-surface text-white border border-komazi-border shadow-xs'
                        : 'text-komazi-muted hover:text-white'
                      }`}
                  >
                    <span>58 mm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperWidth('80mm')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${paperWidth === '80mm'
                        ? 'bg-komazi-surface text-white border border-komazi-border shadow-xs'
                        : 'text-komazi-muted hover:text-white'
                      }`}
                  >
                    <span>80 mm</span>
                  </button>
                </div>
              </div>

              {/* 3. Opsi Tambahan (QRIS Dinamis) */}
              {!isKitchenStationTicket && receiptType !== 'merchant' && settings?.qrisEnabled !== false && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-komazi-muted uppercase tracking-wider block">
                    Opsi Tambahan
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQrisOnReceipt(!showQrisOnReceipt)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${showQrisOnReceipt
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-komazi-surface-2 border-komazi-border text-komazi-muted hover:text-neutral-200'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <QrCode className="w-4 h-4 shrink-0 text-emerald-400" />
                      <div>
                        <div className="text-xs font-semibold text-white">Sertakan QRIS Dinamis</div>
                        <div className="text-[10px] text-komazi-muted">Konsumen dapat scan langsung di kertas struk</div>
                      </div>
                    </div>
                    <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${showQrisOnReceipt ? 'bg-emerald-500' : 'bg-neutral-700'}`}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${showQrisOnReceipt ? 'translate-x-3.5' : 'translate-x-0'}`} />
                    </div>
                  </button>
                </div>
              )}

              {/* 4. Pemilihan Jalur Cetak / Status Perangkat Printer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-komazi-muted uppercase tracking-wider block">
                    Jalur Cetak / Printer
                  </label>
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Aktif ({connectionType})
                    </span>
                  )}
                </div>

                {/* 3-Way Mode Selector: USB, Bluetooth, Driver Sistem */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-komazi-surface-2 rounded-xl border border-komazi-border text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectionType('USB');
                      if (!isConnected || connectionType !== 'USB') openUsbModal();
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${connectionType === 'USB'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                      }`}
                    title="Cetak langsung lewat kabel USB atau port Serial COM"
                  >
                    <Usb className="w-3.5 h-3.5 text-amber-400" />
                    <span>Kabel USB</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConnectionType('BLUETOOTH');
                      if (!isConnected || connectionType !== 'BLUETOOTH') openBluetoothModal();
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${connectionType === 'BLUETOOTH'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                      }`}
                    title="Cetak via Bluetooth thermal ESC/POS"
                  >
                    <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
                    <span>Bluetooth</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConnectionType('BROWSER');
                      toast.info('Mode Cetak Driver Sistem / Browser aktif');
                    }}
                    className={`py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${connectionType === 'BROWSER'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                      }`}
                    title="Cetak lewat driver printer Windows/Mac atau dialog browser (Bisa di HTTP)"
                  >
                    <Printer className="w-3.5 h-3.5 text-purple-400" />
                    <span>Driver Sistem</span>
                  </button>
                </div>

                {/* Status Perangkat & Tombol Hubungkan */}
                <div className="p-3 rounded-xl bg-komazi-surface-2 border border-komazi-border">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {isConnected ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          <span className="font-semibold text-emerald-400 truncate">
                            {connectionType === 'BLUETOOTH' ? 'Bluetooth: ' : connectionType === 'USB' ? 'USB: ' : 'Printer: '}
                            {connectedDeviceName || 'Printer Thermal Siap'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-neutral-500 shrink-0" />
                          <span className="font-medium text-komazi-muted truncate">
                            {connectionType === 'USB'
                              ? 'Kabel USB Belum Terhubung'
                              : connectionType === 'BLUETOOTH'
                                ? 'Bluetooth Belum Terhubung'
                                : 'Driver Cetak Browser (Universal - Siap)'}
                          </span>
                        </>
                      )}
                    </div>

                    {!isConnected && connectionType !== 'BROWSER' && (
                      <button
                        type="button"
                        onClick={connectionType === 'USB' ? openUsbModal : openBluetoothModal}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-komazi-coral hover:underline shrink-0 ml-2 cursor-pointer"
                      >
                        {connectionType === 'USB' ? <Usb className="w-3.5 h-3.5" /> : <Bluetooth className="w-3.5 h-3.5" />}
                        <span>Hubungkan</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Info jika diakses via HTTP non-localhost */}
                {typeof window !== 'undefined' && window.isSecureContext === false && (connectionType === 'BLUETOOTH' || connectionType === 'USB') && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2 leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-semibold block">Akses via Jaringan HTTP (Non-Secure Context)</span>
                      <span className="text-[10px] text-amber-400/90">
                        Browser membatasi direct hardware di HTTP. Pilih <strong>Driver Sistem</strong> untuk langsung mencetak, atau buka POS di <code>localhost</code> / pasang <code>HTTPS</code>.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Actions (Footer) */}
            <div className="p-4 sm:p-5 border-t border-komazi-border bg-komazi-surface-2/60 shrink-0 space-y-2">
              {/* Primary Print Button */}
              <LoadingButton
                type="button"
                isLoading={isPrinting}
                loadingText="Mencetak..."
                variant="primary"
                icon={Printer}
                onClick={() => handlePrint(receiptType)}
                disabled={isPrinting || (isKitchenStationTicket && stationTicketItems.length === 0)}
                className="w-full py-3 rounded-xl font-bold text-sm shadow-md"
              >
                {isKitchenStationTicket && stationTicketItems.length === 0
                  ? `Tidak Ada Item ${isBaristaTicket ? 'Barista' : 'Dapur'}`
                  : isBaristaTicket
                    ? 'Cetak Struk Barista'
                    : isKitchenTicket
                      ? 'Cetak Struk Dapur'
                      : receiptType === 'merchant'
                        ? 'Cetak Struk Pertinggal'
                        : 'Cetak Struk Pelanggan'}
              </LoadingButton>

              <div className="flex items-center gap-2">
                {isConnected && !isKitchenStationTicket && (
                  <button
                    type="button"
                    onClick={() => handlePrint('both')}
                    disabled={isPrinting}
                    className="flex-1 py-2.5 rounded-xl bg-komazi-surface hover:bg-neutral-800 border border-komazi-border text-xs font-bold text-komazi-text flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Cetak Struk Pelanggan & Pertinggal sekaligus"
                  >
                    <Copy className="w-3.5 h-3.5 text-komazi-teal-light" />
                    <span>Cetak Keduanya</span>
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
